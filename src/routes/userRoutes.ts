import { Router } from "express"
import { requireAuth } from "@clerk/express"
import { getCurrentUser } from "../controllers/userController"

const router = Router()

router.get("/me", requireAuth(), getCurrentUser)

export default router
