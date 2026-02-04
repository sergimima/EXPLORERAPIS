import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const session = await getServerSession(authOptions);

    // Buscar la invitación
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: {
        organization: true
      }
    });

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitación no encontrada' },
        { status: 404 }
      );
    }

    // Verificar que no esté expirada
    if (invitation.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Esta invitación ha expirado' },
        { status: 400 }
      );
    }

    // Verificar que no haya sido aceptada
    if (invitation.acceptedAt) {
      return NextResponse.json(
        { error: 'Esta invitación ya ha sido aceptada' },
        { status: 400 }
      );
    }

    let userId: string;

    // Caso 1: Usuario ya autenticado
    if (session?.user?.id) {
      userId = session.user.id;

      // Verificar que el email coincida
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (user?.email !== invitation.email) {
        return NextResponse.json(
          { error: 'Esta invitación fue enviada a otro email' },
          { status: 400 }
        );
      }

      // Verificar que no sea miembro ya
      const existingMembership = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: invitation.organizationId,
            userId
          }
        }
      });

      if (existingMembership) {
        return NextResponse.json(
          { error: 'Ya eres miembro de esta organización' },
          { status: 400 }
        );
      }

    } else {
      // Caso 2: Usuario no autenticado - necesita crear cuenta o login
      const { password, name } = await request.json();

      // Buscar si el usuario ya existe
      let user = await prisma.user.findUnique({
        where: { email: invitation.email }
      });

      if (user) {
        // Usuario existe pero no está autenticado
        return NextResponse.json(
          {
            error: 'Ya existe una cuenta con este email. Por favor inicia sesión primero.',
            requireLogin: true
          },
          { status: 400 }
        );
      }

      // Crear nuevo usuario
      if (!password || !name) {
        return NextResponse.json(
          { error: 'Se requiere nombre y contraseña para crear la cuenta' },
          { status: 400 }
        );
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      user = await prisma.user.create({
        data: {
          email: invitation.email,
          name,
          hashedPassword,
          role: 'MEMBER',
          organizationId: invitation.organizationId
        }
      });

      userId = user.id;
    }

    // Agregar usuario a la organización
    await prisma.organizationMember.create({
      data: {
        organizationId: invitation.organizationId,
        userId,
        role: invitation.role,
        invitedBy: invitation.invitedBy,
        invitedAt: invitation.createdAt,
        joinedAt: new Date()
      }
    });

    // Actualizar organizationId del usuario si no lo tiene
    await prisma.user.update({
      where: { id: userId },
      data: { organizationId: invitation.organizationId }
    });

    // Marcar invitación como aceptada
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() }
    });

    return NextResponse.json({
      success: true,
      message: 'Te has unido a la organización correctamente',
      organization: {
        id: invitation.organization.id,
        name: invitation.organization.name,
        slug: invitation.organization.slug
      }
    });

  } catch (error) {
    console.error('Error accepting invitation:', error);
    return NextResponse.json(
      { error: 'Error al aceptar la invitación' },
      { status: 500 }
    );
  }
}
