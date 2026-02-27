// =========================================================
// me.routes.ts (Express Router)
// =========================================================
// Ce router expose des routes "me" (profil + home + incidents)
// - Certaines routes sont PUBLIC (mode=latest)
// - D'autres exigent AUTH (mode=home, home/profile updates)
// Auth via Clerk (@clerk/express).
// DB via Prisma.
// =========================================================

// =========================================================
// RÉSUMÉ 
// =========================================================
//
// Ce module est le backend "compte utilisateur" de CrimeVision.
// Il :
// - Synchronise l'utilisateur avec Clerk
// - Gère son domicile
// - Fournit les incidents récents
// - Fournit les incidents proches du domicile
//
// La partie Haversine permet de convertir
// une distance entre deux points GPS
// en mètres, afin d'appliquer un rayon
// géographique précis.
//
// =========================================================
// LOGIQUE GÉOGRAPHIQUE (HAVERSINE)
// =========================================================
//
// Problème:
// Les coordonnées sont en latitude/longitude (degrés).
// Un rayon utilisateur est en mètres.
// On doit convertir une distance entre 2 points GPS en mètres.
//
// Ce n'est PAS une conversion directe lat/long -> mètres.
// C'est un calcul de distance sur une sphère (la Terre).
//
// ---------------------------------------------------------
// Étape 1 : Préfiltre bounding box
// ---------------------------------------------------------
// Pour éviter de calculer la distance sur toute la base,
// on crée un rectangle approximatif autour du domicile:
//
// latDelta = radius / 111 320
// lngDelta = radius / (111 320 * cos(latitude))
//
// Pourquoi 111 320 ?
// 1 degré de latitude ≈ 111 320 mètres.
//
// Cela crée un carré approximatif en degrés.
// La base filtre déjà sur latitude/longitude dans cette zone.
//
// ---------------------------------------------------------
// Étape 2 : Calcul exact avec Haversine
// ---------------------------------------------------------
// Formule utilisée : formule de Haversine.
//
// Elle calcule la distance entre deux points sur une sphère.
//
// R = 6 371 000m (rayon de la Terre)
//
// dist = 2R * asin( sqrt(
//   sin²(dLat/2) +
//   cos(lat1) * cos(lat2) * sin²(dLng/2)
// ))
//
// Résultat : distance en mètres.
//
// ---------------------------------------------------------
// Étape 3 : Filtrage final
// ---------------------------------------------------------
// On garde seulement les incidents dont
// distance <= radiusM
//
// Puis on trie par distance croissante.
//
// =========================================================
// =========================================================
// STRUCTURE LOGIQUE DU MODULE
// =========================================================
//
// 1) AUTHENTIFICATION
// ---------------------------------------------------------
// On utilise getAuth(req) de Clerk.
// Si pas de userId -> 401 Unauthorized.
// Sinon on récupère clerkId.
//
// 2) SYNCHRONISATION USER (UPSERT)
// ---------------------------------------------------------
// Chaque appel important fait un prisma.user.upsert().
// Cela garantit que l'utilisateur Clerk existe en DB.
// Si absent -> création.
// Sinon -> rien ne change.
// Permet un système "auto-sync" entre Clerk et Prisma.
//
// 3) GESTION DU PROFIL (UserProfile)
// ---------------------------------------------------------
// Le profil contient:
// - homeLat
// - homeLng
// - homeRadiusM
//
// PATCH /home:
//   - valide les données (type + range)
//   - clamp le radius entre 50m et 50 000m
//   - upsert le UserProfile
//
// DELETE /home:
//   - reset homeLat/homeLng à null
//   - remet radius par défaut (400m)
//
// 4) INCIDENTS (2 MODES)
// ---------------------------------------------------------
//
// mode=latest (PUBLIC):
//   - retourne les derniers incidents
//   - supporte filtres category, years, months
//   - tri par date desc
//
// mode=home (AUTH):
//   - nécessite un home configuré
//   - retourne incidents dans un rayon autour du domicile
//

