import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'No autenticado' },
      { status: 401 }
    );
  }

  const { name, slug } = await request.json();

  // Validar slug único
  const existing = await prisma.organization.findUnique({
    where: { slug }
  });

  if (existing) {
    return NextResponse.json(
      { error: 'Slug ya existe' },
      { status: 400 }
    );
  }

  // Crear organización
  const organization = await prisma.organization.create({
    data: {
      name,
      slug,
      ownerId: session.user.id,
      users: {
        connect: { id: session.user.id }
      },
      members: {
        create: {
          userId: session.user.id,
          role: 'OWNER',
          joinedAt: new Date()
        }
      }
    }
  });

  // Actualizar usuario
  await prisma.user.update({
    where: { id: session.user.id },
    data: { organizationId: organization.id }
  });

  return NextResponse.json(organization);
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'No autenticado' },
      { status: 401 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      organization: {
        include: {
          tokens: true,
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  image: true
                }
              }
            }
          }
        }
      }
    }
  });

  return NextResponse.json(user?.organization);
}
