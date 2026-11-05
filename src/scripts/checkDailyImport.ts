import prisma from "../prisma";
import { buildSpvmQuery, fetchSpvmPage } from "../services/spvmDailyImport";
import { spvmImportStore } from "../services/spvmImportStore";

async function check() {
  const latest = await spvmImportStore.getLatestIncidentDate();
  if (!latest) throw new Error("No bootstrapped SPVM incidents");
  const start = new Date(latest.getTime() - 7 * 86_400_000).toISOString().slice(0, 10);
  const cutoff = new Date().toISOString().slice(0, 10);
  const records = await fetchSpvmPage({ day: start, id: 0 }, cutoff, 1);
  console.log(JSON.stringify({ readOnly: true, latestDatabaseDate: latest, checkpoint: await spvmImportStore.getCheckpoint(), sourceQuery: buildSpvmQuery({ day: start, id: 0 }, cutoff, 1), sourceRecordsReturned: records.length }, null, 2));
}
check().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
