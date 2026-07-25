import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import { clerkMiddleware } from "@clerk/express";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// ── Debug: log Clerk key presence at startup ──────────────────────────────────
const pk = process.env.CLERK_PUBLISHABLE_KEY ?? "";
const skSet = !!process.env.CLERK_SECRET_KEY;
logger.info({ clerkPkPrefix: pk.substring(0, 20), clerkSkSet: skSet }, "Clerk env check");

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  "https://govtguru.com",
  "https://www.govtguru.com",
];

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow same-origin (no Origin header) and listed origins
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      // In dev, allow any localhost / replit.dev origin
      if (process.env.NODE_ENV !== "production") return cb(null, true);
      cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Clerk auth middleware ─────────────────────────────────────────────────────
app.use(clerkMiddleware());

// ── Per-request debug: log auth header / cookie presence ─────────────────────
app.use((req, _res, next) => {
  const hasAuthHeader = !!req.headers["authorization"];
  const hasSessionCookie = !!(req.headers["cookie"] ?? "").includes("__session");
  req.log?.debug({ hasAuthHeader, hasSessionCookie }, "auth tokens present");
  next();
});

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
