# Analytics System

Complete guide to the token analytics system: architecture, data flow, external APIs, caching, database models, components, and charts.

---

## Overview

The analytics system provides real-time and cached market intelligence for ERC20 tokens on the Base network. It combines on-chain data, external API data, and computed metrics into a single dashboard.

**Key capabilities:**
- Transfer history with incremental caching (90% API call reduction)
- Top holders with 5-minute snapshot caching
- Whale tracking (large transfers above configurable threshold)
- Exchange flow analysis (net flow to/from CEX)
- Price & liquidity data (real-time, no cache)
- Smart alerts (whale moves, accumulation, distribution, exchange flow)
- Advanced client-side filtering

---

## Architecture

### Data Flow Diagram

```
User visits /dashboard?tab=analytics
    │
    ▼
AnalyticsContent.tsx (client component)
    │
    ├── GET /api/token-analytics?days=7&threshold=10000&forceRefresh=false
    │       │
    │       ├── getTenantContext() → org, activeToken, apiKeys
    │       │
    │       ├── getTransfersWithCache()
    │       │       ├── READ: TransferCache (DB, filtered by tokenId)
    │       │       ├── FETCH: Routescan API (only new transfers since last timestamp)
    │       │       └── WRITE: TransferCache (new transfers saved to DB)
    │       │
    │       ├── getHoldersWithCache()
    │       │       ├── READ: HolderSnapshot + Holder (DB, last snapshot)
    │       │       ├── If cache valid (<5 min) → return cached
    │       │       ├── READ: KnownAddress (DB, for labels/types)
    │       │       ├── FETCH: Moralis API (top 50 holders)
    │       │       ├── RPC: isContractAddress() for unknown holders
    │       │       └── WRITE: HolderSnapshot + Holder (new snapshot)
    │       │
    │       ├── getCurrentPrice() [real-time, no cache]
    │       │       ├── TRY: QuikNode price addon
    │       │       └── FALLBACK: DEX Screener API
    │       │
    │       ├── getLiquidityData() [real-time, no cache]
    │       │       ├── FETCH: DEX Screener (all Base pools)
    │       │       └── RPC: Uniswap V4 StateView contract
    │       │
    │       ├── calculateNetFlowToExchanges()
    │       ├── generateAlerts()
    │       └── Return AnalyticsData JSON
    │
    ├── GET /api/addresses (loads known address labels)
    │
    └── Renders tabs: Overview, Charts, Whales, Holders, Activity, Known Addresses
```

### Entry Points (Routes)

| Route | Behavior |
|-------|----------|
| `/dashboard?tab=analytics` | Main entry. Renders `AnalyticsContent` inside dashboard tabs |
| `/dashboard/analytics` | Redirects to `/dashboard?tab=analytics` |
| `/explorer/analytics` | Public explorer route (if exists) |

**Dashboard integration:** [page.tsx](../src/app/dashboard/page.tsx) lines 29-31 load `AnalyticsContent` dynamically with `{ ssr: false }`. The `analytics` tab is at line 381, rendered at line 611-614.

---

## Files Reference

### Core Files

| File | Purpose | Lines |
|------|---------|-------|
| [src/app/api/token-analytics/route.ts](../src/app/api/token-analytics/route.ts) | **Main API endpoint** - all backend logic | 1019 lines |
| [src/components/AnalyticsContent.tsx](../src/components/AnalyticsContent.tsx) | **Main UI component** - tabs, tables, controls, filters | 1250 lines |
| [src/app/dashboard/analytics/page.tsx](../src/app/dashboard/analytics/page.tsx) | Redirect page → `/dashboard?tab=analytics` | 20 lines |
| [src/app/dashboard/page.tsx](../src/app/dashboard/page.tsx) | Dashboard host (imports AnalyticsContent dynamically) | Lines 29-31, 381, 611-614 |

### Chart Components

