import "dotenv/config";
import express from "express";
import cors from "cors";
import "./types/express";
import incidentsRouter from "./routes/incidents.routes";
import pdqRouter from "./routes/pdq.routes";
import usersRouter from "./routes/user.routes";
import authRouter from "./routes/auth.routes";

const app = express();

app.use(express.json());

// =========================================================
// Routes
// =========================================================

app.use("/api/incidents", incidentsRouter);
app.use("/api/pdq", pdqRouter);
app.use("/api/users", usersRouter);
app.use("/api/auth", authRouter);


// =========================================================
// Activation du serveur
// =========================================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`⚡🚔 CrimeVision API running on http://localhost:${PORT} 🚔⚡`);
});


