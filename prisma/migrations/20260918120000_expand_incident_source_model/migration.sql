-- Expand the canonical incident model so multiple city/source datasets can share one table.
-- Existing Montreal rows are preserved and backfilled with source-aware defaults.

DROP INDEX IF EXISTS "Incident_source_sourceId_key";
DROP INDEX IF EXISTS "source_sourceId";

ALTER TABLE "Incident"
  ALTER COLUMN "sourceId" TYPE TEXT USING "sourceId"::TEXT,
  ALTER COLUMN "timePeriod" DROP NOT NULL,
  ALTER COLUMN "pdqId" DROP NOT NULL,
  ADD COLUMN "sourceCategory" TEXT,
  ADD COLUMN "sourceSubcategory" TEXT,
  ADD COLUMN "severity" TEXT,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "region" TEXT,
  ADD COLUMN "country" TEXT,
  ADD COLUMN "occurredAt" TIMESTAMP(3),
  ADD COLUMN "occurredAtEnd" TIMESTAMP(3),
  ADD COLUMN "reportedAt" TIMESTAMP(3),
  ADD COLUMN "policeDistrict" TEXT,
  ADD COLUMN "precinct" TEXT,
  ADD COLUMN "borough" TEXT,
  ADD COLUMN "neighborhood" TEXT,
  ADD COLUMN "locationType" TEXT,
  ADD COLUMN "premiseType" TEXT,
  ADD COLUMN "victimAgeGroup" TEXT,
  ADD COLUMN "victimSex" TEXT,
  ADD COLUMN "victimRace" TEXT,
  ADD COLUMN "suspectAgeGroup" TEXT,
  ADD COLUMN "suspectSex" TEXT,
  ADD COLUMN "suspectRace" TEXT,
  ADD COLUMN "weapon" TEXT,
  ADD COLUMN "domesticRelated" BOOLEAN,
  ADD COLUMN "hateCrime" BOOLEAN,
  ADD COLUMN "shootingRelated" BOOLEAN,
  ADD COLUMN "raw" JSONB,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "Incident"
SET
  "sourceCategory" = COALESCE("sourceCategory", "category"),
  "city" = COALESCE("city", 'montreal'),
  "region" = COALESCE("region", 'QC'),
  "country" = COALESCE("country", 'CA'),
  "occurredAt" = COALESCE("occurredAt", "date");

ALTER TABLE "ImportCursor"
  ALTER COLUMN "lastSourceId" TYPE TEXT USING "lastSourceId"::TEXT;

CREATE UNIQUE INDEX "Incident_source_sourceId_key" ON "Incident"("source", "sourceId");
CREATE INDEX "Incident_source_date_idx" ON "Incident"("source", "date");
CREATE INDEX "Incident_city_date_idx" ON "Incident"("city", "date");
CREATE INDEX "Incident_category_date_idx" ON "Incident"("category", "date");
CREATE INDEX "Incident_latitude_longitude_idx" ON "Incident"("latitude", "longitude");

CREATE TABLE "DataSource" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "city" TEXT,
  "region" TEXT,
  "country" TEXT,
  "provider" TEXT,
  "sourceUrl" TEXT,
  "supportsPointLocation" BOOLEAN NOT NULL DEFAULT false,
  "supportsVictimFields" BOOLEAN NOT NULL DEFAULT false,
  "supportsSuspectFields" BOOLEAN NOT NULL DEFAULT false,
  "supportsSexCrimes" BOOLEAN NOT NULL DEFAULT false,
  "supportsHomicide" BOOLEAN NOT NULL DEFAULT false,
  "supportsReportedDate" BOOLEAN NOT NULL DEFAULT false,
  "supportsOccurredTime" BOOLEAN NOT NULL DEFAULT false,
  "coverage" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DataSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImportRun" (
  "id" SERIAL NOT NULL,
  "source" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "fetchedCount" INTEGER NOT NULL DEFAULT 0,
  "insertedCount" INTEGER NOT NULL DEFAULT 0,
  "updatedCount" INTEGER NOT NULL DEFAULT 0,
  "skippedCount" INTEGER NOT NULL DEFAULT 0,
  "errorCount" INTEGER NOT NULL DEFAULT 0,
  "message" TEXT,
  "metadata" JSONB,
  CONSTRAINT "ImportRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ImportRun_source_startedAt_idx" ON "ImportRun"("source", "startedAt");
CREATE INDEX "ImportRun_status_startedAt_idx" ON "ImportRun"("status", "startedAt");

INSERT INTO "DataSource" (
  "id",
  "name",
  "city",
  "region",
  "country",
  "provider",
  "sourceUrl",
  "supportsPointLocation",
  "supportsHomicide",
  "supportsReportedDate",
  "coverage"
)
VALUES (
  'spvm_incidents',
  'Actes criminels - Montreal',
  'montreal',
  'QC',
  'CA',
  'Ville de Montreal / Donnees Quebec',
  'https://www.donneesquebec.ca/recherche/dataset/vmtl-actes-criminels',
  true,
  true,
  false,
  '{"categories":["Introduction","Vol dans / sur vehicule a moteur","Vol de vehicule a moteur","Mefait","Vol qualifie","Infraction entrainant la mort"],"notes":"Dataset public agrege et limite pour protection de la vie privee."}'::jsonb
)
ON CONFLICT ("id") DO NOTHING;
