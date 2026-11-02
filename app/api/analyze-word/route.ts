import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getServiceSupabase } from '@/lib/supabase/service';
import { analyzeAttempt } from '@/lib/pronunciation/analyze';
import { finishAttempt, reserveAttempt } from '@/lib/pronunciation/log';
import { legacyAnalyzeWord } from '@/lib/pronunciation/legacy-word';

export const maxDuration = 60;
const DAILY_CAP = Number(process.env.PRON_DAILY_ATTEMPT_CAP || 80);

export async function POST(request: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
  // Rollback switch to the old pipeline; still requires a signed-in user.
  if (process.env.PRON_PIPELINE === 'v1') return legacyAnalyzeWord(request);

  const form = await request.formData();
  const audio = form.get('audio') as File | null;
  const roman = String(form.get('reference_word') || '').trim();
  const devanagari = String(form.get('reference_word_devanagari') || roman).trim();
  const mantraId = String(form.get('mantra_id') || '') || null;
  const lang = String(form.get('feedback_language') || 'hindi');

  if (!audio || !roman) return NextResponse.json({ error: 'Recording or word missing.' }, { status: 400 });
  // The current client always sends WAV; anything else is an outdated client.
  if (!(audio.type || '').includes('wav')) {
    return NextResponse.json({ error: 'Please refresh the app to get the latest version.' }, { status: 426 });
  }
  if (audio.size > 8 * 16000 * 2 + 1024) return NextResponse.json({ error: 'Say just the one word.' }, { status: 413 });

  const supabase = getServiceSupabase();
  const attemptId = await reserveAttempt(supabase, { userId, mantraId, kind: 'word', cap: DAILY_CAP });
  if (!attemptId) {
    return NextResponse.json({ error: 'You have practised a lot today. Rest, and continue tomorrow.' }, { status: 429 });
  }

  const startedAt = Date.now();
  try {
    const result = await analyzeAttempt({
      wav: Buffer.from(await audio.arrayBuffer()),
      romanText: roman,
      devanagariText: devanagari,
      teacherLiteral: null,
      feedbackLanguage: lang,
    });
    await finishAttempt(supabase, attemptId, { userId, kind: 'word', word: roman, result, startedAt, audioBytes: audio.size });
    return NextResponse.json(result);
  } catch (e) {
    console.error('analyze-word v2 failed', e);
    await finishAttempt(supabase, attemptId, { userId, kind: 'word', word: roman, result: null, startedAt, audioBytes: audio.size, error: String(e).slice(0, 300) });
    return NextResponse.json({ error: 'We could not listen to that recording. Please try once more.' }, { status: 502 });
  }
}
