import { Router } from "express";
import prisma from "../prisma";

import { requireClerkAuth } from "../middleware/clerkAuth";
import { getOrCreateUserByClerkId } from "../utils/getOrCreateUser";

const router = Router();

router.get("/", requireClerkAuth, async (req: any, res) => {
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

router.delete("/:id", requireClerkAuth, async (req: any, res) => {
  const user = await getOrCreateUserByClerkId(req.auth.clerkUserId, null);
  const id = Number(req.params.id);

  const existing = await prisma.savedLocation.findFirst({ where: { id, userId: user.id } });
  if (!existing) return res.status(404).json({ error: "Not found" });

  await prisma.savedLocation.delete({ where: { id } });
  res.status(204).send();
});

export default router;
