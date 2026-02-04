-- Manual migration: Rename VestingContract to Contract
-- Sprint 2.X: Make contract model generic

-- Step 1: Create enum for contract categories
CREATE TYPE "ContractCategory" AS ENUM (
  'VESTING',
  'STAKING',
  'LIQUIDITY',
  'DAO',
  'TREASURY',
  'MARKETING',
  'TEAM',
  'OTHER'
);

-- Step 2: Rename table
ALTER TABLE "vesting_contracts" RENAME TO "contracts";

-- Step 3: Add new category column (temp)
ALTER TABLE "contracts" ADD COLUMN "category_new" "ContractCategory" DEFAULT 'OTHER';

-- Step 4: Migrate existing data (map string categories to enum)
UPDATE "contracts" SET "category_new" =
  CASE
    WHEN LOWER("category") IN ('vesting', 'investors', 'team', 'reserve', 'vottun world') THEN 'VESTING'::"ContractCategory"
    WHEN LOWER("category") = 'staking' THEN 'STAKING'::"ContractCategory"
    WHEN LOWER("category") IN ('liquidity', 'pool') THEN 'LIQUIDITY'::"ContractCategory"
    WHEN LOWER("category") IN ('marketing', 'promos') THEN 'MARKETING'::"ContractCategory"
    WHEN LOWER("category") = 'treasury' THEN 'TREASURY'::"ContractCategory"
    WHEN LOWER("category") = 'dao' THEN 'DAO'::"ContractCategory"
    ELSE 'OTHER'::"ContractCategory"
  END
WHERE "category" IS NOT NULL;

-- Step 5: Drop old category column
ALTER TABLE "contracts" DROP COLUMN "category";

-- Step 6: Rename new column to category
ALTER TABLE "contracts" RENAME COLUMN "category_new" TO "category";

-- Step 7: Add category index
CREATE INDEX "contracts_category_idx" ON "contracts"("category");

-- Step 8: Update constraint names (if needed)
-- The unique constraint should already work since we renamed the table
