# Application Architecture

Complete application structure, components, pages, and design patterns.

---

## Tech Stack

**Framework:** Next.js 15.5 (App Router)
**Language:** TypeScript 5.2
**Database:** PostgreSQL 14+ with Prisma 6.2
**Styling:** Tailwind CSS 3.4
**Auth:** NextAuth.js 4.24
**Blockchain:** ethers.js 6.13
**Charts:** Recharts 3.4

---

## Project Structure

```
explorerapis/
├── src/
│   ├── app/                    # Next.js App Router pages & API routes
│   │   ├── (auth)/             # Auth pages group
│   │   ├── admin/              # Admin panel (SUPER_ADMIN only)
│   │   ├── api/                # API routes
│   │   ├── dashboard/          # Main dashboard
│   │   ├── explorer/           # Public explorers
│   │   ├── settings/           # Organization settings
│   │   ├── layout.tsx          # Root layout
│   │   └── page.tsx            # Home page
│   ├── components/             # React components
│   ├── contexts/               # React Context providers
│   ├── actions/                # Server Actions
│   ├── lib/                    # Core utilities
│   └── middleware.ts           # Route protection
├── prisma/                     # Database schema & migrations
├── docs/                       # Documentation
├── public/                     # Static assets
└── package.json

```

---

## Core Library (`src/lib/`)

### blockchain.ts

Central blockchain interaction module.

**Functions:**
- `fetchTokenBalances()` - Get wallet balances
- `fetchTokenTransfers()` - Get transfer history
- `getVestingInfo()` - Get vesting contract data
- `getTokenSupplyInfo()` - Get supply metrics
- `getContractABIWithCache()` - Fetch ABIs with fallback

**Network Configuration:**
```typescript
export const NETWORKS = {
  'base': { chainId: 8453, rpcUrl: '...', explorerApi: '...' },
  'base-testnet': { chainId: 84531, ... },
  'base-sepolia': { chainId: 84532, ... }
};
```

### auth.ts

NextAuth.js configuration.

**Providers:**
- Credentials (email/password with bcrypt)
- Google OAuth

**Callbacks:**
- `jwt()` - Add role to JWT token
- `session()` - Add role to session
- `authorized()` - Check authentication for protected routes

### db.ts

Prisma client singleton with connection pooling.

```typescript
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
export const prisma = new PrismaClient({ adapter });
```

### Vesting Helpers

- `vestingHelpers.ts` - Beneficiary processing, releasable calculation
- `vestingContractHelpers.ts` - Vottun-specific processing
- `vestingContractStrategies.ts` - Strategy pattern for contract types

### Other Utilities

- `types.ts` - TypeScript type definitions
- `utils.ts` - Common utility functions
- `limits.ts` - SaaS limit validation
- `auth-helpers.ts` - `requireSuperAdmin()` helper
- `email.ts` - Resend email service wrapper
- `contractAbis.ts` - Preloaded ABIs

---

## Server Actions (`src/actions/`)

### blockchain.ts

Server Actions for blockchain operations.

**Key Functions:**
- `fetchTokenBalances(wallet, network, tokenId?)`
- `fetchTokenTransfers(wallet, network, filter, tokenId?)`
- `getTokenSupplyInfo(address, network, tokenId?, onProgress?)`

**⚠️ Critical:** Always pass `tokenId` to use org-specific API keys.

---

## Components (`src/components/`)

### Token Components

- **TokenBalance.tsx** - Wallet balance display
- **TokenTransfersList.tsx** - Transfer history table
- **TokenSupplyCard.tsx** - Supply metrics card

### Vesting Components

- **VestingInfo.tsx** - Detailed vesting info
- **VestingSummary.tsx** - Vesting overview
- **VestingContractList.tsx** - Grid of predefined contracts

### UI Controls

- **NetworkSelector.tsx** - Network dropdown
- **TokenFilter.tsx** - Token filtering
- **WalletInput.tsx** - Wallet address input
- **TabsContainer.tsx** - Tab navigation
- **GlobalSearch.tsx** - Cmd+K search (addresses, txs)

### Visualization (Charts)

- **ExchangeFlowChart.tsx** - Bar chart (net flow to CEX)
- **WhaleTimelineChart.tsx** - Scatter plot (large transfers)
- **HolderDistributionChart.tsx** - Pie chart (concentration)

### Address Management

- **EditAddressModal.tsx** - Inline address label editing

### Auth Components

- **SignInForm.tsx** - Login form
- **SignUpForm.tsx** - Registration form

### Layouts

