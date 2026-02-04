import { NextRequest, NextResponse } from 'next/server';

// DEPRECATED: This endpoint is for legacy testing only and will be removed in future versions
// Use the multi-tenant APIs with authentication instead:
// - /api/tokens/[id] for token data
// - /api/token-analytics for analytics
// - /api/tokens/[id]/settings for configuration

const VTN_TOKEN_ADDRESS = '0xA9bc478A44a8c8FE6fd505C1964dEB3cEe3b7abC';

export async function GET(request: NextRequest) {
  // Warning for deprecated endpoint
  console.warn('⚠️ DEPRECATED: /api/test-vtn is a legacy endpoint and will be removed. Use multi-tenant APIs instead.');

  const apiKey = process.env.NEXT_PUBLIC_ROUTESCAN_API_KEY || process.env.NEXT_PUBLIC_BASESCAN_API_KEY;

  console.log('Routescan API Key:', apiKey ? 'Present' : 'Missing');

  try {
    // Test Routescan API (compatible con Etherscan)
    const urlV2 = `https://api.routescan.io/v2/network/mainnet/evm/8453/etherscan/api?module=account&action=tokentx&contractaddress=${VTN_TOKEN_ADDRESS}&page=1&offset=10&sort=desc&apikey=${apiKey}`;

    console.log('Calling Routescan API...');
    const responseV2 = await fetch(urlV2);
    const dataV2 = await responseV2.json();

    return NextResponse.json({
      _deprecation: {
        warning: 'This endpoint is deprecated and will be removed in a future version',
        useInstead: [
          '/api/tokens/[id]',
          '/api/token-analytics',
          '/api/tokens/[id]/settings'
        ]
      },
      apiKeyPresent: !!apiKey,
      apiKeyValue: apiKey?.substring(0, 10) + '...',
      apiProvider: 'Routescan',
      v2Response: dataV2,
      v2Status: dataV2.status,
      v2ResultCount: Array.isArray(dataV2.result) ? dataV2.result.length : 0,
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
