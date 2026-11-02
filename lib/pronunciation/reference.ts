import { createHash } from 'crypto';
import { getServiceSupabase } from '@/lib/supabase/service';
import { judgeEar, JUDGE_VERSION, literalEar, LITERAL_PROMPT, mergeJudges } from './ears';
import type { JudgeResult } from './types';
import { MODELS } from './openai';

interface TeacherCache {
  audio_url: string;
  text: string;
  words: { word: string; start: number; end: number }[];
}

const BUCKET = 'audio';
const mem = new Map<string, TeacherCache>();

/**
 * What the teacher's own recording sounds like to the literal ear, cached in storage
 * so we transcribe each reference recording once. For a verse, the words inside the
 * verse's time range are returned.
 */
export async function teacherLiteral(opts: {
  mantraId: string;
  audioUrl: string;
  verse?: { start: number | null; end: number | null } | null;
}): Promise<string | null> {
  if (!opts.audioUrl) return null;
  // The key covers the recording AND how it was transcribed, so a model or prompt change
  // never compares a learner against a teacher transcribed a different way.
  const tag = createHash('sha1').update(`${opts.audioUrl}|${MODELS.literal}|${LITERAL_PROMPT}`).digest('hex').slice(0, 12);
  const path = `ear-cache/${opts.mantraId}-${tag}.json`;
  let cache = mem.get(path) ?? null;
  const supabase = getServiceSupabase();

  if (!cache) {
    const { data } = await supabase.storage.from(BUCKET).download(path);
    if (data) {
      try {
        cache = JSON.parse(await data.text()) as TeacherCache;
      } catch {
        cache = null;
      }
    }
  }

  if (!cache) {
    const audioRes = await fetch(opts.audioUrl);
    if (!audioRes.ok) return null;
    const buf = Buffer.from(await audioRes.arrayBuffer());
    const mime = audioRes.headers.get('content-type') || 'audio/webm';
    const ext = mime.includes('mp4') || mime.includes('m4a') ? 'm4a' : mime.includes('wav') ? 'wav' : mime.includes('mpeg') ? 'mp3' : 'webm';
    const lit = await literalEar(buf, `teacher.${ext}`, mime);
    cache = { audio_url: opts.audioUrl, text: lit.text, words: lit.words ?? [] };
    await supabase.storage
      .from(BUCKET)
      .upload(path, Buffer.from(JSON.stringify(cache)), { contentType: 'application/json', upsert: true });
  }
  mem.set(path, cache);

  const v = opts.verse;
  if (v && v.start != null && v.end != null && cache.words.length) {
    const inVerse = cache.words.filter((w) => w.start >= v.start! - 0.25 && w.end <= v.end! + 0.25);
    if (inVerse.length) return inVerse.map((w) => w.word).join(' ');
  }
  return cache.text;
}

// ---------- teacher audio and the judge's reading of it ----------

const PCM_BYTES_PER_SEC = 16000 * 2;
const WAV_HEADER = 44;

/** Writes a 44-byte header for 16 kHz mono 16-bit PCM. */
function wavHeader(dataBytes: number): Buffer {
  const h = Buffer.alloc(WAV_HEADER);
  h.write('RIFF', 0); h.writeUInt32LE(36 + dataBytes, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(16000, 24); h.writeUInt32LE(PCM_BYTES_PER_SEC, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(dataBytes, 40);
  return h;
}

/** Raw 16 kHz mono PCM of any recording, via the bundled ffmpeg. */
async function toPcm(audio: Buffer): Promise<Buffer> {
  const { spawn } = await import('child_process');
  const ffmpegPath = (await import('ffmpeg-static')).default as unknown as string;
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath, ['-v', 'error', '-i', 'pipe:0', '-ac', '1', '-ar', '16000', '-f', 's16le', 'pipe:1']);
    const out: Buffer[] = [];
    p.stdout.on('data', (d) => out.push(d));
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve(Buffer.concat(out)) : reject(new Error(`ffmpeg exited ${code}`))));
    p.stdin.on('error', () => {});
    p.stdin.end(audio);
  });
}

/**
 * The teacher's recording as 16 kHz WAV (the verse slice when a verse is given),
 * converted once and cached in storage.
 */
export async function teacherWav(opts: {
  mantraId: string;
  audioUrl: string;
  verse?: { start: number | null; end: number | null } | null;
}): Promise<Buffer | null> {
  if (!opts.audioUrl) return null;
  const tag = createHash('sha1').update(opts.audioUrl).digest('hex').slice(0, 12);
  const path = `ear-cache/${opts.mantraId}-${tag}.pcm`;
  const supabase = getServiceSupabase();
  let pcm: Buffer | null = null;
  const { data } = await supabase.storage.from(BUCKET).download(path);
  if (data) pcm = Buffer.from(await data.arrayBuffer());
  if (!pcm) {
    const res = await fetch(opts.audioUrl);
    if (!res.ok) return null;
    pcm = await toPcm(Buffer.from(await res.arrayBuffer()));
    await supabase.storage.from(BUCKET).upload(path, pcm, { contentType: 'application/octet-stream', upsert: true });
  }
  const v = opts.verse;
  if (v && v.start != null && v.end != null) {
    const a = Math.max(0, Math.floor(v.start * PCM_BYTES_PER_SEC / 2) * 2);
    const b = Math.min(pcm.length, Math.ceil(v.end * PCM_BYTES_PER_SEC / 2) * 2);
    if (b > a) pcm = pcm.subarray(a, b);
  }
  return Buffer.concat([wavHeader(pcm.length), pcm]);
}

/**
 * What the judge hears in the teacher's own recitation of this text, cached per
 * recording, text and judge model. Used to tell the judge's habits from real errors.
 */
export async function teacherJudge(opts: {
  mantraId: string;
  audioUrl: string;
  verse?: { start: number | null; end: number | null } | null;
  words: string[];
  devanagari: string;
}): Promise<JudgeResult | null> {
  if (!opts.audioUrl) return null;
  const key = createHash('sha1')
    .update(`${opts.audioUrl}|${opts.verse?.start ?? ''}-${opts.verse?.end ?? ''}|${opts.words.join(' ')}|${MODELS.judge}|${JUDGE_VERSION}`)
    .digest('hex')
    .slice(0, 16);
  const path = `ear-cache/${opts.mantraId}-judge-${key}.json`;
  const cached = mem.get(path) as unknown as JudgeResult | undefined;
  if (cached) return cached;
  const supabase = getServiceSupabase();
  const { data } = await supabase.storage.from(BUCKET).download(path);
  if (data) {
    try {
      const j = JSON.parse(await data.text()) as JudgeResult;
      mem.set(path, j as never);
      return j;
    } catch {
      /* recompute below */
    }
  }
  const wav = await teacherWav(opts);
  if (!wav) return null;
  const args = { wavBase64: wav.toString('base64'), words: opts.words, devanagari: opts.devanagari };
  // Two listens, stricter reading kept: every habit the judge shows on the teacher is excused.
  const [a, b] = await Promise.all([judgeEar(args), judgeEar(args).catch(() => null)]);
  const j = b ? mergeJudges(a, b) : a;
  await supabase.storage.from(BUCKET).upload(path, Buffer.from(JSON.stringify(j)), { contentType: 'application/json', upsert: true });
  mem.set(path, j as never);
  return j;
}
