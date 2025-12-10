/*
  Warnings:

  - You are about to drop the column `borough` on the `Pdq` table. All the data in the column will be lost.
  - Made the column `name` on table `Pdq` required. This step will fail if there are existing NULL values in that column.
  - Made the column `address` on table `Pdq` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Pdq" DROP COLUMN "borough",
ADD COLUMN     "cityCode" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "latitude" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "longitude" DOUBLE PRECISION NOT NULL DEFAULT 0,
ALTER COLUMN "name" SET NOT NULL,
ALTER COLUMN "name" SET DEFAULT '',
ALTER COLUMN "address" SET NOT NULL,
ALTER COLUMN "address" SET DEFAULT '';
