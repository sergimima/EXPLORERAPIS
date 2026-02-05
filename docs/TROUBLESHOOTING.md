# Troubleshooting Guide

Common errors, solutions, and debugging tips for the TokenLens platform.

---

## Database Issues

### ❌ "Can't reach database server at localhost:5432"

**Causes:**
- PostgreSQL Docker container not running
- Wrong DATABASE_URL
- Port 5432 already in use

**Solutions:**
```bash
# Check if container is running
docker ps | grep explorer-postgres

# If not running, start it
docker start explorer-postgres

# If doesn't exist, create it
docker run --name explorer-postgres \
  -e POSTGRES_PASSWORD=yourpassword \
  -p 5432:5432 \
  -d postgres:14

# Check logs
docker logs explorer-postgres

# Verify DATABASE_URL in .env.local
echo $DATABASE_URL
```

### ❌ "Unique constraint failed on the fields: (tokenId,address)"

**Cause:** Trying to create duplicate token

**Solution:**
```typescript
// Use upsert instead of create
await prisma.token.upsert({
  where: {
    orgId_address_network: {
      orgId,
      address,
      network
    }
  },
  update: { name: 'Updated Name' },
  create: { orgId, address, network, symbol, name, decimals, chainId }
});
```

### ❌ "Invalid `prisma.X.Y()` invocation"

**Cause:** Prisma Client out of sync with schema

**Solution:**
```bash
# Regenerate Prisma Client
npx prisma generate

# Restart dev server
npm run dev
```

### ❌ "Migration failed: Table already exists"

**Cause:** Schema out of sync with migrations

**Solutions:**
```bash
# Development: Reset database (destructive!)
npx prisma migrate reset

# Production: Fix manually or use prisma db push
npx prisma db push --accept-data-loss
```

---

## API Rate Limiting

### ❌ "Rate limit exceeded" from BaseScan

**Cause:** Free tier limit (5 calls/second)

**Solutions:**
1. **Automatic fallback** to Routescan kicks in
2. **Check console logs** for fallback status
3. **Use custom API keys:**
   - Organization level: `/settings/tokens/[id]/api-keys`
   - Global level: `/admin/settings` (SUPER_ADMIN)
4. **Upgrade BaseScan plan** if needed

**Expected behavior:**
```
BaseScan (3 retries with exponential backoff)
    ↓ (if all fail)
Routescan (3 retries)
    ↓ (if all fail)
Error
```

### ❌ "Invalid API key" errors

**Causes:**
- Using default `'YourApiKeyToken'`
- Wrong key in .env / SystemSettings / TokenSettings
- Key not configured in hierarchy

**Solutions:**
```bash
# 1. Check .env.local
cat .env.local | grep API_KEY

# 2. Check SystemSettings (SUPER_ADMIN)
# Navigate to /admin/settings → API Keys tab

# 3. Check TokenSettings (per token)
# Navigate to /settings/tokens/[id]/api-keys

# 4. Verify hierarchy in console logs:
# Look for: "Using API key from: TokenSettings | SystemSettings | .env"
```

**API Key Hierarchy:**
```
1. TokenSettings (highest priority)
   ↓
2. SystemSettings
   ↓
3. .env variables
   ↓
4. 'YourApiKeyToken' (will fail)
```

---

## Authentication Issues

### ❌ "Invalid credentials" on signin

**Causes:**
- Wrong email/password
- User doesn't exist
- Password hash mismatch

**Solutions:**
```bash
# Check if user exists
npx prisma studio
# → Look in User table

# Reset password (dev only)
npx tsx prisma/seed-user.ts  # Recreates admin@vottun.com

# Check password hashing
# → Passwords are bcrypt hashed with 10 rounds
```

### ❌ Redirected to /auth/signin when accessing protected routes

**Causes:**
- Session expired
- Not logged in
- Middleware blocking route

**Solutions:**
```bash
# 1. Check NEXTAUTH_SECRET in .env.local
echo $NEXTAUTH_SECRET

# If missing, generate:
openssl rand -base64 32

# 2. Clear cookies and re-login

# 3. Check middleware.ts for route protection
# Protected: /dashboard, /settings, /admin, /explorer
# Public: /, /auth/*, /docs
```

### ❌ "Access Denied" when accessing /admin

**Cause:** User is not SUPER_ADMIN

**Solution:**
```bash
# Login as SUPER_ADMIN:
# Email: superadmin@tokenlens.com
# Password: super123

# Or create new SUPER_ADMIN:
npx tsx prisma/seed-superadmin.ts
```

