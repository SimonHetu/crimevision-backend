import type { Request, Response, NextFunction } from "express";
import type { Prisma, TimePeriod } from "../../generated/prisma/client";
import prisma from "../prisma";

// =========================================================
// GET /api/incidents
// =========================================================
// Fonction controlleur pour GET /api/incidents
export async function getIncidents(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Définition des paramètres de requête url
    // Example: /api/incidents?pdqId=30&timePeriod=jour
    const { timePeriod, pdqId, category, limit = "100" } = req.query as {
      timePeriod?: string;
      pdqId?: string;
      category?: string;
      limit?: string;
    };
    // Validation des valeurs de timePeriod
    // Doivent être dans l'enum du schema sinon elles sont ignorées
    const timePeriodValue: TimePeriod | undefined =
      timePeriod === "jour" || timePeriod === "nuit" || timePeriod === "soir"
        ? (timePeriod as TimePeriod)
        : undefined;

    // Conversion des strings reçues et requête url en type acceptable pour la DB
    const pdqIdValue = pdqId ? Number(pdqId) : undefined;
    const categoryValue = category || undefined;
    
    // Limite sécuritaire
    const rawLimit = Number(limit);
    // Si invalid ou en bas de 1 assigne la valeur par défault (100)
    let limitValue = (!rawLimit || rawLimit < 1) ? 100 : rawLimit;
    // Maximum par requête
    limitValue = Math.min(limitValue, 100);

    // Construction de l'objet where basé sur le schema prisma
    const where: Prisma.IncidentWhereInput = {};
    if (timePeriodValue) where.timePeriod = timePeriodValue;
    if (pdqIdValue !== undefined) where.pdqId = pdqIdValue;
    if (categoryValue) where.category = categoryValue;

    // Prisma génère la requête SQL avec les champs de where
    const incidents = await prisma.incident.findMany({
      where,
      take: limitValue,
    });

    // Res reçoit les données retournées dans incidents en format json
    res.json({ success: true, data: incidents });
  } catch (err) {
    next(err);
  }
}


// =========================================================
// GET /api/incidents/:id
// =========================================================

export async function getIncidentById(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;

    const incidentId = Number(id);
    if (Number.isNaN(incidentId)) {
      return res.status(400).json ({
        success: false,
        message: "Paramètre 'id' invalide: Doit être un nombre",
      });
    }

    const incident = await prisma.incident.findUnique({
      where: { id: incidentId },
    });

    if (!incident) {
      return res.status(404).json({
        success: false,
        message: `Aucun incident trouvé avec l'id ${incidentId}`,
      });
    }
    res.json({ success: true, data: incident });
  } catch (err) {
    next(err);
  }
}
