import {
  CURRENT_DATASET_URL,
  DEFAULT_PAGE_SIZE,
  importNypdRange,
  latestRangeFromArgs,
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
  npx tsx src/scripts/importLatestNycIncidents.ts
  npx tsx src/scripts/importLatestNycIncidents.ts --days=30
  npx tsx src/scripts/importLatestNycIncidents.ts --from=2026-09-01 --to=2026-09-18

Options:
  --days=N          Rolling number of days to re-import, default 30
  --from=YYYY-MM-DD Import from date instead of --days
  --to=YYYY-MM-DD   Import to date, default today UTC
  --page-size=N     Socrata page size, default ${DEFAULT_PAGE_SIZE}
  --max=N|all       Maximum records to process, default all
  --help            Show this help
`);
    return;
  }

  const range = latestRangeFromArgs(args);
  const pageSize = readPositiveInt(args["page-size"], DEFAULT_PAGE_SIZE);
  const max = readMax(args.max);

  console.log(`NYC latest ${range.from}..${range.to}`);

  const stats = await importNypdRange({
    mode: "latest",
    datasetUrl: CURRENT_DATASET_URL,
    from: range.from,
    to: range.to,
    pageSize,
    max,
    dateField: "rpt_dt",
  });

  console.log("=================================");
  console.log("NYC latest import complete");
  console.log(`Fetched  : ${stats.fetchedCount}`);
  console.log(`Inserted : ${stats.insertedCount}`);
  console.log(`Updated  : ${stats.updatedCount}`);
  console.log(`Skipped  : ${stats.skippedCount}`);
  console.log(`Errors   : ${stats.errorCount}`);
  console.log("=================================");
}

main()
  .catch((error) => {
    console.error("NYC latest import failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
