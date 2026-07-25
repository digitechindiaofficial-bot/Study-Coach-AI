import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Strip sslmode from URL so pg's own SSL option takes full precedence.
// pg v8 treats sslmode=require as verify-full which breaks Supabase's cert.
const rawUrl = process.env.DATABASE_URL!;
const cleanUrl = rawUrl.replace(/[?&]sslmode=[^&]*/g, "").replace(/[?&]$/, "").replace(/\?$/, "");
const useSSL = process.env.NODE_ENV === "production" || rawUrl.includes("supabase.co");

export const pool = new Pool({
  connectionString: cleanUrl,
  ...(useSSL ? { ssl: { rejectUnauthorized: false } } : {}),
});
export const db = drizzle(pool, { schema });

export * from "./schema";
