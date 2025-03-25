import { NextRequest, NextResponse } from 'next/server';

// Interfaz para el balance de tokens
interface TokenBalance {
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  balance: string;
  decimals: number;
  usdValue: number;
}

// Función simulada para obtener el balance de tokens
async function fetchTokenBalances(
  walletAddress: string,
  network: string = 'base'
): Promise<TokenBalance[]> {
  // Simulamos un retraso para imitar una llamada a la API
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Datos de ejemplo para mostrar la funcionalidad
  const mockBalances: TokenBalance[] = [
    {
      tokenAddress: '0x4200000000000000000000000000000000000006',
      tokenSymbol: 'WETH',
      tokenName: 'Wrapped Ether',
      balance: '1.5',
      decimals: 18,
      usdValue: 3000
    },
    {
      tokenAddress: '0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca',
      tokenSymbol: 'USDbC',
      tokenName: 'USD Base Coin',
      balance: '250',
      decimals: 6,
      usdValue: 250
    },
    {
      tokenAddress: '0x50c5725949a6f0c72e6c4a641f24049a917db0cb',
      tokenSymbol: 'DAI',
      tokenName: 'Dai Stablecoin',
      balance: '75.5',
      decimals: 18,
      usdValue: 75.5
    }
  ];
  
  return mockBalances;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const wallet = searchParams.get('wallet');
    const network = searchParams.get('network') || 'base';

    if (!wallet) {
      return NextResponse.json(
        { error: 'Se requiere una dirección de wallet' },
        { status: 400 }
      );
    }

    const balances = await fetchTokenBalances(wallet, network);
    
    return NextResponse.json(balances);
  } catch (error) {
    console.error('Error en la API de balances:', error);
    return NextResponse.json(
      { error: 'Error al obtener los balances de tokens' },
      { status: 500 }
    );
  }
}
