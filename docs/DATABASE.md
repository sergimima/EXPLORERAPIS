# Database Architecture

Complete Prisma schema documentation, migrations, seeding, and multi-tenant isolation strategy.

---

## Overview

**Database:** PostgreSQL 14+
**ORM:** Prisma 6.2.0
**Adapter:** `@prisma/adapter-pg` with connection pooling
**Total Models:** 17 (4 multi-tenant core + 5 SaaS + 8 data models)

---

## Connection Setup

### Docker PostgreSQL

```bash
# Start PostgreSQL container
docker run --name explorer-postgres \
  -e POSTGRES_PASSWORD=yourpassword \
  -p 5432:5432 \
  -d postgres:14

# Verify running
docker ps | grep explorer-postgres
```

### Environment Configuration

```env
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/explorer_db"
```

### Prisma Client Initialization

**Location:** `src/lib/db.ts`

```typescript
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

// Singleton pattern
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Connection pooling
const connectionString = process.env.DATABASE_URL!;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

// Create client with adapter
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

**Benefits:**
- ✅ Connection pooling prevents leaks
- ✅ Singleton prevents multiple instances
- ✅ Better performance with adapter-pg

---

## Schema Overview

### Multi-Tenant Core (4 models)

Organization-based isolation for SaaS functionality.

```
User ──────┐
           ├──> OrganizationMember <──> Organization
           │                                  │
           └──────────────────────────────> Token ──> [Data Models]
```

### SaaS & Billing (5 models)

Subscription management and global configuration.

```
Organization ──> Subscription ──> Plan
                                   │
                            SystemSettings
                                   │
                            Invitation
```

### Data Models (8 models)

All filtered by `tokenId` for multi-tenant isolation.

```
Token
  ├──> Contract (vesting, staking, liquidity, etc.)
  ├──> CustomAbi (per contract + network)
  ├──> KnownAddress (labeled addresses)
  ├──> TransferCache (incremental sync)
  ├──> HolderSnapshot (periodic snapshots)
  ├──> TokenSupplyCache (supply metrics)
  ├──> VestingCache
  ├──> VestingTransferCache
  └──> VestingBeneficiaryCache
```

---

## Model Details

### 1. User

User accounts with authentication.

```prisma
model User {
  id                String              @id @default(cuid())
  email             String              @unique
  name              String?
  password          String              // bcrypt hashed (10 rounds)
  role              UserRole            @default(MEMBER)
  emailVerified     DateTime?
  image             String?
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt

  organizations     OrganizationMember[]
  sessions          Session[]
  accounts          Account[]

  @@index([email])
}

