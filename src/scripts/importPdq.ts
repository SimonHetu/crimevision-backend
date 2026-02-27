// But : Importer les PDQ (postes de quartier) depuis un CSV
// données officielles via donnees.montreal.ca
//
// Ce module suit un flow ELT :
//   Extract   -> télécharger le CSV
//   Transform -> parser / nettoyer les lignes
//   Load      -> upsert dans la table pdq
//
// Usage (script) :
//   node importPdq.js
// =========================================================
import "dotenv/config";
import fs from "fs";
import path from "path";
import { PrismaClient } from "../../generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

// =========================================================
// ELT TOOL
// ---------------------------------------------------------
// Extract   : downloadPDQ() télécharge pdq.csv
// Transform : parseCsvLine() + parsing par colonnes
// Load      : importPdqFromCsv() upsert les PDQ dans Neon
// =========================================================

// =========================================================
// 1) EXTRACT - TÉLÉCHARGER pdq.csv
// ---------------------------------------------------------
// - Télécharge le CSV officiel depuis donnees.montreal.ca
// - Crée un dossier local /data/raw si absent
// - Écrit le fichier pdq.csv en binaire (Buffer)
// =========================================================

async function downloadPDQ() {
    const url = 
        "https://donnees.montreal.ca/fr/dataset/91f66001-b461-4f63-aff4-cddc0fe30ffe/resource/c9f296dd-596e-48ed-9c76-37230b2c916d/download/pdq.csv";
    
    // Dossier local où stocker le fichier téléchargé
    const folder = path.join(__dirname, "..", "..","data", "raw");
    fs.mkdirSync(folder, { recursive: true });

    // Téléchargement HTTP
    const res = await fetch(url);
    if (!res.ok) throw new Error("Échec du téléchargement pdq.csv");

    // Récupère en binaire (ArrayBuffer) puis écrit sur disque
    const buffer = await res.arrayBuffer();
    fs.writeFileSync(path.join(folder, "pdq.csv"), Buffer.from(buffer));

    console.log("Fichier PDQ téléchargé ✔️");
}


// =========================================================
// 2) TRANSFORM - PARSER CSV 
// ---------------------------------------------------------
// parseCsvLine :
// - split(",") pour séparer les colonnes
// - enlève des guillemets de début/fin
// - trim espaces
//
// une colonne contient une virgule à l’intérieur de guillemets.
// =========================================================
function parseCsvLine(line: string): string[] {
  const cols = line.split(",");
  return cols.map((c) => c.replace(/^"|"$/g, "").trim());
}




// =========================================================
// 3) LOAD - IMPORTER pdq.csv DANS NEON (PRISMA)
// ---------------------------------------------------------
// - Configure Neon WebSocket
// - Ouvre PrismaClient
// - Lit le fichier local pdq.csv
// - Parse toutes les lignes (header + data)
// - Pour chaque ligne :
//   * construit address
//   * trouve le numéro de PDQ depuis DESC_LIEU
//   * upsert dans la table pdq
//
// Upsert =
// - update si id existe déjà
// - create sinon
// =========================================================
async function importPdqFromCsv() {

  neonConfig.webSocketConstructor = ws;

  // DB connect string
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set in .env");
  }

  // Prisma client (Neon adapter)
  const adapter = new PrismaNeon({ connectionString });
  const prisma = new PrismaClient({ adapter });

  // Chemin local du fichier téléchargé
  const PDQ_CSV_PATH = path.join(__dirname, "..", "..", "data", "raw", "pdq.csv");

  try {
    console.log("Import des PDQ à partir de pdq.csv...");

    // Lecture du fichier complet
    const content = fs.readFileSync(PDQ_CSV_PATH, "utf8");

    // Split en lignes + retire lignes vides
    const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);

    const header = parseCsvLine(lines[0]!);
    
    let imported = 0;

    // =====================================================
    // TRANSFORM + LOAD ligne par ligne
    // =====================================================
    for (const line of lines.slice(1)) {
      const cols = parseCsvLine(line);

      // Mapping "par index" (selon structure du CSV PDQ)
      // Exemple de colonnes attendues :
      //  [1]=NO_CIV_LIE, [2]=PREFIXE, [3]=NOM, [4]=DIR,
      //  [5]=MUN_CODE, [6]=DESC_LIEU, [7]=LAT, [8]=LONG
      const noCivLie = cols[1] ?? "";
      const prefix   = cols[2] ?? "";
      const nom      = cols[3] ?? "";
      const dir      = cols[4] ?? "";
      const munCode  = cols[5] ?? "";
      const descLieu = cols[6] ?? "";
      const lat      = Number(cols[7] ?? 0);
      const lon      = Number(cols[8] ?? 0);

      if (!descLieu) {
        console.warn("Ligne sans DESC_LIEU, ignorée:", line);
        continue;
      }

      // Extraire le numéro de PDQ depuis descLieu (ex: "PDQ 12")
      // match récupère le premier groupe de digits dans la string
      const match = descLieu.match(/(\d+)/);
      const pdqId = match?.[1] ? Number.parseInt(match[1], 10) : NaN;

      if (!pdqId || Number.isNaN(pdqId)) {
        console.warn("Impossible de lire le numéro de PDQ pour:", descLieu);
        continue;
      }

      // Construire une adresse propre (concat + nettoyage espaces)
      const addressParts = [noCivLie, prefix, nom, dir].filter(Boolean);
      const address = addressParts.join(" ").replace(/\s+/g, " ").trim();

      const name = descLieu;

      // =====================================================
      // UPSERT PDQ
      // -----------------------------------------------------
      // where: id = numéro PDQ
      // update: met à jour champs si déjà présent
      // create: insère si absent
      // =====================================================
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

// =========================================================
// POINT D’ENTRÉE : main()
// ---------------------------------------------------------
// Séquence ELT complète :
// 1) downloadPDQ()  -> télécharge pdq.csv localement
// 2) importPdqFromCsv() -> lit le fichier et upsert en DB
// =========================================================
async function main() {
  await downloadPDQ();
  await importPdqFromCsv();
}

main()
  .catch((err) => {
    console.error("Erreur globale import PDQ:", err);
  })
