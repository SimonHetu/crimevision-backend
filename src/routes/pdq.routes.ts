import { Router } from "express";
import { getPdqList, getPdqById } from "../controllers/pdq.controller";

const router = Router();

router.get("/", getPdqList);
router.get("/:id", getPdqById);

export default router;