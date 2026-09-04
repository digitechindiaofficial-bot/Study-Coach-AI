import { resolve4 } from "dns/promises";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

const rawUrl = process.env.DATABASE_URL!;
const parsedDatabaseUrl = new URL(rawUrl);
const sslMode = parsedDatabaseUrl.searchParams.get("sslmode")?.toLowerCase();
// Strip sslmode= so pg's code-level ssl option takes full precedence
const cleanUrl = rawUrl
  .replace(/[?&]sslmode=[^&]*/g, "")
  .replace(/[?&]$/, "")
  .replace(/\?$/, "");
const sslRequested =
  sslMode === "require" ||
  sslMode === "verify-ca" ||
  sslMode === "verify-full";
const isSupabase =
  parsedDatabaseUrl.hostname.endsWith(".supabase.co") ||
  parsedDatabaseUrl.hostname.endsWith(".supabase.com");
// NODE_ENV does not describe the database server's TLS capabilities. Respect
// explicit connection-string intent and known hosted providers instead of
// forcing SSL for every production deployment (including local Hostinger DBs).
const useSSL = sslMode !== "disable" && (sslRequested || isSupabase);
console.error(
  `[db] Config host=${parsedDatabaseUrl.hostname} port=${parsedDatabaseUrl.port || "default"} ` +
    `sslmode=${sslMode ?? "unset"} ssl=${useSSL}`,
);

// Resolve hostname → IPv4 via A-record lookup (bypasses OS resolver which
// may prefer IPv6 on Hostinger, causing ECONNREFUSED on Supabase's IPv6 addr)
async function resolveToIPv4(url: string): Promise<string> {
  try {
    const parsed = new URL(url);
    const [ipv4] = await resolve4(parsed.hostname);
    console.log(`[db] Resolved ${parsed.hostname} → ${ipv4} (IPv4)`);
    parsed.hostname = ipv4;
    return parsed.toString();
  } catch (e) {
    console.warn("[db] IPv4 DNS resolution failed, using original hostname:", e);
    return url;
  }
}

// pool and db are assigned inside initDb() before the server starts accepting
// requests. ESM live-bindings ensure all importers see the assigned values.
export let pool!: InstanceType<typeof Pool>;
export let db!: ReturnType<typeof drizzle<typeof schema>>;

export async function initDb(): Promise<void> {
  const connectionString = await resolveToIPv4(cleanUrl);
  pool = new Pool({
    connectionString,
    ...(useSSL ? { ssl: { rejectUnauthorized: false } } : {}),
  });
  db = drizzle(pool, { schema });
}

export * from "./schema";
