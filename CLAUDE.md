# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

---

## Project Overview

**TokenLens** - Multi-tenant SaaS blockchain explorer for Base network focused on token analytics, transfers, and vesting contracts.

**Tech Stack:** Next.js 15, TypeScript 5.2, PostgreSQL + Prisma 6.2, NextAuth.js, ethers.js 6, Tailwind CSS, Recharts

**Key Features:**
- Token balances & transfer history with incremental caching
- Vesting contract detection & processing (multiple strategies)
- Advanced analytics (whale tracking, holder distribution, exchange flows)
- Multi-tenant with org-isolated data
- Role-based access (SUPER_ADMIN, ADMIN, MEMBER, VIEWER)
- Admin panel for SaaS management

---

## Quick Start

### Prerequisites
- Node.js 20+
- Docker Desktop (for PostgreSQL)
- Git

### First-Time Setup

```bash
# 1. Clone and install
git clone <repo>
cd explorerapis
npm install

# 2. Start PostgreSQL
docker run --name explorer-postgres \
  -e POSTGRES_PASSWORD=yourpassword \
  -p 5432:5432 \
  -d postgres:14

# 3. Configure environment
cp .env.example .env.local
# Edit .env.local:
#   DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/explorer_db"
#   NEXTAUTH_SECRET="<generate with: openssl rand -base64 32>"
#   NEXTAUTH_URL="http://localhost:4200"
#   <Add API keys for BaseScan, Etherscan, Moralis, QuikNode, Routescan>

# 4. Initialize database
npx prisma db push
npm run db:seed

# 5. Create admin users
npx tsx prisma/seed-user.ts         # admin@vottun.com / admin123
npx tsx prisma/seed-superadmin.ts   # superadmin@tokenlens.com / super123

# 6. Start dev server
npm run dev
# → http://localhost:4200
```

### Login Credentials

**Regular User:** admin@vottun.com / admin123
**SUPER_ADMIN:** superadmin@tokenlens.com / super123

---

## Development Commands

### NPM Scripts

```bash
npm run dev          # Start dev server on port 4200
npm run build        # Build for production (includes prisma generate)
npm start            # Start production server
npm run lint         # Run ESLint
```

### Database Commands

```bash
# Prisma commands
npx prisma generate                      # Generate Prisma Client (after schema changes)
npx prisma db push                       # Push schema to DB (dev)
npx prisma migrate dev --name <name>     # Create migration
npx prisma migrate deploy                # Apply migrations (prod)
npx prisma db reset                      # Reset DB (destructive!)
npx prisma studio                        # Open DB GUI

# NPM shortcuts
npm run db:seed                          # Seed initial data (13 addresses)
npm run db:migrate-vottun                # Migrate existing Vottun data
npm run db:studio                        # Open Prisma Studio
npm run db:migrate                       # Create migration
npm run db:reset                         # Reset database

# Migration scripts
npx tsx prisma/seed-user.ts              # Create regular user
npx tsx prisma/seed-superadmin.ts        # Create SUPER_ADMIN
npx tsx prisma/migrate-vottun-data.ts    # Migrate 8,959 Vottun records
npx tsx prisma/migrate-vesting-contracts.ts
npx tsx prisma/migrate-abis.ts
npx tsx prisma/migrate-admin-setup.ts
npx tsx prisma/backfill-transfer-tokens.ts  # Fix "UNKNOWN" tokens
```

---

## Key Dependencies

**Core:** Next.js 15.5, React 19.2, TypeScript 5.2
**Database:** PostgreSQL + Prisma 6.2 + @prisma/adapter-pg
**Auth:** NextAuth.js 4.24 (bcrypt hashing)
**Blockchain:** ethers.js 6.13
**Styling:** Tailwind CSS 3.4
**Charts:** Recharts 3.4
**Email:** Resend 6.9 (for invitations)
**External APIs:** BaseScan, Routescan, Etherscan V2, Moralis, QuikNode, DEX Screener

