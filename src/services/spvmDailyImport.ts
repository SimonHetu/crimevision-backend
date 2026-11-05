export const SPVM_SOURCE = "spvm_incidents";
export const SPVM_CURSOR = "spvm_incidents_daily_v1";
const RESOURCE_ID = "c6f482bf-bf0f-4960-8b2f-9982c211addd";
const DAY = 86_400_000;
const OVERLAP_DAYS = 7;

export type ImportPosition = { day: string; id: number };
export type ImportCheckpoint = { lastDate: Date | null; lastSourceId: string | null };
export type SpvmRecord = {
  _id: number;
  DATE?: string;
  CATEGORIE?: string;
  QUART?: string;
  PDQ?: string | null;
  X?: string | null;
  Y?: string | null;
  LONGITUDE?: string | null;
  LATITUDE?: string | null;
};
export type SpvmIncident = {
  source: string; sourceId: string; category: string; sourceCategory: string;
  city: string; region: string; country: string; date: Date; occurredAt: Date;
  timePeriod: "jour" | "soir" | "nuit" | null;
  x: number | null; y: number | null; longitude: number | null; latitude: number | null; pdqId: number;
};
export interface SpvmImportStore {
  getCheckpoint(): Promise<ImportCheckpoint | null>;
  getLatestIncidentDate(): Promise<Date | null>;
  // Compare the persisted checkpoint under a transaction lock before writing.
  commit(expected: ImportCheckpoint | null, incidents: SpvmIncident[], next: ImportCheckpoint): Promise<boolean>;
}
type ImportOptions = {
  now?: Date;
  maxRecords?: number;
  budgetMs?: number;
  clock?: () => number;
  fetchPage?: (position: ImportPosition, cutoff: string, limit: number) => Promise<SpvmRecord[]>;
};

