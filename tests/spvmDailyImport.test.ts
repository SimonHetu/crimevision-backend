import assert from "node:assert/strict";
import { test } from "node:test";
import express from "express";
import { createCronRouter } from "../src/routes/cron.routes";
import vercelHandler, { config as vercelConfig } from "../api/index";
import { buildSpvmQuery, mapSpvmRecord, runSpvmDailyImport, type ImportCheckpoint, type ImportPosition, type SpvmImportStore, type SpvmRecord } from "../src/services/spvmDailyImport";

const now = new Date("2026-11-05T15:00:00Z");
function memoryStore(initial: ImportCheckpoint | null = null) {
  let checkpoint = initial;
  const rows = new Map<string, unknown>();
  const store: SpvmImportStore = {
    async getCheckpoint() { return checkpoint; },
    async getLatestIncidentDate() { return new Date("2026-10-25T12:00:00Z"); },
    async commit(expected, incidents, next) {
      assert.deepEqual(expected, checkpoint);
      incidents.forEach((incident) => rows.set(incident.sourceId, incident));
      checkpoint = next;
      return true;
    },
  };
  return { store, rows, checkpoint: () => checkpoint };
}
function source(records: SpvmRecord[]) {
  return async (position: ImportPosition, cutoff: string, limit: number) => records
    .filter((r) => r.DATE! < cutoff && (r.DATE! > position.day || (r.DATE === position.day && r._id > position.id)))
    .slice(0, limit);
}
const records = Array.from({ length: 250 }, (_, i) => ({ _id: i + 1, DATE: "2026-10-25", CATEGORIE: "Méfait", PDQ: "27" }));

test("bounded runs resume through every ID on the same day without skipping", async () => {
  const db = memoryStore();
  const first = await runSpvmDailyImport(db.store, { now, maxRecords: 125, fetchPage: source(records) });
  assert.equal(first.reason, "record_limit");
  assert.equal(db.checkpoint()?.lastSourceId, "125");
  const second = await runSpvmDailyImport(db.store, { now, maxRecords: 200, fetchPage: source(records) });
  assert.equal(second.complete, true);
  assert.equal(db.checkpoint()?.lastSourceId, "done:250");
  assert.equal(db.rows.size, 250);
});

test("failure keeps earlier batches and retries the failed batch", async () => {
  const db = memoryStore();
  const fetchPage = source(records);
  await assert.rejects(runSpvmDailyImport(db.store, { now, fetchPage: async (p, c, l) => {
    if (p.id === 100) throw new Error("Source unavailable");
    return fetchPage(p, c, l);
  } }), /Source unavailable/);
  assert.equal(db.checkpoint()?.lastSourceId, "100");
  await runSpvmDailyImport(db.store, { now, fetchPage });
  assert.equal(db.rows.size, 250);
});

test("a database failure cannot advance the checkpoint", async () => {
  const db = memoryStore();
  const commit = db.store.commit;
  db.store.commit = async (expected, incidents, next) => {
    if (next.lastSourceId === "200") throw new Error("Transaction rolled back");
    return commit(expected, incidents, next);
  };
  await assert.rejects(runSpvmDailyImport(db.store, { now, fetchPage: source(records) }), /rolled back/);
  assert.equal(db.checkpoint()?.lastSourceId, "100");
  assert.equal(db.rows.size, 100);
});

test("completed imports revisit late arrivals without duplicating existing records", async () => {
  const db = memoryStore();
  await runSpvmDailyImport(db.store, { now, fetchPage: source(records) });
  const withLate = [{ _id: 500, DATE: "2026-10-24", PDQ: "1" }, ...records];
  await runSpvmDailyImport(db.store, { now, fetchPage: source(withLate) });
  assert.equal(db.rows.size, 251);
  assert.equal(db.checkpoint()?.lastSourceId, "done:250");
});

