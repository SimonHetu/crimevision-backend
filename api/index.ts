import type { VercelRequest, VercelResponse } from "@vercel/node";
import app from "../src/app";

function setCors(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin;
  const allowedOrigins = new Set([
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://crimevision-frontend.vercel.app",
    "https://crimevision-frontend-a3wev43wi-simons-projects-55545dbc.vercel.app",
    "https://www.crimevision.ca",
    "https://crimevision.ca",
  ]);

  if (typeof origin === "string" && (allowedOrigins.has(origin) || origin.endsWith(".vercel.app"))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.url?.startsWith("/api/health")) {
    return res.status(200).json({ success: true, status: "ok" });
  }

  return app(req, res);
}
