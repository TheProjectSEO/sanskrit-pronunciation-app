import { isAdmin } from './roles';

/**
 * Mantra visibility.
 * - published: in the library, anyone can practise.
 * - private / submitted: a user's own recording; anyone signed in with the link can
 *   practise it (the id is the share link). `submitted` is waiting for admin review.
 * - rejected: only the owner and admins.
 * - draft: admins only (teacher work in progress).
 */
export const LIBRARY = 'published';
export const UGC_STATUSES = ['private', 'submitted', 'rejected'] as const;
export const ADMIN_STATUSES = ['draft', 'published'] as const;

export function canPractise(m: { status: string; created_by?: string | null }, user?: { id?: string; role?: string } | null): boolean {
  if (m.status === 'published' || m.status === 'private' || m.status === 'submitted') return true;
  if (isAdmin(user?.role)) return true;
  if (m.status === 'rejected') return !!user?.id && m.created_by === user.id;
  return false;
}
