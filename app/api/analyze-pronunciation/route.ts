import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getServiceSupabase } from '@/lib/supabase/service';
import { analyzeAttempt } from '@/lib/pronunciation/analyze';
import { teacherLiteral } from '@/lib/pronunciation/reference';
import { legacyAnalyze } from '@/lib/pronunciation/legacy';
import { attemptsToday, logAttempt } from '@/lib/pronunciation/log';

export const maxDuration = 60;

const DAILY_CAP = Number(process.env.PRON_DAILY_ATTEMPT_CAP || 80);
const MAX_BYTES = 25 * 16000 * 2 + 1024; // 25 s of 16 kHz mono 16-bit PCM

export async function POST(request: NextRequest) {
  if (process.env.PRON_PIPELINE === 'v1') return legacyAnalyze(request);

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });

  const form = await request.formData();
  const audio = form.get('audio') as File | null;
  const mantraId = String(form.get('mantra_id') || '');
  const verseId = String(form.get('verse_id') || '');
  const feedbackLanguage = String(form.get('feedback_language') || 'hindi');

  if (!audio || !mantraId) {
    return NextResponse.json({ error: 'Recording or mantra missing.' }, { status: 400 });
  }
  if (!(audio.type || '').includes('wav')) {
    // Older client still sending webm: serve it with the legacy pipeline.
    const legacyForm = new FormData();
    for (const [k, v] of form.entries()) legacyForm.append(k, v);
    return legacyAnalyze(new NextRequest(request.url, { method: 'POST', body: legacyForm }));
  }
  if (audio.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Recording is too long. Keep it under 20 seconds.' }, { status: 413 });
  }

  const supabase = getServiceSupabase();
  if ((await attemptsToday(supabase, userId)) >= DAILY_CAP) {
    return NextResponse.json({ error: 'You have practised a lot today. Rest, and continue tomorrow.' }, { status: 429 });
  }

  const { data: mantra } = await supabase
    .from('mantras')
    .select('id, reference_text_roman, reference_text_devanagari, reference_audio_url, status')
    .eq('id', mantraId)
    .single();
  if (!mantra) return NextResponse.json({ error: 'Mantra not found.' }, { status: 404 });

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

  const startedAt = Date.now();
  try {
    const wav = Buffer.from(await audio.arrayBuffer());
    const teacher = await teacherLiteral({ mantraId, audioUrl: mantra.reference_audio_url, verse }).catch((e) => {
      console.error('teacher literal failed', e);
      return null;
    });
    const result = await analyzeAttempt({ wav, romanText: roman, devanagariText: devanagari, teacherLiteral: teacher, feedbackLanguage });

    const logId = await logAttempt(supabase, { userId, mantraId, verseId, kind: 'mantra', result, startedAt, audioBytes: wav.length });
    return NextResponse.json({ ...result, log_id: logId });
  } catch (e) {
    console.error('analyze v2 failed', e);
    return NextResponse.json({ error: 'We could not listen to that recording. Please try once more.' }, { status: 502 });
  }
}
