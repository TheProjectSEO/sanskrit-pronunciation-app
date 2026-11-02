import OpenAI from 'openai';

let client: OpenAI | null = null;
export function openai(): OpenAI {
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

/** Models, overridable per environment so a swap needs no deploy of code. */
export const MODELS = {
  // Literal ear. whisper-1 is the only current model that transcribes what was said
  // rather than normalising famous mantras to their textbook form (tested 2 Nov 2026:
  // gpt-transcribe rewrote a wrong Gayatri as the correct one, even unprimed).
  // whisper-1 shuts down 26 Feb 2027; replace with gpt-realtime-whisper or an alignment service.
  literal: process.env.PRON_LITERAL_MODEL || 'whisper-1',
  // Judge ear: hears the audio and the expected text.
  judge: process.env.PRON_JUDGE_MODEL || 'gpt-audio-1.5',
  // Writes the guru's sentence from confirmed issues only.
  guru: process.env.PRON_GURU_MODEL || 'gpt-5.5',
};
