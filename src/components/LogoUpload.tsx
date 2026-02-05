/**
 * LogoUpload Component
 * Reusable component for uploading organization and token logos
 * Sprint 4.9: Sistema de logos
 */

'use client';

import { useState, useRef } from 'react';
import { validateImageFile, fileToBase64 } from '@/lib/cloudinary';

interface LogoUploadProps {
  type: 'organization' | 'token';
  currentLogoUrl?: string | null;
  name: string; // Organization or token name for fallback initials
  tokenId?: string; // Required for token uploads
  onUploadSuccess?: (logoUrl: string) => void;
  onDeleteSuccess?: () => void;
}

export default function LogoUpload({
  type,
  currentLogoUrl,
  name,
  tokenId,
  onUploadSuccess,
  onDeleteSuccess
}: LogoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(currentLogoUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate initials from name
  const getInitials = (text: string): string => {
    const words = text.trim().split(/\s+/);
    if (words.length === 1) {
      return words[0].substring(0, 2).toUpperCase();
    }
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Validate file
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setError(validation.error || 'Invalid file');
      return;
    }

    try {
      // Show preview
      const base64 = await fileToBase64(file);
      setPreview(base64);

      // Upload to server
      setUploading(true);
      const endpoint = type === 'organization'
        ? '/api/upload/organization-logo'
        : `/api/upload/token-logo?tokenId=${tokenId}`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 })
      });

      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response:', text.slice(0, 200));
        if (response.status === 401) {
          throw new Error('Sesión expirada. Inicia sesión de nuevo.');
        }
        throw new Error('Error del servidor. Intenta más tarde.');
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      // Success
      setPreview(data.logoUrl);
      onUploadSuccess?.(data.logoUrl);

    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
      setPreview(currentLogoUrl || null);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!preview) return;

    try {
      setDeleting(true);
      setError(null);

      const endpoint = type === 'organization'
        ? '/api/upload/organization-logo'
        : `/api/upload/token-logo?tokenId=${tokenId}`;

      const response = await fetch(endpoint, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          const data = await response.json();
          throw new Error(data.error || 'Delete failed');
        }
        if (response.status === 401) {
          throw new Error('Sesión expirada. Inicia sesión de nuevo.');
        }
        throw new Error('Error del servidor. Intenta más tarde.');
      }

      // Success
      setPreview(null);
      onDeleteSuccess?.();

    } catch (err) {
      console.error('Delete error:', err);
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const initials = getInitials(name);

  return (
    <div className="space-y-4">
      {/* Logo Display */}
      <div className="flex items-center space-x-4">
        {/* Avatar */}
        <div className="relative">
          {preview ? (
            <img
              src={preview}
              alt={name}
              className="w-20 h-20 rounded-full object-cover border-2 border-gray-300 dark:border-gray-600"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center border-2 border-gray-300 dark:border-gray-600">
              <span className="text-2xl font-bold text-white">{initials}</span>
            </div>
          )}

          {/* Loading overlay */}
          {(uploading || deleting) && (
            <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col space-y-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || deleting}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {preview ? 'Change Logo' : 'Upload Logo'}
          </button>

          {preview && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={uploading || deleting}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Remove Logo
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      </div>

      {/* Helper text */}
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Recommended: Square image, at least 200x200px. Max 5MB.
        <br />
        Supported formats: JPEG, PNG, GIF, WebP
      </p>

      {/* Error message */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Success message */}
      {uploading && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-blue-600 dark:text-blue-400">Uploading...</p>
        </div>
      )}
    </div>
  );
}
