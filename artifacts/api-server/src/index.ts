import { initDb } from "@workspace/db";
import app from "./app";
import { logger } from "./lib/logger";

// Resolve DB hostname to IPv4 before accepting any requests
await initDb();

const rawPort = process.env["PORT"] ?? "3000";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  logger.warn({ rawPort }, "Invalid PORT value, defaulting to 3000");
}

const resolvedPort = Number.isNaN(port) || port <= 0 ? 3000 : port;

app.listen(resolvedPort, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port: resolvedPort }, "Server listening");
});
