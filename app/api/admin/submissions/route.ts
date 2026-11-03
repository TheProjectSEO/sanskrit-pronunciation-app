import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import { getServiceSupabase } from '@/lib/supabase/service';

const STATUSES = ['submitted', 'private', 'rejected'];

/** User recordings, newest first. ?status=submitted (default) | private | rejected */
export async function GET(request: NextRequest) {
  const g = await requireAdmin();
  if (g.error) return g.error;
  const status = request.nextUrl.searchParams.get('status') || 'submitted';
  if (!STATUSES.includes(status)) return NextResponse.json({ error: 'Bad status' }, { status: 400 });
  const sb = getServiceSupabase();
  const { data: mantras } = await sb
    .from('mantras')
    .select('id, name, status, created_by, reference_text_devanagari, reference_text_roman, reference_audio_url, deity_id, category, created_at, updated_at')
    .eq('status', status)
    .order('updated_at', { ascending: false })
    .limit(200);
  const owners = [...new Set((mantras ?? []).map((m) => m.created_by).filter(Boolean))];
  const { data: users } = owners.length ? await sb.from('users').select('id, email, name, first_name, last_name').in('id', owners) : { data: [] };
  const byId = new Map((users ?? []).map((u) => [u.id, u]));
  return NextResponse.json({
    mantras: (mantras ?? []).map((m) => {
      const u = byId.get(m.created_by);
      return { ...m, owner_email: u?.email ?? null, owner_name: u?.name || [u?.first_name, u?.last_name].filter(Boolean).join(' ') || null };
    }),
  });
}

/** Approve into the library (optionally fixing text, category, deity) or reject. */
export async function PATCH(request: NextRequest) {
  const g = await requireAdmin();
  if (g.error) return g.error;
  const body = await request.json().catch(() => ({}));
  const { id, action } = body as { id?: string; action?: string };
  if (!id || !['approve', 'reject', 'reopen'].includes(action ?? '')) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  const sb = getServiceSupabase();
  const { data: m } = await sb.from('mantras').select('id, status').eq('id', id).single();
  if (!m || !STATUSES.includes(m.status)) return NextResponse.json({ error: 'Not a user recording' }, { status: 404 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (action === 'approve') {
    patch.status = 'published';
    patch.published_at = new Date().toISOString();
    for (const k of ['name', 'reference_text_devanagari', 'reference_text_roman', 'category', 'deity_id'] as const) {
      if (typeof body[k] === 'string') patch[k] = body[k].trim() || null;
    }
    if (patch.reference_text_roman) patch.text_latin = patch.reference_text_roman;
    if (patch.reference_text_devanagari) patch.text_devanagari = patch.reference_text_devanagari;
  } else {
    patch.status = action === 'reject' ? 'rejected' : 'submitted';
  }
  const { error } = await sb.from('mantras').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, status: patch.status });
}
