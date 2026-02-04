import { NextRequest, NextResponse } from 'next/server';
import OpenAI, { toFile } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;
    const referenceText = formData.get('reference_text') as string;

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    if (!referenceText) {
      return NextResponse.json({ error: 'No reference text provided' }, { status: 400 });
    }

    // Convert File to buffer for Whisper
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Determine file extension based on MIME type
    // Whisper supports: mp3, mp4, mpeg, mpga, m4a, wav, webm
    const mimeType = audioFile.type || 'audio/webm';
    let extension = 'webm';
    if (mimeType.includes('mp4') || mimeType.includes('m4a')) {
      extension = 'm4a';
    } else if (mimeType.includes('wav')) {
      extension = 'wav';
    } else if (mimeType.includes('mp3') || mimeType.includes('mpeg')) {
      extension = 'mp3';
    }

    // Create file with proper format for OpenAI
    const file = await toFile(buffer, `recording.${extension}`, {
      type: mimeType,
    });

    console.log('Transcribing audio:', { mimeType, extension, size: buffer.length });

    // Transcribe user's recording
    // IMPORTANT: Don't include reference text in prompt - it causes Whisper to hallucinate
    // that text even from silence/noise. Use generic Sanskrit context only.
    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
      prompt: 'Sanskrit mantra pronunciation. Om. Namah. Shivaya. Hare Krishna.',
    });

    console.log('Transcription result:', transcription.text);

    const userText = transcription.text.trim();

    // Check for empty or likely hallucinated transcription
    // Whisper often hallucinates single words from silence/noise
    const suspiciousPatterns = [
      '', // empty
      '.', // just punctuation
      '...',
      'you', // common English hallucination
      'Thank you.',
      'Thanks for watching.',
      'Subscribe',
      'ॐ', // single character
      // Common single-word Sanskrit hallucinations from silence
      'Om',
      'Om.',
      'Aum',
      'Aum.',
      'Namah',
      'Namah.',
      'Shanti',
      'Shanti.',
      'Hari',
      'Hari.',
    ];

    // Check if it's a suspicious pattern OR too short OR just a single word
    // Single word responses from silence are almost always hallucinations
    const words = userText.split(/\s+/).filter(w => w.length > 0);
    const isSingleWord = words.length <= 1;
    const isTooShort = userText.length < 5; // "Om." is 3 chars, real mantras are longer

    const isLikelyEmpty = suspiciousPatterns.some(pattern =>
      userText.toLowerCase() === pattern.toLowerCase()
    ) || isTooShort || isSingleWord;

    if (isLikelyEmpty) {
      console.log('Empty or suspicious transcription detected:', userText, '| words:', words.length, '| length:', userText.length);
      return NextResponse.json({
        overall_score: 0,
        feedback: 'No clear speech detected. Please hold the button and speak the full mantra clearly.',
        word_analysis: [],
        user_transcription: userText || '(no speech detected)',
        hindi_feedback: 'स्पष्ट आवाज़ नहीं सुनाई दी। कृपया पूरा मंत्र स्पष्ट रूप से बोलें।',
      });
    }

    // Analyze pronunciation using GPT-4
    const analysisPrompt = `You are a STRICT Sanskrit pronunciation evaluator. Compare what the user ACTUALLY said with the reference.

Reference (expected): "${referenceText}"
User's transcription: "${userText}"

CRITICAL RULES FOR WORD ANALYSIS:
1. Compare each word the user said with the corresponding reference word
2. BE STRICT - if the transcription shows a different word, mark it INCORRECT
   - "Pamo" for "Namo" = INCORRECT (different first consonant)
   - "Pagbate" for "Bhagavate" = INCORRECT (wrong sounds)
   - "Waso" for "Vasu" = INCORRECT (w vs v)
3. Only mark as "correct" if the transcription closely matches
4. "needs_work" = minor pronunciation issue but recognizable
5. "incorrect" = wrong word or unrecognizable

For word_analysis, show the REFERENCE word and what they actually said:
- If user said "Pamo" instead of "Namo", the word_analysis entry should be:
  {"word": "namo", "status": "incorrect", "feedback": "You said 'Pamo' - should be 'Namo' with 'N' sound"}

Hindi feedback rules:
- NATURAL FLOWING speech (no commas between every word)
- In Devanagari script ONLY
- Keep SHORT - max 2 sentences
- Be encouraging but honest about mistakes

Respond in JSON:
{
  "overall_score": 40,
  "feedback": "Several pronunciation errors. Focus on 'N' in Namo and 'Bh' in Bhagavate.",
  "word_analysis": [
    {"word": "om", "status": "correct"},
    {"word": "namo", "status": "incorrect", "feedback": "Said 'Pamo' - use 'N' sound"},
    {"word": "bhagavate", "status": "incorrect", "feedback": "Said 'Pagbate' - should be 'Bhagavate'"},
    {"word": "vasudevaya", "status": "needs_work", "feedback": "Said 'Waso Deivaya' - V not W"}
  ],
  "hindi_feedback": "ओम सही था। नमो में 'न' की आवाज़ करें, 'प' नहीं। भगवते में 'भ' बोलें।"
}

Status: "correct" | "needs_work" | "incorrect"`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a Sanskrit pronunciation expert. Always respond in valid JSON.' },
        { role: 'user', content: analysisPrompt },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const analysisText = completion.choices[0]?.message?.content;
    if (!analysisText) {
      throw new Error('No analysis generated');
    }

    const analysis = JSON.parse(analysisText);

    return NextResponse.json({
      overall_score: analysis.overall_score || 70,
      feedback: analysis.feedback || 'Keep practicing!',
      word_analysis: analysis.word_analysis || [],
      user_transcription: userText,
      hindi_feedback: analysis.hindi_feedback || 'फिर से कोशिश करें।',
    });
  } catch (error) {
    console.error('Pronunciation analysis error:', error);
    return NextResponse.json(
      { error: 'Analysis failed. Please try again.' },
      { status: 500 }
    );
  }
}