| File | Chart Type | Library | Data Source |
|------|-----------|---------|-------------|
| [src/components/charts/HolderDistributionChart.tsx](../src/components/charts/HolderDistributionChart.tsx) | `PieChart` | Recharts | `topHolders[]` |
| [src/components/charts/WhaleTimelineChart.tsx](../src/components/charts/WhaleTimelineChart.tsx) | `ScatterChart` | Recharts | `transfers[]` (filtered by `isLargeTransfer`) |
| [src/components/charts/ExchangeFlowChart.tsx](../src/components/charts/ExchangeFlowChart.tsx) | `BarChart` | Recharts | `transfers[]` (grouped by day, net flow) |

All charts use `dynamic(() => import(...), { ssr: false })` to avoid SSR issues with Recharts.

### Supporting Components

| File | Purpose |
|------|---------|
| [src/components/AdvancedFilters.tsx](../src/components/AdvancedFilters.tsx) | Collapsible filter panel (address types, amount range, date range, exclusions) |
| [src/components/EditAddressModal.tsx](../src/components/EditAddressModal.tsx) | Modal for editing/creating KnownAddress entries |

### Settings Page

| File | Purpose |
|------|---------|
| [src/app/settings/tokens/[id]/general/page.tsx](../src/app/settings/tokens/%5Bid%5D/general/page.tsx) | Token-specific analytics settings (whaleThreshold, customExchangeAddresses) - lines 81-161 |

---

## External APIs

### 1. Routescan API (Transfer History)

**Used by:** `fetchNewTransfersFromAPI()` (route.ts:127-164)

```
GET https://api.routescan.io/v2/network/mainnet/evm/8453/etherscan/api
    ?module=account
    &action=tokentx
    &contractaddress={tokenAddress}
    &page=1
    &offset=10000
    &sort=desc
    &apikey={apiKey}
```

**API Key hierarchy:**
1. `SystemSettings.defaultRoutescanApiKey`
2. `SystemSettings.defaultBasescanApiKey`
3. `.env` → `NEXT_PUBLIC_ROUTESCAN_API_KEY` or `NEXT_PUBLIC_BASESCAN_API_KEY`

**Returns:** Array of ERC20 token transfers (Etherscan-compatible format)

**Rate limits:** Free tier ~5 calls/second. Incremental caching reduces calls by ~90%.

---

### 2. Moralis API (Top Holders)

**Used by:** `fetchHoldersFromMoralis()` (route.ts:293-410)

```
GET https://deep-index.moralis.io/api/v2.2/erc20/{tokenAddress}/owners
    ?chain=base
    &order=DESC
    &limit=50
Headers:
    Accept: application/json
    X-API-Key: {moralisApiKey}
```

**API Key hierarchy:**
1. `TokenSettings.customMoralisApiKey` (per-token, highest priority)
2. `SystemSettings.defaultMoralisApiKey` (global fallback)
3. `.env` → `NEXT_PUBLIC_MORALIS_API_KEY`

**Returns:** Top 50 token holders with balances and percentages.

**Post-processing:** For each holder, checks `isContract` via RPC call (`getCode()`), reusing info from previous snapshots and KnownAddress DB to minimize RPC calls.

---

### 3. QuikNode Price Addon (Token Price)

**Used by:** `getCurrentPrice()` (route.ts:547-593)

```
GET {quiknodeUrl}/addon/1051/v1/prices/{tokenAddress}?target=aero
Headers:
    Accept: application/json
```

**API Key:** `SystemSettings.defaultQuiknodeUrl` or `.env` → `NEXT_PUBLIC_QUICKNODE_URL`

**Returns:** `{ price: number }` - Real-time token price in USD.

**No cache** - fetched on every analytics request.

---

### 4. DEX Screener API (Price Fallback + Liquidity)

**Used by:** `getCurrentPrice()` (fallback) and `getLiquidityData()` (route.ts:674-748)

```
GET https://api.dexscreener.com/latest/dex/tokens/{tokenAddress}
```

**No API key required** (free, public API).

**Returns:** All trading pairs for the token across DEXes.

