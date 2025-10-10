# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a blockchain explorer application for the Base blockchain network, built with Next.js 14, focused on token balances, transfers, and vesting contract information. The project integrates with BaseScan API and uses ethers.js v6 for blockchain interactions.

## Development Commands

- `npm run dev` - Start development server on port 4200 (http://localhost:4200)
- `npm run build` - Build the production application
- `npm start` - Start production server
- `npm run lint` - Run ESLint

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

### Network Configuration

The application supports three networks defined in `blockchain.ts`:
- `base` - Base Mainnet (Chain ID: 8453)
- `base-testnet` - Base Goerli Testnet (Chain ID: 84531)
- `base-sepolia` - Base Sepolia Testnet (Chain ID: 84532)

Each network has RPC URLs, explorer API URLs, and some have alternative RPC endpoints for failover.

### API Routes (`src/app/api/`)

- `/api/tokens/balance` - Get token balances for a wallet
- `/api/tokens/transfers` - Get token transfers with optional filtering
- `/api/vottun/searchUserByEmail` - Search Vottun users
- `/api/vottun/userPoints` - Get user points
- `/api/vottun/userTokens` - Get user tokens
- `/api/token-supply` - Get token supply information
- `/api/search` - General search endpoint
- `/api/vottun-search` - Vottun-specific search

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

- `TokenBalance.tsx` - Displays wallet token balances
- `TokenTransfersList.tsx` - Shows token transfers
- `VestingInfo.tsx` - Detailed vesting information for wallet/contract pair
- `VestingSummary.tsx` - Overview of vesting contract status
- `AirdropAssignments.tsx` - Airdrop information display
- `NetworkSelector.tsx`, `TokenFilter.tsx`, `WalletInput.tsx` - UI controls
- `TabsContainer.tsx` - Tab navigation component

### Pages (`src/app/`)

- `/` - Home page with navigation cards
- `/explorer/tokens` - Token explorer interface
- `/explorer/vestings` - Vesting contracts viewer with supply card
- `/docs` - API documentation

## Important Implementation Details

### Vesting Contract Processing

When working with vesting contracts:
1. The system first checks for preloaded ABIs in `contractAbis.ts`
2. If not found, fetches ABI from BaseScan with retry logic
3. Applies appropriate strategy based on detected contract type
4. Processes beneficiaries either by index or by holder depending on available methods
5. Calculates releasable tokens based on time elapsed and vesting schedule

### Error Handling

- All blockchain calls should have try-catch blocks
- Fallback to empty arrays or zero values rather than propagating errors
- Log warnings for non-critical failures
- Return meaningful error objects with `isValid: false` for contract status checks

### API Key Configuration

Environment variables expected (in `.env` or `.env.local`):
- `NEXT_PUBLIC_BASESCAN_API_KEY` - For BaseScan API access
- `NEXT_PUBLIC_ETHERSCAN_API_KEY` - For Etherscan V2 API access

Default API key `YourApiKeyToken` is used as fallback (rate-limited).

## TypeScript Configuration

- Path alias: `@/*` maps to `./src/*`
- Strict mode enabled
- JSX: preserve (Next.js handles transformation)

## Styling

- Tailwind CSS for styling
- Custom button classes: `btn-primary`
- Color schemes: blue-50, purple-50, green-50, gray-100 backgrounds