enum UserRole {
  SUPER_ADMIN  // Platform admin (access to /admin/*)
  ADMIN        // Organization admin
  MEMBER       // Regular user
  VIEWER       // Read-only
}
```

**Seed Data:**
- Regular user: `admin@vottun.com` / `admin123`
- Super admin: `superadmin@tokenlens.com` / `super123`

### 2. Organization

Multi-tenant organizations.

```prisma
model Organization {
  id          String              @id @default(cuid())
  name        String
  slug        String              @unique
  ownerId     String
  createdAt   DateTime            @default(now())
  updatedAt   DateTime            @updatedAt

  owner       User                @relation("OrganizationOwner", fields: [ownerId], references: [id])
  members     OrganizationMember[]
  tokens      Token[]
  invitations Invitation[]
  subscription Subscription?

  @@index([ownerId])
}
```

**Usage:**
- Each organization has isolated tokens and data
- Owner has full control
- Members have role-based access

### 3. Token

Token configuration per organization.

```prisma
model Token {
  id          String   @id @default(cuid())
  orgId       String
  address     String   // ERC20 contract address
  symbol      String
  name        String
  decimals    Int      @default(18)
  network     String   // base, base-testnet, base-sepolia
  chainId     Int
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  organization Organization @relation(fields: [orgId], references: [id])
  settings     TokenSettings?
  contracts    Contract[]
  customAbis   CustomAbi[]
  knownAddresses KnownAddress[]
  transferCache  TransferCache[]
  holderSnapshots HolderSnapshot[]
  // ... more cache relations

  @@unique([orgId, address, network])
  @@index([orgId])
}
```

**⚠️ Critical:** Two orgs can have same `address` but different `tokenId`.

### 4. OrganizationMember

Many-to-many user-organization relationship.

```prisma
model OrganizationMember {
  id          String   @id @default(cuid())
  userId      String
  orgId       String
  role        UserRole @default(MEMBER)
  joinedAt    DateTime @default(now())

  user        User         @relation(fields: [userId], references: [id])
  organization Organization @relation(fields: [orgId], references: [id])

  @@unique([userId, orgId])
}
```

### 5. Plan

Subscription plans with configurable limits.

```prisma
model Plan {
  id             String   @id @default(cuid())
  name           String
  slug           String   @unique
  description    String?
  price          Int      // In cents (e.g., 2999 = $29.99)
  currency       String   @default("USD")
  stripePriceId  String?

  // Limits (-1 = unlimited)
  tokensLimit     Int      @default(1)
  apiCallsLimit   Int      @default(10000)
  transfersLimit  Int      @default(100000)
  membersLimit    Int      @default(3)

  // Features
  features       Json     // Array of feature strings
  isActive       Boolean  @default(true)
  isPublic       Boolean  @default(true)
  sortOrder      Int      @default(0)

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  subscriptions  Subscription[]

  @@index([isActive, isPublic])
}
```

**Managed via:** `/admin/plans` (SUPER_ADMIN only)

### 6. Subscription

Organization subscriptions linking to plans.

```prisma
model Subscription {
  id                   String   @id @default(cuid())
  organizationId       String   @unique
  planId               String

  status               SubscriptionStatus @default(ACTIVE)
  currentPeriodStart   DateTime
  currentPeriodEnd     DateTime

  // Stripe integration
  stripeCustomerId     String?
  stripeSubscriptionId String?

  // Override limits (null = use plan limits)
  tokensLimit          Int?
  apiCallsLimit        Int?
  transfersLimit       Int?
  membersLimit         Int?

  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  organization         Organization @relation(fields: [organizationId], references: [id])
  plan                 Plan         @relation(fields: [planId], references: [id])
}

enum SubscriptionStatus {
  ACTIVE
  PAST_DUE
  CANCELED
  TRIALING
}
```

### 7. SystemSettings

Global SaaS configuration (singleton).

```prisma
model SystemSettings {
  id                      String  @id @default("system")

  // API Keys (defaults)
  defaultBasescanApiKey   String?
  defaultEtherscanApiKey  String?
  defaultMoralisApiKey    String?
  defaultQuicknodeUrl     String?
  defaultRoutescanApiKey  String?

  // Email configuration
  resendApiKey            String?
  resendFromEmail         String?

  // Stripe
  stripePublicKey         String?
  stripeSecretKey         String?

  // General
  appName                 String  @default("TokenLens")
  appUrl                  String?
  supportEmail            String?

  updatedAt               DateTime @updatedAt
}
```

**Managed via:** `/admin/settings` (SUPER_ADMIN only)

### 8. Invitation

Team member invitations.

```prisma
model Invitation {
  id             String   @id @default(cuid())
  organizationId String
  email          String
  role           UserRole @default(MEMBER)
  token          String   @unique  // UUID for accept link
  expiresAt      DateTime
  acceptedAt     DateTime?
  createdAt      DateTime @default(now())

  organization   Organization @relation(fields: [organizationId], references: [id])

  @@index([organizationId])
  @@index([token])
}
```

**Flow:**
1. Admin sends invite → Email with unique token
2. Recipient clicks link → `/invitations/[token]/accept`
3. Auto-creates user if not registered
4. Adds to organization

### 9. Contract

Generic contract model (vesting, staking, liquidity, etc.).

```prisma
model Contract {
  id          String          @id @default(cuid())
  tokenId     String
  name        String
  address     String
  network     String
  category    ContractCategory
  isActive    Boolean         @default(true)
  description String?
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  token       Token           @relation(fields: [tokenId], references: [id])

  @@unique([tokenId, address, network])
  @@index([tokenId, category])
}

