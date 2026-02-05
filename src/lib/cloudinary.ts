/**
 * Cloudinary Helper - Upload and manage images
 * Sprint 4.9: Sistema de logos para organizaciones y tokens
 */

import { v2 as cloudinary } from 'cloudinary';
import { prisma } from './db';

/**
 * Configure Cloudinary with credentials from SystemSettings
 * This should be called before any upload operation
 */
export async function configureCloudinary() {
  // Get settings from database
  const settings = await prisma.systemSettings.findUnique({
    where: { id: 'system' }
  });

  if (!settings?.cloudinaryCloudName || !settings?.cloudinaryApiKey || !settings?.cloudinaryApiSecret) {
    throw new Error('Cloudinary credentials not configured in SystemSettings');
  }

  cloudinary.config({
    cloud_name: settings.cloudinaryCloudName,
    api_key: settings.cloudinaryApiKey,
    api_secret: settings.cloudinaryApiSecret
  });

  return cloudinary;
}

/**
 * Upload image to Cloudinary
 * @param file - Base64 string or file path
 * @param folder - Folder in Cloudinary (e.g., 'organizations' or 'tokens')
 * @param publicId - Optional custom public ID
 * @returns Cloudinary upload response with secure_url
 */
export async function uploadImage(
  file: string,
  folder: 'organizations' | 'tokens',
  publicId?: string
): Promise<{ url: string; publicId: string }> {
  const cloudinaryInstance = await configureCloudinary();

  try {
    const result = await cloudinaryInstance.uploader.upload(file, {
      folder: `tokenlens/${folder}`,
      public_id: publicId,
      // Optimizations
      transformation: [
        { width: 200, height: 200, crop: 'fill', gravity: 'face' },
        { quality: 'auto:good' },
        { fetch_format: 'auto' }
      ],
      // Security
      invalidate: true, // Invalidate CDN cache
      overwrite: true
    });

    return {
      url: result.secure_url,
      publicId: result.public_id
    };
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    throw new Error('Failed to upload image');
  }
}

/**
 * Delete image from Cloudinary
 * @param publicId - The public ID of the image to delete
 * @returns Delete operation result
 */
export async function deleteImage(publicId: string): Promise<boolean> {
  const cloudinaryInstance = await configureCloudinary();

  try {
    const result = await cloudinaryInstance.uploader.destroy(publicId);
    return result.result === 'ok';
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    return false;
  }
}

/**
 * Extract public ID from Cloudinary URL
 * @param url - Full Cloudinary URL
 * @returns Public ID or null
 */
export function extractPublicIdFromUrl(url: string): string | null {
  try {
    // Example URL: https://res.cloudinary.com/demo/image/upload/v1234567890/tokenlens/organizations/abc123.jpg
    const parts = url.split('/upload/');
    if (parts.length < 2) return null;

    const pathParts = parts[1].split('/').slice(1); // Remove version
    const publicIdWithExt = pathParts.join('/');
    const publicId = publicIdWithExt.replace(/\.[^/.]+$/, ''); // Remove extension

    return publicId;
  } catch (error) {
    console.error('Error extracting public ID:', error);
    return null;
  }
}

/**
 * Validate image file (client-side helper)
 * @param file - File object from input
 * @returns Validation result
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  // Check file size (max 5MB)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    return { valid: false, error: 'Image size must be less than 5MB' };
  }

  // Check file type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Only JPEG, PNG, GIF, and WebP images are allowed' };
  }

  return { valid: true };
}

/**
 * Resize image to max dimensions (client-side) to avoid 413 Request Entity Too Large
 * @param file - File object from input
 * @param maxSize - Max width/height (default 512, enough for logos)
 * @param maxKb - Max output size in KB (default 300)
 */
export async function resizeImageForUpload(file: File, maxSize = 512, maxKb = 300): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const canvas = document.createElement('canvas');
      let { width, height } = img;

      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas not supported'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      let quality = 0.9;
      const tryCompress = () => {
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const base64Size = (dataUrl.length * 3) / 4;
        if (base64Size <= maxKb * 1024 || quality <= 0.5) {
          resolve(dataUrl);
        } else {
          quality -= 0.1;
          tryCompress();
        }
      };
      tryCompress();
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

/**
 * Convert File to Base64 string (client-side helper)
 * Resizes to max 512px to avoid 413 errors
 */
export function fileToBase64(file: File): Promise<string> {
  return resizeImageForUpload(file);
}
