import { runSpvmDailyImport } from "../services/spvmDailyImport";
import { spvmImportStore } from "../services/spvmImportStore";
import prisma from "../prisma";

const maxArg = process.argv.find((arg) => arg.startsWith("--max="));
const maxRecords = maxArg ? Number(maxArg.slice(6)) : 5000;
runSpvmDailyImport(spvmImportStore, { maxRecords })
  .then((result) => console.log(JSON.stringify(result, null, 2)))
  .catch((error) => { console.error("Daily SPVM import failed", error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
