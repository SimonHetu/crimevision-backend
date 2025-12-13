import type { Request, Response, NextFunction } from "express";
import prisma from "../prisma";
import bcrypt from "bcrypt";

// =========================================================
// POST /api/users  => Création d'un utilisateur
// =========================================================
export async function createUser(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { email, name, pseudo, password } = req.body;

    // Normalisation 
    const emailTrimmed = email?.trim();
    const nameTrimmed = name?.trim();
    const pseudoTrimmed = pseudo?.trim();
    const passwordTrimmed = password?.trim();

    // Validation des champs requis
    if (!emailTrimmed || !nameTrimmed || !pseudoTrimmed || !passwordTrimmed) {
      return res.status(400).json({
        success: false,
        message: "Champs requis: email, name, pseudo, password",
      });
    }

    // Vérifier si l'email est déjà utilisé
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Un utilisateur avec cet email existe déjà",
      });
    }
    
    // Vérifier si le pseudo est déjà utilisé
    const existingPseudo = await prisma.user.findUnique({ where: { pseudo } });
    if (existingPseudo) {
      return res.status(409).json({
        success: false,
        message: "Ce pseudo est déjà utilisé",
      });
    }

    // Hashage du mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // Création de l'utilisateur dans la base de donnée avec Prisma
    const user = await prisma.user.create({
      data: {
        email: emailTrimmed,
        name: nameTrimmed,
        pseudo: pseudoTrimmed,
        hashedPassword: hashedPassword,
      },
    });

    // Ne pas retourner le mot de passe hashé
    const { hashedPassword: _pw, ...safeUser } = user;

    res.status(201).json({
      success: true,
      data: safeUser,
    });
  } catch (err) {
    next(err);
  }
}

// =========================================================
// GET /api/users/:id   => Utilisateur par ID
// =========================================================
export async function getUserById(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const id = Number(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Paramètre 'id' invalide: doit être un nombre.",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: `Aucun utilisateur trouvé avec l'id ${id}`,
      });
    }

    // Retire le mot de passe avant de retourner
    const { hashedPassword, ...safeUser } = user;

    res.json({
      success: true,
      data: safeUser,
    });
  } catch (err) {
    next(err);
  }
}


// =========================================================
// PATCH /api/users/:id   => Utilisateur par ID
// =========================================================
export async function updateUser(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Paramètre 'id' invalide: doit être un nombre.",
      });
    }

    const { email, name, pseudo } = req.body;

    // Normalisation
    const emailTrimmed = email?.trim();
    const nameTrimmed = name?.trim();
    const pseudoTrimmed = pseudo?.trim();

    // Si rien à mettre à jour
    if (!emailTrimmed && !nameTrimmed && !pseudoTrimmed) {
      return res.status(400).json({
        success: false,
        message: "Aucun champ à mettre à jour (email, name, pseudo).",
      });
    }

    // Construit l'objet data dynamiquement
    const data: Record<string, unknown> = {};
    if (emailTrimmed) data.email = emailTrimmed;
    if (nameTrimmed) data.name = nameTrimmed;
    if (pseudoTrimmed) data.pseudo = pseudoTrimmed;

    // Vérifier unicité si email ou pseudo changent
    if (emailTrimmed) {
      const existingEmail = await prisma.user.findUnique({
        where: { email: emailTrimmed },
      });
      if (existingEmail && existingEmail.id !== id) {
        return res.status(409).json({
          success: false,
          message: "Un utilisateur avec cet email existe déjà",
        });
      }
    }

    if (pseudoTrimmed) {
      const existingPseudo = await prisma.user.findUnique({
        where: { pseudo: pseudoTrimmed },
      });
      if (existingPseudo && existingPseudo.id !== id) {
        return res.status(409).json({
          success: false,
          message: "Ce pseudo est déjà utilisé",
        });
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
    });

    const { hashedPassword, ...safeUser } = updated;

    res.json({
      success: true,
      data: safeUser,
    });
  } catch (err) {
    next(err);
  }
}


// =========================================================
// DELETE /api/users/:id   => Utilisateur par ID
// =========================================================

export async function deleteUser(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Paramètre 'id' invalide: doit être un nombre.",
      });
    }

    // Optionnel: vérifier d'abord s'il existe
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: `Aucun utilisateur trouvé avec l'id ${id}`,
      });
    }

    await prisma.user.delete({ where: { id } });

    res.status(204).send(); // Pas de contenu, juste "OK, supprimé"
  } catch (err) {
    next(err);
  }
}
