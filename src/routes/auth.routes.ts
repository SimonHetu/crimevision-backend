import { Router } from "express";
import { login } from "../controllers/auth.controller";


// console.log("✅ auth.routes loaded");
const router = Router();

// POST /api/auth/login
router.post("/login", login);

export default router;
