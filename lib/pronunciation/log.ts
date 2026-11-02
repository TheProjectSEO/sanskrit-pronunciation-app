import type { SupabaseClient } from '@supabase/supabase-js';
import type { AttemptResult } from './types';

// pronunciation_logs predates user accounts: it has no user_id column, so the
// owner lives in metadata.user_id and is filtered with metadata->>user_id.
const OWNER = 'metadata->>user_id';

export async function attemptsToday(supabase: SupabaseClient, userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('pronunciation_logs')
    .select('id', { count: 'exact', head: true })
    .eq(OWNER, userId)
    .gte('created_at', new Date(Date.now() - 864e5).toISOString());
  if (error) {
    // Fail closed: if usage cannot be counted, treat the cap as reached.
    console.error('attempt count failed', error.message);
    return Number.POSITIVE_INFINITY;
  }
  return count ?? 0;
}

const VALIDATION: Record<AttemptResult['status'], string> = {
  ok: 'SAME_MANTRA',
  different_mantra: 'DIFFERENT_MANTRA',
  say_again: 'SAY_AGAIN',
};

/** Records one attempt and returns its id, or null if the insert failed. */
export async function logAttempt(
  supabase: SupabaseClient,
  a: { userId: string; mantraId: string | null; verseId?: string | null; kind: 'mantra' | 'word'; word?: string; result: AttemptResult; startedAt: number; audioBytes: number },
): Promise<string | null> {
  const r = a.result;
  const flagged = r.words.filter((w) => w.status !== 'ok');
  const { data, error } = await supabase
    .from('pronunciation_logs')
    .insert({
      session_id: `user:${a.userId}`,
      mantra_id: a.mantraId,
      request_timestamp: new Date(a.startedAt).toISOString(),
      response_timestamp: new Date().toISOString(),
      duration_ms: Date.now() - a.startedAt,
      score: r.status === 'ok' ? r.overall_score : null,
      success: true,
      audio_size_bytes: a.audioBytes,
      feedback_text: r.guru_line,
      word_with_error: r.focus?.word ?? flagged[0]?.word ?? null,
      user_transcription: r.user_transcription,
      validation_type: VALIDATION[r.status],
      is_valid_mantra: r.status !== 'different_mantra',
      metadata: {
        user_id: a.userId,
        pipeline: 'v2',
        kind: a.kind,
        word: a.word ?? null,
        verse_id: a.verseId || null,
        status: r.status,
        band: r.band,
        confidence: r.confidence,
        say_again_reason: r.say_again_reason ?? null,
        flagged: flagged.map((w) => ({ word: w.word, status: w.status, heard: w.heard, issue: w.issue })),
      },
    })
    .select('id')
    .single();
  if (error) {
    console.error('attempt log failed', error.message);
    return null;
  }
  return data.id as string;
}
