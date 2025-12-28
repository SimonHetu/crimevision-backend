import { Router } from "express";
import { login } from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.post("/login", login);

router.get("/me", requireAuth, (req, res) => {
  res.json({ ok: true, user: req.user });
});

export default router;
