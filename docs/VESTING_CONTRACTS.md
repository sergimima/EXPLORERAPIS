# Vesting Contracts System

Complete guide to the vesting contract detection, processing, and analytics system.

---

## Overview

The Vesting System automatically detects, processes, and analyzes token vesting contracts on the Base blockchain. It supports multiple vesting contract types with different ABI structures and implements a strategy pattern for processing beneficiary data.

### Key Features

- **Automatic Contract Type Detection** - Identifies contract type by available methods
- **Multiple Strategy Support** - VestingSchedules, Vottun, OpenZeppelin, Generic
- **Beneficiary Processing** - Extracts all beneficiaries and vesting schedules
- **Releasable Token Calculation** - Calculates available tokens based on time elapsed
- **Token Supply Tracking** - Tracks locked vs circulating supply
- **Multi-Tenant Support** - Each organization can configure custom vesting contracts

---

## Architecture

### Contract Detection Flow

```
getVestingInfo(contractAddress, holderAddress?, network, tokenId?)
    ↓
detectContractType(contractAddress, network)
    ↓
Check for methods:
  - getVestingSchedulesCount?      → VestingSchedules
  - getVestingListByHolder?        → Vottun
  - vestingSchedules?              → OpenZeppelin
  - Other patterns?                → GenericVesting
  - Unknown                        → UnknownVesting
    ↓
Apply appropriate Strategy
    ↓
Return VestingInfo with beneficiaries
```

### Strategy Pattern

Each contract type has its own processing strategy:

| Strategy | Contract Methods | Processing Logic |
|----------|------------------|------------------|
| **VestingSchedules** | `getVestingSchedulesCount`, `getVestingScheduleById` | Iterates by index (0 to count) |
| **Vottun** | `getVestingListByHolder` | Queries by holder address |
| **OpenZeppelin** | `vestingSchedules` | Direct schedule access |
| **GenericVesting** | Mixed patterns | Fallback detection |
| **UnknownVesting** | None detected | Returns empty data |

---

## Contract Types

### 1. VestingSchedules Type

**Identification:**
- Has `getVestingSchedulesCount()` method
- Has `getVestingScheduleById(bytes32 id)` method

**Processing:**
```typescript
// Get total schedules
const count = await contract.getVestingSchedulesCount();

// Iterate through all schedules
for (let i = 0; i < count; i++) {
  const scheduleId = await contract.computeVestingScheduleIdForAddressAndIndex(
    holderAddress,
    i
  );
  const schedule = await contract.getVestingScheduleById(scheduleId);

  beneficiaries.push({
    address: schedule.beneficiary,
    amount: schedule.amountTotal,
    released: schedule.released,
    releasable: schedule.releasable,
    start: schedule.start,
    cliff: schedule.cliff,
    duration: schedule.duration,
    slicePeriodSeconds: schedule.slicePeriodSeconds
  });
}
```

**Example Contracts:**
- Vottun World: `0xa699Cf416FFe6063317442c3Fbd0C39742E971c5`
- Investors: `0x3e0ef51811B647E00A85A7e5e495fA4763911982`
- Marketing: `0xE521B2929DD28a725603bCb6F4009FBb656C4b15`

### 2. Vottun Type

**Identification:**
- Has `getVestingListByHolder(address holder)` method

**Processing:**
```typescript
// Get all vesting schedules for holder in one call
const vestingList = await contract.getVestingListByHolder(holderAddress);

// vestingList is array of structs
vestingList.forEach(schedule => {
  beneficiaries.push({
    address: schedule.beneficiary,
    amount: schedule.totalAmount,
    released: schedule.releasedAmount,
    // ... calculate releasable
  });
});
```

**Advantages:**
- Single contract call (vs multiple calls for VestingSchedules)
- Faster processing
- More efficient for large beneficiary lists

**Example Contracts:**
- Staking: `0x3a7cf4cCC76bb23Cf15845B0d4f05BafF1D478cF`
- Liquidity: `0x417Fc9c343210AA52F0b19dbf4EecBD786139BC1`

### 3. OpenZeppelin Type

