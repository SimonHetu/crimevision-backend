// =========================================================
// ROUTES API - SavedLocation (Express)
// =========================================================
// Ce router gère les lieux sauvegardés d’un utilisateur.
// Toutes les routes sont protégées par requireClerkAuth.
// Chaque requête est liée au user authentifié (Clerk).

import { Router } from "express";
import prisma from "../prisma";

import { requireClerkAuth } from "../middleware/clerkAuth";
import { getOrCreateUserByClerkId } from "../utils/getOrCreateUser";

const router = Router();


// =========================================================
// GET /
// ---------------------------------------------------------
// Retourne toutes les locations sauvegardées du user connecté.
// - Auth obligatoire
// - Récupère (ou crée) le user via clerkId
// - Filtre par userId (sécurité multi-user)
// =========================================================

router.get("/", requireClerkAuth, async (req: any, res) => {

  // Garantit que le user existe en DB
  const user = await getOrCreateUserByClerkId(req.auth.clerkUserId, null);
  const rows = await prisma.savedLocation.findMany({ where: { userId: user.id } });
  res.json(rows);
});

router.post("/", requireClerkAuth, async (req: any, res) => {
  const user = await getOrCreateUserByClerkId(req.auth.clerkUserId, null);
  const { label, lat, lng, radiusM } = req.body;
  const created = await prisma.savedLocation.create({
    data: { userId: user.id, label, lat, lng, radiusM },
  });
  res.status(201).json(created);
});


// =========================================================
// PATCH /:id
// ---------------------------------------------------------
// Met à jour une location existante.
// - Vérifie que la location appartient bien au user
// - Sinon 404 (sécurité)
// =========================================================

router.patch("/:id", requireClerkAuth, async (req: any, res) => {
  const user = await getOrCreateUserByClerkId(req.auth.clerkUserId, null);
  const id = Number(req.params.id);

  const existing = await prisma.savedLocation.findFirst({ where: { id, userId: user.id } });
  if (!existing) return res.status(404).json({ error: "Not found" });

  const updated = await prisma.savedLocation.update({
    where: { id },
    data: req.body,
  });

  res.json(updated);
});


// =========================================================
// DELETE /:id
// ---------------------------------------------------------
// Supprime une location si elle appartient au user.
// - Vérification ownership avant suppression
// =========================================================

router.delete("/:id", requireClerkAuth, async (req: any, res) => {

  // Vérifie que la location appartient au user
  const user = await getOrCreateUserByClerkId(req.auth.clerkUserId, null);
  const id = Number(req.params.id);

  const existing = await prisma.savedLocation.findFirst({ where: { id, userId: user.id } });
  if (!existing) return res.status(404).json({ error: "Not found" });

  await prisma.savedLocation.delete({ where: { id } });
  res.status(204).send();
});

export default router;
