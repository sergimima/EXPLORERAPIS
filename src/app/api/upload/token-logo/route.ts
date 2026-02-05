/**
 * API: Upload Token Logo
 * POST /api/upload/token-logo?tokenId=xxx
 * Sprint 4.9: Sistema de logos
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { uploadImage, deleteImage, extractPublicIdFromUrl } from '@/lib/cloudinary';

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get tokenId from query
    const searchParams = request.nextUrl.searchParams;
    const tokenId = searchParams.get('tokenId');

    if (!tokenId) {
      return NextResponse.json({ error: 'Token ID required' }, { status: 400 });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user?.organizationId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Verify token belongs to user's organization
    const token = await prisma.token.findFirst({
      where: {
        id: tokenId,
        organizationId: user.organizationId
      }
    });

    if (!token) {
      return NextResponse.json({ error: 'Token not found' }, { status: 404 });
    }

    // Check permissions (ADMIN or OWNER)
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: user.organizationId,
          userId: user.id
        }
      }
    });

    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const { image } = body; // Base64 string

    if (!image || typeof image !== 'string') {
      return NextResponse.json({ error: 'Invalid image data' }, { status: 400 });
    }

    // Delete old logo if exists
    if (token.logoUrl) {
      const publicId = extractPublicIdFromUrl(token.logoUrl);
      if (publicId) {
        await deleteImage(publicId);
      }
    }

    // Upload new logo
    const result = await uploadImage(
      image,
      'tokens',
      `token_${tokenId}`
    );

    // Update token in database
    const updatedToken = await prisma.token.update({
      where: { id: tokenId },
      data: { logoUrl: result.url }
    });

    return NextResponse.json({
      success: true,
      logoUrl: updatedToken.logoUrl
    });

  } catch (error) {
    console.error('Error uploading token logo:', error);
    return NextResponse.json(
      { error: 'Failed to upload logo' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Auth check
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get tokenId from query
    const searchParams = request.nextUrl.searchParams;
    const tokenId = searchParams.get('tokenId');

    if (!tokenId) {
      return NextResponse.json({ error: 'Token ID required' }, { status: 400 });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user?.organizationId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Verify token belongs to user's organization
    const token = await prisma.token.findFirst({
      where: {
        id: tokenId,
        organizationId: user.organizationId
      }
    });

    if (!token) {
      return NextResponse.json({ error: 'Token not found' }, { status: 404 });
    }

    // Check permissions
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: user.organizationId,
          userId: user.id
        }
      }
    });

    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Delete from Cloudinary
    if (token.logoUrl) {
      const publicId = extractPublicIdFromUrl(token.logoUrl);
      if (publicId) {
        await deleteImage(publicId);
      }
    }

    // Update database
    await prisma.token.update({
      where: { id: tokenId },
      data: { logoUrl: null }
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error deleting token logo:', error);
    return NextResponse.json(
      { error: 'Failed to delete logo' },
      { status: 500 }
    );
  }
}