import { Router } from "express";
import { getAuth } from "@clerk/express";
import prisma from "../prisma";

const router = Router();


// =========================================================
// Helpers AUTH
// =========================================================

/**
 * requireUserId
 * - Lit l'auth Clerk sur la requête
 * - Si pas de userId => 401 Unauthorized
 * - Sinon retourne le clerkId (auth.userId)
 *
 * Note: ici on retourne un string (clerkId), et on retourne null si pas auth.
 */
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


// =========================================================
// Helpers GEO
// =========================================================
/**
 * metersBetween (Haversine)
 * - Calcule la distance (en mètres) entre deux points GPS
 * - Sert à filtrer les incidents dans un rayon autour de "home"
 *
 * R = rayon de la Terre ~ 6,371,000m
 */

function metersBetween(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;

  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);

  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);

  // Formule de Haversine (distance sphérique)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(s));
}

// =======================================================
// GET /api/me  → sync + return user (AUTH)
// =======================================================
// - Exige auth Clerk
// - "Sync": crée le User en DB s'il n'existe pas (upsert)

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

// =======================================================
// GET /api/me/profile (AUTH) — useful for Dashboard (READ)
// =======================================================
// - Exige auth
// - Assure que user existe (upsert)
// - Retourne uniquement le profile (ou null si absent)

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

// =======================================================
// PATCH /api/me/home  (AUTH) — Update home location
// =======================================================
// - Exige auth
// - Valide le payload : homeLat/homeLng/homeRadiusM
// - Applique des limites (lat/lng range + radius 50..50k)
// - Upsert user puis upsert userProfile (home settings)
// - Retourne le profile mis à jour

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

// =======================================================
// DELETE /api/me/home (AUTH)
// =======================================================
// - Exige auth
// - Remet homeLat/homeLng à null
// - Remet radius à 400 par défaut
// - Retourne le profile après reset

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

// =======================================================
// GET /api/me/incidents?mode=home|latest&limit=...&category=...&radiusM=...
// -------------------------------------------------------
// Deux modes :
// 1) mode=latest (PUBLIC) : renvoie les derniers incidents (option filtres date)
// 2) mode=home   (AUTH)   : renvoie incidents proches du domicile de l'utilisateur
//
// latest supporte filtres:
//   years=2025,2026
//   months=0,1,11  (0-11 style JS Date.getMonth())
// =======================================================

router.get("/incidents", async (req, res) => {
  const mode = String(req.query.mode ?? "home").trim().toLowerCase();
  const category = req.query.category ? String(req.query.category) : null;

  const DEFAULT_LIMIT = 50;
  const MAX_LIMIT = 1000;

  const rawLimit = Number(req.query.limit ?? DEFAULT_LIMIT);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(rawLimit, 1), MAX_LIMIT)
    : DEFAULT_LIMIT;

  // =====================================================
  // MODE PUBLIC : latest
  // =====================================================
  if (mode === "latest") {
    // ---- NEW: parse years/months filters (optional)
    const years = String(req.query.years ?? "")
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n));

    const months = String(req.query.months ?? "")
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n >= 0 && n <= 11);

    // If user selected some years/months, compute an inclusive date range.
    // We’ll use the earliest selected (year,month) as start, and the month AFTER
    // the latest selected (year,month) as end (exclusive).
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
      // year-only: from Jan 1 of minYear to Jan 1 of (maxYear+1)
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

  // =====================================================
  // MODE AUTH : home
  // =====================================================
  // - Exige auth
  // - Utilise homeLat/homeLng du profile
  // - Filtre incidents dans un rayon
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


  // =====================================================
  // Optimisation perf:
  // 1) On fait un "préfiltre" rectangle (bounding box)
  // 2) Puis on calcule la vraie distance (Haversine)
  // =====================================================
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
