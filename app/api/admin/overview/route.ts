import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import { getServiceSupabase } from '@/lib/supabase/service';

/** Counts for the admin home. */
export async function GET() {
  const g = await requireAdmin();
  if (g.error) return g.error;
  const sb = getServiceSupabase();
  const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
  const head = { count: 'exact' as const, head: true };
  const [published, drafts, submitted, userPrivate, users, week] = await Promise.all([
    count(sb.from('mantras').select('id', head).eq('status', 'published')),
    count(sb.from('mantras').select('id', head).eq('status', 'draft')),
    count(sb.from('mantras').select('id', head).eq('status', 'submitted')),
    count(sb.from('mantras').select('id', head).eq('status', 'private')),
    count(sb.from('users').select('id', head)),
    count(sb.from('pronunciation_logs').select('id', head).eq('metadata->>pipeline', 'v2').gte('created_at', new Date(Date.now() - 7 * 864e5).toISOString())),
  ]);
  const flagged = await count(sb.from('pronunciation_logs').select('id', head).eq('metadata->>user_verdict', 'wrong'));
  return NextResponse.json({ published, drafts, submitted, userPrivate, users, attemptsThisWeek: week, flaggedWrong: flagged });
}
