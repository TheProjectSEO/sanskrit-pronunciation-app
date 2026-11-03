import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import { getServiceSupabase } from '@/lib/supabase/service';
import { forgetTeacherCache, teacherJudge, teacherJudgePath, teacherLiteral, teacherLiteralPath } from '@/lib/pronunciation/reference';
import { splitWords } from '@/lib/pronunciation/phonetic';

export const maxDuration = 120;

type Target = { label: string; roman: string; deva: string; verse: { start: number | null; end: number | null } | null };

async function targetsFor(sb: ReturnType<typeof getServiceSupabase>, m: { id: string; reference_text_roman: string; reference_text_devanagari: string }) {
  const out: Target[] = [{ label: 'Full mantra', roman: m.reference_text_roman, deva: m.reference_text_devanagari, verse: null }];
  const { data: verses } = await sb.from('mantra_verses').select('verse_number, text_roman, text_devanagari, audio_start_time, audio_end_time').eq('mantra_id', m.id).order('verse_number');
  for (const v of verses ?? []) {
    out.push({
      label: `Verse ${v.verse_number}`,
      roman: v.text_roman || m.reference_text_roman,
      deva: v.text_devanagari || m.reference_text_devanagari,
      verse: v.audio_start_time != null && v.audio_end_time != null ? { start: v.audio_start_time, end: v.audio_end_time } : null,
    });
  }
  return out;
}

/** Readiness of every library and draft mantra for pronunciation checking. */
export async function GET() {
  const g = await requireAdmin();
  if (g.error) return g.error;
  const sb = getServiceSupabase();
  const { data: mantras } = await sb.from('mantras').select('id, name, status, reference_audio_url, reference_text_roman, reference_text_devanagari').in('status', ['published', 'draft', 'submitted', 'private']).order('name');
  const { data: files } = await sb.storage.from('audio').list('ear-cache', { limit: 2000 });
  const have = new Set((files ?? []).map((f) => `ear-cache/${f.name}`));
  const { data: wordRows } = await sb.from('mantra_word_audio').select('mantra_id').in('mantra_id', (mantras ?? []).map((m) => m.id));
  const wordCount = new Map<string, number>();
  for (const r of wordRows ?? []) wordCount.set(r.mantra_id, (wordCount.get(r.mantra_id) ?? 0) + 1);

  const rows = [];
  for (const m of mantras ?? []) {
    const targets = await targetsFor(sb, m);
    const parts = targets.map((t) => {
      const judgePath = m.reference_audio_url ? teacherJudgePath({ mantraId: m.id, audioUrl: m.reference_audio_url, verse: t.verse, words: splitWords(t.roman) }) : '';
      return { label: t.label, timed: t.label === 'Full mantra' || !!t.verse, ready: !!judgePath && have.has(judgePath) };
    });
    rows.push({
      id: m.id, name: m.name, status: m.status,
      has_audio: !!m.reference_audio_url,
      words: splitWords(m.reference_text_roman).length,
      word_timings: wordCount.get(m.id) ?? 0,
      teacher_literal: !!m.reference_audio_url && have.has(teacherLiteralPath(m.id, m.reference_audio_url)),
      parts,
    });
  }
  return NextResponse.json({ mantras: rows });
}

/** Prepares (or with force, re-does) the teacher readings for one mantra and its verses. */
export async function POST(request: NextRequest) {
  const g = await requireAdmin();
  if (g.error) return g.error;
  const { mantra_id, force } = await request.json().catch(() => ({}));
  const sb = getServiceSupabase();
  const { data: m } = await sb.from('mantras').select('id, name, reference_audio_url, reference_text_roman, reference_text_devanagari').eq('id', mantra_id).single();
  if (!m?.reference_audio_url) return NextResponse.json({ error: 'This mantra has no teacher recording.' }, { status: 400 });

  const targets = await targetsFor(sb, m);
  if (force) {
    const paths = [teacherLiteralPath(m.id, m.reference_audio_url), ...targets.map((t) => teacherJudgePath({ mantraId: m.id, audioUrl: m.reference_audio_url, verse: t.verse, words: splitWords(t.roman) }))];
    await sb.storage.from('audio').remove(paths);
    forgetTeacherCache(paths);
  }
  const results = [];
  for (const t of targets) {
    try {
      await teacherLiteral({ mantraId: m.id, audioUrl: m.reference_audio_url, verse: t.verse });
      const j = await teacherJudge({ mantraId: m.id, audioUrl: m.reference_audio_url, verse: t.verse, words: splitWords(t.roman), devanagari: t.deva });
      results.push({ label: t.label, ok: true, habits: (j?.words ?? []).filter((w) => w.status !== 'ok').map((w) => `${w.expected} → ${w.heard}`) });
    } catch (e) {
      results.push({ label: t.label, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return NextResponse.json({ results });
}
