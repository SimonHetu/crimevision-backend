import "dotenv/config";
import express from "express";
import cors from "cors";
import incidentsRouter from "./routes/incidents.routes";
import pdqRouter from "./routes/pdq.routes";
import statsRoutes from "./routes/stats.routes";
import { clerkMiddleware } from "@clerk/express";
import meRouter from "./routes/me.routes";
import userRoutes from "./routes/userRoutes"
import locationsRoutes from "./routes/locations";




// =========================================================
// EXPRESS
// =========================================================
const app = express();
app.use(express.json());

// =========================================================
// CORS
// =========================================================
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  })
);


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
app.use("/api/users", userRoutes)
app.use("/api/locations", locationsRoutes);

// =========================================================
// Démarrage du serveur
// =========================================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`⚡🧿🚔 CrimeVision API running on http://localhost:${PORT} 🚔🧿⚡`);
});