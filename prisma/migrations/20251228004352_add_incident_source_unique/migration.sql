-- CreateTable
CREATE TABLE "ImportCursor" (
    "source" TEXT NOT NULL,
    "lastDate" TIMESTAMP(3),
    "lastSourceId" INTEGER,
    "lastRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportCursor_pkey" PRIMARY KEY ("source")
);
