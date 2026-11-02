import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getServiceSupabase } from '@/lib/supabase/service';

/** The learner's scored attempts on one mantra (or one verse), oldest first. */
export async function GET(request: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ attempts: [] });

  const mantraId = request.nextUrl.searchParams.get('mantra_id');
  const verseId = request.nextUrl.searchParams.get('verse_id');
  if (!mantraId) return NextResponse.json({ error: 'mantra_id required' }, { status: 400 });

  let q = getServiceSupabase()
    .from('pronunciation_logs')
    .select('created_at, score')
    .eq('metadata->>user_id', userId)
    .eq('metadata->>kind', 'mantra')
    .eq('mantra_id', mantraId)
    .eq('validation_type', 'SAME_MANTRA')
    .not('score', 'is', null)
    .order('created_at', { ascending: false })
    .limit(60);
  q = verseId ? q.eq('metadata->>verse_id', verseId) : q.is('metadata->>verse_id', null);

  const { data, error } = await q;
  if (error) {
    console.error('progress query failed', error.message);
    return NextResponse.json({ attempts: [] });
  }
  return NextResponse.json({ attempts: (data ?? []).reverse().map((r) => ({ at: r.created_at, score: r.score as number })) });
}
