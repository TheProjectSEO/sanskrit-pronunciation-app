import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getServiceSupabase } from '@/lib/supabase/service';

/** The signed-in learner's practice, per mantra, plus this week's totals. */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ week: { attempts: 0, mantras: 0 }, mantras: [] });

  const sb = getServiceSupabase();
  const since = new Date(Date.now() - 90 * 864e5).toISOString();
  const { data: rows, error } = await sb
    .from('pronunciation_logs')
    .select('mantra_id, score, created_at')
    .eq('metadata->>user_id', userId)
    .eq('metadata->>kind', 'mantra')
    .eq('validation_type', 'SAME_MANTRA')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(2000);
  if (error) {
    console.error('progress summary failed', error.message);
    return NextResponse.json({ week: { attempts: 0, mantras: 0 }, mantras: [] });
  }

  const weekAgo = Date.now() - 7 * 864e5;
  const week = (rows ?? []).filter((r) => new Date(r.created_at).getTime() >= weekAgo);
  const per = new Map<string, { mantra_id: string; attempts: number; last: number; best: number; last_at: string }>();
  for (const r of rows ?? []) {
    const p = per.get(r.mantra_id);
    if (!p) per.set(r.mantra_id, { mantra_id: r.mantra_id, attempts: 1, last: r.score ?? 0, best: r.score ?? 0, last_at: r.created_at });
    else { p.attempts++; p.best = Math.max(p.best, r.score ?? 0); }
  }
  const ids = [...per.keys()];
  const { data: names } = ids.length ? await sb.from('mantras').select('id, name, reference_text_devanagari').in('id', ids) : { data: [] };
  const nameOf = new Map((names ?? []).map((m) => [m.id, m]));

  return NextResponse.json({
    week: { attempts: week.length, mantras: new Set(week.map((r) => r.mantra_id)).size },
    mantras: [...per.values()]
      .filter((p) => nameOf.has(p.mantra_id))
      .map((p) => ({ ...p, name: nameOf.get(p.mantra_id)!.name, devanagari: nameOf.get(p.mantra_id)!.reference_text_devanagari })),
  });
}