enum ContractCategory {
  VESTING
  STAKING
  LIQUIDITY
  DAO
  TREASURY
  MARKETING
  TEAM
  OTHER
}
```

**Managed via:** `/settings/tokens/[id]/contracts`

### 10. CustomAbi

ABIs for tokens and contracts.

```prisma
model CustomAbi {
  id              String    @id @default(cuid())
  tokenId         String
  contractAddress String
  network         String
  abi             Json
  source          AbiSource @default(STANDARD)
  methodCount     Int       @default(0)
  eventCount      Int       @default(0)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  token           Token     @relation(fields: [tokenId], references: [id])

  @@unique([tokenId, contractAddress, network])
  @@index([tokenId])
}

enum AbiSource {
  STANDARD   // Standard ERC20/ERC721
  UPLOADED   // User uploaded
  BASESCAN   // Fetched from BaseScan
  ROUTESCAN  // Fetched from Routescan
}
```

**Usage:**
```typescript
// Check for cached ABI
const cached = await prisma.customAbi.findUnique({
  where: {
    tokenId_contractAddress_network: {
      tokenId,
      contractAddress,
      network
    }
  }
});

if (cached) return cached.abi;

// Fetch from BaseScan/Routescan → Save to DB
```

### 11. KnownAddress

Labeled blockchain addresses.

```prisma
model KnownAddress {
  id          String      @id @default(cuid())
  tokenId     String
  address     String
  name        String
  type        AddressType @default(UNKNOWN)
  category    String?
  description String?
  tags        String[]
  color       String?
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  token       Token       @relation(fields: [tokenId], references: [id])

  @@unique([tokenId, address])
  @@index([tokenId, type])
}

enum AddressType {
  CONTRACT
  WALLET
  EXCHANGE
  VESTING
  TOKEN
  UNKNOWN
}
```

**Features:**
- Edit inline with pencil icon
- Shows friendly names in UI
- Searchable in GlobalSearch (Cmd+K)

### 12. TransferCache

Incremental transfer history cache.

```prisma
model TransferCache {
  id           String   @id @default(cuid())
  tokenId      String
  hash         String   // Transaction hash
  from         String
  to           String
  value        String
  timestamp    DateTime
  blockNumber  Int
  tokenAddress String
  tokenSymbol  String
  tokenName    String
  decimals     Int
  network      String
  createdAt    DateTime @default(now())

  token        Token    @relation(fields: [tokenId], references: [id])

  @@unique([tokenAddress, hash, network])
  @@index([tokenId, timestamp])
  @@index([tokenAddress, network, timestamp])
}
```

**Performance:**
- First load: ~10s (fetches all history)
- Subsequent: 2-4s (reads DB + fetches only new)
- 90% API call reduction

### 13. HolderSnapshot

Periodic holder snapshots (5-minute intervals).

```prisma
model HolderSnapshot {
  id           String   @id @default(cuid())
  tokenId      String
  tokenAddress String
  network      String
  snapshotAt   DateTime
  holders      Json     // Array of { address, balance, percentage, isContract, isExchange }
  totalHolders Int
  createdAt    DateTime @default(now())

  token        Token    @relation(fields: [tokenId], references: [id])

  @@index([tokenId, tokenAddress, network, snapshotAt])
}
```

**Usage:**
```typescript
// Get latest snapshot
const snapshot = await prisma.holderSnapshot.findFirst({
  where: { tokenId, tokenAddress, network },
  orderBy: { snapshotAt: 'desc' }
});