function dayKey(date: Date) { return date.toISOString().slice(0, 10); }
function dayDate(day: string) {
  const date = new Date(`${day}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(date.getTime()) || dayKey(date) !== day) {
    throw new Error(`Invalid SPVM date: ${day}`);
  }
  return date;
}
export function recordPosition(record: SpvmRecord): ImportPosition {
  if (!Number.isSafeInteger(record._id) || record._id < 1) throw new Error("Invalid SPVM source ID");
  const day = record.DATE ?? "";
  dayDate(day);
  return { day, id: record._id };
}
function coordinate(value: string | null | undefined) {
  if (value == null || !value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
export function mapSpvmRecord(record: SpvmRecord): SpvmIncident {
  const position = recordPosition(record);
  const pdqId = record.PDQ == null || !record.PDQ.trim() ? 0 : Number(record.PDQ);
  if (!Number.isSafeInteger(pdqId) || pdqId < 0) throw new Error(`Invalid PDQ for SPVM ${record._id}`);
  const date = new Date(`${position.day}T12:00:00.000Z`);
  const lat = coordinate(record.LATITUDE);
  const lng = coordinate(record.LONGITUDE);
  const located = lat != null && lng != null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && (lat !== 0 || lng !== 0);
  return {
    source: SPVM_SOURCE, sourceId: String(record._id), category: record.CATEGORIE ?? "Inconnu",
    sourceCategory: record.CATEGORIE ?? "Inconnu", city: "montreal", region: "QC", country: "CA",
    date, occurredAt: date,
    timePeriod: record.QUART === "jour" || record.QUART === "soir" || record.QUART === "nuit" ? record.QUART : null,
    x: coordinate(record.X), y: coordinate(record.Y), latitude: located ? lat : null, longitude: located ? lng : null, pdqId,
  };
}

export function buildSpvmQuery(position: ImportPosition, cutoff: string, limit: number) {
  // Dates and IDs are validated before being included in the source SQL.
  dayDate(position.day); dayDate(cutoff);
  if (!Number.isSafeInteger(position.id) || position.id < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("Invalid SPVM page parameters");
  }
  return `SELECT * FROM "${RESOURCE_ID}" WHERE ("DATE" > '${position.day}' OR ("DATE" = '${position.day}' AND "_id" > ${position.id})) AND "DATE" < '${cutoff}' ORDER BY "DATE" ASC, "_id" ASC LIMIT ${limit}`;
}
export async function fetchSpvmPage(position: ImportPosition, cutoff: string, limit: number): Promise<SpvmRecord[]> {
  const url = new URL("https://www.donneesquebec.ca/recherche/api/3/action/datastore_search_sql");
  url.searchParams.set("sql", buildSpvmQuery(position, cutoff, limit));
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`SPVM source returned HTTP ${response.status}`);
  const json = await response.json() as { success?: boolean; result?: { records?: SpvmRecord[] } };
  if (!json.success || !Array.isArray(json.result?.records)) throw new Error("Invalid SPVM source response");
  return json.result.records;
}

export async function runSpvmDailyImport(store: SpvmImportStore, options: ImportOptions = {}) {
  const clock = options.clock ?? Date.now;
  const started = clock();
  const now = options.now ?? new Date();
  const maxRecords = options.maxRecords ?? 5000;
  const budgetMs = options.budgetMs ?? 180_000;
  if (!Number.isSafeInteger(maxRecords) || maxRecords < 1 || maxRecords > 5000 || budgetMs < 45_000 || budgetMs > 180_000) {
    throw new Error("Invalid daily import limits");
  }
  // Exclude today and yesterday in Montreal: one full day for late source updates.
  const localDay = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const cutoff = dayKey(new Date(dayDate(localDay).getTime() - DAY));
  let expected = await store.getCheckpoint();
  let emptyPageDate = expected?.lastDate ?? null;
  const completedBefore = expected?.lastSourceId?.startsWith("done:") ?? false;
  let position: ImportPosition;
  if (expected?.lastDate && expected.lastSourceId && !completedBefore) {
    position = { day: dayKey(expected.lastDate), id: Number(expected.lastSourceId) };
  } else {
    const latest = expected?.lastDate ?? await store.getLatestIncidentDate();
    if (!latest) throw new Error("Bootstrap the SPVM dataset before enabling daily imports");
    emptyPageDate = dayDate(dayKey(latest));
    position = { day: dayKey(new Date(latest.getTime() - OVERLAP_DAYS * DAY)), id: 0 };
  }
  const fetchPage = options.fetchPage ?? fetchSpvmPage;
  let processed = 0;
  let complete = false;
  let concurrentRun = false;
  // Reserve time for the final fetch and transaction before the platform deadline.
  while (processed < maxRecords && clock() - started < budgetMs - 40_000) {
    const limit = Math.min(100, maxRecords - processed);
    const records = await fetchPage(position, cutoff, limit);
    if (records.length > limit) throw new Error("SPVM source exceeded the requested page size");
    let previous = position;
    for (const record of records) {
      const next = recordPosition(record);
      if (next.day >= cutoff || next.day < previous.day || (next.day === previous.day && next.id <= previous.id)) {
        throw new Error("SPVM source returned an unordered or out-of-range record");
      }
      previous = next;
    }
    complete = records.length < limit;
    const last = records.length ? previous : null;
    // An empty overlap must not move the stored high-water mark backwards.
    const nextDate = last ? dayDate(last.day) : expected?.lastDate ?? emptyPageDate ?? dayDate(position.day);
    const nextId = last ? String(last.id) : expected?.lastSourceId?.replace(/^done:/, "") ?? String(position.id);
    const next: ImportCheckpoint = { lastDate: nextDate, lastSourceId: complete ? `done:${nextId}` : nextId };
    if (!await store.commit(expected, records.map(mapSpvmRecord), next)) {
      concurrentRun = true;
      complete = false;
      break;
    }
    expected = next;
    position = { day: dayKey(nextDate), id: Number(nextId) };
    processed += records.length;
    if (complete) break;
  }
  return {
    source: SPVM_SOURCE, processed, complete, concurrentRun,
    reason: concurrentRun ? "concurrent_run" : complete ? "caught_up" : processed >= maxRecords ? "record_limit" : "time_budget",
    elapsedMs: clock() - started, cutoffExclusive: cutoff,
    checkpoint: expected,
  };
}
