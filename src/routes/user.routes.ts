import { Router } from "express";
import { createUser, getUserById, updateUser, deleteUser } from "../controllers/user.controller";

const router = Router();

// POST /api/users
router.post("/", createUser);

// GET /api/users/:id
router.get("/:id", getUserById);

// PATCH /api/users/:id
router.patch("/:id", updateUser);

// DELETE /api/users/:id
router.delete("/:id", deleteUser);

export default router;