// If recent (<5 min), use cached
if (isRecent(snapshot.snapshotAt)) {
  return snapshot.holders;
}

// Otherwise, fetch new and create snapshot
```

### 14-17. Vesting Models

See [VESTING_CONTRACTS.md](./VESTING_CONTRACTS.md) for details on:
- `TokenSupplyCache`
- `VestingCache`
- `VestingTransferCache`
- `VestingBeneficiaryCache`

---

## Migrations

### Commands

```bash
# Generate Prisma Client (after schema changes)
npx prisma generate

# Create migration
npx prisma migrate dev --name migration_name

# Apply migrations (production)
npx prisma migrate deploy

# Reset database (destructive!)
npx prisma db reset

# Push schema without migration (development)
npx prisma db push

# Open Prisma Studio
npx prisma studio
```

### Migration Workflow

**Development:**
```bash
# 1. Edit schema.prisma
# 2. Generate migration
npx prisma migrate dev --name add_custom_abi_model

# 3. Prisma auto-generates SQL and applies it
```

**Production:**
```bash
# 1. Commit migrations to git
# 2. Deploy migrations
npx prisma migrate deploy
```

---

## Seeding

### Initial Seed (13 addresses)

```bash
npm run db:seed
# or
npx prisma db seed
```

**Seed Script:** `prisma/seed.ts`

**Seeds:**
- 8 Vottun vesting contracts
- 1 VTN token address
- 4 known exchanges (Coinbase, Gate.io)

### Migration Scripts

**Create Vottun Organization + Test User:**
```bash
npx tsx prisma/seed-user.ts
# Creates: admin@vottun.com / admin123 (ADMIN role)
```

**Create SUPER_ADMIN:**
```bash
npx tsx prisma/seed-superadmin.ts
# Creates: superadmin@tokenlens.com / super123
```

**Migrate Existing Vottun Data:**
```bash
npx tsx prisma/migrate-vottun-data.ts
# Migrates 8,959 records to multi-tenant structure
```

**Migrate Vesting Contracts to Contract Model:**
```bash
npx tsx prisma/migrate-vesting-contracts.ts
# Converts old VestingContract → new Contract model
```

**Migrate ABIs to CustomAbi Model:**
```bash
npx tsx prisma/migrate-abis.ts
# Imports 11 preloaded ABIs to database
```

**Setup Admin Panel:**
```bash
npx tsx prisma/migrate-admin-setup.ts
# Creates default plans and SystemSettings
```

**Backfill Transfer Token Info:**
```bash
npx tsx prisma/backfill-transfer-tokens.ts
# Fixes "UNKNOWN" token symbols in old transfers
```

---

## Multi-Tenant Isolation

### How It Works

**Every data model has `tokenId` foreign key:**

```prisma
model TransferCache {
  id      String @id
  tokenId String  // ← Multi-tenant isolation
  // ... other fields

  token   Token @relation(fields: [tokenId], references: [id])

  @@index([tokenId])
}
```

**Queries always filter by tokenId:**

```typescript
// ✅ CORRECT: Filtered by tokenId
const transfers = await prisma.transferCache.findMany({
  where: { tokenId: 'clxxx123' }
});

// ❌ WRONG: Cross-tenant data leak
const transfers = await prisma.transferCache.findMany({
  where: { tokenAddress: '0xA9bc...' }  // Multiple orgs might have this!
});
```

### Tenant Context Helper

**Location:** `src/lib/tenant-context.ts` (if exists) or inline in APIs

```typescript
import { auth } from '@/lib/auth';

export async function getTenantContext() {
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');

  // Get user's active organization
  const membership = await prisma.organizationMember.findFirst({
    where: { userId: session.user.id },
    include: { organization: true }
  });

  return {
    userId: session.user.id,
    orgId: membership.organization.id,
    role: membership.role
  };
}
```

**Usage in API routes:**

```typescript
// GET /api/tokens
export async function GET() {
  const { orgId } = await getTenantContext();

  const tokens = await prisma.token.findMany({
    where: { orgId }  // ← Automatic tenant isolation
  });

  return Response.json(tokens);
}
```

---

## Indexes

### Performance-Critical Indexes

```prisma
// User lookup by email
@@index([email])

