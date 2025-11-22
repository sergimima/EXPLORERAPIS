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

**Blockchain Integration:**
- ethers.js 6.13.5 - Ethereum/Base blockchain interactions, contract calls, wallet operations
- axios 1.8.4 - HTTP client for API calls
- swr 2.2.4 - Data fetching and caching hooks

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
- `/api/token-analytics` - Advanced token analytics including whale movements, holder distribution, price data, liquidity, and alerts

**Vottun Integration APIs:**
- `/api/vottun/searchUserByEmail` - Search Vottun users by email
- `/api/vottun/userPoints` - Get user points from Vottun
- `/api/vottun/userTokens` - Get user tokens from Vottun
- `/api/vottun-search` - Vottun-specific search endpoint

**Utility APIs:**
- `/api/search` - General search endpoint
- `/api/test` - Simple health check endpoint
- `/api/test-vtn` - VTN token API testing endpoint with Etherscan V2 integration

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
- Token supply data is cached for 5 minutes to reduce API calls
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

**Other Components:**
- `AirdropAssignments.tsx` - Airdrop information display

### Pages (`src/app/`)

- `/` - Home page with navigation cards to access different explorer sections
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
  - Sortable large transfers table
  - Period selection (1 day, 7 days, 30 days, 90 days)
- `/docs` - API documentation

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
- Shared ethers.js provider to avoid multiple RPC connections
- Sequential contract verification with 50ms delays to respect RPC limits
- Transfer deduplication by transaction hash
- Progress tracking for long-running operations
- Caching mechanisms for holder data

### Error Handling

- All blockchain calls should have try-catch blocks
- Fallback to empty arrays or zero values rather than propagating errors
- Log warnings for non-critical failures
- Return meaningful error objects with `isValid: false` for contract status checks

### API Key Configuration

Environment variables expected (in `.env` or `.env.local`):

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
