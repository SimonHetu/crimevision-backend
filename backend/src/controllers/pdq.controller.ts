import type { Request, Response, NextFunction } from "express";
import prisma from "../prisma";

export async function getPdqList(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const pdqList = await prisma.pdq.findMany({
      orderBy: { id: "asc" },
    });
    res.json({ success: true, data: pdqList });
  } catch (err) {
    next(err);
  }
}

export async function getPdqById(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Paramètre 'id' invalide pour PDQ.",
      });
    }

    const pdq = await prisma.pdq.findUnique({ where: { id } });

    if (!pdq) {
      return res.status(404).json({
        success: false,
        message: `Aucun PDQ trouvé avec l'id ${id}.`,
      });
    }

    res.json({ success: true, data: pdq });
  } catch (err) {
    next(err);
  }
}
