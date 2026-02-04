import OpenAI from 'openai';

// Initialize OpenAI client with API key from environment
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
    const transcription = await openai.audio.transcriptions.create({
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

/**
 * Convert Latin/IAST text to Devanagari script
 * Uses OpenAI GPT to ensure accurate conversion
 */
export async function convertToDevanagari(latinText: string): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert in Sanskrit and Devanagari script. Convert the given Sanskrit text from Latin/IAST transliteration to Devanagari script.

Rules:
1. Output ONLY the Devanagari text, no explanations
2. Preserve the meaning and pronunciation accurately
3. Use proper Devanagari conjuncts (संयुक्त अक्षर) where appropriate
4. Include proper chandrabindu (ँ) and anusvara (ं) as needed
5. Maintain proper spacing between words`,
        },
        {
          role: 'user',
          content: latinText,
        },
      ],
      temperature: 0.1, // Low temperature for accuracy
      max_tokens: 500,
    });

    const devanagariText = completion.choices[0]?.message?.content?.trim();
    if (!devanagariText) {
      throw new Error('Failed to convert to Devanagari');
    }

    return devanagariText;
  } catch (error) {
    console.error('Devanagari conversion error:', error);
    if (error instanceof OpenAI.APIError) {
      throw new Error(`OpenAI API error: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Validate transcription accuracy using AI
 * Returns confidence score and any corrections
 */
export async function validateTranscription(
  latinText: string,
  devanagariText: string
): Promise<{ confidence: number; corrections?: string }> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert in Sanskrit verification. Analyze the given Latin (IAST) and Devanagari versions of a Sanskrit text.

Evaluate:
1. Whether the Devanagari correctly represents the Latin text
2. Whether the text appears to be valid Sanskrit
3. Any potential transcription errors

Respond in JSON format:
{
  "confidence": 0.0-1.0,
  "is_valid_sanskrit": true/false,
  "corrections": "any suggested corrections or null"
}`,
        },
        {
          role: 'user',
          content: `Latin (IAST): ${latinText}\nDevanagari: ${devanagariText}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 200,
      response_format: { type: 'json_object' },
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      return { confidence: 0.7 }; // Default confidence if validation fails
    }

    const validation = JSON.parse(response);
    return {
      confidence: validation.confidence || 0.7,
      corrections: validation.corrections || undefined,
    };
  } catch (error) {
    console.error('Validation error:', error);
    // Return default confidence on error - don't fail the whole process
    return { confidence: 0.7 };
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
