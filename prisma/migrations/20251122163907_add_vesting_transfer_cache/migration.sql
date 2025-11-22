-- CreateTable
CREATE TABLE "vesting_transfer_cache" (
    "id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "tokenSymbol" TEXT,
    "tokenName" TEXT,
    "decimals" INTEGER NOT NULL DEFAULT 18,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "timestamp" INTEGER NOT NULL,
    "blockNumber" INTEGER NOT NULL,
    "network" TEXT NOT NULL DEFAULT 'base',
    "vestingContract" TEXT NOT NULL,
    "cachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vesting_transfer_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vesting_transfer_cache_vestingContract_tokenAddress_timesta_idx" ON "vesting_transfer_cache"("vestingContract", "tokenAddress", "timestamp");

-- CreateIndex
CREATE INDEX "vesting_transfer_cache_vestingContract_network_idx" ON "vesting_transfer_cache"("vestingContract", "network");

-- CreateIndex
CREATE INDEX "vesting_transfer_cache_from_idx" ON "vesting_transfer_cache"("from");

-- CreateIndex
CREATE INDEX "vesting_transfer_cache_to_idx" ON "vesting_transfer_cache"("to");

-- CreateIndex
CREATE UNIQUE INDEX "vesting_transfer_cache_hash_vestingContract_key" ON "vesting_transfer_cache"("hash", "vestingContract");
