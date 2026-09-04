import { logger } from "./logger";

const DATABASE_ERROR_FIELDS = [
  "code",
  "severity",
  "detail",
  "hint",
  "where",
  "schema",
  "table",
  "column",
  "constraint",
  "syscall",
  "address",
  "port",
] as const;

type ErrorRecord = Record<string, unknown>;

function serializeError(error: unknown, depth = 0): ErrorRecord {
  if (depth > 3) return { message: "Nested error depth exceeded" };
  if (!(error instanceof Error)) return { message: String(error) };

  const source = error as unknown as ErrorRecord;
  const serialized: ErrorRecord = {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };

  for (const field of DATABASE_ERROR_FIELDS) {
    const value = source[field];
    if (value !== undefined && value !== null) serialized[field] = value;
  }

  if (source.cause !== undefined) {
    serialized.cause = serializeError(source.cause, depth + 1);
  }

  return serialized;
}

export function logDatabaseError(route: string, error: unknown): void {
  const databaseError = serializeError(error);

  logger.error({ route, databaseError }, "Database request failed");
  // Hostinger captures stderr even when structured logger output is unavailable.
  // Never include DATABASE_URL, credentials, request bodies, or query parameters.
  console.error(`[database-error] ${JSON.stringify({ route, ...databaseError })}`);
}