**Used for:**
- **Price fallback:** If QuikNode fails, reads `priceUsd` from first Base pair
- **Liquidity:** Aggregates all Base pairs with liquidity > $100 (Aerodrome, Uniswap, etc.)
- **FDV (Fully Diluted Valuation):** From first Base pair
- **24h price change:** From `priceChange.h24`

---

### 5. Base RPC (On-chain calls)

**Used by:** `isContractAddress()` and `getUniswapV4PoolData()`

**Provider:** Singleton `JsonRpcProvider` (route.ts:267-280)
- `SystemSettings.defaultQuiknodeUrl`
- `.env` → `NEXT_PUBLIC_QUICKNODE_URL`
- Fallback: `https://mainnet.base.org` (public RPC)

**On-chain operations:**
| Function | Purpose | Contract |
|----------|---------|----------|
| `provider.getCode(address)` | Check if address is contract (route.ts:282-291) | - |
| `stateView.getLiquidity(poolId)` | Uniswap V4 pool liquidity (route.ts:632-672) | StateView `0xa3c0...67a71` |

**Uniswap V4 config:**
- Pool ID: `0x0f42e66657d0549d32594b0ae1e58435b5a96a60cc59a4d48f08fd6593bc8322`
- StateView: `0xa3c0c9b65bad0b08107aa264b0f3db444b867a71` (Base Mainnet)

---

### 6. Addresses API (Known Labels)

**Used by:** `AnalyticsContent.tsx` (client-side, line 136)

```
GET /api/addresses
```

**Internal API** - fetches all KnownAddress records for the tenant's token. Used to display friendly names next to addresses in all tables.

---

## Database Models Used by Analytics

Cross-reference to [DATABASE.md](./DATABASE.md).

### TransferCache

**DATABASE.md reference:** Lines 495-527 (model documentation), Lines 524-549 (schema)

**Schema location:** `prisma/schema.prisma` lines 524-549

```prisma
model TransferCache {
  id            String   @id @default(cuid())
  tokenId       String?
  hash          String
  tokenAddress  String
  tokenSymbol   String?
  tokenName     String?
  decimals      Int      @default(18)
  from          String
  to            String
  value         String
  timestamp     BigInt   // Unix timestamp
  blockNumber   Int
  network       String   @default("base")
  cachedAt      DateTime @default(now())

  @@unique([tokenId, hash])
  @@index([tokenId, timestamp])
  @@index([tokenAddress, timestamp])
}
```

**How analytics uses it:**
- **READ:** `getTransfersWithCache()` reads all cached transfers filtered by `tokenId` + `tokenAddress` + `network`, ordered by `timestamp DESC`
- **WRITE:** New transfers from Routescan API are saved with `createMany({ skipDuplicates: true })`
- **Incremental sync:** Finds `lastTimestamp` from most recent cached transfer, only fetches transfers newer than that

**Performance impact:**
- First load: ~10s (fetches full history from API)
- Subsequent loads: 2-4s (reads DB + fetches only new)

---

### HolderSnapshot + Holder

**DATABASE.md reference:** Lines 529-564 (HolderSnapshot), Lines 570-585 (Holder)

**Schema location:** `prisma/schema.prisma` lines 554-585

```prisma
model HolderSnapshot {
  id           String   @id @default(cuid())
  tokenId      String?
  tokenAddress String
  network      String   @default("base")
  timestamp    DateTime @default(now())
  holders      Holder[]

  @@index([tokenId, network, timestamp])
  @@index([tokenAddress, network, timestamp])
}

model Holder {
  id         String   @id @default(cuid())
  snapshotId String
  address    String
  balance    String
  percentage Float
  isContract Boolean  @default(false)
  isExchange Boolean  @default(false)
  label      String?

  @@index([address])
  @@index([snapshotId])
}
```

**How analytics uses it:**
- **READ:** `getHoldersWithCache()` reads last snapshot with `{ include: { holders: true } }` (route.ts:417-425)
- **Cache validation:** Snapshot is valid if `now - snapshot.timestamp < 5 minutes` (route.ts:428-429)
- **WRITE:** Creates new snapshot with nested `holders: { create: [...] }` (route.ts:498-515)
- **Optimization:** Reuses `isContract`/`isExchange`/`label` from previous snapshots to avoid redundant RPC calls

