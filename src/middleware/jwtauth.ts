import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { JwtPayload } from "jsonwebtoken";

export type AuthedRequest = Request & {
  auth?: { userId: number; role: string };
};

export function requireJwtAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Missing Bearer token" });
  }

  const token = header.slice("Bearer ".length);
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ success: false, message: "JWT_SECRET missing on server" });
  }

  try {
    const decoded = jwt.verify(token, secret) as JwtPayload;

    const userId = decoded.userId;
    const role = decoded.role;

    if (typeof userId !== "number" || typeof role !== "string") {
      return res.status(401).json({ success: false, message: "Invalid token payload" });
    }

    req.auth = { userId, role };
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid/expired token" });
  }
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.auth) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }
  if (req.auth.role !== "ADMIN") {
    return res.status(403).json({ success: false, message: "Admin only" });
  }
  next();
}