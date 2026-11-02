import { toFile } from 'openai';
import { openai, MODELS } from './openai';
import type { JudgeResult, LiteralResult } from './types';

// Latin-script instruction keeps whisper in romanised output, which the phonetic
// comparison needs. It must contain NO mantra words: an earlier prompt listing
// "Shivaya" made whisper write "Shivaya" for a student who said "Shiva".
export const LITERAL_PROMPT =
  'Write exactly what is pronounced in simple roman letters, syllable by syllable, even if it sounds incomplete, broken or wrong.';

export async function literalEar(audio: Buffer, filename: string, mime: string): Promise<LiteralResult & { words?: { word: string; start: number; end: number }[] }> {
  const file = await toFile(audio, filename, { type: mime });
  const res = (await openai().audio.transcriptions.create({
    file,
    model: MODELS.literal,
    prompt: LITERAL_PROMPT,
    response_format: 'verbose_json',
    timestamp_granularities: ['word', 'segment'],
  })) as unknown as {
    text: string;
    segments?: { no_speech_prob: number; avg_logprob: number }[];
    words?: { word: string; start: number; end: number }[];
  };
  const segs = res.segments ?? [];
  const noSpeechProb = segs.length
    ? segs.reduce((s, x) => s + (x.no_speech_prob ?? 0), 0) / segs.length
    : 1;
  return { text: (res.text || '').trim(), noSpeechProb, words: res.words };
}

const ISSUES = 'none|vowel_length|aspiration|retroflex|sibilant|visarga|anusvara|substitution|missing|extra|other';

export async function judgeEar(opts: {
  wavBase64: string;
  words: string[];
  devanagari: string;
}): Promise<JudgeResult> {
  const list = opts.words.map((w, i) => `${i + 1}. ${w}`).join('\n');
  // Asking for heard_text first makes the model commit to what it heard before it
  // compares, which in testing is what let it catch "deva siddhi mai" for "devasya dhimahi".
  const user = `Reference mantra (Devanagari): ${opts.devanagari}
Reference words, in order:
${list}

Listen to the student's recitation. First write heard_text: exactly the syllables you hear, in IAST, without correcting anything. Then, for every reference word, judge what was actually pronounced. Never assume a word was said correctly because it belongs to a famous mantra; a missing final syllable or a changed consonant is "wrong".
Return JSON only:
{"heard_text": string, "recited_same_mantra": boolean, "words":[{"expected": string, "heard": string, "status":"ok|minor|wrong|missing", "issue":"${ISSUES}", "confidence": number 0-1}], "extra_words":[string], "audio_quality":"clear|noisy|too_quiet|silent", "overall_confidence": number 0-1}
"words" must have exactly ${opts.words.length} entries, one per reference word, in order.`;

  const res = await openai().chat.completions.create({
    model: MODELS.judge,
    modalities: ['text'],
    temperature: 0,
    messages: [
      {
        role: 'system',
        content:
          'You are a strict Sanskrit pronunciation examiner. You LISTEN to the audio. Never assume the student said the reference; report only what you actually hear. Return JSON only.',
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: user },
          { type: 'input_audio', input_audio: { data: opts.wavBase64, format: 'wav' } },
        ],
      },
    ],
  } as never);
  const raw = (res as { choices: { message: { content: string | null } }[] }).choices[0]?.message?.content || '{}';
  return parseJudge(raw, opts.words);
}
export function parseJudge(raw: string, words: string[]): JudgeResult {
  const jsonText = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
  let j: Partial<JudgeResult> = {};
  try {
    j = JSON.parse(jsonText);
  } catch {
    j = {};
  }
  const got = Array.isArray(j.words) ? j.words : [];
  // Guarantee one entry per expected word, in order.
  const aligned = words.map((w, i) => {
    const x = got[i] ?? got.find((g) => g?.expected === w);
    return {
      expected: w,
      heard: String(x?.heard ?? ''),
      status: (['ok', 'minor', 'wrong', 'missing'].includes(x?.status as string) ? x!.status : 'ok') as JudgeResult['words'][number]['status'],
      issue: (x?.issue ?? 'none') as JudgeResult['words'][number]['issue'],
      confidence: clamp01(Number(x?.confidence ?? 0.5)),
    };
  });
  return {
    recited_same_mantra: j.recited_same_mantra !== false,
    words: aligned,
    extra_words: Array.isArray(j.extra_words) ? j.extra_words.map(String) : [],
    audio_quality: (['clear', 'noisy', 'too_quiet', 'silent'].includes(j.audio_quality as string) ? j.audio_quality : 'clear') as JudgeResult['audio_quality'],
    overall_confidence: clamp01(Number(j.overall_confidence ?? (got.length ? 0.7 : 0))),
  };
}

function clamp01(n: number) {
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.5;
}

const SEVERITY = { ok: 0, minor: 1, wrong: 2, missing: 3 } as const;

/** Keep the stricter reading per word; agree on quality only when both heard it clearly. */
export function mergeJudges(a: JudgeResult, b: JudgeResult): JudgeResult {
  return {
    recited_same_mantra: a.recited_same_mantra && b.recited_same_mantra,
    words: a.words.map((wa, i) => {
      const wb = b.words[i];
      if (!wb) return wa;
      return SEVERITY[wb.status] > SEVERITY[wa.status] ? wb : wa;
    }),
    extra_words: [...new Set([...a.extra_words, ...b.extra_words])],
    audio_quality: a.audio_quality === b.audio_quality ? a.audio_quality : a.audio_quality === 'clear' ? b.audio_quality : a.audio_quality,
    overall_confidence: (a.overall_confidence + b.overall_confidence) / 2,
  };
}
