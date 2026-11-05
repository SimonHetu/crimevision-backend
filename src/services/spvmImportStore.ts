import prisma from "../prisma";
import { SPVM_CURSOR, SPVM_SOURCE, type ImportCheckpoint, type SpvmImportStore } from "./spvmDailyImport";

export const spvmImportStore: SpvmImportStore = {
  getCheckpoint: () => prisma.importCursor.findUnique({ where: { source: SPVM_CURSOR } }),
  async getLatestIncidentDate() {
    const incident = await prisma.incident.findFirst({ where: { source: SPVM_SOURCE }, orderBy: { date: "desc" }, select: { date: true } });
    return incident?.date ?? null;
  },
  async commit(expected, incidents, next) {
    return prisma.$transaction(async (tx) => {
      const [lock] = await tx.$queryRaw<{ acquired: boolean }[]>`SELECT pg_try_advisory_xact_lock(43198011) AS acquired`;
      if (!lock?.acquired) return false;
      const current = await tx.importCursor.findUnique({ where: { source: SPVM_CURSOR } });
      if (!sameCheckpoint(current, expected)) return false;
      if (incidents.length) {
        const pdqs = [...new Set(incidents.map((incident) => incident.pdqId))];
        await tx.pdq.createMany({ data: pdqs.map((id) => ({ id, name: id === 0 ? "Poste inconnu" : `PDQ ${id}`, address: "", cityCode: "", latitude: 0, longitude: 0 })), skipDuplicates: true });
        const payload = JSON.stringify(incidents);
        // One bulk upsert per page; unchanged overlap records aren't rewritten.
        await tx.$executeRaw`
          INSERT INTO "Incident" AS target
            ("source", "sourceId", "category", "sourceCategory", "city", "region", "country", "date", "occurredAt", "timePeriod", "x", "y", "longitude", "latitude", "pdqId", "updatedAt")
          SELECT r."source", r."sourceId", r."category", r."sourceCategory", r."city", r."region", r."country", r."date", r."occurredAt", r."timePeriod"::"TimePeriod", r."x", r."y", r."longitude", r."latitude", r."pdqId", NOW()
          FROM jsonb_to_recordset(${payload}::jsonb) AS r
            ("source" text, "sourceId" text, "category" text, "sourceCategory" text, "city" text, "region" text, "country" text, "date" timestamp, "occurredAt" timestamp, "timePeriod" text, "x" double precision, "y" double precision, "longitude" double precision, "latitude" double precision, "pdqId" integer)
          ON CONFLICT ("source", "sourceId") DO UPDATE SET
            "category" = EXCLUDED."category", "sourceCategory" = EXCLUDED."sourceCategory",
            "city" = EXCLUDED."city", "region" = EXCLUDED."region", "country" = EXCLUDED."country",
            "date" = EXCLUDED."date", "occurredAt" = EXCLUDED."occurredAt", "timePeriod" = EXCLUDED."timePeriod",
            "x" = EXCLUDED."x", "y" = EXCLUDED."y", "longitude" = EXCLUDED."longitude", "latitude" = EXCLUDED."latitude", "pdqId" = EXCLUDED."pdqId", "updatedAt" = NOW()
          WHERE (target."category", target."sourceCategory", target."city", target."region", target."country", target."date", target."occurredAt", target."timePeriod", target."x", target."y", target."longitude", target."latitude", target."pdqId")
            IS DISTINCT FROM (EXCLUDED."category", EXCLUDED."sourceCategory", EXCLUDED."city", EXCLUDED."region", EXCLUDED."country", EXCLUDED."date", EXCLUDED."occurredAt", EXCLUDED."timePeriod", EXCLUDED."x", EXCLUDED."y", EXCLUDED."longitude", EXCLUDED."latitude", EXCLUDED."pdqId")
        `;
      }
      await tx.importCursor.upsert({ where: { source: SPVM_CURSOR }, create: { source: SPVM_CURSOR, ...next, lastRunAt: new Date() }, update: { ...next, lastRunAt: new Date() } });
      return true;
    }, { maxWait: 5000, timeout: 25_000 });
  },
};

function sameCheckpoint(a: ImportCheckpoint | null, b: ImportCheckpoint | null) {
  if (!a || !b) return a === b;
  return a.lastDate?.getTime() === b.lastDate?.getTime() && a.lastSourceId === b.lastSourceId;
}
