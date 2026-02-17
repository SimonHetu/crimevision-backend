// =========================================================
// IMPORTS / DÉPENDANCES
// =========================================================
// - dotenv/config : charge automatiquement les variables d'environnement (.env)
// - PrismaClient  : client Prisma généré
// - Prisma/$Enums : types Prisma + enums (ex: TimePeriod)
// - PrismaNeon    : adapter Prisma pour Neon (PostgreSQL)
// - neonConfig/ws : Neon utilise WebSocket en Node (runtime serverless)

import "dotenv/config";
import { PrismaClient, Prisma, $Enums } from "../../generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

// =========================================================
// CONFIG GÉNÉRALE (DB + API CKAN)
// =========================================================
// - TimePeriodEnum : alias typé vers l'enum Prisma (TimePeriod)
// - neonConfig.webSocketConstructor : nécessaire pour Neon en environnement Node
// - DATABASE_URL : chaîne de connexion Postgres (Neon)
// - CKAN_BASE_URL / RESOURCE_ID : endpoint + ressource du portail Données Québec
// - PAGE_SIZE : taille des pages CKAN (pagination par offset)
// - SOURCE : identifiant interne du fournisseur (sert aux uniques + curseurs/import state)

type TimePeriodEnum = $Enums.TimePeriod;
neonConfig.webSocketConstructor = ws;

const connectionString = process.env.DATABASE_URL!;
if (!connectionString) throw new Error("DATABASE_URL n'est pas definit dans le .env");

const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

const CKAN_BASE_URL =
  "https://www.donneesquebec.ca/recherche/api/3/action/datastore_search";
const RESOURCE_ID = "c6f482bf-bf0f-4960-8b2f-9982c211addd";
const PAGE_SIZE = 100;
const SOURCE = "spvm_incidents";

// =========================================================
// CLI (option --max)
// =========================================================
// Permet de limiter le nombre d'incidents traités pour:
// - imports partiels
// - tests rapides
// Valeur par défaut: Infinity (= tout importer)

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

   // Lecture de l'argument --max=...
  const arg = process.argv.find((a) => a.startsWith("--max="));
  if (!arg) return DEFAULT_MAX_IMPORT;

  // Logique d'extraction : on sépare la chaîne "--max=..." au niveau du "="
  // split("=", 2) retourne ["--max", "valeur"]
  // On récupère l'élément à l'index 1 qui correspond à la valeur saisie
  const value = arg.split("=", 2)[1];
  if (value === "all") return DEFAULT_MAX_IMPORT;

  // Validation : doit être un nombre > 0
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`Valeur invalide pour --max (${value}). Exemple: --max=5000 ou --max=all`);
  }
  return n;
}
// Résultat saisie avec la fonction
const MAX_IMPORT = getMaxImport();

// =========================================================
// TYPES CKAN (forme des records reçus)
// =========================================================
// Typage des champs CKAN. Plusieurs champs peuvent être absents / vides.
// Note: CKAN retourne souvent des valeurs en string (même pour X/Y/lat/long)

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
// FETCH CKAN (pagination par offset)
// =========================================================
// Récupère une page de données CKAN en tri décroissant (DATE, puis _id)
// - offset : position dans l'ensemble
// - limit  : PAGE_SIZE (taille de page)
// Retourne { total, records }

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
// HELPERS (conversion + parsing)
// =========================================================
// Conversion string -> number? (null si vide ou NaN)
function toNumberOrNull(value?: string): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

// Parse la date CKAN en Date UTC "safe" (midi UTC) pour éviter le shift timezone.
// Exemple problème classique:
// - "2018-09-13" peut devenir "2018-09-12" selon le fuseau/local parsing.
// Solution: construire une date UTC à 12:00:00 (midi) => stable.

function parseCkanDateToSafeUtc(dateStr?: string) {
  if (!dateStr) return new Date(0);

  // mesure et separation
  const parts = dateStr.slice(0, 10).split("-");
  if (parts.length !== 3) return new Date(0);

  // converion en number
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);

  // cerification que ce sont bien des nombres
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return new Date(0);
  }

  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

let unknownPdqCount = 0;

// =========================================================
// MAPPING (CKAN -> Prisma IncidentCreateInput)
// =========================================================
// Transforme un record CKAN en objet compatible Prisma (IncidentCreateInput)
// - mappe QUART vers l'enum TimePeriod
// - convertit X/Y/LAT/LONG en nombres (null si invalide)
// - gère PDQ manquant: connectOrCreate sur PDQ 0 ("Poste inconnu")
// - connectOrCreate: crée le PDQ au besoin, sinon connecte au PDQ existant

