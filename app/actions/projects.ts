"use server";

import { db } from "../../src/lib/db";

export async function initDatabase() {
  try {
    // Check if tasks table already exists to skip basic creation
    const checkTasks = await db.query(`SELECT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tasks')`);
    const tablesExist = checkTasks.rows[0].exists;

    if (!tablesExist) {
      console.log("Initializing database for the first time...");
      // Enable UUID extension
      await db.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

      // Projects table
      await db.query(`
        CREATE TABLE IF NOT EXISTS projects (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          description TEXT,
          status TEXT NOT NULL DEFAULT 'Planning',
          start_date TIMESTAMPTZ,
          end_date TIMESTAMPTZ,
          creator_id TEXT NOT NULL REFERENCES "user"("id"),
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Project Members table
      await db.query(`
        CREATE TABLE IF NOT EXISTS project_members (
          project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          user_id TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
          role TEXT NOT NULL DEFAULT 'Member',
          joined_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (project_id, user_id)
        )
      `);

      // Tasks table
      await db.query(`
        CREATE TABLE IF NOT EXISTS tasks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          parent_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
          type TEXT NOT NULL DEFAULT 'small',
          title TEXT NOT NULL,
          description TEXT,
          status TEXT NOT NULL DEFAULT 'To Do',
          priority TEXT NOT NULL DEFAULT 'Medium',
          due_date TIMESTAMPTZ,
          assignee_id TEXT REFERENCES "user"("id"),
          creator_id TEXT NOT NULL REFERENCES "user"("id"),
          position DOUBLE PRECISION DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )
      `);
    }

    // Always check for missing columns (Migrations)
    // We can optimize this by checking one column first
    const checkColumn = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name='tasks' AND column_name='timer_status'`);
    if (checkColumn.rows.length === 0) {
      console.log("Applying migrations...");
      const migrations = [
        "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES tasks(id) ON DELETE CASCADE",
        "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'small'",
        "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS position DOUBLE PRECISION DEFAULT 0",
        "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deadline TIMESTAMPTZ",
        "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS total_time_spent INTEGER DEFAULT 0",
        "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS timer_started_at TIMESTAMPTZ",
        "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS timer_status TEXT DEFAULT 'idle'"
      ];

      for (const m of migrations) {
        try { await db.query(m); } catch (e) { }
      }

      // Constraints
      try { await db.query(`ALTER TABLE tasks ADD CONSTRAINT tasks_type_check CHECK (type IN ('big', 'small'))`); } catch (e) { }
      try { await db.query(`ALTER TABLE tasks ADD CONSTRAINT tasks_timer_status_check CHECK (timer_status IN ('idle', 'working', 'break'))`); } catch (e) { }
    }

    // Dependencies and Invitations (Checked separately for speed)
    await db.query(`
      CREATE TABLE IF NOT EXISTS task_dependencies (
        task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        blocked_by_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        PRIMARY KEY (task_id, blocked_by_id),
        CHECK (task_id != blocked_by_id)
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS invitations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'Member',
        token TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'pending',
        expires_at TIMESTAMPTZ NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '7 days'),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);

    return { success: true };
  } catch (error) {
    console.error("Database initialization error:", error);
    return { success: false, error };
  }
}

export async function deleteTask(taskId: string) {
  try {
    const taskResult = await db.query('SELECT parent_id FROM tasks WHERE id = $1', [taskId]);
    const parentId = taskResult.rows[0]?.parent_id;

    await db.query('DELETE FROM tasks WHERE id = $1', [taskId]);

    if (parentId) {
      await syncParentTaskStatus(parentId);
    }

    return { success: true };
  } catch (error) {
    return { success: false, error };
  }
}

export async function startTaskTimer(taskId: string, status: 'working' | 'break') {
  try {
    await db.query(`
      UPDATE tasks 
      SET timer_started_at = CURRENT_TIMESTAMP, timer_status = $1 
      WHERE id = $2
    `, [status, taskId]);
    return { success: true };
  } catch (error) {
    return { success: false, error };
  }
}

export async function stopTaskTimer(taskId: string) {
  try {
    const task = await db.query('SELECT timer_started_at, total_time_spent, timer_status FROM tasks WHERE id = $1', [taskId]);
    if (task.rows.length === 0) return { success: false };
    const { timer_started_at, total_time_spent, timer_status } = task.rows[0];

    if (!timer_started_at) {
      await db.query(`UPDATE tasks SET timer_status = 'idle' WHERE id = $1`, [taskId]);
      return { success: true };
    }

    const now = new Date();
    const started = new Date(timer_started_at);
    
    // Calculate difference in seconds
    let diffSeconds = Math.floor((now.getTime() - started.getTime()) / 1000);
    
    // Safety check: if clock drift is extreme (>24h), something is wrong, capped it for safety
    if (diffSeconds < 0) diffSeconds = 0;
    
    let newTotal = Number(total_time_spent || 0);
    // Only accumulate if the current session was 'working'
    if (timer_status === 'working') {
      newTotal += diffSeconds;
    }

    await db.query(`
      UPDATE tasks 
      SET timer_started_at = NULL, timer_status = 'idle', total_time_spent = $1 
      WHERE id = $2
    `, [newTotal, taskId]);

    return { success: true };
  } catch (error) {
    return { success: false, error };
  }
}

async function handleTimerAutomation(taskId: string, newStatus: string) {
  const timerStatus = newStatus === 'In Progress' ? 'working' : newStatus === 'Break' ? 'break' : 'idle';
  const isStarting = timerStatus !== 'idle';

  return await db.query(`
    UPDATE tasks 
    SET 
      total_time_spent = COALESCE(total_time_spent, 0) + CASE 
        WHEN timer_status = 'working' AND timer_started_at IS NOT NULL 
        THEN FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - timer_started_at)))
        ELSE 0 
      END,
      timer_status = $1,
      timer_started_at = CASE WHEN $2 = TRUE THEN CURRENT_TIMESTAMP ELSE NULL END,
      status = $3,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $4
    RETURNING parent_id
  `, [timerStatus, isStarting, newStatus, taskId]);
}

export async function getProjects(userId: string) {
  const result = await db.query(`
    SELECT p.* FROM projects p
    JOIN project_members pm ON p.id = pm.project_id
    WHERE pm.user_id = $1
    ORDER BY p.created_at DESC
  `, [userId]);
  return result.rows;
}

export async function createProject(data: { name: string; description: string; creator_id: string }) {
  try {
    const projectResult = await db.query(`
      INSERT INTO projects (name, description, creator_id)
      VALUES ($1, $2, $3)
      RETURNING id
    `, [data.name, data.description, data.creator_id]);

    const projectId = projectResult.rows[0].id;

    // Add creator as Admin
    await db.query(`
      INSERT INTO project_members (project_id, user_id, role)
      VALUES ($1, $2, 'Admin')
    `, [projectId, data.creator_id]);

    return { success: true, projectId };
  } catch (error) {
    return { success: false, error };
  }
}

export async function getProjectById(projectId: string, userId: string) {
  const result = await db.query(`
    SELECT p.*, pm.role FROM projects p
    JOIN project_members pm ON p.id = pm.project_id
    WHERE p.id = $1 AND pm.user_id = $2
  `, [projectId, userId]);
  return result.rows[0];
}

export async function getTasks(projectId: string) {
  const result = await db.query(`
    WITH subtask_stats AS (
      SELECT 
        parent_id, 
        COUNT(*) as total_count,
        SUM(CASE WHEN status = 'Done' THEN 1 ELSE 0 END) as done_count,
        SUM(total_time_spent) as total_time
      FROM tasks 
      WHERE project_id = $1 AND parent_id IS NOT NULL
      GROUP BY parent_id
    )
    SELECT 
      t.*, 
      u.name as assignee_name, 
      u.email as assignee_email,
      COALESCE(ss.total_count, 0) as subtask_count,
      COALESCE(ss.done_count, 0) as subtasks_done,
      CASE 
        WHEN t.type = 'big' THEN COALESCE(ss.total_time, 0)
        ELSE t.total_time_spent
      END as total_time_spent
    FROM tasks t
    LEFT JOIN "user" u ON t.assignee_id = u.id
    LEFT JOIN subtask_stats ss ON t.id = ss.parent_id
    WHERE t.project_id = $1
    ORDER BY t.position DESC, t.created_at DESC
  `, [projectId]);
  return result.rows;
}

export async function getTaskWithDependencies(taskId: string) {
  const task = await db.query(`
    SELECT t.*, u.name as assignee_name 
    FROM tasks t 
    LEFT JOIN "user" u ON t.assignee_id = u.id 
    WHERE t.id = $1
  `, [taskId]);
  
  const blockedBy = await db.query(`
    SELECT t.id, t.title, t.status 
    FROM tasks t
    JOIN task_dependencies td ON t.id = td.blocked_by_id
    WHERE td.task_id = $1
  `, [taskId]);

  const blocking = await db.query(`
    SELECT t.id, t.title, t.status 
    FROM tasks t
    JOIN task_dependencies td ON t.id = td.task_id
    WHERE td.blocked_by_id = $1
  `, [taskId]);

  return {
    ...task.rows[0],
    blocked_by_tasks: blockedBy.rows,
    blocking_tasks: blocking.rows
  };
}

export async function createTask(data: { 
  project_id: string; 
  title: string; 
  description?: string; 
  status?: string; 
  priority?: string; 
  creator_id: string;
  type?: 'big' | 'small';
  parent_id?: string;
  deadline?: string;
}) {
  try {
    const priority = data.priority || 'Medium';
    const weights: Record<string, number> = { 'Urgent': 4000, 'High': 3000, 'Medium': 2000, 'Low': 1000 };
    const baseWeight = weights[priority] || 2000;
    
    // Get max position in this priority tier to put it at the top
    const posResult = await db.query(`
      SELECT MAX(position) as max_pos FROM tasks 
      WHERE project_id = $1 AND priority = $2
    `, [data.project_id, priority]);
    
    const initialPosition = posResult.rows[0].max_pos 
      ? parseFloat(posResult.rows[0].max_pos) + 1 
      : baseWeight;

    const result = await db.query(`
      INSERT INTO tasks (project_id, title, description, status, priority, creator_id, type, parent_id, position, deadline)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      data.project_id, 
      data.title, 
      data.description || '', 
      data.status || 'To Do', 
      priority, 
      data.creator_id,
      data.type || 'small',
      data.parent_id || null,
      initialPosition,
      data.deadline || null
    ]);

    if (data.parent_id) {
      await syncParentTaskStatus(data.parent_id);
    }

    return { success: true, task: result.rows[0] };
  } catch (error) {
    console.error("Create task error:", error);
    return { success: false, error };
  }
}

