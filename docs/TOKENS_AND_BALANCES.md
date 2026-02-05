# Tokens and Balances System

Complete guide to the token explorer functionality, including balance queries, transfer history, and analytics.

---

## Overview

The Token Explorer provides comprehensive blockchain data for ERC20 tokens on the Base network, with multi-tenant isolation allowing each organization to configure their own tokens and API keys.

### Key Features

- **Real-time Balance Queries** - Fetch current token balances for any wallet
- **Transfer History** - Complete transaction history with incremental caching
- **Multi-Network Support** - Base Mainnet, Base Testnet (Goerli), Base Sepolia
- **Analytics Dashboard** - Whale tracking, holder distribution, exchange flows
- **Multi-Tenant** - Each organization has isolated token configurations

---

## Architecture

### Data Flow

```
User Request
    ↓
TokenContext (provides activeToken)
    ↓
Server Actions (src/actions/blockchain.ts)
    ↓
API Key Hierarchy: TokenSettings → SystemSettings → .env
    ↓
External APIs: BaseScan, Etherscan V2, Moralis
    ↓
Database Cache: TransferCache, HolderSnapshot
    ↓
UI Components: TokenBalance, TokenTransfersList
```

### Multi-Tenant Isolation

Each organization can have the **same token address** (e.g., VTN) but with:
- Unique `tokenId` in the database
- Custom API keys in `TokenSettings`
- Isolated cache data (transfers, holders, supply)

---

## Token Balance Queries

### How It Works

**1. Primary Method: Moralis API**
```typescript
// Endpoint: Moralis Token Balances API
GET https://deep-index.moralis.io/api/v2.2/{address}/erc20
```

**2. Fallback: Transfer History Analysis**
If Moralis fails or returns empty:
- Fetches all transfers from Etherscan V2 API
- Calculates balance: `(total received) - (total sent)`
- Works but slower than direct balance query

**3. Rate Limiting**
- Implements exponential backoff (1s, 2s, 3s)
- Automatically retries up to 3 times
- Falls back to alternative method on persistent failure

### Usage in Code

```typescript
// In a component
import { fetchTokenBalances } from '@/actions/blockchain';
import { useToken } from '@/contexts/TokenContext';

const { activeToken } = useToken();

const balances = await fetchTokenBalances(
  walletAddress,
  'base',
  activeToken?.id  // ✅ CRITICAL: Pass tokenId for correct API keys
);
```

**⚠️ Important:** Always pass `activeToken?.id` to use organization-specific API keys.

---

## Transfer History

### Incremental Caching System

**Problem Solved:**
- Fetching full transfer history takes 10-15s
- Repeating this on every page load wastes API calls and time

**Solution: TransferCache Model**
```typescript
model TransferCache {
  id              String   @id @default(cuid())
  tokenId         String
  hash            String   // Transaction hash (unique)
  from            String
  to              String
  value           String   // Amount transferred
  timestamp       DateTime
  blockNumber     Int
  tokenAddress    String
  tokenSymbol     String
  tokenName       String
  decimals        Int
  network         String

  @@unique([tokenAddress, hash, network])
  @@index([tokenId, timestamp])
}
```

**How It Works:**
1. **First Load:** Fetch all transfers from Etherscan V2 → Save to DB (~10s)
2. **Subsequent Loads:**
   - Read from DB (~1s)
   - Fetch only NEW transfers since last timestamp (~1s)
   - Total: 2-4s (80% improvement)
3. **Deduplication:** Unique constraint on `[tokenAddress, hash, network]`

### API Integration

**Etherscan V2 API (Primary)**
```typescript
// Endpoint: tokentx (ERC20 token transfers)
GET https://api.basescan.org/api
  ?module=account
  &action=tokentx
  &address={walletAddress}
  &startblock={lastBlock}
  &endblock=99999999
  &sort=asc
```

**Routescan API (Fallback)**
```typescript
GET https://api.routescan.io/v2/network/mainnet/evm/8453/etherscan/api
  ?module=account
  &action=tokentx
  ...
```

### Usage Example

```typescript
// Fetch transfers with caching
const transfers = await fetchTokenTransfers(
  walletAddress,
  'base',
  { contractAddress: '0xA9bc...' },  // Optional filter
  activeToken?.id  // For API keys
);

// Response format
[
  {
    hash: '0xabc...',
    from: '0x123...',
    to: '0x456...',
    value: '1000000000000000000',  // Raw value (wei)
    timestamp: '2025-01-15T10:30:00Z',
    blockNumber: 12345678,
    tokenSymbol: 'VTN',
    tokenName: 'Vottun Token',
    decimals: 18
  }
]
```

---

## Token Analytics

Comprehensive market intelligence system. See `/explorer/analytics` page.

### Data Sources

| Source | Purpose | Refresh Rate |
|--------|---------|--------------|
| **Etherscan V2** | Transfer history | Incremental (cached) |
| **Moralis API** | Top 50 holders | 5-minute snapshots |
| **QuikNode RPC** | Price data, contract verification | Real-time |
| **DEX Screener** | Liquidity (Aerodrome, Uniswap) | Real-time |
| **Uniswap V4 StateView** | On-chain V4 pool data | Real-time |

