import { NextRequest, NextResponse } from 'next/server';
import { fetchTokenTransfers } from '@/lib/blockchain';
import { getTenantContext } from '@/lib/tenant-context';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Validar autenticación y tenant context
    const tenantContext = await getTenantContext();

    if (!tenantContext) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const wallet = searchParams.get('wallet');
    const network = searchParams.get('network') || tenantContext.activeToken?.network || 'base';
    const tokenAddress = searchParams.get('token') || tenantContext.activeToken?.address || '';

    if (!wallet) {
      return NextResponse.json(
        { error: 'Se requiere una dirección de wallet' },
        { status: 400 }
      );
    }

    // Validar que el token pertenece a la organización (si se especifica)
    if (tokenAddress && tenantContext.activeToken) {
      const hasAccess = tenantContext.tokens.some(
        t => t.address.toLowerCase() === tokenAddress.toLowerCase()
      );

      if (!hasAccess) {
        return NextResponse.json(
          { error: 'No tienes acceso a este token' },
          { status: 403 }
        );
      }
    }

    const transfers = await fetchTokenTransfers(wallet, network, tokenAddress);

    return NextResponse.json(transfers);
  } catch (error) {
    console.error('Error en la API de transferencias:', error);
    return NextResponse.json(
      { error: 'Error al obtener las transferencias de tokens' },
      { status: 500 }
    );
  }
}