function mapRecordToIncident(record: CkanRecord): Prisma.IncidentCreateInput {
  
  // Mapping QUART -> TimePeriod enum
  let timePeriod: TimePeriodEnum = $Enums.TimePeriod.jour;
  if (record.QUART === "soir") timePeriod = $Enums.TimePeriod.soir;
  else if (record.QUART === "nuit") timePeriod = $Enums.TimePeriod.nuit;

  // Coordonnées: X/Y (projection) + longitude/latitude (GPS)
  const x = toNumberOrNull(record.X);
  const y = toNumberOrNull(record.Y);
  const longitude = toNumberOrNull(record.LONGITUDE);
  const latitude = toNumberOrNull(record.LATITUDE);

  // PDQ: si absent/vides => PDQ=0 (inconnu) + compteur
  const pdqNumber =
    record.PDQ == null || record.PDQ === ""
      ? (unknownPdqCount++, 0)
      : Number.parseInt(record.PDQ, 10);

  if (Number.isNaN(pdqNumber)) {
    throw new Error(`PDQ invalide pour le record _id=${record._id}: ${record.PDQ}`);
  }

  // Construction de la payload Prisma (création/mise à jour identique pour upsert)
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

    // Relation PDQ (1 Incident -> 1 PDQ)
    // - connectOrCreate : assure qu'un PDQ existe même si on ne l'a pas importé avant
    // Si fait dans le desordre import pdq upsert et la logique fonctionne aussi
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
// IMPORT PRINCIPAL (BOOTSTRAP PAR OFFSET)
// =========================================================
// Objectif:
// - importer des pages CKAN en partant de nextOffset (persisté en DB)
// - upsert par clé unique métier: (source, sourceId)
// - compter traités / nouveaux / mis à jour / erreurs
// - sauvegarder nextOffset pour reprendre plus tard
// - initialiser/mettre à jour le curseur ImportCursor pour l'import "latest"

async function importIncidents() {
  console.log("Début import (bootstrap offset) CKAN => Neon...");
  unknownPdqCount = 0;

  // 1) Lecture/création de l'état bootstrap (nextOffset persisté)
  const state = await prisma.importBootstrapState.upsert({
    where: { source: SOURCE },
    create: { source: SOURCE, nextOffset: 0 },
    update: {},
  });

  // Offset courant (reprise)
  let offset = state.nextOffset;

  // Cible maximale (si --max est défini)
  const target = Number.isFinite(MAX_IMPORT) ? offset + MAX_IMPORT : Infinity;

  // Compteurs de stats
  let traitesCount = 0;
  let nouveauxCount = 0;
  let majCount = 0;
  let errorCount = 0;

  // Boucle pagination (offset) tant qu'on n'a pas atteint la limite
  while (offset < target) {
    console.log(`=> Fetch offset=${offset}`);
    const result = await fetchPage(offset);

    // Stop si plus aucun record
    if (!result.records || result.records.length === 0) {
      console.log("Aucun enregistrement supplémentaire, fin.");
      break;
    }

    // Traitement record par record (upsert)
    for (const record of result.records) {
      try {
        const data = mapRecordToIncident(record);

        // Clé unique métier utilisée par @@unique([source, sourceId])
        const where = {
          source_sourceId: { source: SOURCE, sourceId: record._id },
        } as const;

        // Optionnel: check existence pour compter mise à jour vs création (nouveaux)
        const existed = await prisma.incident.findUnique({
          where,
          select: { id: true },
        });


        await prisma.incident.upsert({
          where,
          create: data,
          update: data,
        });

        traitesCount++;
        if (existed) majCount++;
        else nouveauxCount++;

        if (Number.isFinite(MAX_IMPORT) && traitesCount >= MAX_IMPORT) break;
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
  console.log(`Traités           : ${traitesCount}`);
  console.log(`Nouveaux          : ${nouveauxCount}`);
  console.log(`Mis à jour        : ${majCount}`);
  console.log(`PDQ inconnus      : ${unknownPdqCount}`);
  console.log(`Erreurs           : ${errorCount}`);
  console.log("=================================");
}

importIncidents()
  .catch((err) => console.error("Erreur globale pendant l'import :", err))
  .finally(async () => {
    await prisma.$disconnect();
  });
