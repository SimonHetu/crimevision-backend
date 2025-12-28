import type { Request, Response, NextFunction } from "express";
import prisma from "../prisma";
import bcrypt from "bcrypt";
import { signAccessToken } from "../utils/jwt";

// =========================================================
// POST /api/auth/login
// =========================================================
export async function login(req: Request, res: Response, next: NextFunction) {
  // Affichage
  console.log("▶ /api/auth/login called with body:", req.body);

  try {
    const { email, password } = req.body;

    // Validation champs requis
    if (!email || !password) {
      console.log(`😵 Connexion échouée pour: ${email ?? "(no email)"} 🤔`);
      return res.status(400).json({
        success: false,
        message: "Champs requis: email, password",
      });
    }

    // Recherche dans DB avec le email
    const user = await prisma.user.findUnique({ where: { email } });

    // Validation que le email existe
    if (!user) {
      console.log(`😵 Connexion échouée pour: ${email} 🤔`);
      return res.status(401).json({
        success: false,
        message: "Identifiants invalides",
      });
    }

    // Comparaison du mot de passe
    const passwordOk = await bcrypt.compare(password, user.hashedPassword);
    if (!passwordOk) {
      console.log(`😵 Connexion échouée pour: ${email} 🤔`);
      return res.status(401).json({
        success: false,
        message: "Identifiants invalides",
      });
    }

    // Générer un token JWT (via utils/jwt.ts)
   const accessToken = signAccessToken({
      sub: String(user.id),
      email: user.email,
      role: (user as any).role,
    });


    // Ne jamais renvoyer le hashedPassword
    const { hashedPassword, ...safeUser } = user;

    console.log(`🗝 ✨ Connection réussie pour ${email} ✨`);
    return res.json({
      success: true,
      accessToken,
      user: safeUser,
      message: "Connexion Réussi ⚙✔",
    });
  } catch (err) {
    return next(err);
  }
}
