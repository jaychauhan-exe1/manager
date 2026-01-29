// app/actions.ts
"use server";
import { neon } from "@neondatabase/serverless";

export async function getData() {
    const DATABASE_URL = process.env.DATABASE_URL;
    if (!DATABASE_URL) {
        throw new Error("DATABASE_URL is not defined");
    }
    const sql = neon(DATABASE_URL);
    const data = await sql`SELECT 1`;
    return data;
}