---

## Known Issues & Gotchas

### 🔴 Critical Issues

1. **Missing `tokenId` parameter** (TODOs in code)
   - `src/lib/blockchain.ts:757` - `getVestingInfo()` doesn't receive tokenId
   - `src/lib/blockchain.ts:980` - Internal `getTokenSupplyInfo()` call
   - **Impact:** Falls back to .env keys instead of TokenSettings
   - **Fix:** Always pass `activeToken?.id` from components

2. **DEPRECATED endpoint:** `/api/test-vtn`
   - Marked DEPRECATED in code (lines 3, 13)
   - Use multi-tenant APIs instead

3. **Version mismatches** in docs
   - Docs claim: Next.js 14.0.0, React 18.2.0
   - Actual: Next.js 15.5.11, React 19.2.4
   - (Works fine, just doc inconsistency)

### ⚠️ Important Warnings

4. **Port 4200 conflicts**
   - If port in use, change in `package.json`: `"dev": "next dev -p 4201"`

5. **Prisma Client cache**
   - After schema changes: `npx prisma generate` + restart dev server
   - Or you'll get "Invalid invocation" errors

6. **API Key Hierarchy** (CRITICAL for multi-tenant)
   ```
   1. TokenSettings (per token) → Highest priority
   2. SystemSettings (global)   → Fallback
   3. .env variables            → Last resort
   ```
   Always pass `tokenId` to Server Actions to use org-specific keys.

7. **Windows users**
   - Use Docker Desktop with WSL2 backend
   - Line endings: `git config --global core.autocrlf false`

8. **Old TransferCache data**
   - May have `tokenSymbol: "UNKNOWN"`
   - Run: `npx tsx prisma/backfill-transfer-tokens.ts`

---

## Project Structure (Brief)

```
src/
├── app/                    # Next.js App Router (pages + API routes)
│   ├── admin/              # SUPER_ADMIN panel
│   ├── api/                # API endpoints
│   ├── auth/               # Auth pages
│   ├── dashboard/          # Main dashboard
│   ├── explorer/           # Public explorers (tokens, vestings, analytics)
│   └── settings/           # Org settings
├── components/             # React components
├── actions/                # Server Actions (blockchain.ts)
├── contexts/               # TokenContext, etc.
├── lib/                    # Core utilities (blockchain, auth, db, vesting helpers)
└── middleware.ts           # Route protection

prisma/
├── schema.prisma           # 17 models (4 multi-tenant + 5 SaaS + 8 data)
├── migrations/             # Database migrations
├── seed.ts                 # Initial seed
└── [migration scripts]

docs/                       # 📚 Detailed documentation
├── ARCHITECTURE.md         # Components, pages, file structure
├── API_REFERENCE.md        # All API endpoints
├── DATABASE.md             # Prisma schema, migrations
├── TOKENS_AND_BALANCES.md  # Token system guide
├── VESTING_CONTRACTS.md    # Vesting system guide
└── TROUBLESHOOTING.md      # Common errors
```

**Path Alias:** `@/*` → `./src/*`

---

## Multi-Tenant Architecture

### Data Isolation

**Every data model has `tokenId` foreign key** for isolation:
- TransferCache, HolderSnapshot, TokenSupplyCache
- VestingCache, VestingTransferCache, VestingBeneficiaryCache
- Contract, CustomAbi, KnownAddress

**⚠️ CRITICAL:** Always filter queries by `tokenId`:
```typescript
// ✅ CORRECT
await prisma.transferCache.findMany({ where: { tokenId } });

// ❌ WRONG (cross-tenant leak)
await prisma.transferCache.findMany({ where: { tokenAddress: '0x...' } });
```

### API Key Hierarchy

```typescript
// Server Actions must receive tokenId
const { activeToken } = useToken();
await fetchTokenBalances(wallet, network, activeToken?.id);  // ✅

// Without tokenId, uses only .env keys ❌
await fetchTokenBalances(wallet, network);
```

