import "dotenv/config";
import { PrismaClient, Prisma } from "../../generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set in .env");

const adapter = new PrismaNeon({ connectionString });
export const prisma = new PrismaClient({ adapter });

export const NYC_SOURCE = "nypd_complaints";
export const HISTORIC_DATASET_URL = "https://data.cityofnewyork.us/resource/qgea-i56i.json";
export const CURRENT_DATASET_URL = "https://data.cityofnewyork.us/resource/5uac-w243.json";
export const DEFAULT_PAGE_SIZE = 5000;

type Args = Record<string, string | true>;

export type NypdRecord = {
  cmplnt_num?: string;
  cmplnt_fr_dt?: string;
  cmplnt_fr_tm?: string;
  cmplnt_to_dt?: string;
  cmplnt_to_tm?: string;
  rpt_dt?: string;
  ky_cd?: string;
  addr_pct_cd?: string;
  ofns_desc?: string;
  pd_cd?: string;
  pd_desc?: string;
  crm_atpt_cptd_cd?: string;
  law_cat_cd?: string;
  boro_nm?: string;
  loc_of_occur_desc?: string;
  prem_typ_desc?: string;
  juris_desc?: string;
  jurisdiction_code?: string;
  parks_nm?: string;
  hadevelopt?: string;
  housing_psa?: string;
  x_coord_cd?: string;
  y_coord_cd?: string;
  susp_age_group?: string;
  susp_race?: string;
  susp_sex?: string;
  transit_district?: string;
  latitude?: string;
  longitude?: string;
  patrol_boro?: string;
  station_name?: string;
  vic_age_group?: string;
  vic_race?: string;
  vic_sex?: string;
};

export type ImportStats = {
  fetchedCount: number;
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
};

export function parseArgs(): Args {
  const args: Args = {};
  for (const arg of process.argv.slice(2)) {
    if (!arg.startsWith("--")) continue;
    const [key, ...rest] = arg.slice(2).split("=");
    if (!key) continue;
    args[key] = rest.length === 0 ? true : rest.join("=");
  }
  return args;
}

export function readPositiveInt(value: string | true | undefined, fallback: number): number {
  if (value === undefined || value === true) return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`Expected a positive integer, got ${value}`);
  return n;
}

export function readMax(value: string | true | undefined): number {
  if (value === undefined || value === true || value === "all") return Infinity;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`Expected --max to be a positive integer or all, got ${value}`);
  return n;
}

export function dateRangeFromArgs(args: Args): { from: string; to: string } {
  if (typeof args.year === "string") {
    const year = Number(args.year);
    if (!Number.isInteger(year) || year < 1900) throw new Error(`Invalid --year value: ${args.year}`);
    return { from: `${year}-01-01`, to: `${year}-12-31` };
  }

  if (typeof args.from === "string" && typeof args.to === "string") {
    return { from: args.from, to: args.to };
  }

  throw new Error("Use --year=YYYY or --from=YYYY-MM-DD --to=YYYY-MM-DD");
}

export function latestRangeFromArgs(args: Args): { from: string; to: string; days: number } {
  const now = new Date();
  const to = typeof args.to === "string" ? args.to : toDateKey(now);

  if (typeof args.from === "string") {
    return { from: args.from, to, days: 0 };
  }

  const days = readPositiveInt(args.days, 30);
  const fromDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - days, 0, 0, 0));
  return { from: toDateKey(fromDate), to, days };
}

export async function ensureNycDataSource() {
  await prisma.dataSource.upsert({
    where: { id: NYC_SOURCE },
    create: {
      id: NYC_SOURCE,
      name: "NYPD Complaint Data",
      city: "new_york",
      region: "NY",
      country: "US",
      provider: "NYPD / NYC Open Data",
      sourceUrl: HISTORIC_DATASET_URL,
      supportsPointLocation: true,
      supportsVictimFields: true,
      supportsSuspectFields: true,
      supportsSexCrimes: true,
      supportsHomicide: true,
      supportsReportedDate: true,
      supportsOccurredTime: true,
      coverage: {
        historicDatasetUrl: HISTORIC_DATASET_URL,
        currentDatasetUrl: CURRENT_DATASET_URL,
        sourceIdField: "cmplnt_num",
      },
    },
    update: {
      name: "NYPD Complaint Data",
      city: "new_york",
      region: "NY",
      country: "US",
      provider: "NYPD / NYC Open Data",
      sourceUrl: HISTORIC_DATASET_URL,
      supportsPointLocation: true,
      supportsVictimFields: true,
      supportsSuspectFields: true,
      supportsSexCrimes: true,
      supportsHomicide: true,
      supportsReportedDate: true,
      supportsOccurredTime: true,
      coverage: {
        historicDatasetUrl: HISTORIC_DATASET_URL,
        currentDatasetUrl: CURRENT_DATASET_URL,
        sourceIdField: "cmplnt_num",
      },
    },
  });
}

