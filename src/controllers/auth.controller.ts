import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import type { Secret, SignOptions } from "jsonwebtoken";
import prisma from "../prisma";


export async function loginLocal(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "email/password requis" });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.passwordHash) {
      return res.status(401).json({ success: false, message: "Identifiants invalides" });
    }

    if (user.role !== "ADMIN") {
      return res.status(403).json({ success: false, message: "Admin only" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ success: false, message: "Identifiants invalides" });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET missing");

    const expiresIn: NonNullable<SignOptions["expiresIn"]> =
    (process.env.JWT_EXPIRES_IN ?? "8h") as NonNullable<SignOptions["expiresIn"]>;

    const token = jwt.sign(
    { userId: user.id, role: user.role },
    secret as Secret,
    { expiresIn }
    );

    return res.json({
      success: true,
      data: { token, user: { id: user.id, email: user.email, role: user.role } },
    });
  } catch (err) {
    next(err);
  }
}