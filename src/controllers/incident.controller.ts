import type { Request, Response, NextFunction } from "express";
import type { Prisma, TimePeriod } from "../../generated/prisma/client";
import prisma from "../prisma";

function parseIsoDayStart(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseIsoMonthStart(value: string) {
  if (!/^\d{4}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}-01T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function getIncidents(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { timePeriod, pdqId, category, source, city, date, dateMode, limit = "5000" } = req.query as {
      timePeriod?: string;
      pdqId?: string;
      category?: string;
      source?: string;
      city?: string;
      date?: string;
      dateMode?: string;
      limit?: string;
    };
    const timePeriodValue: TimePeriod | undefined =
      timePeriod === "jour" || timePeriod === "nuit" || timePeriod === "soir"
        ? (timePeriod as TimePeriod)
        : undefined;

    const pdqIdValue = pdqId ? Number(pdqId) : undefined;
    const categoryValue = category || undefined;
    const sourceValue = source || undefined;
    const cityValue = city || undefined;
    const isMonthMode = dateMode === "month";
    const dateStart = date ? (isMonthMode ? parseIsoMonthStart(date) : parseIsoDayStart(date)) : null;
    const dateEnd = dateStart
      ? isMonthMode
        ? new Date(Date.UTC(dateStart.getUTCFullYear(), dateStart.getUTCMonth() + 1, 1))
        : new Date(dateStart.getTime() + 24 * 60 * 60 * 1000)
      : null;

    const rawLimit = Number(limit);
    let limitValue = (!rawLimit || rawLimit < 1) ? 5000 : rawLimit;
    limitValue = Math.min(limitValue, 100000);

    const where: Prisma.IncidentWhereInput = {};
    if (timePeriodValue) where.timePeriod = timePeriodValue;
    if (pdqIdValue !== undefined) where.pdqId = pdqIdValue;
    if (categoryValue) where.category = categoryValue;
    if (sourceValue) where.source = sourceValue;
    if (cityValue) where.city = cityValue;
    if (dateStart && dateEnd) where.date = { gte: dateStart, lt: dateEnd };

    const incidents = await prisma.incident.findMany({
      where,
      orderBy: { date: "desc" },
      take: limitValue,
    });

    res.json({ success: true, data: incidents });
  } catch (err) {
    next(err);
  }
}

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
