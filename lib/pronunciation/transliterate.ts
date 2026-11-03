import { openai, MODELS } from './openai';

/**
 * Writes the same words in the other script without "correcting" them. User mantras are
 * often lineage-specific, so the text must stay what was recited, never the nearest
 * famous mantra.
 */
export async function transliterate(text: string, to: 'devanagari' | 'roman'): Promise<string> {
  const res = await openai().chat.completions.create({
    model: MODELS.guru,
    messages: [
      {
        role: 'system',
        content: `Transliterate the user's text into ${to === 'devanagari' ? 'Devanagari script' : 'IAST roman letters'}. Keep every word exactly as given, even if it looks misspelt or differs from a well-known mantra. Do not add, remove, reorder or correct words. Return only the transliterated text.`,
      },
      { role: 'user', content: text },
    ],
  } as never);
  return ((res as { choices: { message: { content: string | null } }[] }).choices[0]?.message?.content || '').trim();
}
