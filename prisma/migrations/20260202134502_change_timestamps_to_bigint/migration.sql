-- AlterTable
ALTER TABLE "transfer_cache" ALTER COLUMN "timestamp" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "vesting_beneficiary_cache" ALTER COLUMN "startTime" SET DATA TYPE BIGINT,
ALTER COLUMN "endTime" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "vesting_cache" ALTER COLUMN "startTime" SET DATA TYPE BIGINT,
ALTER COLUMN "endTime" SET DATA TYPE BIGINT,
ALTER COLUMN "nextUnlockTime" SET DATA TYPE BIGINT,
ALTER COLUMN "cliffEndTime" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "vesting_schedule_cache" ALTER COLUMN "start" SET DATA TYPE BIGINT,
ALTER COLUMN "lastClaimDate" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "vesting_transfer_cache" ALTER COLUMN "timestamp" SET DATA TYPE BIGINT;
