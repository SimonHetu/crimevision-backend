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
import authRouter from "./routes/auth.routes";
import paymentsRouter from "./routes/payments.routes";
import { handleStripeWebhook } from "./controllers/stripeWebhook.controller";
import { stripeWebhookRawBody } from "./middleware/stripeWebhookRawBody";

// =========================================================
// BUT: CONFIGURATION DU SERVEUR
// =========================================================

// =========================================================
// EXPRESS
// =========================================================
const app = express();
app.post("/api/payments/webhook", stripeWebhookRawBody, handleStripeWebhook);
app.use(express.json());
app.use("/api/auth", authRouter);
// =========================================================
// CORS
// =========================================================
const allowedOrigins = [
  "http://localhost:5173",
  "https://crimevision-frontend.vercel.app",
  "https://crimevision-frontend-a3wev43wi-simons-projects-55545dbc.vercel.app",
  "https://www.crimevision.ca",
  "https://crimevision.ca",
];

const corsOptions: cors.CorsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);

    if (allowedOrigins.includes(origin)) return cb(null, true);

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
app.use("/api/payments", paymentsRouter);

export default app;
