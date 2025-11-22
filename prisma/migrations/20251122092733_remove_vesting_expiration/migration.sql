/*
  Warnings:

  - You are about to drop the column `expiresAt` on the `vesting_cache` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `vesting_cache` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "vesting_cache_expiresAt_idx";

-- AlterTable
ALTER TABLE "vesting_cache" DROP COLUMN "expiresAt",
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;
