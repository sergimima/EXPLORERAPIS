# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a blockchain explorer application for the Base blockchain network, built with Next.js 14, focused on token balances, transfers, and vesting contract information. The project integrates with BaseScan API and uses ethers.js v6 for blockchain interactions.

## Development Commands

- `npm run dev` - Start development server on port 4200 (http://localhost:4200)
- `npm run build` - Build the production application
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## Key Dependencies

**Core Framework:**
- Next.js 14.0.0 - React framework for production
- React 18.2.0 - UI library
- TypeScript 5.2.2 - Type safety

**Database & ORM:**
- PostgreSQL - Production database (Docker: explorer-postgres)
- Prisma 6.2.0 - Type-safe ORM with migrations
- @prisma/client - Prisma client for database queries
- @prisma/adapter-pg - PostgreSQL adapter for better performance
- pg - PostgreSQL client for connection pooling

**Blockchain Integration:**
- ethers.js 6.13.5 - Ethereum/Base blockchain interactions, contract calls, wallet operations
- axios 1.8.4 - HTTP client for API calls
- swr 2.2.4 - Data fetching and caching hooks

**Data Visualization:**
- recharts 2.15.1 - React charting library for analytics visualizations

**Styling:**
- Tailwind CSS 3.4.17 - Utility-first CSS framework
- Autoprefixer 10.4.21 - PostCSS plugin for vendor prefixes

**External APIs Used:**
- BaseScan API - Contract ABIs and blockchain data
- Etherscan V2 API - Transaction history for Base network
- Moralis API - Real-time holder data and token ownership
- DEX Screener API - Liquidity and trading data for Aerodrome and other DEXs (free, no key)
- QuikNode - RPC provider and price data endpoints
- Uniswap V4 StateView - On-chain liquidity data for Uniswap V4 pools via contract calls

## Architecture Overview

### Core Library Structure (`src/lib/`)

**blockchain.ts** - Central blockchain interaction module organized by feature tabs:
- Token transfers retrieval using Etherscan V2 API
- Token balance queries with fallback mechanisms for rate limits
- Vesting contract information extraction with multiple contract type support
- Token supply information from Vottun API endpoints
- Network configuration for Base Mainnet, Base Testnet (Goerli), and Base Sepolia

**Vesting Contract Helpers:**
- `vestingHelpers.ts` - Utility functions for processing beneficiary data and calculating releasable tokens
- `vestingContractHelpers.ts` - Specialized processing using `getVestingListByHolder` method
- `vestingContractStrategies.ts` - Strategy pattern implementation for different vesting contract types
- `contractAbis.ts` - Preloaded ABIs to reduce BaseScan API calls

**Core Utilities:**
- `types.ts` - TypeScript type definitions for Network, TokenTransfer, VestingInfo, etc.
- `utils.ts` - Common utility functions
- `limits.ts` - SaaS limit validation helpers (Sprint 4.5)
  - `checkTokensLimit()` - Verify if org can create more tokens
  - `checkMembersLimit()` - Verify if org can add more members
  - `incrementApiCalls()` - Track API usage (soft limit)
  - `canPerformAction()` - Generic limit validation
  - All functions return: `{ allowed: boolean, current: number, limit: number, message?: string }`

**Authentication & Database:**
- `auth.ts` - NextAuth.js configuration with CredentialsProvider and GoogleProvider
- `auth-helpers.ts` - Helper functions (Sprint 4.2)
  - `requireSuperAdmin()` - Throws 403 if not SUPER_ADMIN
  - Used in all `/api/admin/*` routes
- `db.ts` - Prisma client singleton with PostgreSQL adapter and connection pooling
- `email.ts` - Resend email service wrapper (Sprint 2.5)
  - `sendInvitationEmail()` - HTML template for team invitations
  - Fallback graceful if no API key configured

### Database Architecture (PostgreSQL + Prisma)

The project uses PostgreSQL with Prisma ORM for data persistence and caching.

**Database Models:**

**Multi-Tenant Models (Sprint 1.1):**

1. **User** - User accounts with authentication
   - Email/password auth with bcrypt hashing
   - OAuth support (Google)
   - Roles: SUPER_ADMIN, ADMIN, MEMBER, VIEWER
   - Belongs to Organization

2. **Organization** - Multi-tenant isolation
   - Each org has its own tokens and data
   - Owner and members with role-based access
   - Settings for API keys and configuration

3. **Token** - Token configuration per organization
   - Token address, symbol, decimals
   - Network and chain ID
   - Custom settings per organization

4. **OrganizationMember** - User-Organization relationship
   - Join date and role
   - Many-to-many relationship

**SaaS & Billing Models (Sprint 4.1):**

5. **Plan** - Configurable subscription plans
   - Fields: name, slug, price, currency, stripePriceId
   - Limits: tokensLimit, apiCallsLimit, transfersLimit, membersLimit (-1 = unlimited)
   - Features: JSON array, isActive, isPublic, sortOrder
   - Managed via `/admin/plans` (SUPER_ADMIN only)

6. **Subscription** - Organization subscriptions
   - Links Organization to Plan
   - Fields: planId, status, currentPeriodStart, currentPeriodEnd
   - Stripe integration: stripeCustomerId, stripeSubscriptionId
   - Override limits: tokensLimit, apiCallsLimit, transfersLimit, membersLimit

7. **SystemSettings** - Global SaaS configuration (singleton)
   - API Keys: defaultBasescanApiKey, defaultEtherscanApiKey, defaultMoralisApiKey, defaultQuiknodeUrl
   - Email: resendApiKey, resendFromEmail
   - Stripe: stripePublicKey, stripeSecretKey
   - General: appName, appUrl, supportEmail
   - Managed via `/admin/settings` (SUPER_ADMIN only)

8. **Invitation** - Team member invitations (Sprint 2.5)
   - Fields: organizationId, email, role, token (unique)
   - Expiration: expiresAt (7 days default)
   - Status tracking: acceptedAt
   - Email sent via Resend integration

**Data Models (Multi-Tenant Isolated):**

9. **Contract** - Generic contract model (vesting, staking, liquidity, etc.)
   - Supports any type of smart contract with categorization
   - Categories (enum): VESTING, STAKING, LIQUIDITY, DAO, TREASURY, MARKETING, TEAM, OTHER
   - Each contract can have a custom ABI (via CustomAbi relation)
   - Fields: name, address, network, category, isActive, description
   - Managed via `/settings/tokens/[id]/contracts` page
   - **Multi-tenant**: Filtered by tokenId

10. **CustomAbi** - ABIs for multiple contract addresses
    - Supports multiple ABIs per token (one per contractAddress + network combo)
    - Unique constraint: [tokenId, contractAddress, network]
    - Source types: STANDARD, UPLOADED, BASESCAN
    - Auto-detection from BaseScan API supported
    - Includes methodCount and eventCount for each ABI
    - **Multi-tenant**: Filtered by tokenId

11. **KnownAddress** - Labeled blockchain addresses
    - Stores names and metadata for contracts, exchanges, wallets
    - Types: CONTRACT, WALLET, EXCHANGE, VESTING, TOKEN, UNKNOWN
    - Used to display friendly names throughout the UI
    - Managed via `/admin/addresses` panel
    - **Multi-tenant**: Filtered by tokenId

12. **TransferCache** - Incremental transfer history cache
    - Stores token transfers with deduplication by hash
    - Implements incremental sync (only fetches new transfers since last timestamp)
    - Reduces API calls by ~90% after initial load
    - Indexed by tokenAddress, timestamp, and hash
    - **Multi-tenant**: Filtered by tokenId

13. **HolderSnapshot** - Periodic holder snapshots
    - Stores top holder data every 5 minutes
    - Includes balance, percentage, contract/exchange flags
    - Enables historical holder analysis
    - Indexed by tokenAddress, network, and snapshotAt
    - **Multi-tenant**: Filtered by tokenId

14. **TokenSupplyCache** - Token supply information cache
    - Caches total, circulating, and locked supply
    - 5-minute TTL to balance freshness and API usage
    - Migrated to DB model (previously in-memory)
    - **Multi-tenant**: Filtered by tokenId

15. **VestingCache** - Vesting contract cache
    - **Multi-tenant**: Filtered by tokenId

16. **VestingTransferCache** - Vesting transfer cache
    - **Multi-tenant**: Filtered by tokenId

17. **VestingBeneficiaryCache** - Vesting beneficiary cache
    - **Multi-tenant**: Filtered by tokenId

**Performance Benefits:**
- 🚀 Analytics page load: 10-15s → 2-4s (75-80% improvement)
- 💰 API call reduction: ~90% (only fetches new data)
- 📊 Complete historical data for analysis
- ⚡ Instant load from cache after first fetch

**Database Setup:**
```bash
# Using Docker (current setup)
docker run --name explorer-postgres -e POSTGRES_PASSWORD=yourpassword -p 5432:5432 -d postgres

# Prisma commands
npx prisma generate          # Generate Prisma Client
npx prisma db push          # Push schema to database
npx prisma db seed          # Seed initial data (13 addresses)
npx prisma studio           # Open database GUI
```

**Connection:**
- Uses `@prisma/adapter-pg` with connection pooling
- Singleton pattern to prevent connection leaks
- Configured in `src/lib/db.ts`

**Seed Data (13 addresses):**
- 8 Vottun vesting contracts
- 1 VTN token address
- 4 known exchanges (Coinbase, Gate.io)

### Network Configuration

The application supports three networks defined in `blockchain.ts`:
- `base` - Base Mainnet (Chain ID: 8453)
- `base-testnet` - Base Goerli Testnet (Chain ID: 84531)
- `base-sepolia` - Base Sepolia Testnet (Chain ID: 84532)

Each network has RPC URLs, explorer API URLs, and some have alternative RPC endpoints for failover.

### API Routes (`src/app/api/`)

**Token & Balance APIs:**
- `/api/tokens/balance` - Get token balances for a wallet
- `/api/tokens/transfers` - Get token transfers with optional filtering
- `/api/token-supply` - Get token supply information (total, circulating, locked)
  - ⚠️ Currently uses in-memory cache (5 minutes TTL), migration to TokenSupplyCache pending
- `/api/token-analytics` - Advanced token analytics with incremental caching
  - Uses TransferCache for incremental transfer sync (only fetches new data)
  - Uses HolderSnapshot for periodic holder snapshots (5-minute intervals)
  - Includes whale movements, holder distribution, price data, liquidity, and alerts
  - Supports manual refresh via `forceRefresh` query parameter

**Address Management APIs:**
- `GET /api/addresses` - List all known addresses with optional filters
  - Query params: `type`, `search`, `limit`, `offset`
  - Returns addresses with name, type, category, tags, color
- `POST /api/addresses` - Create or update (upsert) an address label
  - Body: `{ address, name, type, category?, description?, tags?, color? }`
  - Used by admin panel and edit modals
- `DELETE /api/addresses` - Delete an address label by address
  - Query param: `address`

**Vottun Integration APIs:**
- `/api/vottun/searchUserByEmail` - Search Vottun users by email
- `/api/vottun/userPoints` - Get user points from Vottun
- `/api/vottun/userTokens` - Get user tokens from Vottun
- `/api/vottun-search` - Vottun-specific search endpoint

**Utility APIs:**
- `/api/search` - General search endpoint (supports address lookup with labels)
- `/api/test` - Simple health check endpoint
- `/api/test-vtn` - VTN token API integration test with Etherscan V2

**Authentication APIs (Sprint 1.1):**
- `/api/auth/[...nextauth]` - NextAuth.js handlers (signin, signout, session, providers)
- `POST /api/auth/signup` - User registration endpoint
  - Body: `{ email, password, name, organizationId? }`
  - Creates user with MEMBER role by default
  - Hashes password with bcrypt (10 rounds)
  - Auto-login after signup

**Admin Panel APIs (Sprint 4.2) - SUPER_ADMIN only:**
- `GET/POST /api/admin/plans` - List and create plans
- `GET/PUT/DELETE /api/admin/plans/[id]` - Manage individual plan
- `POST /api/admin/plans/reorder` - Update sortOrder for drag & drop
- `GET /api/admin/organizations` - List all organizations with stats
  - Includes: total tokens, members, plan info, custom API indicators
- `GET/PATCH /api/admin/organizations/[id]` - Organization details and assign plan
  - Returns: full org info, members, tokens, usage stats, plan limits
- `GET /api/admin/users` - List all users with filters
  - Stats: total, by role, org counts
  - Filters: role, search query
- `GET/PUT /api/admin/settings` - Global SystemSettings (singleton)
  - Tabs: API Keys, Email config, Stripe keys, General settings
- `GET /api/admin/stats` - Dashboard statistics
  - MRR, new orgs, cancellations, plan distribution
  - Data for Recharts graphs (12 months historical)
- `POST /api/admin/stripe/webhook` - Webhook stub (future Stripe integration)

**Organization Management APIs (Sprint 2.5):**
- `POST /api/organizations/invite` - Create team invitation
  - Sends email via Resend with unique token
  - Returns: invitation object
- `GET /api/organizations/invitations` - List pending invitations
- `DELETE /api/organizations/invitations/[id]` - Cancel invitation
- `POST /api/invitations/[token]/accept` - Accept invitation
  - Auto-creates user if email not registered
  - Adds to organization if user exists

### Key Features

**Vesting Contract Detection:**
The system automatically detects vesting contract types:
- `VestingSchedules` - Contracts with `getVestingSchedulesCount` and `getVestingScheduleById`
- `Vottun` - Contracts with `getVestingListByHolder`
- `OpenZeppelin` - Contracts with `vestingSchedules`
- `GenericVesting` / `CustomVesting` / `UnknownVesting` - Fallback categories

**Token Information:**
The codebase is hardcoded to work with Vottun Token (VTN):
- Address: `0xA9bc478A44a8c8FE6fd505C1964dEB3cEe3b7abC`
- Symbol: VTN
- Decimals: 18

**Rate Limiting and Caching:**
- BaseScan API calls implement retry logic with exponential backoff
- **Incremental Transfer Caching**: TransferCache stores all transfers and only fetches new ones since last timestamp
  - First load: ~10s (fetches all history)
  - Subsequent loads: 2-4s (reads from DB + fetches only new transfers)
  - Reduces API calls by ~90%
- **Holder Snapshots**: HolderSnapshot stores top holders every 5 minutes
  - Instant load if snapshot is <5 minutes old
  - Enables historical holder analysis
- **Token Supply Cache**: In-memory cache (5 minutes TTL)
  - ⚠️ Pending migration to TokenSupplyCache model for persistence
- Manual refresh via "Actualizar" button with timestamp display ("hace Xm")
- Fallback to transfer history analysis when balance API fails

### Component Structure (`src/components/`)

**Token Display Components:**
- `TokenBalance.tsx` - Displays wallet token balances
- `TokenTransfersList.tsx` - Shows token transfers with filtering and sorting

**Vesting Components:**
- `VestingInfo.tsx` - Detailed vesting information for wallet/contract pair
- `VestingSummary.tsx` - Overview of vesting contract status
- `VestingContractList.tsx` - Grid display of predefined vesting contracts (Vottun World, Investors, Marketing, Staking, Liquidity, Promos, Team, Reserve)
- `TokenSupplyCard.tsx` - Displays token supply metrics with loading progress (Total, Circulating, Locked Supply)

**UI Control Components:**
- `NetworkSelector.tsx` - Network selection dropdown (Base, Base Testnet, Base Sepolia)
- `TokenFilter.tsx` - Token filtering controls
- `WalletInput.tsx` - Wallet address input with validation
- `TabsContainer.tsx` - Tab navigation component

**Search & Navigation:**
- `GlobalSearch.tsx` - Universal search component with Cmd+K / Ctrl+K shortcut
  - Searches addresses, names, transaction hashes
  - Shows known addresses with labels
  - Quick navigation to analytics, holders, etc.

**Data Visualization:**
- `charts/ExchangeFlowChart.tsx` - Bar chart showing net flow to/from exchanges over time
- `charts/WhaleTimelineChart.tsx` - Scatter plot of large transfers (whales) timeline
- `charts/HolderDistributionChart.tsx` - Pie chart of holder concentration (Top 10, Top 50, Rest)
- All charts built with Recharts, responsive and interactive

**Address Management:**
- `EditAddressModal.tsx` - Modal for editing address labels inline
  - Triggered by pencil icon next to addresses
  - Saves to database via `/api/addresses`
  - Supports name, type, category, description, tags, color

**Admin Components:**
- Located in admin pages (see Pages section below)
- Table views, filters, import/export functionality
- Statistics dashboards

### Pages (`src/app/`)

**Public Pages:**
- `/` - Home page with navigation cards to access different explorer sections
- `/dashboard` - Unified dashboard combining token, vesting, and analytics explorers
  - Token balances and transfers
  - Vesting contract information
  - Analytics overview
- `/explorer/tokens` - Token explorer interface with balance and transfer views
- `/explorer/vestings` - Vesting contracts viewer with:
  - VestingContractList component for selecting predefined contracts
  - TokenSupplyCard showing supply metrics
  - Detailed vesting information per contract
- `/explorer/analytics` - Advanced token analytics dashboard featuring:
  - Real-time price data and liquidity metrics from DEX Screener
  - Whale movement tracking with configurable thresholds
  - Top holders distribution (via Moralis API)
  - Exchange flow analysis (net flow to CEX)
  - Automated alerts system (whale moves, accumulation, distribution, liquidity changes)
  - Interactive tabs: Overview, Whale Movements, Top Holders, Recent Activity
  - Three main charts (Exchange Flow, Whale Timeline, Holder Distribution)
  - Sortable large transfers table
  - Period selection (1 day, 7 days, 30 days, 90 days)
  - Manual "Actualizar" button with timestamp display
- `/docs` - API documentation

**Authentication Pages (Sprint 1.1):**
- `/auth/signin` - User login page
  - Email/password form
  - Google OAuth button
  - Link to signup page
- `/auth/signup` - User registration page
  - Email, password, name fields
  - Password confirmation
  - Auto-login after signup, redirects to `/onboarding`
- `/auth/error` - Authentication error page
  - Displays NextAuth error messages

**Admin Panel (`/admin/*`) - SUPER_ADMIN only (Sprint 4.3):**
- `/admin/dashboard` - Complete SaaS metrics dashboard
  - 4 stats cards: Total orgs, Active subscriptions, MRR, Total users
  - 3 Recharts graphs: New orgs (12 months), Cancellations, MRR evolution
  - Plan distribution chart (pie chart)
  - Recent organizations table
  - **Alerts section**: Organizations near limits (≥80% usage)
    - Color coded: Yellow (80-89%), Red (90%+)
    - Shows: Tokens 🪙, API Calls 📡, Members 👥
    - Direct links to org detail
- `/admin/organizations` - Organizations management
  - Table with: Name, Owner, Plan, Members, Tokens, Created
  - **Custom APIs indicator**: 🔑 icon if org has custom API keys
  - Filters: Name search (debounced), Plan filter, Status
  - Click row → Detail page
- `/admin/organizations/[id]` - Organization detail page
  - Info card: Name, slug, owner, plan, created date
  - **Change plan**: Dropdown to assign different plan
  - **Progress bars**: Usage vs limits (Tokens, API Calls, Members)
  - **Custom API Keys indicator**: Badge showing which services are custom
  - Members table: Email, role, joined date
  - Tokens table: Symbol, address, network, contracts count
  - Stats cards: Total transfers, unique addresses, last activity
- `/admin/plans` - Plans management
  - Grid view with drag & drop reordering (@dnd-kit)
  - Each card: Name, price, limits, features, active/public status
  - Inline editing: Click to edit any plan
  - Create new plan button
  - Delete with validation (checks if used)
- `/admin/settings` - Global configuration (4 tabs)
  - **API Keys tab**: Default keys (BaseScan, Etherscan, Moralis, QuikNode)
  - **Email tab**: Resend API key and from email
  - **Stripe tab**: Public and secret keys
  - **General tab**: App name, URL, support email
- `/admin/users` - Global users list
  - Stats cards: Total, SUPER_ADMIN, ADMIN, MEMBER count
  - Table: Email, name, role (color coded), org counts, verified status
  - Tooltips: Hover to see org names
  - Filters: Role, search by email/name
- `/admin/health` - System health check (future)

**Admin Layout:**
- Sidebar navigation with icons for all sections
- Protected routes with middleware (requires SUPER_ADMIN role)
- Consistent dark mode support
- User info in sidebar footer

**Settings Pages (`/settings/*`) - Authenticated users (Sprint 2.5):**
- Layout with persistent sidebar (icons + descriptions)
- `/settings` - Redirects to `/settings/general`
- `/settings/general` - Organization information
  - Org name, slug, ID
  - Owner information
- `/settings/members` - Team management
  - Active members table (email, role, joined date)
  - **Invite Member** button → Modal form
  - Pending invitations list with cancel option
  - Invitation flow integrated with Resend emails
- `/settings/tokens` - Token management
  - List of organization tokens
  - **Add Token** button → Modal form (address + network verification)
  - Click token → Detail pages
- `/settings/tokens/[id]` - Individual token settings (multiple tabs)
  - **General**: Basic info, whale threshold, cache settings
  - **API Keys**: Custom API keys (BaseScan, Etherscan, Moralis, QuikNode)
  - **Contracts**: Manage contracts linked to token
  - **ABI**: Manage custom ABIs
  - **Supply**: Configure supply method (API vs ONCHAIN)
- Protected routes with middleware (requires organization membership)

## Important Implementation Details

### Vesting Contract Processing

When working with vesting contracts:
1. The system first checks for preloaded ABIs in `contractAbis.ts`
2. If not found, fetches ABI from BaseScan with retry logic
3. Applies appropriate strategy based on detected contract type
4. Processes beneficiaries either by index or by holder depending on available methods
5. Calculates releasable tokens based on time elapsed and vesting schedule

**Predefined Vesting Contracts:**
The application includes 8 predefined vesting contracts accessible via VestingContractList:
- Vottun World: `0xa699Cf416FFe6063317442c3Fbd0C39742E971c5`
- Investors: `0x3e0ef51811B647E00A85A7e5e495fA4763911982`
- Marketing: `0xE521B2929DD28a725603bCb6F4009FBb656C4b15`
- Staking: `0x3a7cf4cCC76bb23Cf15845B0d4f05BafF1D478cF`
- Liquidity: `0x417Fc9c343210AA52F0b19dbf4EecBD786139BC1`
- Promos: `0xFC750D874077F8c90858cC132e0619CE7571520b`
- Team: `0xde68AD324aafD9F2b6946073C90ED5e61D5d51B8`
- Reserve: `0xC4CE5cFea2B6e32Ad41973348AC70EB3b00D8e6d`

### Token Analytics Implementation

The analytics system (`/explorer/analytics` and `/api/token-analytics`) provides comprehensive market intelligence:

**Data Sources:**
- Transfer history from Etherscan V2 API (Base chain) with incremental sync caching
- Real-time holder data from Moralis API (top 50 holders) with 5-minute snapshot caching
- Price data from QuikNode custom endpoints
- Liquidity metrics from multiple sources:
  - DEX Screener API for Aerodrome and other aggregated DEXs
  - Uniswap V4 StateView contract (`0xa3c0c9b65bad0b08107aa264b0f3db444b867a71`) for on-chain V4 pool data
- Contract verification via ethers.js RPC calls (using QuikNode for reliability)

**Key Metrics Calculated:**
- Total transfers and volume for selected period
- Unique addresses interacting with token
- Large transfer detection (configurable threshold, default 10,000 VTN)
- Net flow to/from known exchanges (CEX addresses)
- Top holder concentration percentage
- Average transfer size

**Alert System:**
Automatically generates alerts based on:
- Whale movements (≥3 large transfers in 2 hours)
- Exchange flow anomalies (>50k VTN net flow)
- High holder concentration (top 10 >70% of supply)
- Accumulation patterns (single address receiving >100k VTN)

**Known Exchange Addresses:**
- Coinbase: `0x3cd751e6b0078be393132286c442345e5dc49699`
- Coinbase 2: `0x71660c4005ba85c37ccec55d0c4493e66fe775d3`
- Coinbase 3: `0x503828976d22510aad0201ac7ec88293211d23da`
- Gate.io: `0x0d0707963952f2fba59dd06f2b425ace40b492fe`

**Performance Optimizations:**
- **Incremental Transfer Sync**: Uses TransferCache to store all historical transfers
  - Only fetches new transfers since last cached timestamp
  - Deduplication by transaction hash
  - First load: ~10s, subsequent loads: 2-4s (80% improvement)
  - Reduces Etherscan API calls by ~90%
- **Holder Snapshots**: Uses HolderSnapshot to cache top holders
  - Creates snapshot every 5 minutes
  - Instant load if recent snapshot exists
  - Enables historical holder analysis
- Shared ethers.js provider to avoid multiple RPC connections
- Sequential contract verification with 50ms delays to respect RPC limits
- Progress tracking for long-running operations
- Manual refresh via "Actualizar" button
- Timestamp display showing "Última actualización: hace Xm"

### Error Handling

- All blockchain calls should have try-catch blocks
- Fallback to empty arrays or zero values rather than propagating errors
- Log warnings for non-critical failures
- Return meaningful error objects with `isValid: false` for contract status checks

### API Key Configuration

Environment variables expected (in `.env` or `.env.local`):

**Database:**
- `DATABASE_URL` - PostgreSQL connection string
  - Format: `postgresql://user:password@localhost:5432/explorer_db`
  - Current setup: Docker container `explorer-postgres`
  - Connection pooling managed by `@prisma/adapter-pg`

**Authentication (Sprint 1.1):**
- `NEXTAUTH_SECRET` - Secret for JWT signing (generate with `openssl rand -base64 32`)
- `NEXTAUTH_URL` - Base URL for NextAuth (e.g., `http://localhost:4200`)
- `GOOGLE_CLIENT_ID` - Google OAuth client ID (optional)
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret (optional)

**Required for Basic Functionality:**
- `NEXT_PUBLIC_BASESCAN_API_KEY` - For BaseScan API access (contract ABIs, verification)
- `NEXT_PUBLIC_ETHERSCAN_API_KEY` - For Etherscan V2 API access (transfer history)

**Required for Analytics Features:**
- `NEXT_PUBLIC_MORALIS_API_KEY` - For real holder data from Moralis (top holders endpoint)
- `NEXT_PUBLIC_QUICKNODE_URL` - QuikNode RPC endpoint for price data and contract interactions

**Optional/Free APIs:**
- DEX Screener API - Used for liquidity data (no key required, free public API)

Default API key `YourApiKeyToken` is used as fallback for BaseScan/Etherscan (rate-limited).

## TypeScript Configuration

- Path alias: `@/*` maps to `./src/*`
- Strict mode enabled
- JSX: preserve (Next.js handles transformation)

## Styling

- Tailwind CSS for styling
- Custom button classes: `btn-primary`
- Color schemes: blue-50, purple-50, green-50, gray-100 backgrounds
- Dark mode support via Tailwind's `dark:` variant
- Responsive design with mobile-first approach
- Hover states and transitions for better UX

## Development Best Practices

**When Adding New Features:**
1. Follow existing patterns for API routes (Next.js App Router structure)
2. Use TypeScript interfaces for all data structures
3. Implement error boundaries and loading states
4. Add retry logic for external API calls
5. Cache expensive operations (especially blockchain calls)
6. Log important operations for debugging

**Analytics & Monitoring:**
- Console logging is used extensively for debugging
- All API calls log status and response summaries
- Progress tracking for long operations (see TokenSupplyCard)
- Error states always display user-friendly messages

**API Rate Limiting:**
- Respect BaseScan/Etherscan rate limits (5 calls/second for free tier)
- Use delays between sequential calls (50-500ms)
- Implement exponential backoff on failures
- Prefer batch endpoints when available
- Use cached data when possible (5-minute cache for supply data)

**Testing Endpoints:**
- `/api/test` - Basic health check
- `/api/test-vtn` - VTN token API integration test with Etherscan V2

## Uniswap V4 Integration

**Important:** Uniswap V4 uses a different architecture than V2/V3. Pools are managed by a central PoolManager contract and identified by 66-character pool IDs (not addresses).

### How to Query Uniswap V4 Pool Liquidity

**StateView Contract (Base Mainnet):**
- Address: `0xa3c0c9b65bad0b08107aa264b0f3db444b867a71`
- Purpose: Read-only contract to query pool state without calling PoolManager directly

**ABI for getLiquidity:**
```typescript
const UNISWAP_V4_STATEVIEW_ABI = [
  {
    inputs: [{ internalType: 'bytes32', name: 'poolId', type: 'bytes32' }],
    name: 'getLiquidity',
    outputs: [{ internalType: 'uint128', name: 'liquidity', type: 'uint128' }],
    stateMutability: 'view',
    type: 'function'
  }
];
```

**Example Usage:**
```typescript
const STATE_VIEW_ADDRESS = '0xa3c0c9b65bad0b08107aa264b0f3db444b867a71';
const POOL_ID = '0x0f42e66657d0549d32594b0ae1e58435b5a96a60cc59a4d48f08fd6593bc8322';

const provider = new ethers.JsonRpcProvider(QUICKNODE_URL);
const stateView = new ethers.Contract(STATE_VIEW_ADDRESS, UNISWAP_V4_STATEVIEW_ABI, provider);

const liquidity = await stateView.getLiquidity(POOL_ID);
// Returns uint128 raw liquidity value
```

**Converting Liquidity to USD:**
The liquidity value needs to be converted using the current ETH price:
```typescript
const liquidityUSD = Number(liquidity) / 1e18 * ethPrice * 2;
```

**Key Differences from V2/V3:**
- Pool IDs are 66 characters (bytes32), not 42-character addresses
- Must use StateView contract, not direct pool calls
- No subgraph available for Base Mainnet yet (as of Jan 2025)
- Liquidity value format is uint128, requires conversion for USD display

## Project Status and Roadmap

### Current Implementation Status (Fase 1-2: ✅ Complete)

**✅ Completed Features:**

1. **Multi-Tenant Architecture (Sprint 1.1)**
   - Organization → Token → Data hierarchy
   - User, Organization, Token, OrganizationMember models
   - All cache models updated with tokenId for data isolation
   - Migration script for existing Vottun data (8,959 records migrated)
   - Test user created: admin@vottun.com (ADMIN role)

2. **Authentication System (Sprint 1.1)**
   - NextAuth.js with JWT sessions
   - Credentials provider (email/password with bcrypt)
   - OAuth support (Google)
   - Role-based access: SUPER_ADMIN, ADMIN, MEMBER, VIEWER
   - Auth pages: `/auth/signin`, `/auth/signup`, `/auth/error`
   - Protected routes with middleware
   - SessionProvider for client-side auth state

3. **Database Integration (PostgreSQL + Prisma)**
   - Full schema with 11 models (4 multi-tenant + 7 data models)
   - Connection pooling with `@prisma/adapter-pg`
   - Seed scripts: 13 addresses + Vottun org + test user
   - Migrations and schema management
   - Multi-tenant data isolation by tokenId

4. **Address Labeling System**
   - Database-backed address labels with types (CONTRACT, WALLET, EXCHANGE, VESTING, TOKEN)
   - EditAddressModal for inline editing
   - Integration throughout analytics UI
   - API endpoints for CRUD operations

5. **Admin Panel (Complete)**
   - `/admin/dashboard` - Statistics and overview
   - `/admin/addresses` - Full address management with search, filters, pagination
   - `/admin/addresses/new` - Add new addresses
   - `/admin/import` - Import/Export CSV and JSON
   - Sidebar navigation and consistent styling

6. **Performance & Caching (Incremental Sync)**
   - TransferCache: Stores all transfers, only fetches new ones (90% API call reduction)
   - HolderSnapshot: 5-minute snapshots of top holders
   - Load time improvement: 10-15s → 2-4s (75-80% faster)
   - Manual "Actualizar" button with timestamp

7. **Search & Navigation**
   - GlobalSearch component with Cmd+K / Ctrl+K shortcut
   - Searches addresses, names, transaction hashes
   - Quick access to analytics and holder views

8. **Data Visualization (Recharts)**
   - ExchangeFlowChart: Bar chart of net flow to exchanges
   - WhaleTimelineChart: Scatter plot of large transfers
   - HolderDistributionChart: Pie chart of holder concentration
   - Responsive and interactive charts

9. **Unified Dashboard**
   - `/dashboard` page combining all explorers
   - Token balances, vesting info, and analytics in one view

**✅ Completed (Sprint 1.2: Aislamiento Multi-Tenant):**
- ✅ Tenant context helper implemented (`getTenantContext`, `getApiKeys`)
- ✅ All APIs updated to filter by tokenId
  - `/api/token-analytics` - Full tenant isolation
  - `/api/addresses` - Filtered by tokenId
  - `/api/transfers-cache` - Filtered by tokenId
  - `/api/vesting-info` - Filtered by tokenId
  - `/api/token-supply` - Migrated to TokenSupplyCache model
- ✅ Organization management API (`/api/organizations`)
- ✅ Settings page created (`/settings/organization`)

**✅ Completed (Sprint 1.3: Gestión de Organizaciones):**
- ✅ API de organizaciones (`POST /api/organizations`, `GET /api/organizations`)
- ✅ Página de settings (`/settings/organization`)
- ✅ Visualización de miembros del equipo
- ⚠️ Invitación de miembros pendiente

**✅ Completed (Sprint 2.1: Configuración de Tokens):**
- ✅ CRUD completo de tokens (`/api/tokens`, `/settings/tokens`)
- ✅ Verificación on-chain de tokens ERC20 (ethers.js)
- ✅ Página de gestión de tokens (`/settings/tokens`)
- ✅ Página de configuración individual (`/settings/tokens/[id]`)
- ✅ Custom API keys por token (BaseScan, Etherscan, Moralis, QuikNode)
- ✅ Custom exchange addresses configurables
- ✅ Settings: whale threshold, cache duration, max transfers

**⚠️ Pending (Sprint 3.1: Wizard de Onboarding):**
- Create onboarding wizard for new users
- Token selector component in UI
- Redirect to onboarding if no org/tokens

### Future Features (See SAAS_PLAN.md for Details)

**Next Priorities (Sprint 3.1-3.2):**
1. **Wizard de Onboarding** - 5-step wizard for new users (welcome, org, token, settings, done)
2. **Token Selector Component** - Dropdown in UI to switch between tokens
3. **Redirección Automática** - To onboarding if user has no org/tokens

**Medium-term (Sprint 2-3):**
1. **Multi-Token Support** - Analyze any ERC20 token, not just VTN
2. **System de Alertas** - Telegram/Email notifications for whale movements, price changes
3. **API Pública** - REST API with authentication and rate limiting

**Long-term (Sprint 4+):**
- Progressive Web App (PWA) with push notifications
- Advanced AI/ML for pattern detection and dump prediction
- Historical analytics and trend analysis
- More DEX integrations

### Important Documentation

**For comprehensive information, refer to:**

1. **[IMPROVEMENTS.md](IMPROVEMENTS.md)** - Complete roadmap and feature planning
   - 10 major improvement areas with detailed implementation plans
   - Sprint breakdowns and time estimates
   - Technical specifications for each feature
   - Prioritization matrix and success metrics

2. **[database_plan.md](database_plan.md)** - Database architecture and implementation
   - Complete Prisma schema documentation
   - Migration guides and setup instructions
   - Performance optimization strategies
   - Implementation status and next steps

### Project Structure

**Key Directories:**
```
src/
├── app/
│   ├── api/
│   │   ├── auth/         # NextAuth API routes + signup endpoint
│   │   ├── addresses/    # Address CRUD
│   │   ├── analytics/    # Token analytics
│   │   ├── tokens/       # Token data
│   │   └── vottun/       # Vottun integration
│   ├── auth/             # Auth pages (signin, signup, error)
│   ├── admin/            # Admin panel (dashboard, addresses, import)
│   ├── platform/         # Protected platform routes (pending Sprint 1.2)
│   ├── dashboard/        # Unified dashboard page
│   ├── explorer/         # Public explorer pages
│   └── docs/             # API documentation
├── components/
│   ├── auth/             # SignInForm, SignUpForm components
│   ├── charts/           # Recharts visualizations
│   ├── EditAddressModal.tsx
│   ├── GlobalSearch.tsx
│   ├── Providers.tsx     # SessionProvider wrapper
│   └── [other UI components]
├── lib/
│   ├── auth.ts           # NextAuth configuration
│   ├── blockchain.ts     # Core blockchain interactions
│   ├── db.ts             # Prisma client singleton
│   ├── vestingHelpers.ts
│   ├── contractAbis.ts
│   ├── types.ts
│   └── utils.ts
├── middleware.ts         # Route protection with withAuth
└── prisma/
    ├── schema.prisma     # Database schema (11 models)
    ├── migrations/       # Database migrations
    ├── seed.ts           # Initial address seeding
    ├── seed-user.ts      # Test user creation
    └── migrate-vottun-data.ts  # Vottun data migration script

**Database Models (17 total):**

**Multi-Tenant Core:**
- `User` - User accounts with auth
- `Organization` - Multi-tenant organizations
- `Token` - Token configuration per org
- `OrganizationMember` - User-org relationships

**SaaS & Billing:**
- `Plan` - Subscription plans with configurable limits
- `Subscription` - Org subscriptions linking to plans
- `SystemSettings` - Global SaaS configuration (singleton)
- `Invitation` - Team member invitations with email tokens

**Data Models (Multi-Tenant Isolated):**
- `Contract` - Generic contract model (vesting, staking, liquidity, DAO, treasury, etc.) with category enum (tokenId FK)
- `CustomAbi` - ABIs for tokens and contracts (tokenId + contractAddress + network)
- `KnownAddress` - Address labels (tokenId FK)
- `TransferCache` - Transfer history (tokenId FK)
- `HolderSnapshot` - Holder snapshots (tokenId FK)
- `TokenSupplyCache` - Supply cache (tokenId FK)
- `VestingCache` - Vesting data (tokenId FK)
- `VestingTransferCache` - Vesting transfers (tokenId FK)
- `VestingBeneficiaryCache` - Vesting beneficiaries (tokenId FK)

### Development Workflow

**Database Operations:**
```bash
# Generate Prisma Client after schema changes
npx prisma generate

# Create and apply migrations
npx prisma migrate dev --name description

# Seed database with initial data (13 addresses)
npx prisma db seed

# Create test user (admin@vottun.com / admin123)
npx tsx prisma/seed-user.ts

# Migrate existing Vottun data to multi-tenant structure
npx tsx prisma/migrate-vottun-data.ts

# Migrate vesting contracts to database
npx tsx prisma/migrate-vesting-contracts.ts

# Migrate ABIs to database (11 ABIs)
npx tsx prisma/migrate-abis.ts

# Setup admin panel (create plans, system settings)
npx tsx prisma/migrate-admin-setup.ts

# Create SUPER_ADMIN user (superadmin@tokenlens.com / super123)
npx tsx prisma/seed-superadmin.ts

# Open Prisma Studio (database GUI)
npx prisma studio

# Push schema without migration (development)
npx prisma db push
```

**Common Tasks:**
- Adding new address labels: Use `/admin/addresses/new` or POST to `/api/addresses`
- Bulk import: Use `/admin/import` with CSV/JSON file
- Creating users: Use `/auth/signup` or run `npx tsx prisma/seed-user.ts`
- Login: Navigate to `/auth/signin`
  - Regular user: admin@vottun.com / admin123
  - SUPER_ADMIN: superadmin@tokenlens.com / super123
- Access admin panel: Login as SUPER_ADMIN → "Admin" link in navbar
- Managing plans: `/admin/plans` (create, edit, reorder, delete)
- Assigning plans to orgs: `/admin/organizations/[id]` → Change Plan dropdown
- Viewing SaaS metrics: `/admin/dashboard` (MRR, alerts, graphs)
- Configuring global settings: `/admin/settings` (API keys, Stripe, email)
- Viewing cache status: Check PostgreSQL directly or add admin cache page (pending)
- Forcing data refresh: Use "Actualizar" button in analytics UI

### Performance Considerations

**Caching Strategy:**
- Transfers: Incremental sync (fetch only new since last timestamp)
- Holders: Snapshot every 5 minutes
- Supply: 5-minute TTL (in-memory, DB migration pending)
- Analytics: Combined cache + real-time data

**API Rate Limits:**
- Etherscan: 5 calls/second (free tier)
- Moralis: Rate limited by plan
- BaseScan: 5 calls/second (free tier)
- QuikNode: Depends on plan
- DEX Screener: Free, no auth required

**Optimization Tips:**
- Use cached data whenever possible
- Batch blockchain calls when feasible
- Implement exponential backoff for retries
- Monitor API usage to stay within free tiers
- Add indexes to frequently queried database fields

### Security Notes

**✅ Implemented (Sprint 1.1):**
- NextAuth.js authentication system with JWT sessions
- Role-based access control (SUPER_ADMIN, ADMIN, MEMBER, VIEWER)
- Protected routes with middleware (admin and platform routes)
- Password hashing with bcrypt (10 rounds)
- OAuth support (Google)
- Session management with SessionProvider
- Database credentials in `.env.local` (not committed)

**⚠️ Pending Security (Sprint 1.2+):**
- CSRF protection
- Rate limiting on authentication endpoints
- Email verification flow
- Password reset flow
- Audit logging for sensitive operations
- API key management for public API (Sprint 2)
- Two-factor authentication (2FA) - future consideration

---

**Last Updated:** 2025-02-05
**Version:** 4.0 (Sprint 4.8 - Admin Panel Complete)

### Sprint Status:

**Fase 1: Auth + Multi-Tenant**
- ✅ **Sprint 1.1:** NextAuth Setup (COMPLETADO)
- ✅ **Sprint 1.2:** Tenant Context & API Isolation (COMPLETADO)
- ✅ **Sprint 1.3:** Organization Settings (COMPLETADO)

**Fase 2: Tokens + Config**
- ✅ **Sprint 2.1:** Token Management + Custom API Keys (COMPLETADO)
- ✅ **Sprint 2.2:** Custom ABIs + Contracts (COMPLETADO - modelo genérico con enum)
- ✅ **Sprint 2.3:** Token Supply Custom Configuration (COMPLETADO)
- ✅ **Refactor:** VestingContract → Contract (modelo genérico para todos los tipos)
- ✅ **Sprint 2.4:** APIs Multi-Tenant Completas (COMPLETADO)
- ✅ **Sprint 2.5:** Invitación de Miembros (COMPLETADO)
- ✅ **UI Refactor:** Settings con Sidebar (COMPLETADO)

**Fase 4: Admin Panel SaaS** 🎉
- ✅ **Sprint 4.1:** Base de Datos (Plan, SystemSettings, Subscription)
- ✅ **Sprint 4.2:** APIs de Admin (/api/admin/*)
- ✅ **Sprint 4.3:** UI Panel Admin completo (/admin/*)
- ✅ **Sprint 4.4:** Navbar + Protección (SUPER_ADMIN)
- ✅ **Sprint 4.5:** Validación de Límites (limits.ts)
- ✅ **Sprint 4.6:** Fixes y Mejoras (Login redirect, async params)
- ✅ **Sprint 4.7:** Mejoras UX (Alertas, custom APIs indicator)
- ✅ **Sprint 4.8:** Gestión de Usuarios (/admin/users)

---

## 🎉 Admin Panel SaaS - Resumen Completo (Fase 4)

**Panel completo para SUPER_ADMIN** con gestión de planes, organizaciones, usuarios y configuración global.

### Características Principales:

**Dashboard (`/admin/dashboard`):**
- 4 métricas clave: Total orgs, Subscriptions, MRR, Users
- 3 gráficos históricos (12 meses): Nuevas orgs, Cancelaciones, MRR evolution
- Plan distribution chart
- **Alertas proactivas**: Orgs cerca de límites (≥80% usage)
- Recent organizations table

**Gestión de Organizaciones:**
- Lista completa con filtros y búsqueda
- Indicador "🔑 Custom APIs" en tabla
- Detalle individual con:
  - Cambio de plan (dropdown)
  - Progress bars de uso vs límites
  - Lista de miembros y tokens
  - Indicador custom API keys con detalles

**Gestión de Planes:**
- CRUD completo con drag & drop reordering
- Límites configurables (-1 = ilimitado)
- Features como JSON array
- Validación antes de eliminar

**Configuración Global (`/admin/settings`):**
- 4 tabs: API Keys, Email, Stripe, General
- SystemSettings en BD (no hardcoded en .env)

**Gestión de Usuarios:**
- Lista global con stats por rol
- Filtros y búsqueda
- Tooltips con organizaciones

**Validación de Límites:**
- `src/lib/limits.ts` - Helpers para validar límites
- Integrado en: `/api/tokens`, `/api/organizations/invite`, `/api/token-analytics`
- Mensajes claros para upgrades
- Hard limits (bloqueo) vs Soft limits (warning)

**Seguridad:**
- Helper `requireSuperAdmin()` en todas las APIs admin
- Middleware protege `/admin/*`
- Link "Admin" solo visible para SUPER_ADMIN

**Acceso:**
- Login: superadmin@tokenlens.com / super123
- URL: http://localhost:4200/admin/dashboard

---

**Next Steps:**
- ⏸️ Fase 3: Onboarding Wizard (POSTPONED)
- 🔜 Fase 5: Integración REAL con Stripe API
