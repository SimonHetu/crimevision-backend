import { neon } from "@neondatabase/serverless";

type ApiRequest = {
  method?: string;
  url?: string;
  headers: { origin?: string | string[] };
};

type ApiResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): ApiResponse;
  json(body: unknown): void;
  end(): void;
};

let appHandler: any;
let sqlClient: any;

function getApp() {
  appHandler ??= require("../src/app").default;
  return appHandler;
}

function getSql() {
  if (sqlClient) return sqlClient;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set on the server");
  }

  sqlClient = neon(connectionString);
  return sqlClient;
}

function setCors(req: ApiRequest, res: ApiResponse) {
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

function requestUrl(req: ApiRequest) {
  return new URL(req.url ?? "/", "https://crimevision-backend.vercel.app");
}

async function handlePdq(res: ApiResponse) {
  const rows = await getSql().query('SELECT * FROM "Pdq" ORDER BY "id" ASC');
  return res.status(200).json({ success: true, data: rows });
}

async function handleIncidents(req: ApiRequest, res: ApiResponse) {
  const url = requestUrl(req);
  const params: unknown[] = [];
  const where: string[] = [];

  const timePeriod = url.searchParams.get("timePeriod");
  if (timePeriod === "jour" || timePeriod === "nuit" || timePeriod === "soir") {
    params.push(timePeriod);
    where.push(`"timePeriod" = $${params.length}`);
  }

  const pdqId = url.searchParams.get("pdqId");
  if (pdqId && Number.isInteger(Number(pdqId))) {
    params.push(Number(pdqId));
    where.push(`"pdqId" = $${params.length}`);
  }

  const category = url.searchParams.get("category");
  if (category) {
    params.push(category);
    where.push(`"category" = $${params.length}`);
  }

  const source = url.searchParams.get("source");
  if (source) {
    params.push(source);
    where.push(`"source" = $${params.length}`);
  }

  const city = url.searchParams.get("city");
  if (city) {
    params.push(city);
    where.push(`"city" = $${params.length}`);
  }

  const date = url.searchParams.get("date");
  const isMonthMode = url.searchParams.get("dateMode") === "month";
  const dateStart = date ? (isMonthMode ? parseIsoMonthStart(date) : parseIsoDayStart(date)) : null;
  if (dateStart) {
    const dateEnd = isMonthMode
      ? new Date(Date.UTC(dateStart.getUTCFullYear(), dateStart.getUTCMonth() + 1, 1))
      : new Date(dateStart.getTime() + 24 * 60 * 60 * 1000);

    params.push(dateStart.toISOString());
    where.push(`"date" >= $${params.length}::timestamp`);
    params.push(dateEnd.toISOString());
    where.push(`"date" < $${params.length}::timestamp`);
  }

  const rawLimit = Number(url.searchParams.get("limit") ?? "5000");
  const limit = Math.min(!rawLimit || rawLimit < 1 ? 5000 : rawLimit, 100000);
  params.push(limit);

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const query = `
    SELECT
      "id",
      "source",
      "sourceId",
      "category",
      "sourceCategory",
      "date",
      "occurredAt",
      "reportedAt",
      "latitude",
      "longitude",
      "pdqId",
      "city",
      "borough",
      "precinct",
      "locationType",
      "premiseType",
      "suspectRace"
    FROM "Incident"
    ${whereSql}
    ORDER BY "date" DESC
    LIMIT $${params.length}
  `;
  const rows = await getSql().query(query, params);

  return res.status(200).json({ success: true, data: rows });
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  const url = requestUrl(req);

  try {
    if (url.pathname === "/api/health") {
      return res.status(200).json({ success: true, status: "ok" });
    }

    if (url.pathname === "/api/pdq") {
      return await handlePdq(res);
    }

    if (url.pathname === "/api/incidents") {
      return await handleIncidents(req, res);
    }

    return getApp()(req, res);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Backend failed to start";
    console.error("Backend API failed", err);
    return res.status(500).json({ success: false, message });
  }
}
