import "dotenv/config";
import { PrismaClient, Prisma, $Enums } from "../../generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

// =========================================================
// CONFIG
// =========================================================
type TimePeriodEnum = $Enums.TimePeriod;
neonConfig.webSocketConstructor = ws;

const connectionString = process.env.DATABASE_URL!;
if (!connectionString) throw new Error("DATABASE_URL is not set in .env");

const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

const CKAN_BASE_URL =
  "https://www.donneesquebec.ca/recherche/api/3/action/datastore_search";
const RESOURCE_ID = "c6f482bf-bf0f-4960-8b2f-9982c211addd";
const PAGE_SIZE = 100;
const SOURCE = "spvm_incidents";

// =========================================================
// CLI --max
// =========================================================
const DEFAULT_MAX_IMPORT = Infinity;

function getMaxImport(): number {
  if (process.argv.includes("--help")) {
    console.log(`
Usage:
  npx tsx src/scripts/importIncidents.ts [options]

Options:
  --max=N        Nombre maximum d'incidents à traiter (ex: --max=5000)
  --max=all      Traiter tous les incidents (défaut)
  --help         Afficher cette aide
`);
    process.exit(0);
  }

  const arg = process.argv.find((a) => a.startsWith("--max="));
  if (!arg) return DEFAULT_MAX_IMPORT;

  const value = arg.split("=", 2)[1];
  if (value === "all") return DEFAULT_MAX_IMPORT;

  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`Valeur invalide pour --max (${value}). Exemple: --max=5000 ou --max=all`);
  }
  return n;
}

const MAX_IMPORT = getMaxImport();

// =========================================================
// CKAN types
// =========================================================
type CkanRecord = {
  _id: number;
  CATEGORIE?: string;
  DATE?: string;
  QUART?: "jour" | "soir" | "nuit";
  PDQ?: string | null;
  X?: string;
  Y?: string;
  LONGITUDE?: string;
  LATITUDE?: string;
};

async function fetchPage(offset: number) {
  const url =
    `${CKAN_BASE_URL}?resource_id=${RESOURCE_ID}` +
    `&limit=${PAGE_SIZE}&offset=${offset}` +
    `&sort=DATE desc,_id desc`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Erreur API CKAN: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();
  return json.result as { total: number; records: CkanRecord[] };
}

// =========================================================
// Helpers
// =========================================================
function toNumberOrNull(value?: string): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

// ✅ évite le shift timezone (midi UTC)
function parseCkanDateToSafeUtc(dateStr?: string) {
  if (!dateStr) return new Date(0);

  const parts = dateStr.slice(0, 10).split("-");
  if (parts.length !== 3) return new Date(0);

  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);

  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return new Date(0);
  }

  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

let unknownPdqCount = 0;

// =========================================================
// Map CKAN -> Prisma IncidentCreateInput
// =========================================================
function mapRecordToIncident(record: CkanRecord): Prisma.IncidentCreateInput {
  let timePeriod: TimePeriodEnum = $Enums.TimePeriod.jour;
  if (record.QUART === "soir") timePeriod = $Enums.TimePeriod.soir;
  else if (record.QUART === "nuit") timePeriod = $Enums.TimePeriod.nuit;

  const x = toNumberOrNull(record.X);
  const y = toNumberOrNull(record.Y);
  const longitude = toNumberOrNull(record.LONGITUDE);
  const latitude = toNumberOrNull(record.LATITUDE);

  const pdqNumber =
    record.PDQ == null || record.PDQ === ""
      ? (unknownPdqCount++, 0)
      : Number.parseInt(record.PDQ, 10);

  if (Number.isNaN(pdqNumber)) {
    throw new Error(`PDQ invalide pour le record _id=${record._id}: ${record.PDQ}`);
  }

  return {
    source: SOURCE,
    sourceId: record._id,
    category: record.CATEGORIE ?? "Inconnu",
    date: parseCkanDateToSafeUtc(record.DATE),
    timePeriod,
    x,
    y,
    longitude,
    latitude,
    pdq: {
      connectOrCreate: {
        where: { id: pdqNumber },
        create: {
          id: pdqNumber,
          name: pdqNumber === 0 ? "Poste inconnu" : `PDQ ${pdqNumber}`,
          address: "",
          cityCode: "",
          latitude: 0,
          longitude: 0,
        },
      },
    },
  };
}

// =========================================================
// MAIN IMPORT (BOOTSTRAP BY OFFSET)
// =========================================================
async function importIncidents() {
  console.log("Début import (bootstrap offset) CKAN => Neon...");
  unknownPdqCount = 0;

  // 1) lire l’état bootstrap
  const state = await prisma.importBootstrapState.upsert({
    where: { source: SOURCE },
    create: { source: SOURCE, nextOffset: 0 },
    update: {},
  });

  let offset = state.nextOffset; // ✅ reprend où tu étais rendu
  const target = Number.isFinite(MAX_IMPORT) ? offset + MAX_IMPORT : Infinity;

  let importedCount = 0;
  let errorCount = 0;

  while (offset < target) {
    console.log(`=> Fetch offset=${offset}`);
    const result = await fetchPage(offset);

    if (!result.records || result.records.length === 0) {
      console.log("Aucun enregistrement supplémentaire, fin.");
      break;
    }

    for (const record of result.records) {
      try {
        const data = mapRecordToIncident(record);

        await prisma.incident.upsert({
          where: { source_sourceId: { source: SOURCE, sourceId: record._id } },
          create: data,
          update: data,
        });

        importedCount++;
        if (Number.isFinite(MAX_IMPORT) && importedCount >= MAX_IMPORT) break;
      } catch (err) {
        errorCount++;
        console.error("Erreur sur le record _id=", record._id, err);
      }
    }

    offset += PAGE_SIZE;
  }

  // 2) sauvegarder nextOffset
  await prisma.importBootstrapState.update({
    where: { source: SOURCE },
    data: { nextOffset: offset },
  });

  console.log(`✅ Bootstrap offset sauvegardé: nextOffset=${offset}`);

  // 3) init/update cursor (pour importLatest ensuite)
  const latest = await prisma.incident.findFirst({
    where: { source: SOURCE },
    orderBy: [{ date: "desc" }, { sourceId: "desc" }],
    select: { date: true, sourceId: true },
  });

  if (latest) {
    await prisma.importCursor.upsert({
      where: { source: SOURCE },
      create: {
        source: SOURCE,
        lastDate: latest.date,
        lastSourceId: latest.sourceId,
        lastRunAt: new Date(),
      },
      update: {
        lastDate: latest.date,
        lastSourceId: latest.sourceId,
        lastRunAt: new Date(),
      },
    });

    console.log(`Cursor initialisé/maj: ${latest.date.toISOString()} / ${latest.sourceId}`);
  }

  console.log("=================================");
  console.log("Import terminé");
  console.log(`Source            : ${SOURCE}`);
  console.log(`Importés (batch)  : ${importedCount}`);
  console.log(`PDQ inconnus      : ${unknownPdqCount}`);
  console.log(`Erreurs           : ${errorCount}`);
  console.log("=================================");
}

importIncidents()
  .catch((err) => console.error("Erreur globale pendant l'import :", err))
  .finally(async () => {
    await prisma.$disconnect();
  });
