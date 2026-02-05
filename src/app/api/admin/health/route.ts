import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth-helpers';

const CHECK_TIMEOUT_MS = 8000;

async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number
): Promise<{ result: T; ms: number } | { error: string; ms: number }> {
  const start = Date.now();
  try {
    const result = await Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), timeoutMs)
      )
    ]);
    return { result, ms: Date.now() - start };
  } catch (err: any) {
    return {
      error: err.message || 'Unknown error',
      ms: Date.now() - start
    };
  }
}

/**
 * GET /api/admin/health
 *
 * Health check de servicios: DB, BaseScan, Routescan, Moralis
 * Solo accesible para SUPER_ADMIN
 */
export async function GET() {
  const session = await requireSuperAdmin();
  if (!session) {
    return NextResponse.json(
      { error: 'Forbidden: SUPER_ADMIN required' },
      { status: 403 }
    );
  }

  const results: Record<
    string,
    { status: 'ok' | 'error' | 'skipped'; ms?: number; message?: string }
  > = {};

  // Obtener settings una sola vez
  const systemSettings = await prisma.systemSettings.findUnique({
    where: { id: 'system' }
  });

  // 1. Database
  const dbCheck = await withTimeout(async () => {
    await prisma.$queryRaw`SELECT 1`;
  }, CHECK_TIMEOUT_MS);

  if ('error' in dbCheck) {
    results.database = {
      status: 'error',
      ms: dbCheck.ms,
      message: dbCheck.error
    };
  } else {
    results.database = { status: 'ok', ms: dbCheck.ms };
  }

  // 2. BaseScan API
  const basescanKey =
    process.env.NEXT_PUBLIC_BASESCAN_API_KEY ||
    (await prisma.systemSettings.findUnique({ where: { id: 'system' } }))?.defaultBasescanApiKey;

  const basescanCheck = await withTimeout(async () => {
    const url = `https://api.basescan.org/api?module=proxy&action=eth_blockNumber${basescanKey ? `&apikey=${basescanKey}` : ''}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.error) throw new Error(json.error.message || json.error);
  }, CHECK_TIMEOUT_MS);

  if ('error' in basescanCheck) {
    results.basescan = {
      status: 'error',
      ms: basescanCheck.ms,
      message: basescanCheck.error
    };
  } else {
    results.basescan = { status: 'ok', ms: basescanCheck.ms };
  }

  // 3. Routescan API (usado para transfers en Base)
  const routescanKey =
    process.env.NEXT_PUBLIC_ROUTESCAN_API_KEY ||
    process.env.NEXT_PUBLIC_BASESCAN_API_KEY;

  const routescanCheck = await withTimeout(async () => {
    const url = `https://api.routescan.io/v2/network/mainnet/evm/8453/etherscan/api?module=proxy&action=eth_blockNumber${routescanKey ? `&apikey=${routescanKey}` : ''}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.error) throw new Error(json.error.message || json.error);
  }, CHECK_TIMEOUT_MS);

  if ('error' in routescanCheck) {
    results.routescan = {
      status: 'error',
      ms: routescanCheck.ms,
      message: routescanCheck.error
    };
  } else {
    results.routescan = { status: 'ok', ms: routescanCheck.ms };
  }

  // 4. Moralis API (opcional, solo si hay key)
  const moralisKey =
    process.env.NEXT_PUBLIC_MORALIS_API_KEY ||
    systemSettings?.defaultMoralisApiKey;

  if (!moralisKey) {
    results.moralis = { status: 'skipped', message: 'No API key configured' };
  } else {
    const moralisCheck = await withTimeout(async () => {
      const res = await fetch(
        'https://deep-index.moralis.io/api/v2.2/0x0000000000000000000000000000000000000000/balance?chain=base',
        {
          headers: { 'X-API-Key': moralisKey }
        }
      );
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status}: ${txt.slice(0, 80)}`);
      }
    }, CHECK_TIMEOUT_MS);

    if ('error' in moralisCheck) {
      results.moralis = {
        status: 'error',
        ms: moralisCheck.ms,
        message: moralisCheck.error
      };
    } else {
      results.moralis = { status: 'ok', ms: moralisCheck.ms };
    }
  }

  const allOk = Object.values(results).every(
    (r) => r.status === 'ok' || r.status === 'skipped'
  );

  return NextResponse.json({
    status: allOk ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    services: results
  });
}
