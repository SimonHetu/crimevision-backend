
// RequireAuth est un middleware de express qui est positionné devant une route protégée
// Fonction:
// 1) Lecture de JWT à partir du header de la requête HTTP
// 2) Vérification du token (signature et expiration)
// 3) Si valide attache l'information décodée à la requete (req.user)
// 4) Si invalide ou manquant arrête la requete avec erreur 401 non-authorisé

import type { Request, Response, NextFunction } from "express"; // Types de TypeScript pour les signature middleware de Express
import { verifyAccessToken } from "../utils/jwt"; // la fonction helper qui vérifie en utilisant le JWT_SECRET

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Bearer token invalide" });
  }

  const token = header.slice("Bearer ".length).trim();

  try {
    const decoded = verifyAccessToken(token);
    
    (req as any).user = decoded;
    return next();
  } catch {
    return res.status(401).json({ message: "Token expiré ou invalide" });
  }
}
