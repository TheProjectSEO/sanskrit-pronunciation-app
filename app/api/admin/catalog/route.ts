import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import { getServiceSupabase } from '@/lib/supabase/service';

/** Every mantra in any state, with its owner, for the Check screen. */
export async function GET() {
  const g = await requireAdmin();
  if (g.error) return g.error;
  const sb = getServiceSupabase();
  const { data: mantras } = await sb.from('mantras').select('id, name, status, created_by, reference_text_devanagari, created_at').order('name');
  const owners = [...new Set((mantras ?? []).map((m) => m.created_by).filter(Boolean))];
  const { data: users } = owners.length ? await sb.from('users').select('id, email, role').in('id', owners) : { data: [] };
  const byId = new Map((users ?? []).map((u) => [u.id, u]));
  return NextResponse.json({
    mantras: (mantras ?? []).map((m) => ({ ...m, owner_email: byId.get(m.created_by)?.email ?? null, owner_role: byId.get(m.created_by)?.role ?? null })),
  });
}
