import OpenAI from 'openai';

let _openai: OpenAI;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

export interface TranscriptionResult {
  text: string;
  language?: string;
  duration?: number;
}

/**
 * Transcribe audio using OpenAI Whisper API
 * @param audioBuffer - The audio file as a Buffer
 * @param filename - Original filename for content type detection
 * @returns Transcription result with text
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  filename: string
): Promise<TranscriptionResult> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  // Create a File object from the buffer (convert to Uint8Array for type compatibility)
  const uint8Array = new Uint8Array(audioBuffer);
  const file = new File([uint8Array], filename, {
    type: getAudioMimeType(filename),
  });

  try {
    // Note: Whisper doesn't support Sanskrit ('sa') directly.
    // We omit the language parameter to let Whisper auto-detect,
    // and use a detailed prompt to guide accurate transcription.
    const transcription = await getOpenAI().audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
      response_format: 'verbose_json',
      prompt: 'Sanskrit mantra shloka. Om Namah Shivaya. Hare Krishna. Gayatri mantra. Transcribe accurately preserving Sanskrit pronunciation.',
    });

    return {
      text: transcription.text,
      language: transcription.language,
      duration: transcription.duration,
    };
  } catch (error) {
    console.error('Whisper transcription error:', error);
    if (error instanceof OpenAI.APIError) {
      throw new Error(`OpenAI API error: ${error.message}`);
    }
    throw error;
  }
}

export interface MantraIdentificationResult {
  mantra_name: string;
  text_roman: string;
  text_devanagari: string;
  confidence: number;
}

/**
 * Identify the mantra from Whisper transcription and return correct text.
 * GPT-4o recognizes the mantra and provides authoritative correct text
 * in both Roman (IAST) and Devanagari from its knowledge.
 */
export async function identifyAndCorrectMantra(
  whisperOutput: string
): Promise<MantraIdentificationResult> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert in Sanskrit mantras, shlokas, and prayers. You know ALL well-known mantras by heart.

A user recorded themselves speaking a Sanskrit mantra. Whisper transcribed it (possibly with errors, possibly in Devanagari or Roman script).

Your job:
1. IDENTIFY which mantra this is (e.g. "Gayatri Mantra", "Mahamrityunjaya Mantra", etc.)
2. Return the CORRECT, AUTHORITATIVE text from your knowledge — NOT just a cleanup of the transcription
3. If the mantra is well-known, use the standard/canonical version
4. If you cannot identify it, clean up the transcription as best you can

Return JSON with these fields:
{
  "mantra_name": "Name of the mantra (e.g. Gayatri Mantra)",
  "text_roman": "Correct IAST Roman transliteration",
  "text_devanagari": "Correct Devanagari script",
  "confidence": 0.0-1.0
}

Examples:
- Whisper: "ॐ भूर्भुवः स्वः तच्यवितुर्वरिण्यं..." → This is Gayatri Mantra
  Return the CORRECT Gayatri Mantra text, not the garbled Whisper output
- Whisper: "Om Namah Shivay" → This is Panchakshari Mantra
  Return "Om Namah Shivaya" (corrected) with proper Devanagari

Return ONLY the JSON, no markdown fences.`
        },
        {
          role: 'user',
          content: `Whisper transcription: "${whisperOutput}"`
        }
      ],
      temperature: 0.1,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
    });

    const response = completion.choices[0]?.message?.content?.trim();
    if (!response) {
      throw new Error('GPT-4o returned empty response');
    }

    const result = JSON.parse(response);
    return {
      mantra_name: result.mantra_name || 'Unknown Mantra',
      text_roman: result.text_roman || whisperOutput,
      text_devanagari: result.text_devanagari || whisperOutput,
      confidence: result.confidence || 0.5,
    };
  } catch (error) {
    console.error('Mantra identification error:', error);
    // Fallback: return Whisper output as-is
    return {
      mantra_name: 'Unknown Mantra',
      text_roman: whisperOutput,
      text_devanagari: whisperOutput,
      confidence: 0.3,
    };
  }
}

/**
 * Get MIME type from filename
 */
function getAudioMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    webm: 'audio/webm',
    m4a: 'audio/mp4',
    ogg: 'audio/ogg',
    flac: 'audio/flac',
  };
  return mimeTypes[ext || ''] || 'audio/webm';
}
