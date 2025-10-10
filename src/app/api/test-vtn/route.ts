import { NextRequest, NextResponse } from 'next/server';

const VTN_TOKEN_ADDRESS = '0xA9bc478A44a8c8FE6fd505C1964dEB3cEe3b7abC';

export async function GET(request: NextRequest) {
  const apiKey = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY;

  console.log('API Key:', apiKey ? 'Present' : 'Missing');

  try {
    // Test API V2
    const urlV2 = `https://api.etherscan.io/v2/api?chainid=8453&module=account&action=tokentx&contractaddress=${VTN_TOKEN_ADDRESS}&page=1&offset=10&sort=desc&apikey=${apiKey}`;

    console.log('Calling V2 API...');
    const responseV2 = await fetch(urlV2);
    const dataV2 = await responseV2.json();

    return NextResponse.json({
      apiKeyPresent: !!apiKey,
      apiKeyValue: apiKey?.substring(0, 10) + '...',
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