---

### KnownAddress

**DATABASE.md reference:** Lines 456-488

**How analytics uses it:**
- **In API:** `getHoldersWithCache()` reads all KnownAddress for the token (route.ts:469-486) to enrich holder data with labels and address types
- **In UI:** `GET /api/addresses` loads all known addresses for label display in AnalyticsContent (line 136-152)
- **Edit/Delete:** UI allows inline editing/deleting of known addresses from the "Direcciones Conocidas" tab

---

### TokenSettings (Analytics Configuration)

**DATABASE.md reference:** Lines 224-254

**Schema location:** `prisma/schema.prisma` lines 224-254

**Analytics-relevant fields:**
```prisma
model TokenSettings {
  // API Keys (used by analytics for Moralis, Routescan, etc.)
  customMoralisApiKey     String?
  customRoutescanApiKey   String?
  customQuiknodeUrl       String?

  // Analytics-specific settings
  cacheDurationMinutes    Int      @default(5)     // Holder cache TTL
  maxTransfersToFetch     Int      @default(10000) // API fetch limit
  whaleThreshold          String   @default("10000") // Large transfer threshold

  // Exchange detection
  customExchangeAddresses String[] // Custom CEX addresses
}
```

**Used in:** `route.ts:900` reads `whaleThreshold` from token settings as default threshold.

**Configurable at:** `/settings/tokens/[id]/general`

---

## Caching Strategy

### Transfer Cache (Incremental)

```
Request → Read DB (TransferCache WHERE tokenId)
              │
              ├── Get lastTimestamp from most recent cached transfer
              │
              ├── Fetch API: Routescan (only transfers AFTER lastTimestamp)
              │
              ├── Save new transfers to DB (createMany, skipDuplicates)
              │
              └── Return: cached + new (combined)
```

| Metric | First Load | Subsequent Loads |
|--------|-----------|-----------------|
| Time | ~10s | 2-4s |
| API calls | 1 (full history) | 1 (incremental) |
| DB reads | 0 | 1 (all cached transfers) |
| DB writes | N transfers | Only new transfers |

---

### Holder Snapshot Cache (Time-based)

```
Request → Read DB (last HolderSnapshot WHERE tokenId)
              │
              ├── Is snapshot < 5 minutes old?
              │       │
              │       YES → Return cached holders
              │       │
              │       NO → Fetch Moralis API (top 50)
              │              │
              │              ├── For each holder:
              │              │   ├── Reuse info from previous snapshot? ✓ Skip RPC
              │              │   ├── Reuse info from KnownAddress DB? ✓ Skip RPC
              │              │   └── New address? → RPC: getCode() to check isContract
              │              │
              │              └── Save new HolderSnapshot + Holders to DB
              │
              └── Return formatted holders
```

**Cache TTL:** 5 minutes (configurable via `TokenSettings.cacheDurationMinutes`)

---

### Price & Liquidity (No Cache)

Fetched fresh on every request via `Promise.all()` (route.ts:964-967):
- `getCurrentPrice()` → QuikNode → DEX Screener fallback
- `getLiquidityData()` → DEX Screener + Uniswap V4 on-chain

---

## API Endpoint

### GET /api/token-analytics

**Authentication:** Required (uses `getTenantContext()`)

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `days` | number | 7 | Time range: 1, 7, 30, 90 days |
| `threshold` | string | TokenSettings.whaleThreshold or "10000" | Large transfer threshold (in token units) |
| `forceRefresh` | boolean | false | Force refresh of holder snapshot cache |

**Response Type: `AnalyticsData`**

```typescript
interface AnalyticsData {
  transfers: TokenTransfer[];       // Recent transfers (max 1000)
  largeTransfers: TokenTransfer[];  // Transfers >= threshold (max 100)
  topHolders: HolderInfo[];         // Top 50 holders
  priceData: PriceData;             // Current price
  liquidityData: LiquidityData | null; // DEX pools + total liquidity
  alerts: Alert[];                  // Smart alerts
  statistics: Statistics;           // Computed metrics
  timeRange: { from: number; to: number };
  cacheInfo: {
    transfersCached: number;
    transfersNew: number;
    holdersCached: boolean;
    lastUpdate: number;
  };
}
```