---

## Port & Process Issues

### ❌ "Port 4200 already in use"

**Causes:**
- Previous dev server still running
- Another app using port 4200

**Solutions:**
```bash
# Windows
netstat -ano | findstr :4200
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:4200 | xargs kill -9

# Or change port in package.json
"dev": "next dev -p 4201"
```

### ❌ Docker container won't start

**Causes:**
- Port 5432 in use
- Volume issues
- Container name conflict

**Solutions:**
```bash
# Check what's using port 5432
netstat -ano | findstr :5432  # Windows
lsof -i :5432                 # Linux/Mac

# Remove old container
docker rm -f explorer-postgres

# Recreate with different port
docker run --name explorer-postgres \
  -e POSTGRES_PASSWORD=yourpassword \
  -p 5433:5432 \
  -d postgres:14

# Update DATABASE_URL to use port 5433
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5433/explorer_db"
```

---

## Token & Balance Issues

### ❌ "No tokens found" when user has balances

**Causes:**
- Wrong network
- Wrong wallet address
- Moralis API error
- Rate limit

**Solutions:**
```bash
# 1. Verify network matches token
# Token on Base Mainnet → Use 'base' network

# 2. Check console logs for API errors
# Look for: "❌ Balance API failed"

# 3. Test Moralis API key
curl -X GET \
  "https://deep-index.moralis.io/api/v2.2/${address}/erc20" \
  -H "X-API-Key: ${MORALIS_KEY}"

# 4. Check fallback to transfer analysis
# System auto-falls back if Moralis fails
```

### ❌ Transfer history shows "UNKNOWN" token

**Cause:** Old cached data without token info

**Solution:**
```bash
# Run backfill script
npx tsx prisma/backfill-transfer-tokens.ts

# This updates all TransferCache records with token metadata
```

### ❌ Slow analytics page (>10s load)

**Causes:**
- First load (fetching full history)
- Cache expired
- Large transfer history

**Solutions:**
```bash
# Normal behavior:
# - First load: 10-15s (fetches all transfers)
# - Subsequent: 2-4s (reads cache + new data)

# If ALWAYS slow:
# 1. Check TransferCache has data
npx prisma studio  # → Check TransferCache table

# 2. Force refresh and check console logs
# Click "Actualizar" button and watch logs

# 3. Verify database indexes exist
# Should have: @@index([tokenId, timestamp])
```

---

## Vesting Contract Issues

### ❌ "Contract has no vesting methods"

**Causes:**
- Contract is not a vesting contract
- Wrong ABI
- Contract not verified on BaseScan

**Solutions:**
```bash
# 1. Verify contract type
# Check if it has: getVestingSchedulesCount, getVestingListByHolder, etc.

# 2. Add custom ABI
# Navigate to: /settings/tokens/[id]/abi
# Upload correct ABI JSON

# 3. Check preloaded ABIs
# File: src/lib/contractAbis.ts
# Add contract address if missing
```

### ❌ Releasable amount calculation seems wrong

**Causes:**
- Cliff time confusion
- Timezone issues
- Wrong duration units

**Debug:**
```typescript
// Log calculation inputs
console.log({
  totalAmount,
  released,
  startTime,    // Unix timestamp
  cliffTime,    // Unix timestamp
  duration,     // Seconds
  currentTime   // Unix timestamp (UTC!)
});

// Verify logic:
// Before cliff → 0 releasable
// During vesting → Linear unlock
// After end → All remaining
```

---

## Build & Deployment Issues

### ❌ "Module not found" errors during build

**Causes:**
- Missing dependencies
- Prisma Client not generated

**Solutions:**
```bash
# Install dependencies
npm install

# Generate Prisma Client
npx prisma generate

# Clean build cache
rm -rf .next

# Rebuild
npm run build
```

### ❌ Environment variables not working in production

**Causes:**
- Using .env.local in production
- Missing NEXTAUTH_SECRET
- Variables not prefixed with NEXT_PUBLIC_

**Solutions:**
```bash
# Server-side variables (API routes, server actions)
DATABASE_URL="..."           # ✅ Works
NEXTAUTH_SECRET="..."        # ✅ Works
STRIPE_SECRET_KEY="..."      # ✅ Works

# Client-side variables (browser)
NEXT_PUBLIC_BASESCAN_API_KEY="..."  # ✅ Works
BASESCAN_API_KEY="..."              # ❌ Won't work
```

---

## Performance Issues

### ❌ Slow initial page load

**Causes:**
- First-time data fetch
- Large transfer history
- Multiple API calls

