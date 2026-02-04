import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'No autenticado' },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;

    // Obtener la invitación
    const invitation = await prisma.invitation.findUnique({
      where: { id }
    });

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitación no encontrada' },
        { status: 404 }
      );
    }

    // Verificar que el usuario pertenece a la misma organización
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        memberships: true
      }
    });

    if (user?.organizationId !== invitation.organizationId) {
      return NextResponse.json(
        { error: 'No tienes permisos para cancelar esta invitación' },
        { status: 403 }
      );
    }

    // Verificar permisos (solo OWNER o ADMIN pueden cancelar)
    const membership = user.memberships.find(
      m => m.organizationId === user.organizationId
    );

    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'No tienes permisos para cancelar invitaciones' },
        { status: 403 }
      );
    }

    // Eliminar la invitación
    await prisma.invitation.delete({
      where: { id }
    });

    return NextResponse.json({
      success: true,
      message: 'Invitación cancelada correctamente'
    });

  } catch (error) {
    console.error('Error deleting invitation:', error);
    return NextResponse.json(
      { error: 'Error al cancelar la invitación' },
      { status: 500 }
    );
  }
}