**Key interfaces:**

```typescript
interface TokenTransfer {
  hash: string;
  from: string;
  to: string;
  value: string;           // Raw BigInt as string
  valueFormatted: string;  // Human-readable (ethers.formatUnits)
  timestamp: number;       // Unix seconds
  blockNumber: number;
  isLargeTransfer: boolean;
  tokenSymbol: string;
  tokenName: string;
  decimals: number;
}

interface HolderInfo {
  address: string;
  balance: string;      // Formatted (ethers.formatUnits)
  percentage: string;   // "12.34"
  isExchange: boolean;
  isContract: boolean;
  label?: string;
}

interface PriceData {
  price: number;
  priceChange24h?: number;
  priceChange7d?: number;
}

interface LiquidityData {
  total: number;         // Total USD liquidity
  pools: PoolData[];     // Individual pools
  fdv?: number;          // Fully diluted valuation
}

interface PoolData {
  liquidity: number;     // USD
  volume24h: number;
  priceChange24h?: number;
  pairAddress: string;
  dexName: string;       // "Aerodrome", "Uniswap", etc.
}

interface Alert {
  type: 'whale_move' | 'accumulation' | 'distribution' | 'liquidity_change' | 'exchange_flow';
  severity: 'low' | 'medium' | 'high';
  message: string;
  timestamp: number;
  data?: any;
}

interface Statistics {
  totalTransfers: number;
  totalVolume: string;
  uniqueAddresses: number;
  averageTransferSize: string;
  largeTransferCount: number;
  largeTransferThreshold: string;
  netFlowToExchanges: string;
  topHoldersConcentration: string;  // "72.45"
}
```

---

## UI Component: AnalyticsContent

**Location:** [src/components/AnalyticsContent.tsx](../src/components/AnalyticsContent.tsx)

### State Management

| State | Type | Purpose |
|-------|------|---------|
| `data` | `AnalyticsData \| null` | Main data from API |
| `days` | `number` | Selected time range (1, 7, 30, 90) |
| `threshold` | `string` | Whale threshold |
| `activeTab` | `string` | Current tab |
| `addressNames` | `Map<string, string>` | Address → label mapping |
| `knownAddresses` | `any[]` | Full KnownAddress records (includes `isFavorite`) |
| `selectedWatchlistAddress` | `string \| null` | Currently selected watchlist wallet |
| `advancedFilters` | `AdvancedFiltersState` | Filter configuration |
| `appliedFilters` | `AdvancedFiltersState` | Currently applied filters |
| `isRefreshing` | `boolean` | Refresh in progress |
| `lastUpdate` | `number` | Timestamp of last data fetch |

### Tabs

| Tab | Content | Key Data |
|-----|---------|----------|
| **Resumen** (overview) | Stats cards + top 5 holders table | `statistics`, `topHolders[0:5]` |
| **Graficos** (charts) | 4 charts (pie, scatter, bar, stacked bar) | `topHolders`, `transfers`, `threshold`, `dailyVolumeHistory` |
| **Movimientos Grandes** (whales) | Sortable large transfers table | `largeTransfers` (sorted by date or amount) |
| **Top Holders** (holders) | Top 20 holders with types and labels | `topHolders` |
| **Actividad Reciente** (activity) | Last 50 transfers | `transfers[0:50]` |
| **Direcciones Conocidas** (known) | CRUD for KnownAddress | `knownAddresses` via `/api/addresses` |
| **Watchlist** (watchlist) | Favorite wallets with detail view | `knownAddresses.filter(isFavorite)`, `topHolders`, `transfers` |

### Summary Cards (Always Visible)

