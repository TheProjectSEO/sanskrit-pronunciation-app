/**
 * Re-cuts the teacher's per-word clips (mantra_word_audio) so tapping a word plays only
 * that word. A forced aligner (Meta MMS, scripts/align/mms_align.py, run in .venv-align)
 * finds each word of the known text in the recording; cuts go at the quietest point
 * between two words and clips are trimmed to the voice (lib/audio/word-split.ts).
 * Mantras with any teacher-verified row are left alone.
 *
 * One-time setup:  python3 -m venv .venv-align && .venv-align/bin/pip install torch==2.6.0 torchaudio==2.6.0 numpy
 *
 *   npx tsx --env-file=.env.local scripts/realign-word-audio.ts            # dry run, prints old vs new
 *   npx tsx --env-file=.env.local scripts/realign-word-audio.ts --audit    # also has the judge ear listen to every clip
 *   npx tsx --env-file=.env.local scripts/realign-word-audio.ts --write    # saves (backup in docs/eval/results/)
 *   --only <mantra id>   limit to one mantra
 */
import { mkdirSync, writeFileSync } from 'fs';
import { spawn } from 'child_process';
import { createInterface } from 'readline';
import { tmpdir } from 'os';
import { join } from 'path';
import { getServiceSupabase } from '../lib/supabase/service';
import { toPcm } from '../lib/pronunciation/reference';
import { splitWords } from '../lib/pronunciation/phonetic';
import { alignWords, pcmSamples, projectRough, type Span } from '../lib/audio/word-split';
import { openai, MODELS } from '../lib/pronunciation/openai';
import { transliterate } from '../lib/pronunciation/transliterate';

const args = process.argv.slice(2);
const WRITE = args.includes('--write');
const AUDIT = args.includes('--audit');
const ONLY = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;

function wav(pcm: Int16Array, span: Span): string {
  const a = Math.max(0, Math.floor(span.start * 16000));
  const b = Math.min(pcm.length, Math.ceil(span.end * 16000));
  const data = Buffer.from(pcm.slice(a, b).buffer);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(16000, 24);
  h.writeUInt32LE(32000, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]).toString('base64');
}

/** What the judge ear hears in one clip, in IAST, uncorrected. */
async function hear(b64: string, expected: string): Promise<string> {
  const res = await openai().chat.completions.create({
    model: MODELS.judge,
    modalities: ['text'],
    temperature: 0,
    messages: [
      { role: 'system', content: 'You transcribe short Sanskrit audio clips syllable by syllable. Report only what is audible, including partial syllables at the start or end. Never complete or correct a word.' },
      { role: 'user', content: [
        { type: 'text', text: `This clip should contain only the word "${expected}". Write exactly the syllables you hear in IAST, including any fragment of a neighbouring word at either edge. Return JSON {"heard": string}.` },
        { type: 'input_audio', input_audio: { data: b64, format: 'wav' } },
      ] },
    ],
  } as never);
  const raw = (res as { choices: { message: { content: string | null } }[] }).choices[0]?.message?.content || '{}';
  try {
    return String(JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)).heard ?? '');
  } catch {
    return raw.trim();
  }
}


/** The aligner's alphabet is plain a-z; IAST letters map to their usual romanisation. */
function ascii(word: string): string {
  return word
    .toLowerCase()
    .replace(/[śṣ]/g, 'sh').replace(/[ṛṝ]/g, 'ri').replace(/ḷ/g, 'li')
    .replace(/[ṅñṇ]/g, 'n').replace(/[ṃṁ]/g, 'm').replace(/ḥ/g, 'h')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z']/g, '');
}

/** One long-lived aligner process; each call sends one job and waits for its line. */
function startAligner() {
  const p = spawn('.venv-align/bin/python', ['scripts/align/mms_align.py'], { stdio: ['pipe', 'pipe', 'inherit'] });
  const waiting = new Map<string, (r: { spans?: [number, number][]; error?: string }) => void>();
  createInterface({ input: p.stdout }).on('line', (l) => {
    try {
      const r = JSON.parse(l);
      waiting.get(r.id)?.(r);
      waiting.delete(r.id);
    } catch {
      /* progress or warnings */
    }
  });
  return {
    align(id: string, pcm: Int16Array, words: string[]): Promise<Span[] | null> {
      const path = join(tmpdir(), `align-${id}.pcm`);
      writeFileSync(path, Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength));
      return new Promise((resolve) => {
        waiting.set(id, (r) => resolve(r.spans ? r.spans.map(([start, end]) => ({ start, end })) : (console.error('  aligner:', r.error), null)));
        p.stdin.write(JSON.stringify({ id, pcm: path, words }) + '\n');
      });
    },
    stop: () => p.stdin.end(),
  };
}

