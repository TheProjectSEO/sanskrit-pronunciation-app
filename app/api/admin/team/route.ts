import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import { getServiceSupabase } from '@/lib/supabase/service';

const ASSIGNABLE = ['user', 'admin', 'super_admin'];

/** Admins and super admins. Any admin can view; only super admins can change roles. */
export async function GET() {
  const g = await requireAdmin();
  if (g.error) return g.error;
  const { data } = await getServiceSupabase().from('users').select('id, email, name, first_name, last_name, role, created_at, last_login_at').in('role', ['admin', 'super_admin', 'instructor']).order('created_at');
  return NextResponse.json({ team: data ?? [] });
}

/** Give an existing account a role, found by email. */
export async function POST(request: NextRequest) {
  const g = await requireAdmin(true);
  if (g.error) return g.error;
  const { email, role } = await request.json().catch(() => ({}));
  if (!email || !ASSIGNABLE.includes(role)) return NextResponse.json({ error: 'Email and role are required.' }, { status: 400 });
  const sb = getServiceSupabase();
  const { data: u } = await sb.from('users').select('id, role').ilike('email', String(email).trim()).maybeSingle();
  if (!u) return NextResponse.json({ error: 'No account with that email. Ask them to sign up first, then add them here.' }, { status: 404 });
  return setRole(sb, g.session.user.id, u.id, role);
}

/** Change or remove someone's role. */
export async function PATCH(request: NextRequest) {
  const g = await requireAdmin(true);
  if (g.error) return g.error;
  const { user_id, role } = await request.json().catch(() => ({}));
  if (!user_id || !ASSIGNABLE.includes(role)) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  return setRole(getServiceSupabase(), g.session.user.id, user_id, role);
}

async function setRole(sb: ReturnType<typeof getServiceSupabase>, actorId: string, userId: string, role: string) {
  if (userId === actorId && role !== 'super_admin') {
    return NextResponse.json({ error: 'You cannot lower your own role. Ask another super admin.' }, { status: 400 });
  }
  const { data: current } = await sb.from('users').select('role').eq('id', userId).single();
  if (current?.role === 'super_admin' && role !== 'super_admin') {
    const { count } = await sb.from('users').select('id', { count: 'exact', head: true }).eq('role', 'super_admin');
    if ((count ?? 0) <= 1) return NextResponse.json({ error: 'There must always be at least one super admin.' }, { status: 400 });
  }
  const { error } = await sb.from('users').update({ role, updated_at: new Date().toISOString() }).eq('id', userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