- **Providers.tsx** - SessionProvider wrapper

---

## Pages (`src/app/`)

### Public Pages

**/** - Home page with navigation cards

**/dashboard** - Unified dashboard
- Token balances & transfers
- Vesting info
- Analytics overview

**/explorer/tokens** - Token explorer
**/explorer/vestings** - Vesting explorer
**/explorer/analytics** - Advanced analytics

**/docs** - API documentation

### Auth Pages (`/auth/*`)

**/auth/signin** - Login page
**/auth/signup** - Registration page
**/auth/error** - Error handling

### Settings Pages (`/settings/*`)

Protected routes requiring organization membership.

**/settings/general** - Organization info
**/settings/members** - Team management
  - Invite members
  - Pending invitations

**/settings/tokens** - Token management
  - List organization tokens
  - Add/remove tokens

**/settings/tokens/[id]** - Token settings (tabs)
  - General: Basic info, whale threshold
  - API Keys: Custom API keys
  - Contracts: Manage contracts
  - ABI: Manage custom ABIs
  - Supply: Configure supply method

**Layout:** Persistent sidebar with icons

### Admin Panel (`/admin/*`)

SUPER_ADMIN only routes.

**/admin/dashboard** - SaaS metrics
  - Stats cards (orgs, subscriptions, MRR, users)
  - Charts (new orgs, cancellations, MRR)
  - Alerts (orgs near limits)

**/admin/organizations** - Org management
  - List with filters
  - Custom APIs indicator
  - Click row → Detail page

**/admin/organizations/[id]** - Org details
  - Change plan dropdown
  - Usage progress bars
  - Members & tokens tables

**/admin/plans** - Plans management
  - Drag & drop reordering
  - Inline editing
  - Create/delete

**/admin/settings** - Global config (4 tabs)
  - API Keys, Email, Stripe, General

**/admin/users** - Global users list
  - Stats by role
  - Filters & search

**Layout:** Sidebar navigation, dark mode

---

## API Routes (`src/app/api/`)

### Structure

```
api/
├── auth/
│   ├── [...nextauth]/      # NextAuth handlers
│   └── signup/             # User registration
├── admin/                  # Admin panel APIs
│   ├── organizations/
│   ├── plans/
│   ├── settings/
│   ├── stats/
│   └── users/
├── addresses/              # Address CRUD
├── organizations/          # Org management
│   ├── invite/
│   └── invitations/
├── tokens/                 # Token CRUD
│   ├── balance/
│   └── transfers/
├── token-analytics/        # Advanced analytics
├── token-supply/           # Supply metrics
├── vesting-info/           # Vesting data
└── search/                 # Global search
```

See [API_REFERENCE.md](./API_REFERENCE.md) for complete documentation.

---

## Contexts (`src/contexts/`)

### TokenContext

Provides active token state globally.

```typescript
const TokenContext = createContext<{
  activeToken: Token | null;
  setActiveToken: (token: Token | null) => void;
}>();

export function useToken() {
  return useContext(TokenContext);
}
```

**Usage:**
```typescript
const { activeToken } = useToken();
await fetchTokenBalances(wallet, network, activeToken?.id);
```

---

## Middleware

### Route Protection

**Location:** `src/middleware.ts`

**Public Routes:**
- `/`, `/auth/*`, `/docs`

**Protected Routes:**
- `/dashboard`, `/settings/*`, `/explorer/*`
- Requires: Valid session

**Admin Routes:**
- `/admin/*`
- Requires: Role = SUPER_ADMIN

**Redirects:**
- Not authenticated → `/auth/signin`
- Not SUPER_ADMIN → `/dashboard`

---

## Multi-Tenant Architecture

### Hierarchy

```
Organization
    ↓
  Token
    ↓
[Data Models]
```

### Isolation

All data models have `tokenId` foreign key:
- TransferCache
- HolderSnapshot
- TokenSupplyCache
- VestingCache
- KnownAddress
- CustomAbi
- Contract

**⚠️ Critical:** Always filter queries by `tokenId`.

### API Key Hierarchy

```
1. TokenSettings (per token)
    ↓
2. SystemSettings (global defaults)
    ↓
3. .env variables
```

---

## Design Patterns

### 1. Strategy Pattern (Vesting)

Different contract types use different processing strategies.

```typescript
interface VestingStrategy {
  detect(contract): Promise<boolean>;
  process(contract, holder): Promise<VestingInfo>;
}

const strategies = [
  new VestingSchedulesStrategy(),
  new VottunStrategy(),
  new OpenZeppelinStrategy()
];
```

