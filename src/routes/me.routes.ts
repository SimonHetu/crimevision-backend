
import { Router } from "express";
import { getAuth } from "@clerk/express";
import prisma from "../prisma";

const router = Router();
function requireUserId(req: any, res: any) {
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return null;
  }
  return auth.userId;
}

function isFiniteNumber(x: any) {
  return typeof x === "number" && Number.isFinite(x);
}

function metersBetween(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;

  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);

  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);

  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(s));
}

router.get("/", async (req, res) => {
  const clerkId = requireUserId(req, res);
  if (!clerkId) return;

  const user = await prisma.user.upsert({
    where: { clerkId },
    update: {},
    create: { clerkId },
    include: { profile: true },
  });

  return res.json({ success: true, user });
});

router.get("/profile", async (req, res) => {
  const clerkId = requireUserId(req, res);
  if (!clerkId) return;

  const user = await prisma.user.upsert({
    where: { clerkId },
    update: {},
    create: { clerkId },
    include: { profile: true },
  });

  return res.json({ success: true, profile: user.profile ?? null });
});

router.patch("/home", async (req, res) => {
  const clerkId = requireUserId(req, res);
  if (!clerkId) return;

  const { homeLat, homeLng, homeRadiusM } = req.body;

  if (
    (homeLat != null && !isFiniteNumber(homeLat)) ||
    (homeLng != null && !isFiniteNumber(homeLng)) ||
    (homeRadiusM != null && !isFiniteNumber(homeRadiusM))
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid payload. homeLat/homeLng/homeRadiusM must be numbers.",
    });
  }

  if (homeLat != null && (homeLat < -90 || homeLat > 90)) {
    return res.status(400).json({ success: false, message: "homeLat out of range." });
  }

  if (homeLng != null && (homeLng < -180 || homeLng > 180)) {
    return res.status(400).json({ success: false, message: "homeLng out of range." });
  }

  const radius = homeRadiusM ?? 400;
  if (radius < 50 || radius > 50_000) {
    return res.status(400).json({
      success: false,
      message: "homeRadiusM must be between 50 and 50000 meters.",
    });
  }

  const user = await prisma.user.upsert({
    where: { clerkId },
    update: {},
    create: { clerkId },
  });

  const profile = await prisma.userProfile.upsert({
    where: { userId: user.id },
    update: {
      homeLat: homeLat ?? null,
      homeLng: homeLng ?? null,
      homeRadiusM: radius,
    },
    create: {
      userId: user.id,
      homeLat: homeLat ?? null,
      homeLng: homeLng ?? null,
      homeRadiusM: radius,
    },
  });

  return res.json({ success: true, profile });
});

router.delete("/home", async (req, res) => {
  const clerkId = requireUserId(req, res);
  if (!clerkId) return;

  const user = await prisma.user.upsert({
    where: { clerkId },
    update: {},
    create: { clerkId },
  });

  const profile = await prisma.userProfile.upsert({
    where: { userId: user.id },
    update: { homeLat: null, homeLng: null, homeRadiusM: 400 },
    create: { userId: user.id, homeLat: null, homeLng: null, homeRadiusM: 400 },
  });

  return res.json({ success: true, profile });
});

router.get("/incidents", async (req, res) => {
  const mode = String(req.query.mode ?? "home").trim().toLowerCase();
  const category = req.query.category ? String(req.query.category) : null;

  const DEFAULT_LIMIT = 50;
  const MAX_LIMIT = 1000;

  const rawLimit = Number(req.query.limit ?? DEFAULT_LIMIT);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(rawLimit, 1), MAX_LIMIT)
    : DEFAULT_LIMIT;

  if (mode === "latest") {
    const years = String(req.query.years ?? "")
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n));

    const months = String(req.query.months ?? "")
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n >= 0 && n <= 11);

    let dateFilter: { gte?: Date; lt?: Date } | null = null;

    if (years.length > 0 && months.length > 0) {
      const pairs: Array<{ y: number; m: number }> = [];
      for (const y of years) for (const m of months) pairs.push({ y, m });

      pairs.sort((a, b) => (a.y - b.y) || (a.m - b.m));

      const first = pairs[0];
      const last = pairs[pairs.length - 1];

      if (first && last) {
        const start = new Date(Date.UTC(first.y, first.m, 1, 0, 0, 0));
        const end = new Date(Date.UTC(last.y, last.m + 1, 1, 0, 0, 0));
        dateFilter = { gte: start, lt: end };
      }

    } else if (years.length > 0 && months.length === 0) {
      const minY = Math.min(...years);
      const maxY = Math.max(...years);
      const start = new Date(Date.UTC(minY, 0, 1, 0, 0, 0));
      const end = new Date(Date.UTC(maxY + 1, 0, 1, 0, 0, 0));
      dateFilter = { gte: start, lt: end };
    }

    const items = await prisma.incident.findMany({
      where: {
        ...(category ? { category } : {}),
        ...(dateFilter ? { date: dateFilter } : {}),
      },
      orderBy: { date: "desc" },
      take: limit,
      select: {
        id: true,
        category: true,
        date: true,
        timePeriod: true,
        latitude: true,
        longitude: true,
        pdqId: true,
      },
    });

    return res.json({ success: true, mode, items });
  }

  const clerkId = requireUserId(req, res);
  if (!clerkId) return;

  const user = await prisma.user.upsert({
    where: { clerkId },
    update: {},
    create: { clerkId },
    include: { profile: true },
  });

  const homeLat = user.profile?.homeLat ?? null;
  const homeLng = user.profile?.homeLng ?? null;
  const storedRadius = user.profile?.homeRadiusM ?? 400;

  const rawRadius = Number(req.query.radiusM ?? storedRadius);
  const radiusM = Number.isFinite(rawRadius)
    ? Math.min(Math.max(rawRadius, 50), 50_000)
    : storedRadius;

  if (homeLat === null || homeLng === null) {
    return res.status(400).json({
      success: false,
      message: "Home location not set. PATCH /api/me/home first.",
    });
  }

  const latDelta = radiusM / 111_320;
  const lngDelta = radiusM / (111_320 * Math.cos((homeLat * Math.PI) / 180));

  const preTake = Math.min(MAX_LIMIT * 5, 5000);

  const pre = await prisma.incident.findMany({
    where: {
      latitude: { not: null, gte: homeLat - latDelta, lte: homeLat + latDelta },
      longitude: { not: null, gte: homeLng - lngDelta, lte: homeLng + lngDelta },
      ...(category ? { category } : {}),
    },
    orderBy: { date: "desc" },
    take: preTake,
    select: {
      id: true,
      category: true,
      date: true,
      timePeriod: true,
      latitude: true,
      longitude: true,
      pdqId: true,
    },
  });

  const items = pre
    .filter((it) => it.latitude != null && it.longitude != null)
    .map((it) => ({
      ...it,
      distM: metersBetween(homeLat, homeLng, it.latitude!, it.longitude!),
    }))
    .filter((it) => it.distM <= radiusM)
    .sort((a, b) => a.distM - b.distM)
    .slice(0, limit);

  return res.json({
    success: true,
    mode,
    home: { lat: homeLat, lng: homeLng, radiusM },
    items,
  });
});

export default router;
