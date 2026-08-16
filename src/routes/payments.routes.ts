import { Router } from "express";
import {
  createStripeCheckoutSession,
  createStripeSupportCheckoutSession,
  getStripePaymentStatus,
} from "../controllers/payments.controller";

const router = Router();

router.post("/checkout-session", createStripeCheckoutSession);
router.post("/support-checkout-session", createStripeSupportCheckoutSession);
router.get("/status", getStripePaymentStatus);

export default router;