export async function updateTaskStatus(taskId: string, status: string) {
  try {
    const result = await handleTimerAutomation(taskId, status);
    const parentId = result.rows[0]?.parent_id;

    if (parentId) {
      await syncParentTaskStatus(parentId);
    }

    return { success: true };
  } catch (error) {
    console.error("Update task status error:", error);
    return { success: false, error };
  }
}

export async function updateTask(taskId: string, data: Partial<{
  title: string;
  description: string;
  status: string;
  priority: string;
  assignee_id: string;
  deadline: string;
}>) {
  try {
    const sets: string[] = [];
    const values: any[] = [];
    let i = 1;

    Object.entries(data).forEach(([key, value]) => {
      sets.push(`${key} = $${i++}`);
      values.push(value);
    });

    if (sets.length === 0) return { success: true };

    values.push(taskId);
    
    // Use the optimized automation if status is being updated
    if (data.status) {
       await handleTimerAutomation(taskId, data.status);
    } else {
       await db.query(`
         UPDATE tasks SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${i}
       `, values);
    }

    // If status changed, sync parent and handle timer
    if (data.status) {
      await handleTimerAutomation(taskId, data.status);
      const taskResult = await db.query('SELECT parent_id FROM tasks WHERE id = $1', [taskId]);
      const parentId = taskResult.rows[0]?.parent_id;
      if (parentId) {
        await syncParentTaskStatus(parentId);
      }
    }

    return { success: true };
  } catch (error) {
    return { success: false, error };
  }
}