### 2. Repository Pattern (Database)

Prisma client provides consistent data access.

```typescript
// All queries through prisma client
await prisma.token.findMany({ where: { orgId } });
await prisma.transferCache.create({ data: {...} });
```

### 3. Server Actions Pattern

Server-side logic in Server Actions (Next.js 13+).

```typescript
'use server'

export async function fetchTokenBalances(...) {
  // Server-side only code
  const apiKeys = await getApiKeys(tokenId);
  return await callApi(apiKeys);
}
```

### 4. Incremental Caching

Fetch only new data since last cache update.

```typescript
// Get last cached timestamp
const lastTransfer = await prisma.transferCache.findFirst({
  where: { tokenId },
  orderBy: { timestamp: 'desc' }
});

// Fetch only new transfers since then
const newTransfers = await fetchTransfersSince(lastTransfer.timestamp);
```

### 5. Automatic Fallback

Chain multiple API sources with fallback.

```
Primary API (3 retries)
    ↓ (on failure)
Fallback API (3 retries)
    ↓ (on failure)
Cached Data / Error
```

---

## Data Flow Examples

### Token Balance Query

```
User clicks "View Balances"
    ↓
Component calls Server Action
    ↓
Server Action gets API keys (TokenSettings → SystemSettings → .env)
    ↓
Call Moralis API with keys
    ↓ (if fails)
Fallback: Analyze transfer history
    ↓
Return balances to component
    ↓
Component renders with TokenBalance
```

### Transfer History with Cache

```
User views Analytics page
    ↓
Check TransferCache in DB
    ↓
Get last cached timestamp
    ↓
Fetch only NEW transfers since timestamp
    ↓
Save new transfers to TransferCache
    ↓
Return combined data (cached + new)
    ↓
Render in UI (2-4s vs 10-15s)
```

### Admin Panel Access

```
User navigates to /admin/dashboard
    ↓
Middleware checks session
    ↓
Verify role = SUPER_ADMIN
    ↓ (if not)
Redirect to /dashboard
    ↓ (if yes)
Fetch stats from /api/admin/stats
    ↓
Render dashboard with charts
```

---

## Configuration Files

### tsconfig.json

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    },
    "strict": true,
    "jsx": "preserve"
  }
}
```

### tailwind.config.js

Custom theme configuration for dark mode and colors.

### next.config.js

Next.js configuration (if exists).

### prisma/schema.prisma

Complete database schema. See [DATABASE.md](./DATABASE.md).

---

## Environment Setup

### Development

```bash
# Install dependencies
npm install

# Setup database
docker run --name explorer-postgres \
  -e POSTGRES_PASSWORD=yourpassword \
  -p 5432:5432 \
  -d postgres:14

# Configure .env.local
cp .env.example .env.local
# Edit DATABASE_URL, NEXTAUTH_SECRET, API keys

# Initialize database
npx prisma db push
npm run db:seed

# Start dev server
npm run dev
```

### Production

```bash
# Build
npm run build

# Start
npm start
```

---

## Performance Optimizations

### 1. Connection Pooling

Use `@prisma/adapter-pg` for connection reuse.

### 2. Incremental Caching

Cache + fetch only new data = 90% API call reduction.

### 3. Preloaded ABIs

`contractAbis.ts` reduces BaseScan API calls.

### 4. Holder Snapshots

5-minute snapshots for instant holder data.

### 5. Indexes

Database indexes on frequently queried fields.

---

## Security

### Authentication

- **NextAuth.js** with JWT sessions
- **bcrypt** password hashing (10 rounds)
- **OAuth** support (Google)

### Authorization

- **Role-based access** (SUPER_ADMIN, ADMIN, MEMBER, VIEWER)
- **Middleware** protection for routes
- **requireSuperAdmin()** helper for API routes

### Multi-Tenant Isolation

- **tokenId filtering** prevents cross-tenant leaks
- **Session-based** org context
- **API key hierarchy** for secure configuration

### Secrets Management

- **Environment variables** (.env.local, gitignored)
- **SystemSettings** in database (encrypted recommended)
- **No hardcoded** API keys in code

---

## Related Documentation

- [DATABASE.md](./DATABASE.md) - Schema and models
- [API_REFERENCE.md](./API_REFERENCE.md) - API endpoints
- [TOKENS_AND_BALANCES.md](./TOKENS_AND_BALANCES.md) - Token system
- [VESTING_CONTRACTS.md](./VESTING_CONTRACTS.md) - Vesting system
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common issues

---

**Last Updated:** 2026-02-05
