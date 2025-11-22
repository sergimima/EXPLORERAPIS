-- CreateEnum
CREATE TYPE "AddressType" AS ENUM ('CONTRACT', 'WALLET', 'EXCHANGE', 'VESTING', 'TOKEN', 'UNKNOWN');

-- CreateTable
CREATE TABLE "known_addresses" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AddressType" NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "tags" TEXT[],
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "known_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_supply_cache" (
    "id" TEXT NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "totalSupply" TEXT NOT NULL,
    "circulatingSupply" TEXT NOT NULL,
    "lockedSupply" TEXT NOT NULL,
    "cachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "token_supply_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfer_cache" (
    "id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "timestamp" INTEGER NOT NULL,
    "blockNumber" INTEGER NOT NULL,
    "network" TEXT NOT NULL,
    "cachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transfer_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holder_snapshots" (
    "id" TEXT NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "holderAddress" TEXT NOT NULL,
    "balance" TEXT NOT NULL,
    "percentage" TEXT NOT NULL,
    "isExchange" BOOLEAN NOT NULL DEFAULT false,
    "isContract" BOOLEAN NOT NULL DEFAULT false,
    "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "holder_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "known_addresses_address_key" ON "known_addresses"("address");

-- CreateIndex
CREATE INDEX "known_addresses_address_idx" ON "known_addresses"("address");

-- CreateIndex
CREATE INDEX "known_addresses_type_idx" ON "known_addresses"("type");

-- CreateIndex
CREATE INDEX "known_addresses_category_idx" ON "known_addresses"("category");

-- CreateIndex
CREATE INDEX "token_supply_cache_expiresAt_idx" ON "token_supply_cache"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "token_supply_cache_tokenAddress_network_key" ON "token_supply_cache"("tokenAddress", "network");

-- CreateIndex
CREATE UNIQUE INDEX "transfer_cache_hash_key" ON "transfer_cache"("hash");

-- CreateIndex
CREATE INDEX "transfer_cache_tokenAddress_network_idx" ON "transfer_cache"("tokenAddress", "network");

-- CreateIndex
CREATE INDEX "transfer_cache_from_idx" ON "transfer_cache"("from");

-- CreateIndex
CREATE INDEX "transfer_cache_to_idx" ON "transfer_cache"("to");

-- CreateIndex
CREATE INDEX "transfer_cache_timestamp_idx" ON "transfer_cache"("timestamp");

-- CreateIndex
CREATE INDEX "holder_snapshots_tokenAddress_network_snapshotAt_idx" ON "holder_snapshots"("tokenAddress", "network", "snapshotAt");

-- CreateIndex
CREATE INDEX "holder_snapshots_holderAddress_idx" ON "holder_snapshots"("holderAddress");
