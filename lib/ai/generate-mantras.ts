import { openai, MODELS } from '@/lib/pronunciation/openai';
import { MANTRA_CATEGORIES } from '@/lib/constants/categories';

export interface AiMantra {
  name: string;
  deity: string | null;
  category: string | null;
  devanagari: string;
  iast: string;
  meaning: string;
  verses: { devanagari: string; iast: string }[];
  pronunciation_tips: { word: string; tip: string }[];
  source_note: string;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Drafts mantras from an admin's request. Output is a starting point for a teacher,
 * never shown to learners: text must be checked and the voice replaced by the teacher's.
 */
export async function generateMantras(prompt: string, count: number): Promise<AiMantra[]> {
  const res = await openai().chat.completions.create({
    model: MODELS.guru,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You help a Sanskrit teacher prepare practice material for a mantra pronunciation app.
Return JSON: {"mantras":[...]} with at most ${count} items. Each item:
{"name": string (common name), "deity": string|null, "category": one of ${JSON.stringify(MANTRA_CATEGORIES)} or null,
 "devanagari": string (the full text, correct Devanagari with standard punctuation ।॥),
 "iast": string (exact IAST transliteration of the same text, word for word),
 "meaning": string (plain English, 1-3 sentences),
 "verses": [{"devanagari": string, "iast": string}] (split into lines/verses if longer than one line, else []),
 "pronunciation_tips": [{"word": string (IAST), "tip": string}] (2-5 sounds learners often get wrong: vowel length, aspiration, retroflex, visarga, anusvara),
 "source_note": string (where this text is traditionally found, or "common devotional use"),
 "confidence": "high"|"medium"|"low" (how sure you are that the text is the traditional wording)}
Rules: use only well-attested traditional texts; never invent verses or attribute a text to a scripture you are unsure of; if a request is for something you do not know reliably, return fewer items or set confidence "low" and say so in source_note. Devanagari and IAST must match word for word.`,
      },
      { role: 'user', content: prompt },
    ],
  } as never);
  const raw = (res as { choices: { message: { content: string | null } }[] }).choices[0]?.message?.content || '{}';
  let parsed: { mantras?: Partial<AiMantra>[] } = {};
  try { parsed = JSON.parse(raw); } catch { parsed = {}; }
  return (parsed.mantras ?? []).slice(0, count).filter((m) => m.devanagari && m.iast && m.name).map((m) => ({
    name: String(m.name).slice(0, 120),
    deity: m.deity ? String(m.deity) : null,
    category: m.category && (MANTRA_CATEGORIES as readonly string[]).includes(m.category) ? m.category : null,
    devanagari: String(m.devanagari),
    iast: String(m.iast),
    meaning: String(m.meaning ?? ''),
    verses: Array.isArray(m.verses) ? m.verses.filter((v) => v?.devanagari && v?.iast).slice(0, 40) : [],
    pronunciation_tips: Array.isArray(m.pronunciation_tips) ? m.pronunciation_tips.slice(0, 8) : [],
    source_note: String(m.source_note ?? ''),
    confidence: (['high', 'medium', 'low'].includes(m.confidence as string) ? m.confidence : 'low') as AiMantra['confidence'],
  }));
}
