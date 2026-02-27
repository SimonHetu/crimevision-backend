import { Router } from "express";
import { loginLocal } from "../controllers/auth.controller";

const router = Router();

router.post("/login", loginLocal);

export default router;