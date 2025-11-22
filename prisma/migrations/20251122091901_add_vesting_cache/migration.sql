-- CreateTable
CREATE TABLE "vesting_cache" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "vestingContractAddress" TEXT NOT NULL,
    "network" TEXT NOT NULL DEFAULT 'base',
    "tokenName" TEXT NOT NULL,
    "tokenSymbol" TEXT NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "totalAmount" TEXT NOT NULL,
    "vestedAmount" TEXT NOT NULL,
    "claimableAmount" TEXT NOT NULL,
    "remainingAmount" TEXT NOT NULL,
    "releasedAmount" TEXT NOT NULL,
    "startTime" INTEGER NOT NULL,
    "endTime" INTEGER NOT NULL,
    "nextUnlockTime" INTEGER,
    "nextUnlockAmount" TEXT,
    "slicePeriodSeconds" INTEGER,
    "cliff" INTEGER,
    "cliffEndTime" INTEGER,
    "cachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vesting_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vesting_cache_walletAddress_idx" ON "vesting_cache"("walletAddress");

-- CreateIndex
CREATE INDEX "vesting_cache_vestingContractAddress_idx" ON "vesting_cache"("vestingContractAddress");

-- CreateIndex
CREATE INDEX "vesting_cache_expiresAt_idx" ON "vesting_cache"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "vesting_cache_walletAddress_vestingContractAddress_network_key" ON "vesting_cache"("walletAddress", "vestingContractAddress", "network");