test("time budget stops after a committed page and allows next-run continuation", async () => {
  const db = memoryStore();
  let time = 0;
  const fetchPage = source(records);
  const result = await runSpvmDailyImport(db.store, { now, clock: () => time, budgetMs: 45_000, fetchPage: async (p, c, l) => {
    time += 6000;
    return fetchPage(p, c, l);
  } });
  assert.equal(result.reason, "time_budget");
  assert.equal(db.checkpoint()?.lastSourceId, "100");
});

test("competing run exits without advancing the checkpoint", async () => {
  const db = memoryStore();
  db.store.commit = async () => false;
  const result = await runSpvmDailyImport(db.store, { now, fetchPage: source(records) });
  assert.equal(result.reason, "concurrent_run");
  assert.equal(db.rows.size, 0);
});

test("cutoff uses Montreal date across UTC midnight and keeps one full day buffer", async () => {
  const db = memoryStore();
  const result = await runSpvmDailyImport(db.store, { now: new Date("2026-11-05T02:00:00Z"), fetchPage: source([]) });
  assert.equal(result.cutoffExclusive, "2026-11-03");
  assert.equal(db.checkpoint()?.lastDate?.toISOString(), "2026-10-25T00:00:00.000Z");
});

test("an unbootstrapped database cannot start an unbounded historical import", async () => {
  const db = memoryStore();
  db.store.getLatestIncidentDate = async () => null;
  await assert.rejects(runSpvmDailyImport(db.store, { now, fetchPage: source(records) }), /Bootstrap/);
  assert.equal(db.rows.size, 0);
});

test("invalid and unordered records stop instead of being skipped", async () => {
  assert.throws(() => mapSpvmRecord({ _id: 1, DATE: "2026-02-30" }), /Invalid SPVM date/);
  const db = memoryStore();
  await assert.rejects(runSpvmDailyImport(db.store, { now, fetchPage: async () => [{ _id: 2, DATE: "2026-10-25" }, { _id: 1, DATE: "2026-10-25" }] }), /unordered/);
  assert.equal(db.checkpoint(), null);
  assert.equal(mapSpvmRecord({ _id: 1, DATE: "2026-10-25", LATITUDE: null, LONGITUDE: null }).latitude, null);
  assert.throws(() => buildSpvmQuery({ day: "x'; DROP TABLE", id: 1 }, "2026-11-04", 100));
});

test("cron rejects missing or incorrect secrets and only calls importer when authenticated", async () => {
  const original = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "test-only-secret-not-for-deployment";
  let calls = 0;
  const app = express();
  app.use("/api/cron", createCronRouter(async () => {
    calls++;
    return { source: "spvm_incidents", processed: 0, complete: true, concurrentRun: false, reason: "caught_up", elapsedMs: 0, cutoffExclusive: "2026-11-04", checkpoint: null };
  }));
  const server = app.listen(0, "127.0.0.1");
  try {
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const url = `http://127.0.0.1:${address.port}/api/cron/import-montreal`;
    assert.equal((await fetch(url)).status, 401);
    assert.equal((await fetch(url, { headers: { authorization: "Bearer wrong" } })).status, 401);
    assert.equal(calls, 0);
    delete process.env.CRON_SECRET;
    assert.equal((await fetch(url)).status, 401);
    process.env.CRON_SECRET = "test-only-secret-not-for-deployment";
    const response = await fetch(url, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(calls, 1);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (original === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = original;
  }
});

test("Vercel entrypoint routes cron to secret authentication before Clerk", async () => {
  assert.equal(vercelConfig.maxDuration, 240);
  const app = express();
  app.use((req, res) => { void vercelHandler(req, res); });
  const server = app.listen(0, "127.0.0.1");
  try {
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}`;
    assert.equal((await fetch(`${base}/api/health`)).status, 200);
    const response = await fetch(`${base}/api/cron/import-montreal`);
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { success: false, message: "Unauthorized" });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
