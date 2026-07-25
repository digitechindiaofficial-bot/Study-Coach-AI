import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

// Detailed DB health — exposes actual pg error cause for debugging
router.get("/healthz/db", async (_req, res) => {
  try {
    const result = await pool.query("SELECT 1 AS ok");
    res.json({ status: "ok", row: result.rows[0] });
  } catch (err: any) {
    const cause = err?.cause ?? err;
    res.status(500).json({
      status: "error",
      message: err?.message ?? String(err),
      cause: cause?.message ?? String(cause),
      code: cause?.code,
      detail: cause?.detail,
      hint: cause?.hint,
    });
  }
});

export default router;
