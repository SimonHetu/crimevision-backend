import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { getIncidentById, getIncidents } from "../controllers/incident.controller"

const router = Router();

router.get("/", requireAuth, getIncidents);
router.get("/:id", getIncidentById);

export default router;