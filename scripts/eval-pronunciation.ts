/**
 * Pronunciation eval harness. Runs the production pipeline on labelled clips and
 * reports agreement with the labels.
 *   npx tsx --env-file=.env.local scripts/eval-pronunciation.ts [--tag name]
 * Clips: docs/eval/manifest.json (16 kHz mono WAV). Results: docs/eval/results/<tag>.json
 * Labels: good | partial (error_words lists the words that are wrong) | different
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { getServiceSupabase } from '../lib/supabase/service';
import { analyzeAttempt } from '../lib/pronunciation/analyze';
import { teacherLiteral } from '../lib/pronunciation/reference';

interface Clip { clip: string; mantra_id: string; label: 'good' | 'partial' | 'different'; error_words: string[]; note: string }

const ROOT = join(process.cwd(), 'docs/eval');
const tag = process.argv.includes('--tag') ? process.argv[process.argv.indexOf('--tag') + 1] : new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');

async function main() {
  const clips: Clip[] = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));
  const sb = getServiceSupabase();
  const rows = [];
  let verdictOk = 0, tp = 0, fp = 0, fn = 0, sayAgain = 0, ms = 0;

  for (const c of clips) {
    const { data: m } = await sb.from('mantras').select('reference_text_roman, reference_text_devanagari, reference_audio_url').eq('id', c.mantra_id).single();
    if (!m) { console.log('missing mantra', c.mantra_id); continue; }
    const t0 = Date.now();
    const teacher = await teacherLiteral({ mantraId: c.mantra_id, audioUrl: m.reference_audio_url });
    const r = await analyzeAttempt({ wav: readFileSync(join(ROOT, c.clip)), romanText: m.reference_text_roman, devanagariText: m.reference_text_devanagari, teacherLiteral: teacher, feedbackLanguage: 'english' });
    const dt = Date.now() - t0; ms += dt;

    const flagged = r.words.filter((w) => w.status !== 'ok').map((w) => w.word);
    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
    const want = new Set(c.error_words.map(norm));
    const got = new Set(flagged.map(norm));
    const _tp = [...got].filter((w) => want.has(w)).length;
    tp += _tp; fp += got.size - _tp; fn += [...want].filter((w) => !got.has(w)).length;

    let verdict: string = r.status === 'different_mantra' ? 'different' : r.status === 'say_again' ? 'say_again' : flagged.length ? 'partial' : 'good';
    if (r.status === 'say_again') sayAgain++;
    const pass = verdict === c.label;
    if (pass) verdictOk++;
    rows.push({ ...c, verdict, pass, status: r.status, band: r.band, score: r.overall_score, confidence: r.confidence, flagged, heard: r.user_transcription, guru: r.guru_line, ms: dt });
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${c.clip.padEnd(38)} label=${c.label.padEnd(9)} got=${verdict.padEnd(9)} conf=${r.confidence} flagged=[${flagged.join(', ')}] ${dt}ms`);
    if (r.guru_line) console.log(`      guru: ${r.guru_line}`);
  }

  const precision = tp + fp ? tp / (tp + fp) : 1;
  const recall = tp + fn ? tp / (tp + fn) : 1;
  const summary = { tag, clips: rows.length, verdict_agreement: +(verdictOk / rows.length).toFixed(3), error_precision: +precision.toFixed(3), error_recall: +recall.toFixed(3), say_again_rate: +(sayAgain / rows.length).toFixed(3), avg_ms: Math.round(ms / rows.length) };
  console.log('\n', summary);
  mkdirSync(join(ROOT, 'results'), { recursive: true });
  writeFileSync(join(ROOT, 'results', `${tag}.json`), JSON.stringify({ summary, rows }, null, 1));
}
main().catch((e) => { console.error(e); process.exit(1); });