### Key Metrics

**Whale Movements**
- Large transfers (default: ≥10,000 tokens)
- Configurable threshold per token
- Timeline visualization (scatter plot)

**Exchange Flows**
- Net flow to/from known exchanges
- CEX addresses configurable in `KnownAddress` table
- Bar chart showing daily flows

**Holder Distribution**
- Top 10, Top 50, Rest
- Concentration percentage
- Pie chart visualization

**Automated Alerts**
- Whale movements (≥3 large transfers in 2 hours)
- Exchange anomalies (>50k net flow)
- High concentration (top 10 >70% supply)
- Accumulation patterns (single address >100k received)

### Implementation

**HolderSnapshot Caching**
```typescript
model HolderSnapshot {
  id            String   @id @default(cuid())
  tokenId       String
  tokenAddress  String
  network       String
  snapshotAt    DateTime
  holders       Json     // Array of { address, balance, percentage }

  @@index([tokenId, tokenAddress, network, snapshotAt])
}
```

- Creates snapshot every 5 minutes
- Instant load if recent snapshot exists
- Enables historical holder analysis

**Manual Refresh**
- "Actualizar" button forces new data fetch
- Displays "Última actualización: hace Xm"
- `forceRefresh=true` query parameter

---

## Token Supply Information

### Configuration Options

Each token can configure supply calculation method:

**1. API Method (Default)**
```typescript
// Uses external API endpoints
// Example: Vottun API for VTN token
GET https://api.vottun.com/token/supply/vtn
```

**2. On-Chain Method**
```typescript
// Queries ERC20 contract directly
const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
const totalSupply = await contract.totalSupply();
const circulatingSupply = totalSupply - lockedSupply;
```

**Calculation:**
- **Total Supply:** From contract or API
- **Locked Supply:** Sum of vesting contract balances
- **Circulating Supply:** Total - Locked

### Caching

**TokenSupplyCache Model**
```typescript
model TokenSupplyCache {
  id                  String   @id @default(cuid())
  tokenId             String   @unique
  totalSupply         String
  circulatingSupply   String
  lockedSupply        String
  lastFetched         DateTime

  @@index([tokenId, lastFetched])
}
```

- 5-minute TTL (Time To Live)
- Reduces API calls
- Configurable per token

---

## API Key Hierarchy

**CRITICAL:** API keys follow strict priority order for multi-tenant isolation.

### Priority Order (Highest to Lowest)

```typescript
1. TokenSettings (Database)
   ↓ (if not found)
2. SystemSettings (Database)
   ↓ (if not found)
3. .env variables
   ↓ (if not found)
4. Default fallback 'YourApiKeyToken' (rate-limited)
```

### Implementation

**getApiKeys() Function** (`src/actions/blockchain.ts`)
```typescript
async function getApiKeys(tokenId?: string) {
  // 1. Try TokenSettings for specific token
  if (tokenId) {
    const tokenSettings = await prisma.tokenSettings.findUnique({
      where: { tokenId }
    });
    if (tokenSettings?.customBasescanApiKey) {
      return {
        basescanApiKey: tokenSettings.customBasescanApiKey,
        etherscanApiKey: tokenSettings.customEtherscanApiKey,
        moralisApiKey: tokenSettings.customMoralisApiKey,
        quicknodeUrl: tokenSettings.customQuicknodeUrl,
        routescanApiKey: tokenSettings.customRoutescanApiKey,
      };
    }
  }

  // 2. Fallback to SystemSettings
  const systemSettings = await prisma.systemSettings.findUnique({
    where: { id: 'system' }
  });
  if (systemSettings) {
    return {
      basescanApiKey: systemSettings.defaultBasescanApiKey,
      // ... other keys
    };
  }

  // 3. Fallback to .env
  return {
    basescanApiKey: process.env.NEXT_PUBLIC_BASESCAN_API_KEY,
    // ... other keys
  };
}
```

### Configuration

**Per-Token API Keys:**
- Navigate to: `/settings/tokens/[id]/api-keys`
- Each organization can set custom keys
- Overrides global defaults

**Global Defaults (SUPER_ADMIN only):**
- Navigate to: `/admin/settings`
- Sets defaults for all organizations
- Used when TokenSettings not configured

---

## Rate Limiting & Fallbacks

### Automatic Fallback System

**ABI Fetching:**
```
Database Cache
    ↓ (if not found)
BaseScan API (3 retries)
    ↓ (if fails)
Routescan API (3 retries)
    ↓ (if fails)
Legacy Cache (contractAbis.ts)
    ↓ (if fails)
Error
```

**Transfer History:**
```
TransferCache (Database)
    ↓ (for new data)
Etherscan V2 API
    ↓ (if fails)
Routescan API
    ↓ (if fails)
Error
```

### Exponential Backoff

