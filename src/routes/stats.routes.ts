// src/routes/stats.routes.ts
import { Router } from "express";
import { prisma } from "../prisma";

const router = Router();

router.get("/dashboard", async (req, res) => {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [totalIncidents, incidents7d, totalPdqs, totalUsers] = await Promise.all([
      prisma.incident.count(),
      prisma.incident.count({
        where: {
          date: { gte: sevenDaysAgo },
        },
      }),
      prisma.pdq.count(),
      prisma.user.count(),
    ]);

    res.json({
      totalIncidents,
      incidents7d,
      totalPdqs,
      totalUsers,
      asOf: now.toISOString(),
    });
  } catch (err) {
    console.error("dashboard stats error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
