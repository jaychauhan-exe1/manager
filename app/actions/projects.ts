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

    // Tasks table
    await db.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
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
    SELECT t.*, u.name as assignee_name, u.email as assignee_email 
    FROM tasks t
    LEFT JOIN "user" u ON t.assignee_id = u.id
    WHERE t.project_id = $1
    ORDER BY t.created_at DESC
  `, [projectId]);
  return result.rows;
}

export async function createTask(data: { 
  project_id: string; 
  title: string; 
  description?: string; 
  status?: string; 
  priority?: string; 
  creator_id: string;
}) {
  try {
    const result = await db.query(`
      INSERT INTO tasks (project_id, title, description, status, priority, creator_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      data.project_id, 
      data.title, 
      data.description || '', 
      data.status || 'To Do', 
      data.priority || 'Medium', 
      data.creator_id
    ]);
    return { success: true, task: result.rows[0] };
  } catch (error) {
    return { success: false, error };
  }
}

export async function updateTaskStatus(taskId: string, status: string) {
  try {
    await db.query(`
      UPDATE tasks SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2
    `, [status, taskId]);
    return { success: true };
  } catch (error) {
    return { success: false, error };
  }
}
