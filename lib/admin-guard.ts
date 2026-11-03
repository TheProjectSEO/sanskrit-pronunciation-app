import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin, isSuperAdmin } from './roles';

/** Returns the session for an admin, or a ready 401/403 response. */
export async function requireAdmin(superOnly = false) {
  const session = await auth();
  if (!session?.user?.id) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } as const;
  const ok = superOnly ? isSuperAdmin(session.user.role) : isAdmin(session.user.role);
  if (!ok) return { error: NextResponse.json({ error: superOnly ? 'Super admin only' : 'Admin only' }, { status: 403 }) } as const;
  return { session } as const;
}
