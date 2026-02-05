/**
 * Auth helpers for API routes
 */

import { getServerSession } from 'next-auth';
import { authOptions } from './auth';

/**
 * Require SUPER_ADMIN role for admin panel APIs
 * Returns session if user is SUPER_ADMIN, null otherwise
 */
export async function requireSuperAdmin() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return null;
  }

  if (session.user.role !== 'SUPER_ADMIN') {
    return null;
  }

  return session;
}

/**
 * Require authentication (any role)
 * Returns session if user is authenticated, null otherwise
 */
export async function requireAuth() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return null;
  }

  return session;
}

/**
 * Require ADMIN or SUPER_ADMIN role
 * Returns session if user is admin, null otherwise
 */
export async function requireAdmin() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return null;
  }

  const role = session.user.role;
  if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
    return null;
  }

  return session;
}
