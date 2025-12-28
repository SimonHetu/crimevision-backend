/*
  Warnings:

  - A unique constraint covering the columns `[source,sourceId]` on the table `Incident` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `source` to the `Incident` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sourceId` to the `Incident` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Incident" ADD COLUMN     "source" TEXT NOT NULL,
ADD COLUMN     "sourceId" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Incident_source_sourceId_key" ON "Incident"("source", "sourceId");
