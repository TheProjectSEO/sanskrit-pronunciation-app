import { NextRequest, NextResponse } from 'next/server';
import OpenAI, { toFile } from 'openai';
import { getLanguagePromptInstruction } from '@/lib/constants/languages';

let _openai: OpenAI;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;
    const referenceWord = formData.get('reference_word') as string;
    const feedbackLanguage = (formData.get('feedback_language') as string) || 'hindi';

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    if (!referenceWord) {
      return NextResponse.json({ error: 'No reference word provided' }, { status: 400 });
    }

    // Convert File to buffer for Whisper
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Determine file extension based on MIME type
    const mimeType = audioFile.type || 'audio/webm';
    let extension = 'webm';
    if (mimeType.includes('mp4') || mimeType.includes('m4a')) {
      extension = 'm4a';
    } else if (mimeType.includes('wav')) {
      extension = 'wav';
    } else if (mimeType.includes('mp3') || mimeType.includes('mpeg')) {
      extension = 'mp3';
    }

    const file = await toFile(buffer, `recording.${extension}`, {
      type: mimeType,
    });

    // Transcribe user's recording
    const transcription = await getOpenAI().audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
      prompt: `Sanskrit word: ${referenceWord}`,
    });

    const userText = transcription.text.trim();

    // Check for empty transcription
    if (!userText || userText.length < 2) {
      return NextResponse.json({
        score: 0,
        feedback: 'No clear speech detected. Please speak the word clearly.',
        user_transcription: userText || '(no speech detected)',
        is_correct: false,
      });
    }

    // Analyze with GPT-4o
    const languageInstruction = getLanguagePromptInstruction(feedbackLanguage);

    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert Sanskrit pronunciation teacher. Analyze a student's attempt at pronouncing a single Sanskrit word.

LANGUAGE INSTRUCTION: ${languageInstruction}

Respond in JSON format.`,
        },
        {
          role: 'user',
          content: `Reference word: "${referenceWord}"
Student said: "${userText}"

Analyze the pronunciation and respond with:
{
  "score": <0-100>,
  "is_correct": <true if score >= 80>,
  "feedback": "<1 sentence feedback in ${feedbackLanguage}>",
  "tip": "<specific pronunciation tip in ${feedbackLanguage}>"
}`,
        },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
      max_tokens: 500,
    });

    const analysisText = completion.choices[0]?.message?.content;
    if (!analysisText) {
      throw new Error('No analysis generated');
    }

    const analysis = JSON.parse(analysisText);

    return NextResponse.json({
      score: analysis.score ?? 50,
      is_correct: analysis.is_correct ?? false,
      feedback: analysis.feedback ?? 'Try again.',
      tip: analysis.tip ?? '',
      user_transcription: userText,
    });
  } catch (error) {
    console.error('Word analysis error:', error);
    return NextResponse.json(
      { error: 'Analysis failed. Please try again.' },
      { status: 500 }
    );
  }
}
