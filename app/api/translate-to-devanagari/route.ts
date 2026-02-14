import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { roman_text } = await request.json();

    if (!roman_text || typeof roman_text !== 'string') {
      return NextResponse.json(
        { error: 'Roman text is required' },
        { status: 400 }
      );
    }

    // Use OpenAI to translate Roman/transliterated Sanskrit to Devanagari
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert in Sanskrit transliteration. Convert the given Roman/Latin script Sanskrit text into accurate Devanagari script.

Rules:
- Maintain exact pronunciation mapping (IAST/ISO 15919 standards)
- Preserve all diacritical marks when converting
- Keep word boundaries intact
- Return ONLY the Devanagari text, no explanations
- Common mappings: a=अ, i=इ, u=उ, ka=क, kha=ख, ga=ग, etc.
- Long vowels: ā=आ, ī=ई, ū=ऊ
- Special characters: ṃ=ं, ḥ=ः, ñ=ञ, ṭ=ट, ḍ=ड, ṇ=ण, ś=श, ṣ=ष

Examples:
- "om namah shivaya" → "ॐ नमः शिवाय"
- "tryambakam yajamahe" → "त्र्यम्बकं यजामहे"
- "gayatri mantra" → "गायत्री मंत्र"`
        },
        {
          role: 'user',
          content: roman_text
        }
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const devanagari_text = completion.choices[0]?.message?.content?.trim();

    if (!devanagari_text) {
      return NextResponse.json(
        { error: 'Translation failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      roman_text,
      devanagari_text,
    });
  } catch (error) {
    console.error('Translation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
