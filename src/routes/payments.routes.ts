import { Router } from "express";
import {
  createStripeCheckoutSession,
  getStripePaymentStatus,
} from "../controllers/payments.controller";

const router = Router();

router.post("/checkout-session", createStripeCheckoutSession);
router.get("/status", getStripePaymentStatus);

export default router;
