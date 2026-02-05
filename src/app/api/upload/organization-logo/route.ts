/**
 * API: Upload Organization Logo
 * POST /api/upload/organization-logo
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

    // Get user and organization
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { organization: true }
    });

    if (!user?.organizationId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Check if user is ADMIN or OWNER
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
    const organization = user.organization;
    if (organization?.logoUrl) {
      const publicId = extractPublicIdFromUrl(organization.logoUrl);
      if (publicId) {
        await deleteImage(publicId);
      }
    }

    // Upload new logo
    const result = await uploadImage(
      image,
      'organizations',
      `org_${user.organizationId}`
    );

    // Update organization in database
    const updatedOrg = await prisma.organization.update({
      where: { id: user.organizationId },
      data: { logoUrl: result.url }
    });

    return NextResponse.json({
      success: true,
      logoUrl: updatedOrg.logoUrl
    });

  } catch (error) {
    console.error('Error uploading organization logo:', error);
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

    // Get user and organization
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { organization: true }
    });

    if (!user?.organizationId || !user.organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
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
    if (user.organization.logoUrl) {
      const publicId = extractPublicIdFromUrl(user.organization.logoUrl);
      if (publicId) {
        await deleteImage(publicId);
      }
    }

    // Update database
    await prisma.organization.update({
      where: { id: user.organizationId },
      data: { logoUrl: null }
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error deleting organization logo:', error);
    return NextResponse.json(
      { error: 'Failed to delete logo' },
      { status: 500 }
    );
  }
}
