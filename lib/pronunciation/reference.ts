import { createHash } from 'crypto';
import { getServiceSupabase } from '@/lib/supabase/service';
import { literalEar, LITERAL_PROMPT } from './ears';
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
