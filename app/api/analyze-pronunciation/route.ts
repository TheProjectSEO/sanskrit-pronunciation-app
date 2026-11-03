import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getServiceSupabase } from '@/lib/supabase/service';
import { analyzeAttempt } from '@/lib/pronunciation/analyze';
import { teacherJudge, teacherLiteral } from '@/lib/pronunciation/reference';
import { splitWords } from '@/lib/pronunciation/phonetic';
import { canPractise } from '@/lib/mantra-access';
import { isAdmin } from '@/lib/roles';
import { legacyAnalyze } from '@/lib/pronunciation/legacy';
import { finishAttempt, reserveAttempt } from '@/lib/pronunciation/log';
import type { AttemptResult } from '@/lib/pronunciation/types';

export const maxDuration = 60;

const DAILY_CAP = Number(process.env.PRON_DAILY_ATTEMPT_CAP || 80);
const MAX_BYTES = 25 * 16000 * 2 + 1024; // 25 s of 16 kHz mono 16-bit PCM

export async function POST(request: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
  // Rollback switch to the old pipeline; still requires a signed-in user.
  if (process.env.PRON_PIPELINE === 'v1') return legacyAnalyze(request);

  const form = await request.formData();
  const audio = form.get('audio') as File | null;
  const mantraId = String(form.get('mantra_id') || '');
  const verseId = String(form.get('verse_id') || '');
  const feedbackLanguage = String(form.get('feedback_language') || 'hindi');

  if (!audio || !mantraId) {
    return NextResponse.json({ error: 'Recording or mantra missing.' }, { status: 400 });
  }
  // The current client always sends WAV; anything else is an outdated client.
  if (!(audio.type || '').includes('wav')) {
    return NextResponse.json({ error: 'Please refresh the app to get the latest version.' }, { status: 426 });
  }
  if (audio.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Recording is too long. Keep it under 20 seconds.' }, { status: 413 });
  }

  const supabase = getServiceSupabase();
  const { data: mantra } = await supabase
    .from('mantras')
    .select('id, reference_text_roman, reference_text_devanagari, reference_audio_url, status, created_by')
    .eq('id', mantraId)
    .single();
  if (!mantra || !canPractise(mantra, session?.user)) {
    return NextResponse.json({ error: 'Mantra not found.' }, { status: 404 });
  }

  let roman = mantra.reference_text_roman as string;
  let devanagari = mantra.reference_text_devanagari as string;
  let verse: { start: number | null; end: number | null } | null = null;
  if (verseId) {
    const { data: v } = await supabase
      .from('mantra_verses')
      .select('text_roman, text_devanagari, audio_start_time, audio_end_time')
      .eq('id', verseId)
      .eq('mantra_id', mantraId)
      .single();
    if (v) {
      roman = v.text_roman || roman;
      devanagari = v.text_devanagari || devanagari;
      verse = { start: v.audio_start_time, end: v.audio_end_time };
    }
  }

  const attemptId = await reserveAttempt(supabase, { userId, mantraId, kind: 'mantra', cap: DAILY_CAP });
  if (!attemptId) {
    return NextResponse.json({ error: 'You have practised a lot today. Rest, and continue tomorrow.' }, { status: 429 });
  }

  const startedAt = Date.now();
  const wav = Buffer.from(await audio.arrayBuffer());
  const admin = isAdmin(session?.user?.role);
  const strip = (r: AttemptResult) => {
    const { debug, ...pub } = r;
    return { ...pub, log_id: attemptId, ...(admin ? { debug } : {}) };
  };

  const teacherArgs = {
    teacherLiteral: teacherLiteral({ mantraId, audioUrl: mantra.reference_audio_url, verse }).catch((e) => {
      console.error('teacher literal failed', e);
      return null;
    }),
    teacherJudge: teacherJudge({ mantraId, audioUrl: mantra.reference_audio_url, verse, words: splitWords(roman), devanagari }).catch((e) => {
      console.error('teacher judge failed', e);
      return null;
    }),
  };
  const failed = async (e: unknown) => {
    console.error('analyze v2 failed', e);
    await finishAttempt(supabase, attemptId, { userId, verseId, kind: 'mantra', result: null, startedAt, audioBytes: audio.size, error: String(e).slice(0, 300) });
  };
  const sorry = 'We could not listen to that recording. Please try once more.';

  // A page loaded before the streaming update expects one JSON reply; only pages that
  // ask for NDJSON get the step-by-step stream. (Tabs left open across a deploy.)
  if (!(request.headers.get('accept') || '').includes('application/x-ndjson')) {
    try {
      const result = await analyzeAttempt({ wav, romanText: roman, devanagariText: devanagari, ...teacherArgs, feedbackLanguage });
      await finishAttempt(supabase, attemptId, { userId, verseId, kind: 'mantra', result, startedAt, audioBytes: wav.length });
      return NextResponse.json(strip(result));
    } catch (e) {
      await failed(e);
      return NextResponse.json({ error: sorry }, { status: 502 });
    }
  }

  // NDJSON, one message per line, so the learner sees real progress:
  //   {stage:'listening'} -> {type:'scored', result} (words judged) -> {type:'done', result} (with the guru's line)
  // Errors after this point arrive in-band as {type:'error'}, because the 200 status is already sent.
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (msg: unknown) => controller.enqueue(enc.encode(JSON.stringify(msg) + '\n'));
      send({ type: 'stage', stage: 'listening' });
      try {
        const result = await analyzeAttempt({
          wav,
          romanText: roman,
          devanagariText: devanagari,
          // Passed as promises: the teacher cache loads while the ears are already listening.
          ...teacherArgs,
          feedbackLanguage,
          onScored: (partial) => send({ type: 'scored', result: strip(partial) }),
        });
        await finishAttempt(supabase, attemptId, { userId, verseId, kind: 'mantra', result, startedAt, audioBytes: wav.length });
        send({ type: 'done', result: strip(result) });
      } catch (e) {
        await failed(e);
        send({ type: 'error', error: sorry });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' } });
}
