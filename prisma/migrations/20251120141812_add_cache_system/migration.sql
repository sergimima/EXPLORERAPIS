/*
  Warnings:

  - You are about to drop the column `balance` on the `holder_snapshots` table. All the data in the column will be lost.
  - You are about to drop the column `holderAddress` on the `holder_snapshots` table. All the data in the column will be lost.
  - You are about to drop the column `isContract` on the `holder_snapshots` table. All the data in the column will be lost.
  - You are about to drop the column `isExchange` on the `holder_snapshots` table. All the data in the column will be lost.
  - You are about to drop the column `percentage` on the `holder_snapshots` table. All the data in the column will be lost.
  - You are about to drop the column `snapshotAt` on the `holder_snapshots` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "holder_snapshots_holderAddress_idx";

-- DropIndex
DROP INDEX "holder_snapshots_tokenAddress_network_snapshotAt_idx";

-- DropIndex
DROP INDEX "transfer_cache_timestamp_idx";

-- AlterTable
ALTER TABLE "holder_snapshots" DROP COLUMN "balance",
DROP COLUMN "holderAddress",
DROP COLUMN "isContract",
DROP COLUMN "isExchange",
DROP COLUMN "percentage",
DROP COLUMN "snapshotAt",
ADD COLUMN     "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "network" SET DEFAULT 'base';

-- AlterTable
ALTER TABLE "transfer_cache" ALTER COLUMN "network" SET DEFAULT 'base';

-- CreateTable
CREATE TABLE "holders" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "balance" TEXT NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,
    "isContract" BOOLEAN NOT NULL DEFAULT false,
    "isExchange" BOOLEAN NOT NULL DEFAULT false,
    "label" TEXT,

    CONSTRAINT "holders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "holders_address_idx" ON "holders"("address");

-- CreateIndex
CREATE INDEX "holders_snapshotId_idx" ON "holders"("snapshotId");

-- CreateIndex
CREATE INDEX "holder_snapshots_tokenAddress_network_timestamp_idx" ON "holder_snapshots"("tokenAddress", "network", "timestamp");

-- CreateIndex
CREATE INDEX "transfer_cache_tokenAddress_timestamp_idx" ON "transfer_cache"("tokenAddress", "timestamp");

-- CreateIndex
CREATE INDEX "transfer_cache_hash_idx" ON "transfer_cache"("hash");

-- AddForeignKey
ALTER TABLE "holders" ADD CONSTRAINT "holders_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "holder_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