```typescript
const delays = [1000, 2000, 3000];  // 1s, 2s, 3s
for (let i = 0; i < 3; i++) {
  try {
    return await apiCall();
  } catch (error) {
    if (i < 2) await sleep(delays[i]);
  }
}
```

---

## UI Components

### TokenBalance Component

**Location:** `src/components/TokenBalance.tsx`

**Features:**
- Displays wallet token balances
- Empty state (no mock data)
- Loading states with skeleton
- Error handling

**Usage:**
```tsx
<TokenBalance
  walletAddress="0x123..."
  network="base"
/>
```

### TokenTransfersList Component

**Location:** `src/components/TokenTransfersList.tsx`

**Features:**
- Paginated transfer list
- Sortable columns (date, amount, from, to)
- Address labels from `KnownAddress` table
- Inline address editing (pencil icon)

### TokenSupplyCard Component

**Location:** `src/app/explorer/vestings/components/TokenSupplyCard.tsx`

**Features:**
- Total, Circulating, Locked supply
- Progress bars with percentages
- Loading progress tracking
- Manual refresh button

---

## Known Issues & Gotchas

### 1. Missing tokenId Parameter

**Issue:** Some legacy code doesn't pass `tokenId`:
```typescript
// ❌ WRONG: Uses only .env keys
await fetchTokenBalances(wallet, network);

// ✅ CORRECT: Uses TokenSettings → SystemSettings → .env
await fetchTokenBalances(wallet, network, activeToken?.id);
```

**Locations with TODOs:**
- `src/lib/blockchain.ts:757` - `getVestingInfo()`
- `src/lib/blockchain.ts:980` - `getTokenSupplyInfo()` internal call

**Fix:** Pass `tokenId` parameter from components.

### 2. Version Mismatches

**CLAUDE.md Claims:**
- Next.js 14.0.0
- React 18.2.0

**Actual (package.json):**
- next: ^15.5.11
- react: ^19.2.4

**Impact:** None (versions work), but documentation is outdated.

### 3. Deprecated Endpoint

**Endpoint:** `/api/test-vtn`
- Marked DEPRECATED in code (line 3, 13)
- Still documented in CLAUDE.md
- **Action:** Use multi-tenant APIs instead

### 4. TransferCache Token Info

**Issue:** Old cached transfers may have `tokenSymbol: "UNKNOWN"`
- Fixed in recent update
- Run backfill script: `npx tsx prisma/backfill-transfer-tokens.ts`

---

## Testing & Debugging

### Test Endpoints

**Health Check:**
```bash
curl http://localhost:4200/api/test
```

**Legacy VTN Test (DEPRECATED):**
```bash
curl http://localhost:4200/api/test-vtn
# ⚠️ Use multi-tenant APIs instead
```

### Debug Logging

All blockchain calls log extensively:
```typescript
console.log('🔍 Fetching token balances:', { wallet, network, tokenId });
console.log('✅ Balance API success:', balances.length, 'tokens');
console.error('❌ Balance API failed, falling back to transfers');
```

Check console for:
- API key source (TokenSettings vs SystemSettings vs .env)
- Fallback triggers (BaseScan → Routescan)
- Cache hits vs API calls

### Performance Monitoring

**Expected Load Times:**
- First analytics load: ~10s (fetches all history)
- Subsequent loads: 2-4s (reads cache + new data)
- Balance queries: <2s
- Supply queries: <1s (cached)

**If slower:**
- Check API rate limits (console errors)
- Verify database connection (Prisma logs)
- Check network latency (QuikNode, Moralis)

---

## Best Practices

### 1. Always Pass tokenId

```typescript
// ✅ GOOD: Multi-tenant aware
const { activeToken } = useToken();
await fetchTokenBalances(wallet, network, activeToken?.id);

// ❌ BAD: Ignores TokenSettings
await fetchTokenBalances(wallet, network);
```

### 2. Handle Empty States

```typescript
// ✅ GOOD: Graceful empty state
if (balances.length === 0) {
  return <EmptyState message="No tokens found" />;
}

// ❌ BAD: Shows mock data
const mockBalances = [{ symbol: 'USDC', balance: '1000' }];
```

### 3. Use Incremental Cache

```typescript
// ✅ GOOD: Leverages TransferCache
const transfers = await fetchTokenTransfers(wallet, network, filter, tokenId);
// → Reads DB + fetches only new transfers

// ❌ BAD: Always fetches full history
const transfers = await fetchAllTransfersFromAPI(wallet);
// → Ignores cache, wastes API calls
```

### 4. Configure Custom API Keys

**For development:**
- Use free tier keys in `.env.local`

**For production:**
- Configure in `SystemSettings` (global defaults)
- Let organizations add custom keys in `TokenSettings`

---

## Related Documentation

- [VESTING_CONTRACTS.md](./VESTING_CONTRACTS.md) - Vesting system details
- [API_REFERENCE.md](./API_REFERENCE.md) - Complete API documentation
- [DATABASE.md](./DATABASE.md) - Cache models and schema
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common errors

---

**Last Updated:** 2026-02-05
