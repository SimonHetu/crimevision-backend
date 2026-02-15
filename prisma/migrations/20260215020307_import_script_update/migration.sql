-- CreateTable
CREATE TABLE "ImportBootstrapState" (
    "id" TEXT NOT NULL DEFAULT 'spvm_incidents_bootstrap',
    "source" TEXT NOT NULL,
    "nextOffset" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportBootstrapState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ImportBootstrapState_source_key" ON "ImportBootstrapState"("source");
