// =========================================================
// But du module:
// Pour mettre à jour la base de donnée avec les derniers évènements 
// Sera utiliser pour connecter au bouton "Mettre à jour"

// Principe : on garde un "curseur" (importCursor) qui mémorise
// la dernière (date, sourceId) importée. Au prochain run, on
// s’arrête dès qu’on tombe sur un record pas plus récent.

// Usage CLI :
//   node importLatestIncidents.js --max=200
//   node importLatestIncidents.js --max=all
// =========================================================

import "dotenv/config";
import { PrismaClient, Prisma, $Enums } from "../../generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";


// =========================================================
// CONFIG PRISMA + NEON
// Neon (serverless Postgres) passe par WebSocket,
// On fournit un constructeur ws compatible Node.
// =========================================================
type TimePeriodEnum = $Enums.TimePeriod;
neonConfig.webSocketConstructor = ws;

const connectionString = process.env.DATABASE_URL!;
if (!connectionString) throw new Error("DATABASE_URL is not set in .env");

const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

// =========================================================
// CONFIG CKAN (SOURCE DONNÉES)
// ---------------------------------------------------------
// CKAN datastore_search supporte limit/offset + tri.
// On trie du plus récent au plus vieux : DATE desc, _id desc.
// =========================================================

const CKAN_BASE_URL =
  "https://www.donneesquebec.ca/recherche/api/3/action/datastore_search";
const RESOURCE_ID = "c6f482bf-bf0f-4960-8b2f-9982c211addd";
const PAGE_SIZE = 100;

// Identifiant de la source
const SOURCE = "spvm_incidents";

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

// =========================================================
// TYPES CKAN
// ---------------------------------------------------------
// Représentation brute des champs renvoyés par CKAN.
// Beaucoup de champs sont des strings.
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

// =========================================================
// FETCH CKAN (1 page)
// ---------------------------------------------------------
// offset = PAGE_SIZE * pageIndex
// tri : DATE desc, _id desc
// retourne total + records
// =========================================================
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
// HELPERS DE CONVERSION
// =========================================================
/**
 * Convertit une string en number, sinon null (évite NaN en DB).
 */
function toNumberOrNull(value?: string): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

/**
 * Parse une date CKAN "YYYY-MM-DD..." en Date UTC (midi).
 * Midi UTC = astuce pour éviter les shifts de timezone
 * (jour -1/+1) selon l’environnement.
 */
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

  // midi UTC → évite le shift de timezone
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}


// =========================================================
// MAPPING CKAN -> PRISMA IncidentCreateInput
// ---------------------------------------------------------
// On traduit la forme CKAN en format DB (Prisma).
//
// PDQ : on connect si présent, sinon on create un PDQ minimal.
// On utilise PDQ=0 comme "poste inconnu".
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
    record.PDQ == null || record.PDQ === "" ? 0 : Number.parseInt(record.PDQ, 10);
  if (Number.isNaN(pdqNumber)) {
    throw new Error(`PDQ invalide pour _id=${record._id}: ${record.PDQ}`);
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
// COMPARAISON NOUVEAUTÉ vs CURSEUR
// ---------------------------------------------------------
// On compare (recordDate, recordSourceId) à (lastDate, lastSourceId).
//
// - Si lastDate n'existe pas : tout est nouveau (première import).
// - Sinon : date plus grande = nouveau
// - Si même date : sourceId plus grand = nouveau
//
// Important : doit être cohérent avec le tri CKAN:
//   DATE desc, _id desc
// =========================================================
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

// =========================================================
// FONCTION PRINCIPALE : importLatest
// ---------------------------------------------------------
// 1) Charge le curseur (importCursor) pour SOURCE
// 2) Assure PDQ(0)
// 3) Parcours les pages CKAN (du plus récent au plus vieux)
// 4) Stop dès qu’on atteint un record pas plus récent que le curseur
// 5) Upsert chaque record (create si absent, update si présent)
// 6) Sauvegarde le nouveau curseur si on a importé quelque chose
// =========================================================

async function importLatest() {
  console.log(`ImportLatest - source=${SOURCE}`);

  // 1) load cursor (dernier import)
  const cursor = await prisma.importCursor.findUnique({ where: { source: SOURCE } });
  const lastDate = cursor?.lastDate ?? null;
  const lastSourceId = cursor?.lastSourceId ?? null;

  console.log(
    `Cursor: lastDate=${lastDate?.toISOString() ?? "null"} lastSourceId=${lastSourceId ?? "null"}`
  );

  // s’assurer que PDQ(0) existe
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

  // Compteurs (stats / logs)
  let offset = 0;
  let processed = 0;
  let createdOrUpdated = 0;
  let errors = 0;

  // Nouveau curseur en mémoire (si on avance)
  let newMaxDate = lastDate;
  let newMaxSourceId = lastSourceId;

  let stop = false;

  while (!stop) {
    console.log(`=> Fetch offset=${offset}`);
    const result = await fetchPage(offset);

    // Plus de records => fin
    if (!result.records || result.records.length === 0) {
      console.log("Aucun record, fin.");
      break;
    }

    // Limite CLI (pour tester)
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
            const recordDate = parseCkanDateToSafeUtc(record.DATE);


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

  // 5) Sauvegarde du curseur seulement si on a importé quelque chose
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