---

## Common Tasks

### Add New Address Label
```bash
# Via UI: /admin/addresses/new
# Via API: POST /api/addresses
# Import bulk: /admin/import (CSV/JSON)
```

### Create New User
```bash
# Via UI: /auth/signup
# Via script: npx tsx prisma/seed-user.ts
```

### Access Admin Panel
```bash
# Login as: superadmin@tokenlens.com / super123
# Navigate to: http://localhost:4200/admin/dashboard
```

### Configure API Keys
```bash
# Global defaults (SUPER_ADMIN):
#   /admin/settings → API Keys tab

# Per-token (Org ADMIN):
#   /settings/tokens/[id] → API Keys tab
```

### Check Cache Status
```bash
npx prisma studio
# → Check TransferCache, HolderSnapshot tables
```

### Force Data Refresh
```bash
# Click "Actualizar" button in analytics UI
# Or use ?forceRefresh=true query parameter
```

---

## Database Models (17 total)

**Multi-Tenant Core (4):**
- `User`, `Organization`, `Token`, `OrganizationMember`

**SaaS & Billing (5):**
- `Plan`, `Subscription`, `SystemSettings`, `Invitation`, `TokenSettings`

**Data Models - Multi-Tenant Isolated (8):**
- `Contract` (generic: vesting, staking, liquidity, DAO, treasury, etc.)
- `CustomAbi` (per token + contract + network)
- `KnownAddress` (labeled addresses)
- `TransferCache` (incremental sync, 90% API reduction)
- `HolderSnapshot` (5-minute snapshots)
- `TokenSupplyCache`, `VestingCache`, `VestingBeneficiaryCache`

**Performance Benefits:**
- Analytics: 10-15s → 2-4s (75-80% faster)
- API calls: -90% (incremental caching)
- Complete historical data

See [DATABASE.md](docs/DATABASE.md) for complete schema.

---

## Vesting System

### Auto-Detection

System detects contract type by available methods:
- **VestingSchedules** - Has `getVestingSchedulesCount()`, `getVestingScheduleById()`
- **Vottun** - Has `getVestingListByHolder()` (faster, single call)
- **OpenZeppelin** - Has `vestingSchedules()`
- **Generic/Unknown** - Fallback patterns

### Strategy Pattern

Each contract type has its own processing strategy. See [VESTING_CONTRACTS.md](docs/VESTING_CONTRACTS.md).

### Predefined Contracts (8)

Vottun World, Investors, Marketing, Staking, Liquidity, Promos, Team, Reserve

---

## API Fallback System

### ABI Fetching
```
Database Cache
    ↓ (if not found)
BaseScan API (3 retries with exponential backoff)
    ↓ (if fails)
Routescan API (3 retries)
    ↓ (if fails)
Legacy Cache (contractAbis.ts)
    ↓ (if fails)
Error
```

### Transfer History
```
Etherscan V2 API (primary)
    ↓ (if fails)
Routescan API (fallback)
```

