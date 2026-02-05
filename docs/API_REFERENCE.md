# API Reference

Complete API endpoint documentation with request/response examples.

---

## Base URL

```
Development: http://localhost:4200
Production: https://your-domain.com
```

---

## Authentication

All protected endpoints require authentication via NextAuth.js session cookies.

**Public endpoints:** `/api/auth/*`, `/api/test`
**Protected endpoints:** All others require valid session

---

## Token & Balance APIs

### GET /api/tokens/balance

Get token balances for a wallet address.

**Query Parameters:**
- `address` (required) - Wallet address
- `network` (required) - Network identifier (base, base-testnet, base-sepolia)
- `tokenId` (optional) - Token ID for API key hierarchy

**Response:**
```json
{
  "balances": [
    {
      "tokenAddress": "0xA9bc478A44a8c8FE6fd505C1964dEB3cEe3b7abC",
      "symbol": "VTN",
      "name": "Vottun Token",
      "decimals": 18,
      "balance": "1000000000000000000000",
      "balanceFormatted": "1000.00"
    }
  ]
}
```

### GET /api/tokens/transfers

Get token transfer history.

**Query Parameters:**
- `address` (required) - Wallet address
- `network` (required) - Network
- `contractAddress` (optional) - Filter by token
- `tokenId` (optional) - For API keys

**Response:**
```json
{
  "transfers": [
    {
      "hash": "0xabc123...",
      "from": "0x123...",
      "to": "0x456...",
      "value": "1000000000000000000",
      "timestamp": "2025-01-15T10:30:00Z",
      "blockNumber": 12345678,
      "tokenSymbol": "VTN",
      "tokenName": "Vottun Token",
      "decimals": 18
    }
  ],
  "total": 150
}
```

### GET /api/token-supply

Get token supply metrics.

**Query Parameters:**
- `address` (required) - Token address
- `network` (required) - Network
- `tokenId` (optional) - For API keys

**Response:**
```json
{
  "totalSupply": "1000000000000000000000000",
  "circulatingSupply": "750000000000000000000000",
  "lockedSupply": "250000000000000000000000",
  "percentLocked": 25.0,
  "lastUpdated": "2025-01-15T10:30:00Z"
}
```

### GET /api/token-analytics

Advanced token analytics with caching.

**Query Parameters:**
- `tokenAddress` (required)
- `network` (required)
- `period` (optional) - 1day, 7days, 30days, 90days
- `forceRefresh` (optional) - true/false
- `tokenId` (optional)

**Response:**
```json
{
  "metrics": {
    "totalTransfers": 1523,
    "totalVolume": "500000000000000000000000",
    "uniqueAddresses": 342,
    "largeTransfersCount": 15
  },
  "whaleMovements": [...],
  "topHolders": [...],
  "exchangeFlows": [...],
  "alerts": [...],
  "liquidityData": {...},
  "priceData": {...}
}
```

---

## Vesting APIs

### GET /api/vesting-info

Get vesting contract information.

**Query Parameters:**
- `contractAddress` (required)
- `network` (required)
- `holderAddress` (optional)
- `tokenId` (optional)
- `forceRefresh` (optional)

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

---

## Address Management APIs

### GET /api/addresses

List known addresses with filters.

**Query Parameters:**
- `type` (optional) - CONTRACT, WALLET, EXCHANGE, VESTING, TOKEN
- `search` (optional) - Search by name or address
- `limit` (optional) - Default: 50
- `offset` (optional) - Default: 0
- `tokenId` (required for multi-tenant)

**Response:**
```json
{
  "addresses": [
    {
      "id": "clxxx",
      "address": "0x123...",
      "name": "Vottun World Vesting",
      "type": "VESTING",
      "category": "Contract",
      "tags": ["vesting", "official"],
      "color": "#3b82f6"
    }
  ],
  "total": 13
}
```

### POST /api/addresses

Create or update address label.

**Body:**
```json
{
  "tokenId": "clxxx",
  "address": "0x123...",
  "name": "My Wallet",
  "type": "WALLET",
  "category": "Personal",
  "description": "Main trading wallet",
  "tags": ["trading", "main"],
  "color": "#10b981"
}
```

### DELETE /api/addresses

Delete address label.

**Query Parameters:**
- `address` (required)
- `tokenId` (required)

---

## Admin Panel APIs (SUPER_ADMIN only)

### GET /api/admin/stats

Dashboard statistics.

**Response:**
```json
{
  "totalOrganizations": 45,
  "activeSubscriptions": 38,
  "mrr": 249700,
  "totalUsers": 123,
  "newOrgsThisMonth": 8,
  "cancellationsThisMonth": 2,
  "charts": {
    "newOrgsByMonth": [...],
    "mrrByMonth": [...],
    "cancellationsByMonth": [...]
  }
}
```

### GET /api/admin/organizations

List all organizations.

**Query Parameters:**
- `search` (optional)
- `planId` (optional)
- `limit`, `offset`

