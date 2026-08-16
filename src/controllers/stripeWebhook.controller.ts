import type { Request, Response } from "express";
import type Stripe from "stripe";
import { getStripe } from "../services/stripe";
import { handleStripeEvent } from "../services/paymentService";

export async function handleStripeWebhook(req: Request, res: Response) {
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!endpointSecret) {
    return res.status(500).json({ success: false, message: "STRIPE_WEBHOOK_SECRET missing on server" });
  }

  const signature = req.headers["stripe-signature"];
  if (typeof signature !== "string") {
    return res.status(400).send("Missing Stripe signature");
  }

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(req.body, signature, endpointSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid webhook signature";
    return res.status(400).send(`Webhook Error: ${message}`);
  }

  try {
    await handleStripeEvent(event);
    return res.json({ received: true });
  } catch (err) {
    console.error("Stripe webhook handler failed", err);
    return res.status(500).json({ success: false, message: "Webhook handler failed" });
  }
}

