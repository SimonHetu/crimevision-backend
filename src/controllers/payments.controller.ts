import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import {
  createCheckoutSession,
  createSupportCheckoutSession,
  getOrCreateUserByClerkId,
  getPaymentStatus,
  type SupportTier,
} from "../services/paymentService";

const supportTiers = new Set<SupportTier>(["support_1", "support_5", "support_10"]);

async function requireCurrentUser(req: Request, res: Response) {
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return null;
  }

  return getOrCreateUserByClerkId(auth.userId);
}

export async function createStripeCheckoutSession(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await requireCurrentUser(req, res);
    if (!user) return;

    const priceId = typeof req.body?.priceId === "string" ? req.body.priceId : undefined;
    const session = await createCheckoutSession(user, priceId);

    return res.json({ success: true, id: session.id, url: session.url });
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Missing priceId")) {
      return res.status(400).json({ success: false, message: err.message });
    }

    next(err);
  }
}

export async function getStripePaymentStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await requireCurrentUser(req, res);
    if (!user) return;

    const status = await getPaymentStatus(user.id);

    return res.json({ success: true, ...status });
  } catch (err) {
    next(err);
  }
}

export async function createStripeSupportCheckoutSession(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = getAuth(req);
    const user = auth.userId ? await getOrCreateUserByClerkId(auth.userId) : null;

    const tier = typeof req.body?.tier === "string" ? req.body.tier : "";
    if (!supportTiers.has(tier as SupportTier)) {
      return res.status(400).json({
        success: false,
        message: "Invalid support tier. Use support_1, support_5, or support_10.",
      });
    }

    const session = await createSupportCheckoutSession(user, tier as SupportTier);

    return res.json({ success: true, id: session.id, url: session.url });
  } catch (err) {
    if (err instanceof Error && err.message.includes("STRIPE_SUPPORT_PRICE_")) {
      return res.status(500).json({ success: false, message: err.message });
    }

    next(err);
  }
}
