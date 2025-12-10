-- CreateEnum
CREATE TYPE "TimePeriod" AS ENUM ('jour', 'nuit', 'soir');

-- CreateTable
CREATE TABLE "Pdq" (
    "id" INTEGER NOT NULL,
    "name" TEXT,
    "borough" TEXT,
    "address" TEXT,

    CONSTRAINT "Pdq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" SERIAL NOT NULL,
    "category" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "timePeriod" "TimePeriod" NOT NULL,
    "x" DOUBLE PRECISION,
    "y" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "latitude" DOUBLE PRECISION,
    "pdqId" INTEGER NOT NULL,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_pdqId_fkey" FOREIGN KEY ("pdqId") REFERENCES "Pdq"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
