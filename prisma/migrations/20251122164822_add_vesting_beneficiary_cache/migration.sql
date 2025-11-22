-- CreateTable
CREATE TABLE "vesting_beneficiary_cache" (
    "id" TEXT NOT NULL,
    "vestingContract" TEXT NOT NULL,
    "beneficiaryAddress" TEXT NOT NULL,
    "network" TEXT NOT NULL DEFAULT 'base',
    "tokenAddress" TEXT NOT NULL,
    "tokenSymbol" TEXT NOT NULL,
    "tokenName" TEXT NOT NULL,
    "totalAmount" TEXT NOT NULL,
    "vestedAmount" TEXT NOT NULL,
    "releasedAmount" TEXT NOT NULL,
    "claimableAmount" TEXT NOT NULL,
    "remainingAmount" TEXT NOT NULL,
    "startTime" INTEGER NOT NULL,
    "endTime" INTEGER NOT NULL,
    "cachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vesting_beneficiary_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vesting_beneficiary_cache_vestingContract_idx" ON "vesting_beneficiary_cache"("vestingContract");

-- CreateIndex
CREATE INDEX "vesting_beneficiary_cache_beneficiaryAddress_idx" ON "vesting_beneficiary_cache"("beneficiaryAddress");

-- CreateIndex
CREATE UNIQUE INDEX "vesting_beneficiary_cache_vestingContract_beneficiaryAddres_key" ON "vesting_beneficiary_cache"("vestingContract", "beneficiaryAddress", "network");