**Expected behavior:**
```
First analytics load: ~10s
  - Fetches full transfer history
  - Creates snapshots
  - Builds cache

Subsequent loads: 2-4s
  - Reads from cache
  - Only fetches new data
```

**Optimization:**
```bash
# Check cache is working
npx prisma studio
# → Verify TransferCache and HolderSnapshot have data

# Enable query logging
# Add to prisma client: log: ['query']
```

### ❌ Memory leaks / growing heap

**Causes:**
- Multiple Prisma Client instances
- Unclosed connections

**Solution:**
```typescript
// Use singleton pattern (already implemented in src/lib/db.ts)
// Only one PrismaClient instance with connection pooling
const globalForPrisma = globalThis as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });
```

---

## Next.js / React Issues

### ❌ "Hydration error" in console

**Causes:**
- Server/client mismatch
- Date formatting differences
- Conditional rendering

**Solutions:**
```typescript
// Use suppressHydrationWarning
<div suppressHydrationWarning>
  {new Date().toLocaleString()}
</div>

// Or use client-side only
'use client'
import { useEffect, useState } from 'react';

const [mounted, setMounted] = useState(false);
useEffect(() => setMounted(true), []);
if (!mounted) return null;
```

### ❌ "use client" directive errors

**Cause:** Using client features in server components

**Solution:**
```typescript
// Add 'use client' to components that use:
// - useState, useEffect, useContext
// - Event handlers (onClick, onChange)
// - Browser APIs

'use client'

import { useState } from 'react';

export default function Component() {
  const [state, setState] = useState(0);
  // ...
}
```

---

## Windows-Specific Issues

### ❌ Line ending issues in git

**Solution:**
```bash
# Configure git to use LF
git config --global core.autocrlf false
git config --global core.eol lf

# Re-checkout files
git rm --cached -r .
git reset --hard
```

### ❌ Docker Desktop not starting

**Solutions:**
```bash
# 1. Enable WSL2 in Windows Features
# 2. Install WSL2 update: https://aka.ms/wsl2kernel
# 3. Set WSL2 as default
wsl --set-default-version 2

# 4. Configure Docker to use WSL2 backend
# Docker Desktop → Settings → General → Use WSL2 based engine
```

### ❌ npm commands failing

**Solution:**
```bash
# Use PowerShell or Windows Terminal (not CMD)
# Or use Git Bash

# If still issues, try:
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

---

## Debugging Tips

### Enable Verbose Logging

```typescript
// Prisma queries
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error']
});

// API calls
console.log('🔍 Request:', { method, url, body });
console.log('✅ Response:', { status, data });
console.error('❌ Error:', error);
```

### Use Browser DevTools

```bash
# Network tab: Check API calls
# - Status codes
# - Response times
# - Error messages

# Console tab: Check logs
# - API key source (TokenSettings/SystemSettings/.env)
# - Fallback triggers
# - Cache hits/misses

# React DevTools: Check component state
# - TokenContext activeToken
# - Session state
```

### Check Database Directly

```bash
# Open Prisma Studio
npx prisma studio

# Or use psql
docker exec -it explorer-postgres psql -U postgres -d explorer_db

# Common queries:
SELECT * FROM "User" WHERE email = 'admin@vottun.com';
SELECT * FROM "Token" WHERE "orgId" = 'clxxx';
SELECT COUNT(*) FROM "TransferCache" WHERE "tokenId" = 'clxxx';
```

---

## Getting Help

### Where to Look

1. **Console logs** - Most errors are logged
2. **Prisma Studio** - Check database state
3. **Network tab** - Check API responses
4. **Documentation:**
   - [TOKENS_AND_BALANCES.md](./TOKENS_AND_BALANCES.md)
   - [VESTING_CONTRACTS.md](./VESTING_CONTRACTS.md)
   - [DATABASE.md](./DATABASE.md)
   - [API_REFERENCE.md](./API_REFERENCE.md)

### Report Issues

```markdown
**Issue Title:** Short description

**Environment:**
- OS: Windows 11 / macOS / Linux
- Node: v20.x
- Browser: Chrome 120

**Steps to Reproduce:**
1. Go to /explorer/analytics
2. Click "Actualizar"
3. Wait 30s
4. See error

**Expected:** Analytics data loads in 2-4s
**Actual:** Timeout after 30s

**Console Logs:**
```
❌ Balance API failed: Rate limit exceeded
🔄 Falling back to Routescan...
```

**Screenshots:** (if applicable)
```

---

**Last Updated:** 2026-02-05
