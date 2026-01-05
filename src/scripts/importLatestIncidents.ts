// Pour mettre à jour la base de donnée avec les derniers évènements 
// Sera utiliser pour connecter au bouton "Mettre à jour"

import "dotenv/config";
import { PrismaClient, Prisma, $Enums } from "../../generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

type TimePeriodEnum = $Enums.TimePeriod;
neonConfig.webSocketConstructor = ws;

const connectionString = process.env.DATABASE_URL!;
if (!connectionString) throw new Error("DATABASE_URL is not set in .env");

const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

// ---- CKAN ----
const CKAN_BASE_URL =
  "https://www.donneesquebec.ca/recherche/api/3/action/datastore_search";
const RESOURCE_ID = "c6f482bf-bf0f-4960-8b2f-9982c211addd";
const PAGE_SIZE = 100;
const SOURCE = "spvm_incidents";

// ---- CLI options ----
const DEFAULT_MAX = Infinity;
function getMax(): number {
  const arg = process.argv.find((a) => a.startsWith("--max="));
  if (!arg) return DEFAULT_MAX;
  const v = arg.split("=", 2)[1];
  if (v === "all") return DEFAULT_MAX;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`--max invalide: ${v}`);
  return n;
}
const MAX = getMax();

// ---- Types CKAN ----
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

function toNumberOrNull(value?: string): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function mapRecordToIncident(record: CkanRecord): Prisma.IncidentCreateInput {
  let timePeriod: TimePeriodEnum = $Enums.TimePeriod.jour;
  if (record.QUART === "soir") timePeriod = $Enums.TimePeriod.soir;
  else if (record.QUART === "nuit") timePeriod = $Enums.TimePeriod.nuit;

  const x = toNumberOrNull(record.X);
  const y = toNumberOrNull(record.Y);
  const longitude = toNumberOrNull(record.LONGITUDE);
  const latitude = toNumberOrNull(record.LATITUDE);

  const pdqNumber =
    record.PDQ == null || record.PDQ === "" ? 0 : Number.parseInt(record.PDQ, 10);
  if (Number.isNaN(pdqNumber)) {
    throw new Error(`PDQ invalide pour _id=${record._id}: ${record.PDQ}`);
  }

  return {
    source: SOURCE,
    sourceId: record._id,
    category: record.CATEGORIE ?? "Inconnu",
    date: record.DATE ? new Date(record.DATE) : new Date(0),
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

/**
 * Compare (date, sourceId) au curseur (lastDate, lastSourceId).
 * Retourne true si record est seulement plus récent que curseur.
 */
function isNewer(
  recordDate: Date,
  recordSourceId: number,
  lastDate: Date | null,
  lastSourceId: number | null
): boolean {
  if (!lastDate) return true; // Premiere utilisation
  const t = recordDate.getTime();
  const lt = lastDate.getTime();

  if (t > lt) return true;
  if (t < lt) return false;

  // utilise source id pour trancher lorsque la date est la meme
  const lsid = lastSourceId ?? -1;
  return recordSourceId > lsid;
}

async function importLatest() {
  console.log(`ImportLatest - source=${SOURCE}`);

  // 1) load cursor
  const cursor = await prisma.importCursor.findUnique({ where: { source: SOURCE } });
  const lastDate = cursor?.lastDate ?? null;
  const lastSourceId = cursor?.lastSourceId ?? null;

  console.log(
    `Cursor: lastDate=${lastDate?.toISOString() ?? "null"} lastSourceId=${lastSourceId ?? "null"}`
  );

  // (Optionnel mais clean) s’assurer que PDQ(0) existe
  await prisma.pdq.upsert({
    where: { id: 0 },
    create: {
      id: 0,
      name: "Poste inconnu",
      address: "",
      cityCode: "",
      latitude: 0,
      longitude: 0,
    },
    update: {},
  });

  let offset = 0;
  let processed = 0;
  let createdOrUpdated = 0;
  let errors = 0;

  let newMaxDate = lastDate;
  let newMaxSourceId = lastSourceId;

  let stop = false;

  while (!stop) {
    console.log(`=> Fetch offset=${offset}`);
    const result = await fetchPage(offset);

    if (!result.records || result.records.length === 0) {
      console.log("Aucun record, fin.");
      break;
    }

    for (const record of result.records) {
      if (processed >= MAX) {
        console.log(`Stop (--max=${Number.isFinite(MAX) ? MAX : "all"})`);
        stop = true;
        break;
      }

      try {
        if (!record.DATE) {
            errors++;
            console.error("Record sans DATE, skip _id=", record._id);
            continue;
            }
            const recordDate = new Date(record.DATE);


        // 2) stop condition: dès qu’on atteint du “pas plus récent”
        if (!isNewer(recordDate, record._id, lastDate, lastSourceId)) {
          stop = true;
          break;
        }

        // 3) upsert “nouveaux”
        const data = mapRecordToIncident(record);

        await prisma.incident.upsert({
          where: { source_sourceId: { source: SOURCE, sourceId: record._id } },
          create: data,
          update: data,
        });

        createdOrUpdated++;

        // 4) Mise à jour du marqueur
        if (!newMaxDate || recordDate.getTime() > newMaxDate.getTime()) {
          newMaxDate = recordDate;
          newMaxSourceId = record._id;
        } else if (recordDate.getTime() === newMaxDate.getTime()) {
          newMaxSourceId = Math.max(newMaxSourceId ?? -1, record._id);
        }
      } catch (e) {
        errors++;
        console.error("Erreur record _id=", record._id, e);
      } finally {
        processed++;
      }
    }

    offset += PAGE_SIZE;
  }

  // 5) Sauvegarde du curseur si on avance
  if (createdOrUpdated > 0) {
    await prisma.importCursor.upsert({
      where: { source: SOURCE },
      create: {
        source: SOURCE,
        lastDate: newMaxDate ?? null,
        lastSourceId: newMaxSourceId ?? null,
        lastRunAt: new Date(),
      },
      update: {
        lastDate: newMaxDate ?? null,
        lastSourceId: newMaxSourceId ?? null,
        lastRunAt: new Date(),
      },
    });
  }

  console.log("=================================");
  console.log("ImportLatest terminé");
  console.log(`Source             : ${SOURCE}`);
  console.log(`Nouveaux upserts   : ${createdOrUpdated}`);
  console.log(`Records traités    : ${processed}`);
  console.log(`Erreurs            : ${errors}`);
  console.log(`Nouveau cursor     : ${newMaxDate?.toISOString() ?? "null"} / ${newMaxSourceId ?? "null"}`);
  console.log("=================================");
}

importLatest()
  .catch((err) => console.error("Erreur globale:", err))
  .finally(async () => {
    await prisma.$disconnect();
  });
