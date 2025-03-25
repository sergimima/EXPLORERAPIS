import { NextRequest, NextResponse } from 'next/server';
import { fetchTokenTransfers } from '@/lib/blockchain';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const wallet = searchParams.get('wallet');
    const network = searchParams.get('network') || 'base';
    const token = searchParams.get('token') || '';

    if (!wallet) {
      return NextResponse.json(
        { error: 'Se requiere una dirección de wallet' },
        { status: 400 }
      );
    }

    const transfers = await fetchTokenTransfers(wallet, network, token);
    
    return NextResponse.json(transfers);
  } catch (error) {
    console.error('Error en la API de transferencias:', error);
    return NextResponse.json(
      { error: 'Error al obtener las transferencias de tokens' },
      { status: 500 }
    );
  }
}
