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

function getApp() {
  appHandler ??= require("../src/app").default;
  return appHandler;
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

export default function handler(req: ApiRequest, res: ApiResponse) {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.url?.startsWith("/api/health")) {
    return res.status(200).json({ success: true, status: "ok" });
  }

  try {
    return getApp()(req, res);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Backend failed to start";
    console.error("Backend startup failed", err);
    return res.status(500).json({ success: false, message });
  }
}
