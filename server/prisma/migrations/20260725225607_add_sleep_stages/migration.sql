-- CreateTable
CREATE TABLE "sleep_stages" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "side" TEXT NOT NULL,
    "timestamp" INTEGER NOT NULL,
    "stage" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "sleep_stages_side_timestamp_idx" ON "sleep_stages"("side", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "sleep_stages_side_timestamp_key" ON "sleep_stages"("side", "timestamp");