export async function addTaskDependency(taskId: string, blockedById: string) {
  try {
    await db.query(`
      INSERT INTO task_dependencies (task_id, blocked_by_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
    `, [taskId, blockedById]);
    
    // Update status to 'Blocked' if it was 'To Do' or 'In Progress'
    await db.query(`
      UPDATE tasks SET status = 'Blocked' WHERE id = $1 AND status IN ('To Do', 'In Progress')
    `, [taskId]);

    await handleTimerAutomation(taskId, 'Blocked');

    return { success: true };
  } catch (error) {
    return { success: false, error };
  }
}

export async function removeTaskDependency(taskId: string, blockedById: string) {
  try {
    await db.query(`
      DELETE FROM task_dependencies WHERE task_id = $1 AND blocked_by_id = $2
    `, [taskId, blockedById]);
    return { success: true };
  } catch (error) {
    return { success: false, error };
  }
}

async function syncParentTaskStatus(parentId: string) {
  // Optimized single-query parent sync
  await db.query(`
    UPDATE tasks 
    SET 
      status = CASE 
        WHEN (SELECT COUNT(*) FROM tasks WHERE parent_id = $1) = (SELECT COUNT(*) FROM tasks WHERE parent_id = $1 AND status = 'Done') THEN 'Done'
        WHEN (SELECT COUNT(*) FROM tasks WHERE parent_id = $1 AND (status = 'In Progress' OR status = 'Done' OR status = 'Blocked')) > 0 THEN 'In Progress'
        ELSE 'To Do'
      END,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
  `, [parentId]);
}

