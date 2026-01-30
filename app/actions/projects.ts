"use server";

import { db } from "../../src/lib/db";

export async function initDatabase() {
  try {
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

    // Tasks table (Updated)
    await db.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        parent_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
        type TEXT NOT NULL DEFAULT 'small' CHECK (type IN ('big', 'small')),
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'To Do',
        priority TEXT NOT NULL DEFAULT 'Medium',
        due_date TIMESTAMPTZ,
        assignee_id TEXT REFERENCES "user"("id"),
        creator_id TEXT NOT NULL REFERENCES "user"("id"),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Task Dependencies (Blocked by / Blocking)
    await db.query(`
      CREATE TABLE IF NOT EXISTS task_dependencies (
        task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        blocked_by_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        PRIMARY KEY (task_id, blocked_by_id),
        CHECK (task_id != blocked_by_id)
      )
    `);

    // Project Invitations
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

    // Add columns if they don't exist (for existing tables)
    await db.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='parent_id') THEN
          ALTER TABLE tasks ADD COLUMN parent_id UUID REFERENCES tasks(id) ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='type') THEN
          ALTER TABLE tasks ADD COLUMN type TEXT NOT NULL DEFAULT 'small' CHECK (type IN ('big', 'small'));
        END IF;
      END $$;
    `);

    return { success: true };
  } catch (error) {
    console.error("Failed to init db:", error);
    return { success: false, error };
  }
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
    SELECT t.*, u.name as assignee_name, u.email as assignee_email,
    (SELECT COUNT(*) FROM tasks WHERE parent_id = t.id) as subtask_count,
    (SELECT COUNT(*) FROM tasks WHERE parent_id = t.id AND status = 'Done') as subtasks_done
    FROM tasks t
    LEFT JOIN "user" u ON t.assignee_id = u.id
    WHERE t.project_id = $1
    ORDER BY t.created_at DESC
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
}) {
  try {
    const result = await db.query(`
      INSERT INTO tasks (project_id, title, description, status, priority, creator_id, type, parent_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      data.project_id, 
      data.title, 
      data.description || '', 
      data.status || 'To Do', 
      data.priority || 'Medium', 
      data.creator_id,
      data.type || 'small',
      data.parent_id || null
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
    await db.query(`
      UPDATE tasks SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2
    `, [status, taskId]);

    const taskResult = await db.query('SELECT parent_id FROM tasks WHERE id = $1', [taskId]);
    const parentId = taskResult.rows[0]?.parent_id;

    if (parentId) {
      await syncParentTaskStatus(parentId);
    }

    return { success: true };
  } catch (error) {
    return { success: false, error };
  }
}

export async function updateTask(taskId: string, data: Partial<{
  title: string;
  description: string;
  status: string;
  priority: string;
  assignee_id: string;
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
    await db.query(`
      UPDATE tasks SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${i}
    `, values);

    // If status changed, sync parent
    if (data.status) {
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
    // User wants "blocked by" as a status?
    await db.query(`
      UPDATE tasks SET status = 'Blocked' WHERE id = $1 AND status IN ('To Do', 'In Progress')
    `, [taskId]);

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
  const subtasksResult = await db.query('SELECT status FROM tasks WHERE parent_id = $1', [parentId]);
  const subtasks = subtasksResult.rows;

  if (subtasks.length === 0) return;

  const allDone = subtasks.every(s => s.status === 'Done');
  const anyInProgress = subtasks.some(s => s.status === 'In Progress' || s.status === 'Blocked');
  const someDone = subtasks.some(s => s.status === 'Done');

  let newStatus = 'To Do';
  if (allDone) {
    newStatus = 'Done';
  } else if (anyInProgress || someDone) {
    newStatus = 'In Progress';
  }

  await db.query('UPDATE tasks SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newStatus, parentId]);
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
