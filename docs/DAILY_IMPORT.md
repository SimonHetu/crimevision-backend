# Daily Montreal import on Vercel

The backend schedules `GET /api/cron/import-montreal` daily at `0 10 * * *`
(10:00 UTC: 05:00 Montreal in winter, 06:00 in summer). Hobby invocation may
occur later within that hour. The job runs on Vercel, independently of a local PC.

## Activate

1. In the **backend** Vercel project, add `CRON_SECRET` for **Production**.
   Use a cryptographically random value of at least 32 bytes. Never prefix it
   with `VITE_` or commit it. Vercel sends `Authorization: Bearer <CRON_SECRET>`.
2. Confirm `DATABASE_URL` is set for Production and Fluid Compute is enabled.
3. Deploy the backend changes. Changing an environment variable requires a new deployment.
4. Check the project’s Cron Jobs settings for `/api/cron/import-montreal`.
5. After the next scheduled run, inspect its function logs. A successful run logs
   `SPVM daily import` with `complete`, `processed`, `reason`, `elapsedMs` and checkpoint.
   An unchanged source can legitimately process overlap rows without creating new incidents.

No database migration is needed: the job uses the existing `ImportCursor` table
under `spvm_incidents_daily_v1`. The historical/NYC CLI importers remain separate.

## Progress and limits

- Requires an existing SPVM bootstrap. First run starts seven days before the
  most recent SPVM incident already in the database; it does not rebuild history.
- Pages use source date/ID ascending with keyset pagination. Completed runs replay
  the last seven source-data days to catch late arrivals and corrections. This is
  based on the latest source date, not today's date, so a stale source doesn't
  cause later releases to be skipped.
- A full day of source updates is buffered: today and yesterday in Montreal are excluded.
- Each page bulk-upserts at most 100 records. Missing coordinates stay null.
  Identical existing records are not rewritten.
- At most 5,000 records and a 180-second budget per invocation; 40 seconds are
  reserved for finishing a fetch/transaction. Vercel function limit is configured
  as 240 seconds. Verify the deployment's function settings honor that limit.
- Incident writes and checkpoint updates share a transaction. An advisory
  transaction lock plus checkpoint comparison prevents competing runs from
  moving progress backwards. Failures roll back the current page and stop.
- `complete: false` means the next daily run resumes the remaining work. This
  keeps computation bounded; a large backlog may need several days or a manual backfill.
- `lastSourceId` starts with `done:` when caught up. Otherwise it is the last
  committed source ID of an unfinished run. Do not edit this cursor manually.
- Updates older than the overlap require a manual historical re-import. Source
  deletions and source ID reassignments are not reconciled by this job.

## Verification

Run `npm test` and `npx tsc --noEmit`. Tests use in-memory data and do not modify
the real database. `npx tsx src/scripts/checkDailyImport.ts` performs a read-only
source/database preflight. For a deliberately bounded real import, run
`npx tsx src/scripts/runDailyImport.ts --max=100` from the backend directory.

Tomorrow's checks: deployed function returned 200, `reason: caught_up` (or a
documented limit), cursor timestamp advanced, and the latest eligible incident
date matches the source. A 401 means the Production secret is missing/wrong; a
500 means inspect function logs. Vercel cron does not guarantee automatic retries.

The caps reduce usage but do not guarantee zero cost or free-tier availability;
monitor Vercel CPU/memory and Neon compute/storage alongside normal app traffic.

Official references:
- https://vercel.com/docs/cron-jobs/usage-and-pricing
- https://vercel.com/docs/cron-jobs/manage-cron-jobs
- https://vercel.com/docs/functions/limitations