const fmt = (s: Span) => `${s.start.toFixed(2)}-${s.end.toFixed(2)}`;

async function main() {
  const sb = getServiceSupabase();
  let q = sb.from('mantras').select('id, name, status, reference_text_roman, reference_audio_url').not('reference_audio_url', 'is', null).eq('status', 'published');
  if (ONLY) q = q.eq('id', ONLY);
  const { data: mantras } = await q;
  const aligner = startAligner();
  const backup: unknown[] = [];
  const report: unknown[] = [];

  for (const m of mantras ?? []) {
    const words = splitWords(m.reference_text_roman || '');
    const { data: rows } = await sb.from('mantra_word_audio').select('*').eq('mantra_id', m.id).order('word_position');
    if (!words.length || !rows?.length) continue;
    if (rows.some((r) => r.verified)) {
      console.log(`\n== ${m.name} (${m.status}) — skipped, teacher-verified`);
      continue;
    }
    const audio = Buffer.from(await (await fetch(m.reference_audio_url)).arrayBuffer());
    const pcm = pcmSamples(await toPcm(audio));
    // Words the aligner can read: roman text as is, Devanagari transliterated first.
    let latin = words;
    if (words.some((w) => /[\u0900-\u097F]/.test(w))) latin = splitWords(await transliterate(words.join(' '), 'roman'));
    const cores = latin.length === words.length ? await aligner.align(m.id, pcm, latin.map(ascii)) : null;
    const spans = cores
      ? alignWords(pcm, words, cores, true)
      : alignWords(pcm, words, projectRough(words, rows.map((r) => ({ word: r.word, start: r.start_time, end: r.end_time }))));
    if (!cores) console.log('  (aligner unavailable for this one; used the pause-based cut)');
    console.log(`\n== ${m.name} (${m.status}) words=${words.length} old rows=${rows.length}`);

    const entry: Record<string, unknown>[] = [];
    for (let i = 0; i < words.length; i++) {
      const old = rows.length === words.length ? { start: rows[i].start_time, end: rows[i].end_time } : null;
      let line = `  ${String(i).padStart(2)} ${words[i].padEnd(16)} old ${old ? fmt(old) : '(misaligned)'.padEnd(9)}  new ${fmt(spans[i])}`;
      const e: Record<string, unknown> = { word: words[i], old, new: spans[i] };
      if (AUDIT) {
        const [ho, hn] = await Promise.all([old ? hear(wav(pcm, old), words[i]) : Promise.resolve('—'), hear(wav(pcm, spans[i]), words[i])]);
        line += `   heard old: ${ho.padEnd(18)} new: ${hn}`;
        Object.assign(e, { heard_old: ho, heard_new: hn });
      }
      console.log(line);
      entry.push(e);
    }
    report.push({ id: m.id, name: m.name, words: entry });

    if (WRITE) {
      backup.push({ mantra_id: m.id, rows });
      await sb.from('mantra_word_audio').delete().eq('mantra_id', m.id);
      const { error } = await sb.from('mantra_word_audio').insert(
        words.map((w, i) => ({ mantra_id: m.id, word: w.toLowerCase(), word_position: i, start_time: spans[i].start, end_time: spans[i].end, verified: false })),
      );
      if (error) {
        console.error('  insert failed, restoring', error.message);
        await sb.from('mantra_word_audio').insert(rows.map(({ id: _id, ...r }) => r));
      } else console.log('  saved');
    }
  }

  aligner.stop();
  mkdirSync('docs/eval/results', { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  writeFileSync(`docs/eval/results/word-audio-${AUDIT ? 'audit' : 'plan'}-${stamp}.json`, JSON.stringify(report, null, 1));
  if (WRITE) writeFileSync(`docs/eval/results/word-audio-backup-${stamp}.json`, JSON.stringify(backup, null, 1));
}
main();