**Benefits:**
- 🚀 High availability (rate limits don't block)
- 💰 Uses free tiers efficiently
- 📊 ABIs saved with source tracking
- 🔍 Clear console logs

---

## Performance Optimizations

1. **Incremental Transfer Caching**
   - First load: ~10s (fetches all history)
   - Subsequent: 2-4s (reads DB + fetches only new)
   - 90% API call reduction

2. **Holder Snapshots**
   - Created every 5 minutes
   - Instant load if recent
   - Enables historical analysis

3. **Connection Pooling**
   - Uses `@prisma/adapter-pg`
   - Prevents connection leaks
   - ~30% faster queries

4. **Preloaded ABIs**
   - `contractAbis.ts` has 11 ABIs
   - Reduces BaseScan API calls

5. **Database Indexes**
   - `@@index([tokenId, timestamp])`
   - On all frequently queried fields

---

## Security

**Authentication:**
- NextAuth.js with JWT sessions
- bcrypt password hashing (10 rounds)
- Google OAuth support

**Authorization:**
- Role-based: SUPER_ADMIN, ADMIN, MEMBER, VIEWER
- Middleware protects routes
- `requireSuperAdmin()` helper for APIs

**Multi-Tenant Isolation:**
- tokenId filtering prevents leaks
- Session-based org context
- API key hierarchy

**Secrets:**
- .env.local (gitignored)
- SystemSettings in DB
- Never hardcode in code

---

## Troubleshooting Quick Reference

**"Can't reach database"** → `docker ps`, restart container
**"Port 4200 in use"** → Kill process or change port
**"Invalid Prisma invocation"** → `npx prisma generate`, restart
**"Rate limit exceeded"** → Automatic fallback to Routescan
**"No tokens found"** → Check network, API keys, console logs
**"Slow analytics page"** → Normal on first load (~10s), subsequent should be 2-4s
**"UNKNOWN token"** → Run backfill script
**"Module not found"** → `npm install`, `npx prisma generate`

See [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) for complete guide.

---

## Documentation

**For detailed information, see:**

📚 **Core Guides:**
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) - App structure, components, pages
- [API_REFERENCE.md](docs/API_REFERENCE.md) - All API endpoints with examples
- [DATABASE.md](docs/DATABASE.md) - Prisma schema, migrations, seeding

📚 **Feature Guides:**
- [TOKENS_AND_BALANCES.md](docs/TOKENS_AND_BALANCES.md) - Token system complete guide
- [VESTING_CONTRACTS.md](docs/VESTING_CONTRACTS.md) - Vesting system complete guide

📚 **Support:**
- [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) - Common errors and solutions

📚 **Planning:**
- [IMPROVEMENTS.md](IMPROVEMENTS.md) - Roadmap and feature planning
- [database_plan.md](database_plan.md) - Database architecture planning

---

## Development Best Practices

### When Adding Features

1. Follow existing patterns (see ARCHITECTURE.md)
2. Use TypeScript interfaces
3. Implement error boundaries and loading states
4. Add retry logic for external APIs
5. Cache expensive operations
6. Log important operations

### Multi-Tenant Considerations

- **Always filter by tokenId** in database queries
- **Always pass tokenId** to Server Actions
- **Test with multiple orgs** having same token address

### API Rate Limiting

- Respect free tier limits (5 calls/second)
- Use delays between sequential calls (50-500ms)
- Implement exponential backoff
- Prefer cached data when possible

### Security

- Never commit `.env.local`
- Hash passwords with bcrypt
- Validate user input
- Use parameterized queries (Prisma does this)
- Check roles before sensitive operations

---

## Useful Keyboard Shortcuts

- **Cmd+K / Ctrl+K** - Global search (addresses, transactions)
- **#** key during session - Auto-incorporate learnings into CLAUDE.md

---

## Sprint Status

**Fase 1: Auth + Multi-Tenant** ✅
- Sprint 1.1: NextAuth Setup
- Sprint 1.2: Tenant Context & API Isolation
- Sprint 1.3: Organization Settings

**Fase 2: Tokens + Config** ✅
- Sprint 2.1: Token Management + Custom API Keys
- Sprint 2.2: Custom ABIs + Contracts
- Sprint 2.3: Token Supply Custom Configuration
- Sprint 2.4: APIs Multi-Tenant Completas
- Sprint 2.5: Invitación de Miembros

**Fase 4: Admin Panel SaaS** ✅
- Sprint 4.1-4.8: Complete admin panel with plans, orgs, users, settings

**⏸️ Pending:** Fase 3 (Onboarding Wizard) - Postponed

**🔜 Next:** Fase 5 (Stripe Integration)

---

**Last Updated:** 2026-02-05
**Version:** 5.0 (Refactored for conciseness with docs/ separation)

---

**Need Help?**
- Check console logs (most errors are logged)
- Review [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)
- Use Prisma Studio to inspect database
- Check Network tab in browser DevTools