export async function getProjectMembers(projectId: string) {
  const result = await db.query(`
    SELECT pm.*, u.name, u.email, u.image
    FROM project_members pm
    JOIN "user" u ON pm.user_id = u.id
    WHERE pm.project_id = $1
  `, [projectId]);
  return result.rows;
}

export async function inviteUser(projectId: string, email: string, role: string = 'Member') {
  try {
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    await db.query(`
      INSERT INTO invitations (project_id, email, role, token)
      VALUES ($1, $2, $3, $4)
    `, [projectId, email, role, token]);
    
    // In a real app, send an email here.
    return { success: true, token };
  } catch (error) {
    return { success: false, error };
  }
}

export async function assignTask(taskId: string, userId: string | null) {
  try {
    await db.query(`
      UPDATE tasks SET assignee_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2
    `, [userId, taskId]);
    return { success: true };
  } catch (error) {
    return { success: false, error };
  }
}

export async function updateTaskPosition(taskId: string, newPosition: number, newStatus?: string) {
  try {
    if (newStatus) {
      await handleTimerAutomation(taskId, newStatus);
      
      // Update position separately since automation handles status/timer
      await db.query(`UPDATE tasks SET position = $1 WHERE id = $2`, [newPosition, taskId]);

      // Top-down sync: Update all subtasks to the new status
      const subtasks = await db.query('SELECT id FROM tasks WHERE parent_id = $1', [taskId]);
      for (const st of subtasks.rows) {
        await db.query('UPDATE tasks SET status = $1 WHERE id = $2', [newStatus, st.id]);
        await handleTimerAutomation(st.id, newStatus);
      }

      const taskResult = await db.query('SELECT parent_id FROM tasks WHERE id = $1', [taskId]);
      const parentId = taskResult.rows[0]?.parent_id;
      if (parentId) {
        await syncParentTaskStatus(parentId);
      }
    } else {
      await db.query(`
        UPDATE tasks SET position = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2
      `, [newPosition, taskId]);
    }
    return { success: true };
  } catch (error) {
    return { success: false, error };
  }
}