// Organization queries
@@index([orgId])

// Token lookups
@@index([tokenId])
@@index([orgId, address, network])

// Transfer cache (time-based queries)
@@index([tokenId, timestamp])
@@index([tokenAddress, network, timestamp])

// Holder snapshots
@@index([tokenId, tokenAddress, network, snapshotAt])

// Invitations
@@index([organizationId])
@@index([token])

// Subscriptions
@@index([organizationId])
@@index([planId])
```

### Unique Constraints

```prisma
// Prevent duplicate users
@@unique([email])

// Prevent duplicate org slugs
@@unique([slug])

// Prevent duplicate tokens per org
@@unique([orgId, address, network])

// Prevent duplicate transfers
@@unique([tokenAddress, hash, network])

// Prevent duplicate ABIs
@@unique([tokenId, contractAddress, network])

// Prevent duplicate invitations
@@unique([token])
```

---

## Connection Pooling

### Why Adapter-pg?

**Standard Prisma:**
- Creates new connection per query
- Can leak connections
- Slower performance

**With adapter-pg:**
- Reuses connections from pool
- Prevents leaks
- ~30% faster queries

### Configuration

**Location:** `src/lib/db.ts`

```typescript
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,  // Max connections in pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
```

---

## Best Practices

### 1. Always Filter by tokenId

```typescript
// ✅ GOOD
await prisma.transferCache.findMany({
  where: { tokenId }
});

// ❌ BAD: Cross-tenant leak
await prisma.transferCache.findMany({
  where: { tokenAddress: '0x...' }
});
```

### 2. Use Transactions for Multi-Step Operations

```typescript
await prisma.$transaction(async (tx) => {
  const token = await tx.token.create({ data: {...} });
  await tx.tokenSettings.create({ data: { tokenId: token.id, ... } });
});
```

### 3. Batch Queries When Possible

```typescript
// ✅ GOOD: Single query
await prisma.transferCache.createMany({
  data: transfers,
  skipDuplicates: true
});

// ❌ BAD: N queries
for (const transfer of transfers) {
  await prisma.transferCache.create({ data: transfer });
}
```

### 4. Use Indexes for Frequent Queries

```typescript
// If querying by timestamp frequently:
@@index([tokenId, timestamp])

// If querying by multiple fields:
@@index([tokenAddress, network, timestamp])
```

---

## Troubleshooting

### "Can't reach database server"

```bash
# Check Docker container
docker ps | grep postgres

# Check logs
docker logs explorer-postgres

# Restart if needed
docker restart explorer-postgres
```

### "Unique constraint failed"

**Cause:** Trying to create duplicate record

**Fix:**
```typescript
// Use upsert instead
await prisma.knownAddress.upsert({
  where: { tokenId_address: { tokenId, address } },
  update: { name: 'New Name' },
  create: { tokenId, address, name: 'New Name', type: 'WALLET' }
});
```

### "Invalid `prisma.X.Y()` invocation"

**Cause:** Prisma Client out of sync with schema

**Fix:**
```bash
npx prisma generate
# Then restart dev server
```

### Slow Queries

**Debug:**
```typescript
// Enable query logging
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error']
});
```

**Add Indexes:**
```prisma
// Analyze slow queries and add indexes
@@index([field1, field2])
```

---

## Related Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Application structure
- [API_REFERENCE.md](./API_REFERENCE.md) - API endpoints
- [TOKENS_AND_BALANCES.md](./TOKENS_AND_BALANCES.md) - Token system
- [VESTING_CONTRACTS.md](./VESTING_CONTRACTS.md) - Vesting system

---

**Last Updated:** 2026-02-05