**Identification:**
- Has `vestingSchedules(address beneficiary)` method
- Standard OpenZeppelin VestingWallet pattern

**Processing:**
```typescript
// Query schedule for specific beneficiary
const schedule = await contract.vestingSchedules(holderAddress);

beneficiaries.push({
  address: holderAddress,
  amount: schedule.totalAllocation,
  released: schedule.released,
  start: schedule.start,
  cliff: schedule.cliffDuration,
  duration: schedule.duration
});
```

### 4. Generic/Unknown Types

**Fallback Processing:**
- Attempts to detect common patterns
- May require manual ABI configuration
- Falls back to basic token balance queries

---

## Helper Functions

### vestingHelpers.ts

**Core utility functions for vesting calculations:**

```typescript
// Calculate releasable tokens based on time elapsed
export function calculateReleasableTokens(
  totalAmount: bigint,
  released: bigint,
  startTime: number,
  cliffTime: number,
  duration: number,
  currentTime: number
): bigint {
  // Before cliff: nothing releasable
  if (currentTime < cliffTime) return 0n;

  // After vesting period: all remaining tokens
  if (currentTime >= startTime + duration) {
    return totalAmount - released;
  }

  // During vesting: linear unlock
  const elapsed = currentTime - startTime;
  const vested = (totalAmount * BigInt(elapsed)) / BigInt(duration);
  return vested - released;
}

// Process beneficiary data from contract
export function processBeneficiaryData(
  rawData: any,
  contractType: string
): VestingBeneficiary[] {
  // Normalizes different ABI structures to common format
  // ...
}
```

### vestingContractHelpers.ts

**Specialized functions for Vottun type contracts:**

```typescript
// Process using getVestingListByHolder method
export async function processVottunContract(
  contractAddress: string,
  holderAddress: string,
  network: Network
): Promise<VestingInfo> {
  const contract = new ethers.Contract(
    contractAddress,
    VOTTUN_ABI,
    provider
  );

  const vestingList = await contract.getVestingListByHolder(holderAddress);

  // Process list...
  return {
    contractType: 'Vottun',
    beneficiaries: processedList,
    totalLocked: sumLocked,
    totalReleased: sumReleased
  };
}
```

### vestingContractStrategies.ts

**Strategy pattern implementation:**

```typescript
interface VestingStrategy {
  detect(contract: ethers.Contract): Promise<boolean>;
  process(contract: ethers.Contract, holder: string): Promise<VestingInfo>;
}

class VestingSchedulesStrategy implements VestingStrategy {
  async detect(contract) {
    try {
      await contract.getVestingSchedulesCount();
      await contract.getVestingScheduleById('0x00');
      return true;
    } catch {
      return false;
    }
  }

  async process(contract, holder) {
    // Implementation...
  }
}

// Registry of all strategies
const strategies: VestingStrategy[] = [
  new VestingSchedulesStrategy(),
  new VottunStrategy(),
  new OpenZeppelinStrategy(),
  new GenericStrategy()
];

// Auto-detect and apply correct strategy
export async function detectAndProcess(
  contractAddress: string,
  holder: string,
  network: Network
): Promise<VestingInfo> {
  const contract = getContract(contractAddress, network);

  for (const strategy of strategies) {
    if (await strategy.detect(contract)) {
      return await strategy.process(contract, holder);
    }
  }

  return unknownContractResult;
}
```

---

## ABI Management

### Preloaded ABIs (contractAbis.ts)

To reduce BaseScan API calls, common vesting ABIs are preloaded:

```typescript
export const VESTING_ABIS = {
  // VestingSchedules type (8 contracts)
  '0xa699Cf416FFe6063317442c3Fbd0C39742E971c5': VESTING_SCHEDULES_ABI,
  '0x3e0ef51811B647E00A85A7e5e495fA4763911982': VESTING_SCHEDULES_ABI,
  // ... 6 more

  // Generic ERC20 (for balance queries)
  'ERC20': ERC20_ABI
};

// ABI content
const VESTING_SCHEDULES_ABI = [
  {
    inputs: [],
    name: 'getVestingSchedulesCount',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'vestingScheduleId', type: 'bytes32' }],
    name: 'getVestingScheduleById',
    outputs: [{ type: 'tuple', components: [...] }],
    stateMutability: 'view',
    type: 'function'
  },
  // ... more methods
];
```

