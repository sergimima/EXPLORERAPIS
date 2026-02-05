/**
 * Script para rellenar tokenSymbol y tokenName en TransferCache
 *
 * Algunos registros antiguos tienen tokenSymbol y tokenName como NULL,
 * lo que causa que se muestren como "UNKNOWN" en el UI.
 *
 * Este script obtiene la información del token desde la API de Routescan
 * y actualiza los registros existentes.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface TokenInfo {
  symbol: string;
  name: string;
  decimals: number;
}

const tokenInfoCache = new Map<string, TokenInfo>();

async function getTokenInfo(tokenAddress: string): Promise<TokenInfo | null> {
  // Check cache first
  if (tokenInfoCache.has(tokenAddress.toLowerCase())) {
    return tokenInfoCache.get(tokenAddress.toLowerCase())!;
  }

  const apiKey = process.env.NEXT_PUBLIC_ROUTESCAN_API_KEY || process.env.NEXT_PUBLIC_BASESCAN_API_KEY;

  if (!apiKey) {
    console.warn('No API key found');
    return null;
  }

  try {
    const url = `https://api.routescan.io/v2/network/mainnet/evm/8453/etherscan/api?module=token&action=tokeninfo&contractaddress=${tokenAddress}&apikey=${apiKey}`;

    console.log(`  Fetching token info for ${tokenAddress}...`);

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === '1' && data.result && Array.isArray(data.result) && data.result.length > 0) {
      const token = data.result[0];
      const info: TokenInfo = {
        symbol: token.symbol || token.tokenName?.split(' ')[0] || 'UNKNOWN',
        name: token.tokenName || 'Unknown Token',
        decimals: parseInt(token.divisor) || 18
      };

      // Cache it
      tokenInfoCache.set(tokenAddress.toLowerCase(), info);

      console.log(`  ✅ Found: ${info.symbol} (${info.name})`);

      // Small delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 250));

      return info;
    }

    console.warn(`  ⚠️ No info found for ${tokenAddress}`);
    return null;
  } catch (error) {
    console.error(`  ❌ Error fetching token info:`, error);
    return null;
  }
}

async function main() {
  console.log('🔍 Buscando registros con tokenSymbol/tokenName faltantes...\n');

  // Find records with NULL tokenSymbol or tokenName
  const recordsToUpdate = await prisma.transferCache.findMany({
    where: {
      OR: [
        { tokenSymbol: null },
        { tokenName: null }
      ]
    },
    select: {
      id: true,
      tokenAddress: true,
      tokenSymbol: true,
      tokenName: true,
      decimals: true
    }
  });

  console.log(`📊 Encontrados ${recordsToUpdate.length} registros para actualizar\n`);

  if (recordsToUpdate.length === 0) {
    console.log('✅ No hay registros que actualizar');
    return;
  }

  // Group by token address to minimize API calls
  const uniqueTokens = new Set(recordsToUpdate.map(r => r.tokenAddress.toLowerCase()));
  console.log(`🪙 ${uniqueTokens.size} tokens únicos\n`);

  let updated = 0;
  let failed = 0;

  // Process each unique token
  for (const tokenAddress of Array.from(uniqueTokens)) {
    console.log(`\n🔄 Procesando token: ${tokenAddress}`);

    const info = await getTokenInfo(tokenAddress);

    if (!info) {
      console.log(`  ⏭️  Saltando (no se pudo obtener info)`);
      failed++;
      continue;
    }

    // Update all records for this token
    const recordsForToken = recordsToUpdate.filter(r => r.tokenAddress.toLowerCase() === tokenAddress);
    console.log(`  📝 Actualizando ${recordsForToken.length} registros...`);

    try {
      const result = await prisma.transferCache.updateMany({
        where: {
          tokenAddress: tokenAddress
        },
        data: {
          tokenSymbol: info.symbol,
          tokenName: info.name,
          decimals: info.decimals
        }
      });

      console.log(`  ✅ Actualizados ${result.count} registros`);
      updated += result.count;
    } catch (error) {
      console.error(`  ❌ Error actualizando registros:`, error);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`\n✅ Completado!`);
  console.log(`   - Registros actualizados: ${updated}`);
  console.log(`   - Tokens fallidos: ${failed}`);
  console.log(`   - Total procesado: ${uniqueTokens.size} tokens`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
