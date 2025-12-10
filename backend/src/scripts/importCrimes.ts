// IMPORT:
import "dotenv/config";
import { PrismaClient, Prisma, $Enums  } from "../../generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";

import ws from "ws";



// =========================================================
//******* DOWNLOAD INCIDENT DATA  *******
// =========================================================

type TimePeriodEnum = $Enums.TimePeriod;
neonConfig.webSocketConstructor = ws;

const connectionString = process.env.DATABASE_URL!;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set in .env");
}

const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

// 1. CONSTANTE DE L'API CKAN
// 2. Identifiant de la ressource (table/dataset), format UUID (Universally Unique Identifier)
// 3. Nombre d'entrée par demande
const CKAN_BASE_URL = "https://www.donneesquebec.ca/recherche/api/3/action/datastore_search"
const CKAN_SQL_URL = "https://www.donneesquebec.ca/recherche/api/3/action/datastore_search_sql"
const RESOURCE_ID = "c6f482bf-bf0f-4960-8b2f-9982c211addd"
const PAGE_SIZE = 100;


// Format de contenu CKAN basé sur la réponse d'une requête unique testée:
// https://www.donneesquebec.ca/recherche/api/3/action/datastore_search?resource_id=c6f482bf-bf0f-4960-8b2f-9982c211addd&limit=1

type CkanRecord = {
    _id: number;
    CATEGORIE?: string;
    DATE?: string;
    QUART?: "jour" | "soir" | "nuit"
    PDQ?: string;
    X?: string;
    Y?: string;
    LONGITUDE?: string;
    LATITUDE?: string;  
};

type CkanPage = {
  total: number | null;
  records: CkanRecord[];
};

// Assemble l'URL de demande à l'API basé sur les paramètres modulaires établis
// Si la demande est reçu avec success: CKAN renvoie un Object JSON duquel on extrait les champs, total(nombre d'entrée) et record(contenu)
async function fetchPage(offset: number) {
    const url = 
    `${CKAN_BASE_URL}?resource_id=${RESOURCE_ID}`+
    `&limit=${PAGE_SIZE}&offset=${offset}`+
    `&sort=DATE desc`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Erreur API CKAN: ${response.status} ${response.statusText}`);
    }

    const json = await response.json();
    return json.result as {
        total: number;
        records: CkanRecord[];
    };
}

// async function fetch2025(offset:number): Promise<CkanPage> {
//   const sql = `
//     SELECT *
//     FROM "${RESOURCE_ID}"
//     WHERE "DATE" LIKE '2025%'
//     ORDER BY "DATE" DESC
//     LIMIT ${PAGE_SIZE}
//     OFFSET ${offset}
//     `;
//     const url = `${CKAN_SQL_URL}?sql=${encodeURIComponent(sql)}`;
//     const response = await fetch(url);
//     if (!response.ok) {
//       throw new Error(`Erreur API CKAN (SQL): ${response.status} ${response.statusText}`);
//     }

//      const json = await response.json();
//     const records = json.result.records as CkanRecord[];

//     return {
//       total: null,
//       records,
//     };
// }

// Convertion des champs de la réponse (json) du CKAN 
// dans le format du Model Incident de Prisma
function toNumberOrNull(value?: string): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

// Convertion des champs CKAN vers le modèle Incident de Prisma
// QUART -> enum TimePeriod (avec valeur par défaut)
function mapRecordToIncident(record: CkanRecord): Prisma.IncidentCreateInput {
  let timePeriod: TimePeriodEnum = $Enums.TimePeriod.jour;
  if (record.QUART === "soir") {
    timePeriod = $Enums.TimePeriod.soir;
  } else if (record.QUART === "nuit") { 
    timePeriod = $Enums.TimePeriod.nuit;
  } else if (record.QUART === "jour") {
    timePeriod = $Enums.TimePeriod.jour;
  }

  const x = toNumberOrNull(record.X);
  const y = toNumberOrNull(record.Y);
  const longitude = toNumberOrNull(record.LONGITUDE);
  const latitude = toNumberOrNull(record.LATITUDE);

  const pdqNumber = record.PDQ ? Number.parseInt(record.PDQ, 10) : 0;
  if (!pdqNumber || Number.isNaN(pdqNumber)) {
    throw new Error(`PDQ invalide pour le record _id=${record._id}: ${record.PDQ}`);
  }

  return {
    category: record.CATEGORIE ?? "Inconnu",
    date: record.DATE ? new Date(record.DATE) : new Date(),
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
          name: `PDQ ${pdqNumber}`,
          address: "",
          cityCode: "",
          latitude: 0,
          longitude: 0,
        },
      },
    },
  };
}

// Import des données du CKAN dans la base de donnée
async function importIncidents() {
    console.log("Début de l'import CKAN => Neon...");

    let offset = 0;
    let importedCount = 0;

    while (true) {
        console.log(`=> Récupération des enregistrements à partir de offset=${offset}...`);
        const result = await fetchPage(offset);

        if (!result.records || result.records.length === 0) {
            console.log("Aucun enregistrement supplémentaire, fin de l'import.")
            break;
        }

        const MAX_IMPORT = 15000;
        for (const record of result.records) {
            try {
                const data = mapRecordToIncident(record);
                await prisma.incident.create({ data });
                importedCount++;
            } catch (err) {
                console.error("Erreur sur le record _id=", record._id, err);
            }
            if (importedCount >= MAX_IMPORT) {
                console.log(`Limite de sécurité atteinte (${MAX_IMPORT} incidents). Stop.`);
                return;
            }
        }

        offset += PAGE_SIZE;
    }

    console.log(`Import terminé. Total incidents créés: ${importedCount}`);
}

importIncidents()
    .catch((err) => {
        console.error("Erreur globale pendant l'import :", err);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });