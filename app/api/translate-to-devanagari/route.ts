import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

let _openai: OpenAI;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

export async function POST(request: NextRequest) {
  try {
    const { roman_text, mode } = await request.json();

    if (!roman_text || typeof roman_text !== 'string') {
      return NextResponse.json(
        { error: 'Roman text is required' },
        { status: 400 }
      );
    }

    // mode: "deity" for deity names, "mantra" (default) for mantra text
    const isDeity = mode === 'deity';

    const systemPrompt = isDeity
      ? `You are an expert in Hindu deity names and Sanskrit. Given an English deity name, return the correct Devanagari name.

Rules:
- You know all Hindu deities, their proper Sanskrit names, and correct Devanagari spellings.
- Return ONLY the Devanagari text, nothing else. No quotes, no explanation.
- Examples: "Ganesh" → "गणेश", "Shiva" → "शिव", "Vishnu" → "विष्णु", "Krishna" → "कृष्ण", "Durga" → "दुर्गा", "Lakshmi" → "लक्ष्मी", "Hanuman" → "हनुमान", "Saraswati" → "सरस्वती", "Rama" → "राम", "Parvati" → "पार्वती", "Kali" → "काली"`
      : `You are an expert in Sanskrit mantras and transliteration. You know ALL well-known Sanskrit mantras, shlokas, and prayers by heart.

Your task: Given a mantra in Roman/English script (even if roughly typed), identify which mantra it is and return BOTH the perfect IAST Roman transliteration AND the perfect Devanagari script.

Rules:
- If you recognize the mantra (e.g. "Om Namah Shivaya", "Gayatri Mantra", "Mahamrityunjaya"), return the EXACT correct text from your knowledge, not just a transliteration of the user's input.
- Fix any spelling errors in the Roman text based on your knowledge of the mantra.
- Return valid JSON with two fields: "roman" and "devanagari"
- Return ONLY the JSON object, no markdown code fences, no explanation.

Examples:
Input: "om namah shivay"
Output: {"roman": "Om Namah Shivaya", "devanagari": "ॐ नमः शिवाय"}

Input: "gayatri mantra om bhur bhuva"
Output: {"roman": "Om Bhur Bhuvah Svaha Tat Savitur Varenyam Bhargo Devasya Dhimahi Dhiyo Yo Nah Prachodayat", "devanagari": "ॐ भूर्भुवः स्वः तत्सवितुर्वरेण्यं भर्गो देवस्य धीमहि धियो यो नः प्रचोदयात्"}

Input: "om trayambakam yajamahe"
Output: {"roman": "Om Tryambakam Yajamahe Sugandhim Pushtivardhanam Urvarukamiva Bandhanan Mrityormukshiya Mamritat", "devanagari": "ॐ त्र्यम्बकं यजामहे सुगन्धिं पुष्टिवर्धनम् उर्वारुकमिव बन्धनान् मृत्योर्मुक्षीय मामृतात्"}`;

    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: roman_text }
      ],
      temperature: 0.1,
      max_tokens: 1000,
    });

    const responseText = completion.choices[0]?.message?.content?.trim();

    if (!responseText) {
      return NextResponse.json(
        { error: 'Translation failed' },
        { status: 500 }
      );
    }

    if (isDeity) {
      return NextResponse.json({
        roman_text,
        devanagari_text: responseText,
      });
    }

    // Parse JSON response for mantra mode
    try {
      const parsed = JSON.parse(responseText);
      return NextResponse.json({
        roman_text: parsed.roman || roman_text,
        devanagari_text: parsed.devanagari || responseText,
        corrected: parsed.roman !== roman_text,
      });
    } catch {
      // Fallback if GPT didn't return valid JSON
      return NextResponse.json({
        roman_text,
        devanagari_text: responseText,
      });
    }
  } catch (error) {
    console.error('Translation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