| Card | Data Source | Location |
|------|-------------|----------|
| Precio token | `priceData.price`, `liquidityData.priceChange24h` | Line 637-645 |
| Liquidez Total | `liquidityData.total`, `liquidityData.pools[]` | Line 647-663 |
| Net Flow a CEX | `statistics.netFlowToExchanges` | Line 665-674 |
| Top 10 Concentracion | `statistics.topHoldersConcentration` | Line 676-680 |
| Total Transferencias | `statistics.totalTransfers` | Line 723 |
| Volumen Total | `statistics.totalVolume` | Line 729 |
| Direcciones Unicas | `statistics.uniqueAddresses` | Line 733 |
| Transferencias Grandes | `statistics.largeTransferCount` | Line 739 |

### Client-Side Filtering

Applied via `filterTransfers()` (line 332-375) using `useMemo`:

| Filter | Type | Description |
|--------|------|-------------|
| Address types | Checkbox (exchanges, contracts, wallets) | Show/hide by address type |
| Amount range | min/max number inputs | Filter by transfer amount |
| Date range | date inputs | Filter by transfer date |
| Only labeled | Checkbox | Only show transfers involving known addresses |
| Excluded addresses | List of 0x addresses | Hide specific addresses |

---

## Charts

### 1. HolderDistributionChart (Pie)

**File:** [src/components/charts/HolderDistributionChart.tsx](../src/components/charts/HolderDistributionChart.tsx)

- **Type:** `PieChart` (Recharts)
- **Input:** `topHolders: HolderInfo[]`
- **Segments:** Top 10 Holders, Top 11-50, Rest
- **Indicator:** Shows concentration health (>70% = high, >50% = medium, else healthy)

### 2. WhaleTimelineChart (Scatter)

**File:** [src/components/charts/WhaleTimelineChart.tsx](../src/components/charts/WhaleTimelineChart.tsx)

- **Type:** `ScatterChart` (Recharts)
- **Input:** `transfers[]` (filtered by `isLargeTransfer`), `threshold`, `tokenSymbol`
- **X axis:** timestamp, **Y axis:** amount
- **Max points:** 100
- **Tooltip:** Shows amount, date, from/to addresses

### 3. ExchangeFlowChart (Bar)

**File:** [src/components/charts/ExchangeFlowChart.tsx](../src/components/charts/ExchangeFlowChart.tsx)

- **Type:** `BarChart` (Recharts)
- **Input:** `transfers[]`, `days`, `tokenSymbol`, `exchangeAddresses[]`
- **Logic:** Groups transfers by day, calculates net flow (to exchange = positive/red, from exchange = negative/green)
- **Exchanges:** Receives combined exchange list from API (defaults + custom + KnownAddress EXCHANGE)

### 4. DailyVolumeChart (Stacked Bar)

**File:** [src/components/charts/DailyVolumeChart.tsx](../src/components/charts/DailyVolumeChart.tsx)

- **Type:** Stacked `BarChart` (Recharts)
- **Input:** `dailyVolumeHistory[]`, `days`, `tokenSymbol`
- **Bars:** Exchange volume (red), Whale volume (yellow), Normal volume (blue)
- **Tooltip:** Shows breakdown per day + transaction count
- **Data source:** Pre-aggregated in API (route.ts), using `volumeByDay` with BigInt arithmetic

---

## Watchlist (Favorites)

Mark any wallet as a favorite from anywhere in analytics (star button on `AddressLink` component). Favorites are per-tokenId.

### How it works

- **DB field:** `KnownAddress.isFavorite` (Boolean, default false)
- **Toggle:** Click star icon next to any address → POST `/api/addresses` with `isFavorite: true/false`
- **If address not in KnownAddress:** Creates a new entry with auto-generated name and type WALLET
- **Tab:** "Watchlist" tab shows only `knownAddresses.filter(ka => ka.isFavorite)`
- **Detail view:** Click a favorited wallet → expands `WatchlistDetail` component showing:
  - Name, type, category, tags
  - Balance & % supply (from `topHolders` if present)
  - Last 10 transfers involving this address (from `transfers`)

### Files

