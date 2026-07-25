import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import { clerkMiddleware } from "@clerk/express";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// ── Startup diagnostics (stderr — visible in Hostinger realtime log) ──────────
const pk = process.env.CLERK_PUBLISHABLE_KEY ?? "";
const skSet = !!process.env.CLERK_SECRET_KEY;
const nodeEnv = process.env.NODE_ENV ?? "unset";
console.error(`[startup] NODE_ENV=${nodeEnv}`);
console.error(`[startup] CLERK_PK prefix=${pk.substring(0, 24)}`);
console.error(`[startup] CLERK_SK set=${skSet}`);
console.error(`[startup] DATABASE_URL set=${!!process.env.DATABASE_URL}`);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// ── CORS ──────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  "https://govtguru.com",
  "https://www.govtguru.com",
];

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      if (process.env.NODE_ENV !== "production") return cb(null, true);
      cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Per-request debug (stderr) ────────────────────────────────────────────────
app.use((req, _res, next) => {
  const auth = req.headers["authorization"];
  const cookie = req.headers["cookie"] ?? "";
  const hasBearer = auth?.startsWith("Bearer ");
  const hasSession = cookie.includes("__session");
  console.error(`[req] ${req.method} ${req.path} bearer=${hasBearer} session=${hasSession}`);
  next();
});

// ── Clerk middleware ──────────────────────────────────────────────────────────
// authorizedParties: whitelist the frontend origin so Clerk doesn't reject
// tokens where azp=https://govtguru.com
app.use(
  clerkMiddleware({
    authorizedParties: ALLOWED_ORIGINS,
  }),
);

app.use("/api", router);

// ── Static + SPA fallback (production only) ───────────────────────────────────
if (process.env.NODE_ENV === "production") {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const staticDir = path.resolve(__dirname, "../../../artifacts/study-os/dist/public");
  app.use(express.static(staticDir));
  app.get("/{*path}", (_req, res) => {
    res.sendFile(path.join(staticDir, "index.html"));
  });
}

export default app;
