import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenant-context';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const tenantContext = await getTenantContext();

  if (!tenantContext) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const tokenId = params.id;

  const token = await prisma.token.findFirst({
    where: {
      id: tokenId,
      organizationId: tenantContext.organizationId
    },
    include: {
      settings: true
    }
  });

  if (!token) {
    return NextResponse.json({ error: 'Token no encontrado' }, { status: 404 });
  }

  return NextResponse.json(token);
}
