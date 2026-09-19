import {
  DEFAULT_PAGE_SIZE,
  HISTORIC_DATASET_URL,
  dateRangeFromArgs,
  importNypdRange,
  parseArgs,
  prisma,
  readMax,
  readPositiveInt,
} from "./nycIncidentImport";

async function main() {
  const args = parseArgs();

  if (args.help) {
    console.log(`
Usage:
  npx tsx src/scripts/importNycIncidents.ts --year=2026
  npx tsx src/scripts/importNycIncidents.ts --from=2024-01-01 --to=2024-12-31

Options:
  --year=YYYY       Import one calendar year
  --from=YYYY-MM-DD Import from date, requires --to
  --to=YYYY-MM-DD   Import to date, requires --from
  --page-size=N     Socrata page size, default ${DEFAULT_PAGE_SIZE}
  --max=N|all       Maximum records to process, default all
  --help            Show this help
`);
    return;
  }

  const range = dateRangeFromArgs(args);
  const pageSize = readPositiveInt(args["page-size"], DEFAULT_PAGE_SIZE);
  const max = readMax(args.max);

  console.log(`NYC backfill ${range.from}..${range.to}`);

  const stats = await importNypdRange({
    mode: "backfill",
    datasetUrl: HISTORIC_DATASET_URL,
    from: range.from,
    to: range.to,
    pageSize,
    max,
    dateField: "cmplnt_fr_dt",
  });

  console.log("=================================");
  console.log("NYC backfill complete");
  console.log(`Fetched  : ${stats.fetchedCount}`);
  console.log(`Inserted : ${stats.insertedCount}`);
  console.log(`Updated  : ${stats.updatedCount}`);
  console.log(`Skipped  : ${stats.skippedCount}`);
  console.log(`Errors   : ${stats.errorCount}`);
  console.log("=================================");
}

main()
  .catch((error) => {
    console.error("NYC backfill failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
