import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "@clerk/backend";

type AuthedRequest = Request & { auth?: { clerkUserId: string } };

export async function requireClerkAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing Bearer token" });
    }

    const token = auth.slice("Bearer ".length);

    // You must have CLERK_SECRET_KEY in backend .env
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
    });

    if (!payload?.sub) {
      return res.status(401).json({ error: "Invalid token" });
    }

    req.auth = { clerkUserId: payload.sub };
    next();
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized" });
  }
}
