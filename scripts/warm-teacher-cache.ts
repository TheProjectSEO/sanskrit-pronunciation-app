/**
 * Pre-computes the cached teacher readings (literal transcript and judge reading) for
 * every published mantra and verse, so no learner waits for them on a first attempt.
 * Run: npx tsx --env-file=.env.local scripts/warm-teacher-cache.ts
 */
import { getServiceSupabase } from '../lib/supabase/service';
import { teacherJudge, teacherLiteral } from '../lib/pronunciation/reference';
import { splitWords } from '../lib/pronunciation/phonetic';

async function main() {
  const sb = getServiceSupabase();
  const { data: mantras } = await sb.from('mantras').select('id, name, reference_text_roman, reference_text_devanagari, reference_audio_url').eq('status', 'published');
  for (const m of mantras ?? []) {
    if (!m.reference_audio_url) continue;
    const targets: { label: string; roman: string; deva: string; verse: { start: number | null; end: number | null } | null }[] = [
      { label: 'full', roman: m.reference_text_roman, deva: m.reference_text_devanagari, verse: null },
    ];
    const { data: verses } = await sb.from('mantra_verses').select('verse_number, text_roman, text_devanagari, audio_start_time, audio_end_time').eq('mantra_id', m.id);
    for (const v of verses ?? []) {
      if (v.audio_start_time == null || v.audio_end_time == null) continue;
      targets.push({ label: `verse ${v.verse_number}`, roman: v.text_roman || m.reference_text_roman, deva: v.text_devanagari || m.reference_text_devanagari, verse: { start: v.audio_start_time, end: v.audio_end_time } });
    }
    for (const t of targets) {
      try {
        await teacherLiteral({ mantraId: m.id, audioUrl: m.reference_audio_url, verse: t.verse });
        const j = await teacherJudge({ mantraId: m.id, audioUrl: m.reference_audio_url, verse: t.verse, words: splitWords(t.roman), devanagari: t.deva });
        const habits = j?.words.filter((w) => w.status !== 'ok').map((w) => `${w.expected}→${w.heard}`) ?? [];
        console.log(`ok   ${m.name} (${t.label})${habits.length ? `  judge habits: ${habits.join(', ')}` : ''}`);
      } catch (e) {
        console.log(`FAIL ${m.name} (${t.label}): ${e instanceof Error ? e.message : e}`);
      }
    }
  }
}
main();
