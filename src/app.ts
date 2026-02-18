import "dotenv/config";
import express from "express";
import cors from "cors";
import incidentsRouter from "./routes/incidents.routes";
import pdqRouter from "./routes/pdq.routes";
import statsRoutes from "./routes/stats.routes";
import { clerkMiddleware } from "@clerk/express";
import meRouter from "./routes/me.routes";
import userRoutes from "./routes/userRoutes";
import locationsRoutes from "./routes/locations";

// =========================================================
// EXPRESS
// =========================================================
const app = express();
app.use(express.json());

// =========================================================
// CORS
// =========================================================
const allowedOrigins = [
  "http://localhost:5173",
  "https://crimevision-frontend.vercel.app",
  // add your preview domain if you're testing it:
  "https://crimevision-frontend-a3wev43wi-simons-projects-55545dbc.vercel.app",
];

const corsOptions: cors.CorsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);

    if (allowedOrigins.includes(origin)) return cb(null, true);

    // allow all Vercel preview deployments
    if (origin.endsWith(".vercel.app")) return cb(null, true);

    return cb(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

// =========================================================
// CLERK
// =========================================================
app.use(clerkMiddleware());

// =========================================================
// Routes
// =========================================================
app.use("/api/incidents", incidentsRouter);
app.use("/api/pdq", pdqRouter);
app.use("/api/stats", statsRoutes);
app.use("/api/me", meRouter);
app.use("/api/users", userRoutes);
app.use("/api/locations", locationsRoutes);

export default app;
