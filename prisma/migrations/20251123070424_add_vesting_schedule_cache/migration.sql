-- CreateTable
CREATE TABLE "vesting_schedule_cache" (
    "id" TEXT NOT NULL,
    "beneficiaryId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "cliff" INTEGER NOT NULL,
    "start" INTEGER NOT NULL,
    "duration" INTEGER NOT NULL,
    "amountTotal" TEXT NOT NULL,
    "claimFrequencyInSeconds" INTEGER NOT NULL,
    "lastClaimDate" INTEGER NOT NULL,
    "released" TEXT NOT NULL,
    "revoked" BOOLEAN NOT NULL,
    "cachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vesting_schedule_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vesting_schedule_cache_beneficiaryId_idx" ON "vesting_schedule_cache"("beneficiaryId");

-- CreateIndex
CREATE INDEX "vesting_schedule_cache_scheduleId_idx" ON "vesting_schedule_cache"("scheduleId");

-- AddForeignKey
ALTER TABLE "vesting_schedule_cache" ADD CONSTRAINT "vesting_schedule_cache_beneficiaryId_fkey" FOREIGN KEY ("beneficiaryId") REFERENCES "vesting_beneficiary_cache"("id") ON DELETE CASCADE ON UPDATE CASCADE;
