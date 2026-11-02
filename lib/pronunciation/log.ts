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

// validation_type has a check constraint (SAME_MANTRA, DIFFERENT_MANTRA, GIBBERISH,
// PARTIAL). The exact status lives in metadata.status; pending and failed rows leave it null.
const VALIDATION: Record<AttemptResult['status'], string> = {
  ok: 'SAME_MANTRA',
  different_mantra: 'DIFFERENT_MANTRA',
  say_again: 'GIBBERISH',
};

/**
 * Claims one of today's attempts before any model is called, so parallel requests
 * cannot all pass the cap check. Returns the row id, or null when the cap is reached
 * (or the slot could not be claimed).
 */
export async function reserveAttempt(
  supabase: SupabaseClient,
  a: { userId: string; mantraId: string | null; kind: 'mantra' | 'word'; cap: number },
): Promise<string | null> {
  const { data, error } = await supabase
    .from('pronunciation_logs')
    .insert({
      session_id: `user:${a.userId}`,
      mantra_id: a.mantraId ?? 'unknown', // column is NOT NULL
      request_timestamp: new Date().toISOString(),
      success: false,
      metadata: { user_id: a.userId, pipeline: 'v2', kind: a.kind },
    })
    .select('id, created_at')
    .single();
  if (error || !data) {
    console.error('attempt reserve failed', error?.message);
    return null;
  }
  // Count today's rows up to and including this one: every in-flight request is
  // seen, and when several arrive together the earliest ones keep their slot.
  const { count, error: countError } = await supabase
    .from('pronunciation_logs')
    .select('id', { count: 'exact', head: true })
    .eq(OWNER, a.userId)
    .gte('created_at', new Date(Date.now() - 864e5).toISOString())
    .lte('created_at', data.created_at);
  if (countError || (count ?? 0) > a.cap) {
    await supabase.from('pronunciation_logs').delete().eq('id', data.id);
    return null;
  }
  return data.id as string;
}

/** Fills in a reserved attempt with its result. A failed analysis keeps the row, so it still counts. */
export async function finishAttempt(
  supabase: SupabaseClient,
  id: string,
  a: { userId: string; verseId?: string | null; kind: 'mantra' | 'word'; word?: string; result: AttemptResult | null; startedAt: number; audioBytes: number; error?: string },
): Promise<void> {
  const r = a.result;
  const flagged = r ? r.words.filter((w) => w.status !== 'ok') : [];
  const { error } = await supabase
    .from('pronunciation_logs')
    .update({
      response_timestamp: new Date().toISOString(),
      duration_ms: Date.now() - a.startedAt,
      audio_size_bytes: a.audioBytes,
      success: !!r,
      error_message: a.error ?? null,
      score: r && r.status === 'ok' ? r.overall_score : null,
      feedback_text: r?.guru_line ?? null,
      word_with_error: r ? (r.focus?.word ?? flagged[0]?.word ?? null) : null,
      user_transcription: r?.user_transcription ?? null,
      validation_type: r ? VALIDATION[r.status] : null,
      is_valid_mantra: r ? r.status !== 'different_mantra' : null,
      metadata: {
        user_id: a.userId,
        pipeline: 'v2',
        kind: a.kind,
        word: a.word ?? null,
        verse_id: a.verseId || null,
        status: r?.status ?? 'error',
        band: r?.band ?? null,
        confidence: r?.confidence ?? null,
        say_again_reason: r?.say_again_reason ?? null,
        flagged: flagged.map((w) => ({ word: w.word, status: w.status, heard: w.heard, issue: w.issue })),
      },
    })
    .eq('id', id);
  if (error) console.error('attempt finish failed', error.message);
}