| File | Role |
|------|------|
| `prisma/schema.prisma` | `isFavorite Boolean @default(false)` on KnownAddress |
| `src/app/api/addresses/route.ts` | POST accepts `isFavorite` field |
| `src/components/EditAddressModal.tsx` | Toggle switch for Watchlist |
| `src/components/WatchlistDetail.tsx` | Expandable detail card for selected wallet |
| `src/components/AnalyticsContent.tsx` | Star button on AddressLink, Watchlist tab |

---

## Daily Volume History

Stacked bar chart showing volume breakdown by day.

### Data Flow

1. **API (route.ts):** After fetching transfers, iterates all transfers grouping by `YYYY-MM-DD`
2. Each day calculates: `exchangeVolume` (involves exchange), `whaleVolume` (isLargeTransfer), `normalVolume` (rest)
3. Uses `BigInt` arithmetic for precision, then formats with `ethers.formatUnits()`
4. Returns `dailyVolumeHistory[]` in the API response

### Categories

| Category | Color | Logic |
|----------|-------|-------|
| Exchange | Red (#EF4444) | `from` or `to` is in `exchangeSet` |
| Whale | Yellow (#F59E0B) | `isLargeTransfer === true` (and not exchange) |
| Normal | Blue (#3B82F6) | Everything else |

### Files

| File | Role |
|------|------|
| `src/app/api/token-analytics/route.ts` | Aggregation logic, `dailyVolumeHistory` in response |
| `src/components/charts/DailyVolumeChart.tsx` | Stacked BarChart component |
| `src/components/AnalyticsContent.tsx` | Dynamic import + render in Charts tab |

---

## Alert System

**Generated by:** `generateAlerts()` (route.ts:772-855)

| Alert Type | Trigger | Severity |
|------------|---------|----------|
| `whale_move` | 3+ large transfers in last 2 hours | HIGH |
| `exchange_flow` (sell pressure) | Net flow to exchanges > 50k tokens | MEDIUM/HIGH |
| `exchange_flow` (less pressure) | Net flow from exchanges > 50k tokens | LOW |
| `distribution` | Top 10 holders > 70% concentration | MEDIUM |
| `accumulation` | Single whale received > 100k tokens recently | MEDIUM |

Alerts are sorted by severity (high first).

---

## Exchange Address Detection

Exchange addresses are now merged from 3 sources via `buildExchangeSet()` in route.ts:

| Source | Priority | Where Configured |
|--------|----------|------------------|
| `DEFAULT_EXCHANGES` | Base | Hardcoded in route.ts (Coinbase x3, Gate.io) |
| `TokenSettings.customExchangeAddresses` | Per-token | Settings UI → Token API Keys tab |
| `KnownAddress` type `EXCHANGE` | Per-token | Analytics → Direcciones Conocidas tab |

**Default addresses (always included):**
| Address | Label |
|---------|-------|
| `0x3cd751e6b0078be393132286c442345e5dc49699` | Coinbase |
| `0x71660c4005ba85c37ccec55d0c4493e66fe775d3` | Coinbase 2 |
| `0x503828976d22510aad0201ac7ec88293211d23da` | Coinbase 3 |
| `0x0d0707963952f2fba59dd06f2b425ace40b492fe` | Gate.io |

The combined set is:
- Used in the API for: Net Flow calculation, daily volume breakdown (exchange category), alert generation, holder classification
- Sent in the response as `exchangeAddresses[]` so frontend components (AnalyticsContent, ExchangeFlowChart) use the same list
- No hardcoded exchanges in frontend code anymore

---

## Multi-Tenant Isolation

All database queries in the analytics API filter by `tokenId`:

| Query | Filter | Location |
|-------|--------|----------|
| `transferCache.findMany` | `WHERE tokenId, tokenAddress, network` | route.ts:177-184 |
| `transferCache.createMany` | Each record includes `tokenId` | route.ts:202-218 |
| `holderSnapshot.findFirst` | `WHERE tokenId, tokenAddress, network` | route.ts:417-425 |
| `holderSnapshot.create` | Includes `tokenId` | route.ts:498-515 |
| `knownAddress.findMany` | `WHERE tokenId` | route.ts:469-471 |
| `tokenSettings.findUnique` | `WHERE tokenId` (for Moralis key) | route.ts:304 |

The tenant context is established via `getTenantContext()` at the start of the request (route.ts:868), which determines the active token and organization.

---

## Performance Characteristics

| Operation | First Load | Cached Load | Cache TTL |
|-----------|-----------|-------------|-----------|
| Transfers | ~5-10s (full API fetch) | ~1-2s (DB read + incremental) | Permanent (incremental) |
| Holders | ~3-5s (Moralis + RPC checks) | Instant (DB read) | 5 minutes |
| Price | ~0.5-1s | - (always fresh) | None |
| Liquidity | ~1-2s | - (always fresh) | None |
| **Total** | **~10-15s** | **~2-4s** | - |

---

## Configuration Reference

### Environment Variables (Fallback)

| Variable | Used For |
|----------|----------|
| `NEXT_PUBLIC_ROUTESCAN_API_KEY` | Transfer history API |
| `NEXT_PUBLIC_BASESCAN_API_KEY` | Transfer history fallback |
| `NEXT_PUBLIC_MORALIS_API_KEY` | Top holders |
| `NEXT_PUBLIC_QUICKNODE_URL` | RPC + price addon |

### SystemSettings (Global)

| Field | Used For |
|-------|----------|
| `defaultRoutescanApiKey` | Transfer history |
| `defaultBasescanApiKey` | Transfer history fallback |
| `defaultMoralisApiKey` | Top holders |
| `defaultQuiknodeUrl` | RPC provider + price |

### TokenSettings (Per-Token)

| Field | Used For | Default |
|-------|----------|---------|
| `customMoralisApiKey` | Override Moralis key | null |
| `customRoutescanApiKey` | Override Routescan key | null |
| `customQuiknodeUrl` | Override RPC URL | null |
| `whaleThreshold` | Default large transfer threshold | "10000" |
| `cacheDurationMinutes` | Holder cache TTL | 5 |
| `maxTransfersToFetch` | API fetch limit | 10000 |
| `customExchangeAddresses` | Custom CEX addresses | [] |

---

## Known Issues & TODOs

1. ~~**Hardcoded exchange addresses**~~ - **RESOLVED.** Exchange addresses now merge 3 sources via `buildExchangeSet()`. No more hardcoded lists in frontend.

2. **Uniswap V4 liquidity formula** - Uses hardcoded division factor (`1.64e17`) based on empirical observation (route.ts:658). Not a general formula.

3. **Hardcoded pool ID** - Uniswap V4 pool ID is hardcoded (route.ts:634). Only works for the specific VTN/AERO pool.

4. **Alert thresholds hardcoded** - Whale move (3 transfers/2h), exchange flow (50k/200k tokens), concentration (70%), accumulation (100k) are all hardcoded in `generateAlerts()`.

5. **`cacheDurationMinutes` from TokenSettings** is defined but the API uses hardcoded `HOLDER_CACHE_DURATION = 5 * 60 * 1000` (route.ts:20) instead of reading from settings.

6. **Transfer limit** - API returns max 1000 transfers and max 100 large transfers.

---

## Related Documentation

- [DATABASE.md](./DATABASE.md) - Full schema (TransferCache: lines 524-549, HolderSnapshot: lines 554-585, Holder: lines 570-585, TokenSettings: lines 224-254)
- [API_REFERENCE.md](./API_REFERENCE.md) - Endpoint docs (GET /api/token-analytics: line 102)
- [TOKENS_AND_BALANCES.md](./TOKENS_AND_BALANCES.md) - Token Analytics section (line 180+)
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Analytics data flow (line 463+)
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Slow analytics (line 291), timeouts (line 622)
- [API_KEYS_RECOMMENDATIONS.md](./API_KEYS_RECOMMENDATIONS.md) - API key usage for analytics (lines 12-14)

---

**Last Updated:** 2026-02-06