**Benefits:**
- Instant ABI access (no API call)
- Reduced rate limit pressure
- Faster contract processing

### Database ABIs (CustomAbi Model)

For dynamic ABI storage:

```typescript
model CustomAbi {
  id               String   @id @default(cuid())
  tokenId          String
  contractAddress  String
  network          String
  abi              Json
  source           AbiSource  // STANDARD, UPLOADED, BASESCAN, ROUTESCAN
  methodCount      Int
  eventCount       Int

  @@unique([tokenId, contractAddress, network])
}
```

**Usage:**
1. Check preloaded ABIs first
2. Query CustomAbi table
3. Fetch from BaseScan/Routescan if needed
4. Save to CustomAbi for future use

---

## Database Models

### Contract Model

**Generic contract model for all contract types:**

```typescript
model Contract {
  id          String          @id @default(cuid())
  tokenId     String
  name        String
  address     String
  network     String
  category    ContractCategory  // VESTING, STAKING, LIQUIDITY, DAO, TREASURY, etc.
  isActive    Boolean         @default(true)
  description String?

  token       Token           @relation(fields: [tokenId], references: [id])

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

**Management:**
- Navigate to: `/settings/tokens/[id]/contracts`
- Add/edit/delete contracts per token
- Filter by category
- Multi-tenant isolated by `tokenId`

### VestingCache Model

**Caches vesting contract data to reduce blockchain calls:**

```typescript
model VestingCache {
  id               String   @id @default(cuid())
  tokenId          String
  contractAddress  String
  network          String
  contractType     String   // VestingSchedules, Vottun, OpenZeppelin, etc.
  beneficiaryCount Int
  totalLocked      String
  totalReleased    String
  totalReleasable  String
  lastUpdated      DateTime
  data             Json     // Full vesting info

  @@unique([tokenId, contractAddress, network])
  @@index([tokenId, lastUpdated])
}
```

**TTL:** 5 minutes (configurable per token)

### VestingBeneficiaryCache Model

**Stores individual beneficiary data:**

```typescript
model VestingBeneficiaryCache {
  id               String   @id @default(cuid())
  tokenId          String
  contractAddress  String
  network          String
  beneficiary      String   // Wallet address
  totalAmount      String
  releasedAmount   String
  releasableAmount String
  startTime        DateTime
  cliffTime        DateTime
  duration         Int      // seconds
  lastUpdated      DateTime

  @@unique([tokenId, contractAddress, network, beneficiary])
  @@index([tokenId, beneficiary])
}
```

### VestingTransferCache Model

**Tracks transfers from vesting contracts:**

```typescript
model VestingTransferCache {
  id               String   @id @default(cuid())
  tokenId          String
  contractAddress  String
  hash             String   // Transaction hash
  from             String   // Vesting contract
  to               String   // Beneficiary
  value            String
  timestamp        DateTime
  blockNumber      Int
  network          String

  @@unique([tokenId, hash, network])
  @@index([tokenId, contractAddress, timestamp])
}
```

---

## Token Supply Calculation

### Locked Supply

**Locked supply = Sum of all vesting contract balances**

```typescript
async function calculateLockedSupply(
  tokenAddress: string,
  network: Network,
  tokenId: string
): Promise<bigint> {
  // Get all vesting contracts for this token
  const contracts = await prisma.contract.findMany({
    where: {
      tokenId,
      category: 'VESTING',
      isActive: true
    }
  });

  let totalLocked = 0n;

  for (const contract of contracts) {
    // Get token balance of vesting contract
    const balance = await erc20Contract.balanceOf(contract.address);
    totalLocked += balance;
  }

  return totalLocked;
}
```

### Circulating Supply

**Circulating = Total Supply - Locked Supply**

```typescript
const totalSupply = await erc20Contract.totalSupply();
const lockedSupply = await calculateLockedSupply(tokenAddress, network, tokenId);
const circulatingSupply = totalSupply - lockedSupply;
```

**Displayed in:**
- TokenSupplyCard component
- `/explorer/vestings` page
- Analytics dashboard

---

## UI Components

### VestingInfo Component

**Location:** `src/components/VestingInfo.tsx`

**Features:**
- Displays detailed vesting info for wallet/contract pair
- Shows all beneficiary schedules
- Calculates releasable tokens
- Timeline visualization
- Cliff and duration display

**Usage:**
```tsx
<VestingInfo
  contractAddress="0xa699Cf..."
  holderAddress="0x123..."
  network="base"
