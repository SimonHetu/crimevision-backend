import type { Request, Response, NextFunction } from "express";
import prisma from "../prisma";
import "dotenv/config";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

// =========================================================
// POST /api/auth/login
// =========================================================
export async function login(
  req: Request,
  res: Response,
  next: NextFunction
) {
    // Affichage
    console.log("▶ /api/auth/login called with body:", req.body);
  try {


    const { email, password } = req.body;

    // Validation champs requis
    if (!email || !password) {
      console.log((`😵 Connexion échouée pour: ${email} 🤔`))
      return res.status(400).json({
        success: false,
        message: "Champs requis: email, password",
      });
    }

    // Recherche dans DB avec le email
    const user = await prisma.user.findUnique({ where: { email } });

    // Validation que le email existe
    if (!user) {
      console.log((`😵 Connexion échouée pour: ${email} 🤔`))
      return res.status(401).json({
        success: false,
        message: "Identifiants invalides",
      });
    }

    // Comparaison du mot de passe
    const passwordOk = await bcrypt.compare(password, user.hashedPassword);
    if (!passwordOk) {
      console.log((`😵 Connexion échouée pour: ${email} 🤔`))
      return res.status(401).json({
        success: false,
        message: "Mot de passe invalide",
      });
    }

    // Générer un token JWT
    const token = jwt.sign(
      { userId: user.id },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    const { hashedPassword, ...safeUser } = user;

    console.log((`🗝 ✨ Connection réussit pour ${email} ✨`));
    res.json({
      success: true,
      token,
      user: safeUser,
      message: "Connexion Réussi ⚙✔"
    });
  } catch (err) {
    next(err);
  }
}
