import { Request, Response } from "express"
import { clerkClient, getAuth } from "@clerk/express"
import { ensureUserFromClerk } from "../services/userService"
import { prisma } from "../prisma"; // ajuste si ton prisma client est ailleurs



export async function getCurrentUser(req: Request, res: Response) {
  try {
    const { userId } = getAuth(req)

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" })
    }

    const clerkUser = await clerkClient.users.getUser(userId)
    const email =
      clerkUser.emailAddresses[0]?.emailAddress ?? null

    const user = await ensureUserFromClerk(userId, email)

    res.json(user)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Internal server error" })
  }
}

function distanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function getMyIncidents(req: Request, res: Response) {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // Récupère l'utilisateur + profile (homeLat/homeLng/homeRadiusM)
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: { profile: true },
    });

    const prof = user?.profile;
    if (!prof?.homeLat || !prof.homeLng) {
      return res.json({ incidents: [] });
    }

    // ✅ radiusM venant du frontend OU fallback sur le profil
    const radiusM =
      Number(req.query.radiusM) ||
      prof.homeRadiusM ||
      1500;

    // On charge les incidents (tu peux optimiser plus tard en SQL)
    const incidents = await prisma.incident.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
      },
    });

    const filtered = incidents.filter((inc) => {
      if (inc.latitude == null || inc.longitude == null) return false;
      const d = distanceInMeters(prof.homeLat!, prof.homeLng!, inc.latitude, inc.longitude);
      return d <= radiusM;
    });

    return res.json({ incidents: filtered, radiusM });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