/>
```

### VestingSummary Component

**Location:** `src/components/VestingSummary.tsx`

**Features:**
- Overview of vesting contract status
- Total locked, released, releasable
- Beneficiary count
- Contract type badge

### VestingContractList Component

**Location:** `src/components/VestingContractList.tsx`

**Features:**
- Grid display of predefined vesting contracts
- 8 Vottun contracts (World, Investors, Marketing, Staking, Liquidity, Promos, Team, Reserve)
- Click to view details
- Status indicators (active, paused, completed)

**Predefined Contracts:**
```typescript
const VESTING_CONTRACTS = [
  { name: 'Vottun World', address: '0xa699Cf416FFe6063317442c3Fbd0C39742E971c5' },
  { name: 'Investors', address: '0x3e0ef51811B647E00A85A7e5e495fA4763911982' },
  { name: 'Marketing', address: '0xE521B2929DD28a725603bCb6F4009FBb656C4b15' },
  { name: 'Staking', address: '0x3a7cf4cCC76bb23Cf15845B0d4f05BafF1D478cF' },
  { name: 'Liquidity', address: '0x417Fc9c343210AA52F0b19dbf4EecBD786139BC1' },
  { name: 'Promos', address: '0xFC750D874077F8c90858cC132e0619CE7571520b' },
  { name: 'Team', address: '0xde68AD324aafD9F2b6946073C90ED5e61D5d51B8' },
  { name: 'Reserve', address: '0xC4CE5cFea2B6e32Ad41973348AC70EB3b00D8e6d' }
];
```

### TokenSupplyCard Component

**Location:** `src/app/explorer/vestings/components/TokenSupplyCard.tsx`

**Features:**
- Total, Circulating, Locked supply display
- Progress bars with percentages
- Calculation: Locked = sum of vesting balances
- Loading progress tracking
- Refresh button

---

## API Routes

### GET /api/vesting-info

**Query Parameters:**
- `contractAddress` (required) - Vesting contract address
- `holderAddress` (optional) - Specific beneficiary
- `network` (required) - Network identifier
- `tokenId` (optional) - For API key hierarchy

**Response:**
```json
{
  "contractAddress": "0xa699Cf...",
  "contractType": "VestingSchedules",
  "beneficiaries": [
    {
      "address": "0x123...",
      "totalAmount": "1000000000000000000000",
      "released": "250000000000000000000",
      "releasable": "250000000000000000000",
      "startTime": 1704067200,
      "cliffTime": 1735603200,
      "duration": 126144000
    }
  ],
  "totalLocked": "5000000000000000000000",
  "totalReleased": "1250000000000000000000",
  "isValid": true
}
```

**Caching:**
- Uses VestingCache model
- 5-minute TTL
- Force refresh with `?forceRefresh=true`

---

## Known Issues & Gotchas

### 1. Missing tokenId in getVestingInfo

**Issue:** `src/lib/blockchain.ts:757, 980`
```typescript
// Current (legacy)
await getVestingInfo(contractAddress, holder, network);

