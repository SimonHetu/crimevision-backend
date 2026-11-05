import { timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { runSpvmDailyImport } from "../services/spvmDailyImport";
import { spvmImportStore } from "../services/spvmImportStore";

export function createCronRouter(run = () => runSpvmDailyImport(spvmImportStore)) {
  const router = Router();
  router.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
  router.use((req, res, next) => {
    const secret = process.env.CRON_SECRET;
    const received = Buffer.from(req.get("authorization") ?? "");
    const expected = Buffer.from(`Bearer ${secret ?? ""}`);
    if (!secret || received.length !== expected.length || !timingSafeEqual(received, expected)) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    next();
  });
  router.get("/import-montreal", async (_req, res) => {
    try {
      const result = await run();
      console.info("SPVM daily import", JSON.stringify(result));
      return res.json({ success: true, ...result });
    } catch (error) {
      console.error("SPVM daily import failed", error);
      return res.status(500).json({ success: false, message: "SPVM daily import failed; inspect function logs. Progress from completed batches is preserved." });
    }
  });
  return router;
}

export default createCronRouter();