**Response:**
```json
{
  "organizations": [
    {
      "id": "clxxx",
      "name": "Vottun",
      "slug": "vottun",
      "owner": {...},
      "plan": {...},
      "members": 5,
      "tokens": 3,
      "hasCustomApiKeys": true,
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ],
  "total": 45
}
```

### PATCH /api/admin/organizations/[id]

Update organization (assign plan).

**Body:**
```json
{
  "planId": "clxxx"
}
```

### GET/POST /api/admin/plans

List or create plans.

**POST Body:**
```json
{
  "name": "Professional",
  "slug": "professional",
  "price": 4999,
  "currency": "USD",
  "tokensLimit": 10,
  "apiCallsLimit": 100000,
  "transfersLimit": 1000000,
  "membersLimit": 10,
  "features": ["Custom API Keys", "Priority Support", "Advanced Analytics"],
  "isActive": true,
  "isPublic": true
}
```

### GET/PUT /api/admin/settings

Get or update SystemSettings.

**PUT Body:**
```json
{
  "defaultBasescanApiKey": "...",
  "defaultEtherscanApiKey": "...",
  "defaultMoralisApiKey": "...",
  "defaultQuicknodeUrl": "...",
  "defaultRoutescanApiKey": "...",
  "resendApiKey": "...",
  "resendFromEmail": "noreply@tokenlens.com",
  "appName": "TokenLens",
  "appUrl": "https://tokenlens.com",
  "supportEmail": "support@tokenlens.com"
}
```

### GET /api/admin/users

List all users.

**Query Parameters:**
- `role` (optional) - Filter by role
- `search` (optional)

---

## Organization Management APIs

### POST /api/organizations

Create new organization.

**Body:**
```json
{
  "name": "My Organization",
  "slug": "my-org"
}
```

### POST /api/organizations/invite

Invite team member.

**Body:**
```json
{
  "email": "user@example.com",
  "role": "MEMBER"
}
```

**Response:**
```json
{
  "invitation": {
    "id": "clxxx",
    "email": "user@example.com",
    "token": "uuid-token",
    "expiresAt": "2025-01-22T00:00:00Z"
  },
  "emailSent": true
}
```

### GET /api/organizations/invitations

List pending invitations.

### DELETE /api/organizations/invitations/[id]

Cancel invitation.

### POST /api/invitations/[token]/accept

Accept invitation (public endpoint).

**Body:**
```json
{
  "name": "John Doe",
  "password": "securepassword"
}
```

---

## Token Management APIs

### GET /api/tokens

List organization tokens.

**Query Parameters:**
- `orgId` (required or auto-detected from session)

### POST /api/tokens

Create new token.

**Body:**
```json
{
  "address": "0xA9bc...",
  "network": "base",
  "symbol": "VTN",
  "name": "Vottun Token",
  "decimals": 18,
  "chainId": 8453
}
```

**Validation:**
- Verifies token exists on-chain via ethers.js
- Checks limits via `checkTokensLimit()`

### PUT /api/tokens/[id]

Update token settings.

### DELETE /api/tokens/[id]

Delete token.

---

## Authentication APIs

### POST /api/auth/signup

User registration.

**Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "name": "John Doe",
  "organizationId": "clxxx"
}
```

**Response:**
```json
{
  "user": {
    "id": "clxxx",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "MEMBER"
  }
}
```

**Notes:**
- Password hashed with bcrypt (10 rounds)
- Auto-login after signup
- Redirects to `/onboarding` if no org/tokens

### POST /api/auth/signin (NextAuth)

Handled by NextAuth.js at `/api/auth/[...nextauth]`.

**Providers:**
- Credentials (email/password)
- Google OAuth

---

## Utility APIs

### GET /api/search

General search endpoint.

**Query Parameters:**
- `q` (required) - Search query
- `type` (optional) - address, transaction, token

**Response:**
```json
{
  "results": [
    {
      "type": "address",
      "address": "0x123...",
      "name": "Vottun World Vesting",
      "category": "VESTING"
    }
  ]
}
```

### GET /api/test

Health check.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:30:00Z"
}
```

---

## Error Responses

All APIs return consistent error format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {...}
}
```

**HTTP Status Codes:**
- `200` - Success
- `400` - Bad Request (validation error)
- `401` - Unauthorized (not logged in)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `429` - Rate Limit Exceeded
- `500` - Internal Server Error

---

## Rate Limiting

**Free Tier (Default):**
- BaseScan: 5 calls/second
- Etherscan: 5 calls/second
- Moralis: Plan-dependent

**Automatic Fallback:**
- BaseScan → Routescan
- Caching reduces API calls by ~90%

---

## Related Documentation

- [TOKENS_AND_BALANCES.md](./TOKENS_AND_BALANCES.md) - Token system details
- [VESTING_CONTRACTS.md](./VESTING_CONTRACTS.md) - Vesting APIs
- [DATABASE.md](./DATABASE.md) - Data models
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - API errors

---

**Last Updated:** 2026-02-05