export async function fetchNypdPage(args: {
  datasetUrl: string;
  from: string;
  to: string;
  offset: number;
  limit: number;
  dateField?: "cmplnt_fr_dt" | "rpt_dt";
}) {
  const dateField = args.dateField ?? "cmplnt_fr_dt";
  const url = new URL(args.datasetUrl);
  url.search = new URLSearchParams({
    "$limit": String(args.limit),
    "$offset": String(args.offset),
    "$order": `${dateField} ASC, cmplnt_num ASC`,
    "$where": `${dateField} between '${args.from}T00:00:00' and '${args.to}T23:59:59'`,
  }).toString();

  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`NYC Open Data error ${response.status} ${response.statusText}: ${body.slice(0, 300)}`);
  }

  return (await response.json()) as NypdRecord[];
}

export async function importNypdRange(args: {
  mode: string;
  datasetUrl: string;
  from: string;
  to: string;
  pageSize: number;
  max: number;
  dateField?: "cmplnt_fr_dt" | "rpt_dt";
}) {
  await ensureNycDataSource();

  const run = await prisma.importRun.create({
    data: {
      source: NYC_SOURCE,
      mode: args.mode,
      status: "running",
      metadata: {
        datasetUrl: args.datasetUrl,
        from: args.from,
        to: args.to,
        pageSize: args.pageSize,
        max: Number.isFinite(args.max) ? args.max : "all",
        writeMode: "batch",
      },
    },
  });

  const stats: ImportStats = {
    fetchedCount: 0,
    insertedCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    errorCount: 0,
  };

  let offset = 0;
  let newestDate: Date | null = null;
  let newestSourceId: string | null = null;

  try {
    while (stats.fetchedCount < args.max) {
      const remaining = args.max - stats.fetchedCount;
      const limit = Math.min(args.pageSize, Number.isFinite(remaining) ? remaining : args.pageSize);
      console.log(`Fetch NYC ${args.mode}: offset=${offset} limit=${limit} range=${args.from}..${args.to}`);

      const fetchArgs: Parameters<typeof fetchNypdPage>[0] = {
        datasetUrl: args.datasetUrl,
        from: args.from,
        to: args.to,
        offset,
        limit,
      };
      if (args.dateField) fetchArgs.dateField = args.dateField;

      const records = await fetchNypdPage(fetchArgs);
      if (records.length === 0) break;

      stats.fetchedCount += records.length;

      const result = await processNypdBatch(records);
      stats.insertedCount += result.insertedCount;
      stats.updatedCount += result.updatedCount;
      stats.skippedCount += result.skippedCount;
      stats.errorCount += result.errorCount;

      for (const data of result.validData) {
        const incidentDate = data.date instanceof Date ? data.date : new Date(data.date);
        if (!newestDate || incidentDate.getTime() > newestDate.getTime()) {
          newestDate = incidentDate;
          newestSourceId = data.sourceId;
        } else if (incidentDate.getTime() === newestDate.getTime()) {
          newestSourceId = maxString(newestSourceId, data.sourceId);
        }
      }

      console.log(
        `Batch wrote: inserted=${result.insertedCount} updated=${result.updatedCount} skipped=${result.skippedCount} errors=${result.errorCount}`
      );

      if (records.length < limit) break;
      offset += limit;
    }

    if (newestDate && newestSourceId) {
      await prisma.importCursor.upsert({
        where: { source: NYC_SOURCE },
        create: {
          source: NYC_SOURCE,
          lastDate: newestDate,
          lastSourceId: newestSourceId,
          lastRunAt: new Date(),
        },
        update: {
          lastDate: newestDate,
          lastSourceId: newestSourceId,
          lastRunAt: new Date(),
        },
      });
    }

    await prisma.importRun.update({
      where: { id: run.id },
      data: {
        status: stats.errorCount > 0 ? "completed_with_errors" : "completed",
        finishedAt: new Date(),
        ...stats,
        message: `Imported NYC records for ${args.from}..${args.to}`,
      },
    });

    return stats;
  } catch (error) {
    await prisma.importRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        finishedAt: new Date(),
        ...stats,
        message: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}

async function processNypdBatch(records: NypdRecord[]) {
  const validData: Prisma.IncidentCreateManyInput[] = [];
  let skippedCount = 0;
  let errorCount = 0;

  for (const record of records) {
    try {
      const data = mapNypdRecordToIncident(record);
      if (!data) {
        skippedCount++;
        continue;
      }
      validData.push(data);
    } catch (error) {
      errorCount++;
      console.error("NYC record failed", record.cmplnt_num, error);
    }
  }

  if (validData.length === 0) {
    return { validData, insertedCount: 0, updatedCount: 0, skippedCount, errorCount };
  }

  const sourceIds = validData.map((data) => data.sourceId);
  const existingRows = await prisma.incident.findMany({
    where: {
      source: NYC_SOURCE,
      sourceId: { in: sourceIds },
    },
    select: { sourceId: true },
  });
  const existingSourceIds = new Set(existingRows.map((row) => row.sourceId));

  const newData = validData.filter((data) => !existingSourceIds.has(data.sourceId));
  const existingData = validData.filter((data) => existingSourceIds.has(data.sourceId));

  let insertedCount = 0;
  if (newData.length > 0) {
    const created = await prisma.incident.createMany({
      data: newData,
      skipDuplicates: true,
    });
    insertedCount = created.count;
  }

  let updatedCount = 0;
  for (const data of existingData) {
    await prisma.incident.update({
      where: { source_sourceId: { source: NYC_SOURCE, sourceId: data.sourceId } },
      data,
    });
    updatedCount++;
  }

  return { validData, insertedCount, updatedCount, skippedCount, errorCount };
}
export function mapNypdRecordToIncident(record: NypdRecord): Prisma.IncidentCreateManyInput | null {
  if (!record.cmplnt_num) return null;

  const occurredAt = parseNypdDateTime(record.cmplnt_fr_dt, record.cmplnt_fr_tm);
  const occurredAtEnd = parseNypdDateTime(record.cmplnt_to_dt, record.cmplnt_to_tm);
  const reportedAt = parseNypdDateTime(record.rpt_dt);
  const date = occurredAt ?? reportedAt;
  if (!date) return null;

  const latitude = toNumberOrNull(record.latitude);
  const longitude = toNumberOrNull(record.longitude);
  const sourceCategory = clean(record.ofns_desc);
  const sourceSubcategory = clean(record.pd_desc);
  const category = normalizeNypdCategory(
    sourceCategory ?? sourceSubcategory ?? clean(record.law_cat_cd) ?? "Unknown"
  );

  return {
    source: NYC_SOURCE,
    sourceId: record.cmplnt_num,
    category,
    sourceCategory,
    sourceSubcategory,
    severity: clean(record.law_cat_cd),
    city: "new_york",
    region: "NY",
    country: "US",
    date,
    occurredAt,
    occurredAtEnd,
    reportedAt,
    x: toNumberOrNull(record.x_coord_cd),
    y: toNumberOrNull(record.y_coord_cd),
    longitude,
    latitude,
    policeDistrict: clean(record.patrol_boro) ?? clean(record.juris_desc),
    precinct: clean(record.addr_pct_cd) ?? clean(record.jurisdiction_code),
    borough: clean(record.boro_nm),
    neighborhood: clean(record.station_name) ?? clean(record.hadevelopt) ?? clean(record.parks_nm),
    locationType: clean(record.loc_of_occur_desc),
    premiseType: clean(record.prem_typ_desc),
    victimAgeGroup: clean(record.vic_age_group),
    victimSex: clean(record.vic_sex),
    victimRace: clean(record.vic_race),
    suspectAgeGroup: clean(record.susp_age_group),
    suspectSex: clean(record.susp_sex),
    suspectRace: clean(record.susp_race),
    weapon: null,
    domesticRelated: null,
    hateCrime: null,
    shootingRelated: null,
    raw: record as Prisma.InputJsonValue,
    pdqId: null,
  };
}

function normalizeNypdCategory(category: string) {
  const normalized = category.trim().replace(/\s+/g, " ");

  const aliases: Record<string, string> = {
    "INTOXICATED/IMPAIRED DRIVING": "INTOXICATED & IMPAIRED DRIVING",
  };

  return aliases[normalized] ?? normalized;
}

function parseNypdDateTime(dateValue?: string, timeValue?: string): Date | null {
  const date = parseDateParts(dateValue);
  if (!date) return null;

  const time = parseTimeParts(timeValue);
  return new Date(Date.UTC(date.year, date.month - 1, date.day, time.hour, time.minute, time.second));
}

function parseDateParts(value?: string): { year: number; month: number; day: number } | null {
  if (!value) return null;
  const match = value.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function parseTimeParts(value?: string): { hour: number; minute: number; second: number } {
  if (!value) return { hour: 12, minute: 0, second: 0 };
  const match = value.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return { hour: 12, minute: 0, second: 0 };
  return {
    hour: clamp(Number(match[1]), 0, 23),
    minute: clamp(Number(match[2]), 0, 59),
    second: clamp(Number(match[3] ?? 0), 0, 59),
  };
}

function toDateKey(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toNumberOrNull(value?: string): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clean(value?: string): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 || trimmed === "(null)" ? null : trimmed;
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function maxString(a: string | null, b: string) {
  if (!a) return b;
  return a.localeCompare(b) >= 0 ? a : b;
}
