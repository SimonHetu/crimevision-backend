import "dotenv/config";
import fs from "fs";
import path from "path";
import { PrismaClient } from "../../generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
// =========================================================
// ELT tool 
//      Extract: Download data
//      Transform: Analyse et met au propre les données
//      Load: Insère les données dans Néon avec Prisma
// =========================================================
//******* DOWNLOAD PDQ DATA (csv) *******
// =========================================================

async function downloadPDQ() {
    const url = 
        "https://donnees.montreal.ca/fr/dataset/91f66001-b461-4f63-aff4-cddc0fe30ffe/resource/c9f296dd-596e-48ed-9c76-37230b2c916d/download/pdq.csv";
    
    const folder = path.join(__dirname, "..", "..","data", "raw");

    fs.mkdirSync(folder, { recursive: true });

    const res = await fetch(url);
    if (!res.ok) throw new Error("Échec du téléchargement pdq.csv");

    const buffer = await res.arrayBuffer();
    fs.writeFileSync(path.join(folder, "pdq.csv"), Buffer.from(buffer));

    console.log("Fichier PDQ téléchargé ✔️");
}

// =========================================================
//******* Insert données du csv téléchagé dans Néon  *******
// =========================================================

function parseCsvLine(line: string): string[] {
  const cols = line.split(",");
  return cols.map((c) => c.replace(/^"|"$/g, "").trim());
}

async function importPdqFromCsv() {
  neonConfig.webSocketConstructor = ws;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set in .env");
  }

  const adapter = new PrismaNeon({ connectionString });
  const prisma = new PrismaClient({ adapter });

  const PDQ_CSV_PATH = path.join(__dirname, "..", "..", "data", "raw", "pdq.csv");

  try {
    console.log("Import des PDQ à partir de pdq.csv...");

    const content = fs.readFileSync(PDQ_CSV_PATH, "utf8");
    const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);

    const header = parseCsvLine(lines[0]!);
    
    // DEBUG: afficher les colonnes du CSV PDQ
    // console.log("Header CSV PDQ:", header);

    let imported = 0;

    for (const line of lines.slice(1)) {
      const cols = parseCsvLine(line);

      const noCivLie = cols[1] ?? "";
      const prefix   = cols[2] ?? "";
      const nom      = cols[3] ?? "";
      const dir      = cols[4] ?? "";
      const munCode  = cols[5] ?? "";
      const descLieu = cols[6] ?? "";

      const lat = Number(cols[7] ?? 0);
      const lon = Number(cols[8] ?? 0);

      if (!descLieu) {
        console.warn("Ligne sans DESC_LIEU, ignorée:", line);
        continue;
      }

      const match = descLieu.match(/(\d+)/);
      const pdqId = match?.[1] ? Number.parseInt(match[1], 10) : NaN;

      if (!pdqId || Number.isNaN(pdqId)) {
        console.warn("Impossible de lire le numéro de PDQ pour:", descLieu);
        continue;
      }

      const addressParts = [noCivLie, prefix, nom, dir].filter(Boolean);
      const address = addressParts.join(" ").replace(/\s+/g, " ").trim();

      const name = descLieu;

      await prisma.pdq.upsert({
        where: { id: pdqId },
        update: { name, address, cityCode: munCode, latitude: lat, longitude: lon },
        create: { id: pdqId, name, address, cityCode: munCode, latitude: lat, longitude: lon },
      });

      imported++;
    } 

    console.log(`Import PDQ terminé, ${imported} lignes insérées/mises à jour.`);
  } finally {
    await prisma.$disconnect(); 
  }
}


async function main() {
  await downloadPDQ();
  await importPdqFromCsv();
}

main()
  .catch((err) => {
    console.error("Erreur globale import PDQ:", err);
  })
