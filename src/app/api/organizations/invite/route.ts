import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { randomBytes } from 'crypto';
import { sendInvitationEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'No autenticado' },
      { status: 401 }
    );
  }

  try {
    const { email, role } = await request.json();

    // Validar campos requeridos
    if (!email || !role) {
      return NextResponse.json(
        { error: 'Email y role son requeridos' },
        { status: 400 }
      );
    }

    // Obtener organización del usuario
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        memberships: true
      }
    });

    if (!user?.organizationId) {
      return NextResponse.json(
        { error: 'Usuario no pertenece a ninguna organización' },
        { status: 400 }
      );
    }

    // Verificar permisos (solo OWNER o ADMIN pueden invitar)
    const membership = user.memberships.find(
      m => m.organizationId === user.organizationId
    );

    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'No tienes permisos para invitar miembros' },
        { status: 403 }
      );
    }

    // Verificar si el email ya está en la organización
    const existingMember = await prisma.user.findFirst({
      where: {
        email,
        organizationId: user.organizationId
      }
    });

    if (existingMember) {
      return NextResponse.json(
        { error: 'Este usuario ya es miembro de la organización' },
        { status: 400 }
      );
    }

    // Verificar si ya existe una invitación pendiente
    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        email,
        organizationId: user.organizationId,
        acceptedAt: null
      }
    });

    if (existingInvitation) {
      return NextResponse.json(
        { error: 'Ya existe una invitación pendiente para este email' },
        { status: 400 }
      );
    }

    // Generar token único
    const token = randomBytes(32).toString('hex');

    // Crear invitación (expira en 7 días)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = await prisma.invitation.create({
      data: {
        organizationId: user.organizationId,
        email,
        role,
        token,
        invitedBy: session.user.id,
        expiresAt
      },
      include: {
        organization: {
          select: {
            name: true,
            slug: true
          }
        },
        inviter: {
          select: {
            name: true,
            email: true
          }
        }
      }
    });

    // Enviar email con el link de invitación
    const inviteUrl = `${process.env.NEXTAUTH_URL}/invite/${token}`;
    await sendInvitationEmail({
      to: email,
      organizationName: invitation.organization.name,
      inviterName: invitation.inviter.name || invitation.inviter.email,
      inviteUrl,
      expiresInDays: 7
    });

    return NextResponse.json({
      success: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        createdAt: invitation.createdAt,
        expiresAt: invitation.expiresAt,
        organization: invitation.organization,
        inviter: invitation.inviter
      }
    });

  } catch (error) {
    console.error('Error creating invitation:', error);
    return NextResponse.json(
      { error: 'Error al crear la invitación' },
      { status: 500 }
    );
  }
}