// TODO: Add tokenId parameter
await getVestingInfo(contractAddress, holder, network, tokenId);
```

**Impact:** Falls back to .env API keys instead of TokenSettings.

**Workaround:** Pass tokenId from components:
```typescript
const { activeToken } = useToken();
await getVestingInfo(contract, holder, network, activeToken?.id);
```

### 2. Large Beneficiary Lists

**Problem:** Contracts with 1000+ beneficiaries are slow to process.

**Solution:**
- VestingSchedules: Iterates one-by-one (slow)
- Vottun: Single call with `getVestingListByHolder` (fast)
- **Recommendation:** Use Vottun pattern for large lists

### 3. Unknown Contract Types

**Problem:** New vesting contracts may not be detected.

**Solutions:**
1. **Add ABI manually:**
   - Navigate to `/settings/tokens/[id]/abi`
   - Upload JSON ABI or fetch from BaseScan
   - System will auto-detect pattern

2. **Add to contractAbis.ts:**
   - For common contracts
   - Preload ABI to reduce API calls

3. **Implement new strategy:**
   - Add to `vestingContractStrategies.ts`
   - Register in strategy array

### 4. Cliff vs Start Time Confusion

**Important:** Some contracts use different conventions:
- **Start Time:** When vesting begins
- **Cliff Time:** When tokens first become releasable
- **Duration:** Total vesting period (from start)

**Calculation:**
```typescript
// Tokens are locked until cliffTime
if (currentTime < cliffTime) return 0;

// After cliffTime, linear unlock based on elapsed time since startTime
const elapsed = currentTime - startTime;
const vested = (totalAmount * elapsed) / duration;
```

---

## Testing & Debugging

### Test Vesting Contract

**Manual Test:**
```typescript
// In browser console or API test
const result = await fetch('/api/vesting-info?' + new URLSearchParams({
  contractAddress: '0xa699Cf416FFe6063317442c3Fbd0C39742E971c5',
  network: 'base',
  holderAddress: '0x123...',  // optional
  tokenId: 'clxxx'  // optional
}));

const data = await result.json();
console.log(data);
```

### Debug Logging

All vesting operations log extensively:
```typescript
console.log('🔍 Detecting vesting contract type:', contractAddress);
console.log('✅ Detected:', contractType);
console.log('👥 Found beneficiaries:', count);
console.log('🔐 Total locked:', totalLocked);
console.error('❌ Failed to detect contract type');
```

### Common Errors

**"Contract has no vesting methods"**
- Contract is not a vesting contract
- ABI is incomplete or incorrect
- Add custom ABI in settings

**"No beneficiaries found"**
- Holder has no vesting schedules
- Wrong holder address
- Contract is empty

**"Releasable calculation incorrect"**
- Check cliff vs start time logic
- Verify duration units (seconds)
- Time zones (use UTC timestamps)

---

## Best Practices

### 1. Use Appropriate Strategy

```typescript
// ✅ GOOD: Let system detect automatically
const info = await getVestingInfo(contract, holder, network, tokenId);

// ❌ BAD: Hardcode contract type
const info = await processVestingSchedulesContract(contract, holder);
```

### 2. Cache Aggressively

```typescript
// ✅ GOOD: Use VestingCache
const cached = await prisma.vestingCache.findUnique({
  where: { tokenId_contractAddress_network: { tokenId, contractAddress, network } }
});
if (cached && isRecent(cached.lastUpdated)) return cached.data;

// ❌ BAD: Always fetch from blockchain
const info = await contract.getVestingSchedulesCount(); // slow
```

### 3. Handle Contract Categories

```typescript
// ✅ GOOD: Use Contract model with categories
await prisma.contract.findMany({
  where: { tokenId, category: 'VESTING', isActive: true }
});

// ❌ BAD: Hardcode addresses
const vestingContracts = ['0xa699...', '0x3e0e...'];
```

### 4. Always Pass tokenId

```typescript
// ✅ GOOD: Multi-tenant aware
const { activeToken } = useToken();
await getVestingInfo(contract, holder, network, activeToken?.id);

// ❌ BAD: Uses only .env keys
await getVestingInfo(contract, holder, network);
```

---

## Related Documentation

- [TOKENS_AND_BALANCES.md](./TOKENS_AND_BALANCES.md) - Token system overview
- [DATABASE.md](./DATABASE.md) - Vesting cache models
- [API_REFERENCE.md](./API_REFERENCE.md) - Vesting API endpoints
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common vesting errors

---

**Last Updated:** 2026-02-05
