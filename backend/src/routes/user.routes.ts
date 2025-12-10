import { Router } from "express";
import { createUser, getUserById } from "../controllers/user.controller";

const router = Router();

// POST /api/users
router.post("/", createUser);

// GET /api/users/:id
router.get("/:id", getUserById);

export default router;