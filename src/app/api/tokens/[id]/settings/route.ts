import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenant-context';
import { prisma } from '@/lib/db';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenantContext = await getTenantContext();

  if (!tenantContext) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { id: tokenId } = await params;
  const settings = await request.json();

  // Verificar que el token pertenece a la org
  const token = await prisma.token.findFirst({
    where: {
      id: tokenId,
      organizationId: tenantContext.organizationId
    }
  });

  if (!token) {
    return NextResponse.json({ error: 'Token no encontrado' }, { status: 404 });
  }

  // Actualizar o crear settings
  const updatedSettings = await prisma.tokenSettings.upsert({
    where: { tokenId },
    create: {
      tokenId,
      ...settings
    },
    update: settings
  });

  return NextResponse.json(updatedSettings);
}
