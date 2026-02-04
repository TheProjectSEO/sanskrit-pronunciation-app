import { NextRequest, NextResponse } from 'next/server';
import OpenAI, { toFile } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Intelligent Sanskrit Pronunciation Analysis System
 *
 * This system provides detailed, pedagogically-sound feedback for Sanskrit mantra pronunciation.
 * It detects:
 * - Substitutions: User said a different word (e.g., "Vasudeva" instead of "Krishna")
 * - Omissions: Missing words from the reference
 * - Additions: Extra words not in the reference
 * - Mispronunciations: Phonetic errors in recognized words
 *
 * Feedback is provided in Hindi (Devanagari) with specific, actionable guidance.
 */

interface ErrorDetail {
  type: 'substitution' | 'omission' | 'addition' | 'mispronunciation';
  expected?: string;
  actual?: string;
  position?: number;
  explanation_hindi: string;
  explanation_english: string;
}

interface AnalysisResult {
  overall_score: number;
  feedback: string;
  word_analysis: {
    word: string;
    status: 'correct' | 'needs_work' | 'incorrect';
    feedback?: string;
  }[];
  hindi_feedback: string;
  detailed_errors?: ErrorDetail[];
  practice_suggestions?: string[];
}

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
    // Use generic Sanskrit context to avoid Whisper hallucinating the reference text
    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
      prompt: 'Sanskrit mantra pronunciation. Om. Namah. Shivaya. Hare Krishna. Hare Rama. Vasudeva. Bhagavate.',
    });

    console.log('Transcription result:', transcription.text);

    const userText = transcription.text.trim();

    // Check for empty or likely hallucinated transcription
    const suspiciousPatterns = [
      '', '.', '...',
      'you', 'Thank you.', 'Thanks for watching.', 'Subscribe',
      'ॐ', 'Om', 'Om.', 'Aum', 'Aum.',
      'Namah', 'Namah.', 'Shanti', 'Shanti.', 'Hari', 'Hari.',
    ];

    const words = userText.split(/\s+/).filter(w => w.length > 0);
    const isSingleWord = words.length <= 1;
    const isTooShort = userText.length < 5;

    const isLikelyEmpty = suspiciousPatterns.some(pattern =>
      userText.toLowerCase() === pattern.toLowerCase()
    ) || isTooShort || isSingleWord;

    if (isLikelyEmpty) {
      console.log('Empty or suspicious transcription detected:', userText);
      return NextResponse.json({
        overall_score: 0,
        feedback: 'No clear speech detected. Please hold the button and speak the full mantra clearly.',
        word_analysis: [],
        user_transcription: userText || '(no speech detected)',
        hindi_feedback: 'स्पष्ट आवाज़ नहीं सुनाई दी। कृपया पूरा मंत्र स्पष्ट रूप से बोलें।',
      });
    }

    // Use the advanced analysis prompt
    const analysis = await analyzeWithIntelligentFeedback(referenceText, userText);

    return NextResponse.json({
      overall_score: analysis.overall_score,
      feedback: analysis.feedback,
      word_analysis: analysis.word_analysis,
      user_transcription: userText,
      hindi_feedback: analysis.hindi_feedback,
      detailed_errors: analysis.detailed_errors,
      practice_suggestions: analysis.practice_suggestions,
    });
  } catch (error) {
    console.error('Pronunciation analysis error:', error);
    return NextResponse.json(
      { error: 'Analysis failed. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * Advanced pronunciation analysis using GPT-4 with pedagogically-designed prompts
 * Provides specific, contextual feedback like a knowledgeable Sanskrit teacher
 */
async function analyzeWithIntelligentFeedback(
  referenceText: string,
  userText: string
): Promise<AnalysisResult> {

  const systemPrompt = `You are an expert Sanskrit teacher (संस्कृत गुरु) with deep knowledge of:
- Sanskrit phonetics (वर्णमाला) including proper articulation points (स्थान) and methods (प्रयत्न)
- Common pronunciation mistakes made by Hindi speakers and foreigners
- The spiritual and linguistic importance of precise mantra pronunciation

Your role is to analyze a student's mantra recitation and provide SPECIFIC, HELPFUL feedback in Hindi.

CRITICAL INSTRUCTION: You must identify EXACTLY what the student said wrong and explain it clearly.
Do NOT give generic feedback. Be SPECIFIC about substitutions, omissions, and errors.`;

  const analysisPrompt = `## Analysis Task

**Reference Mantra (सही मंत्र):**
"${referenceText}"

**Student's Recitation (छात्र ने बोला):**
"${userText}"

## Your Analysis Must Include:

### 1. ERROR DETECTION (त्रुटि पहचान)
Identify ALL errors by comparing the two texts:

**SUBSTITUTIONS (प्रतिस्थापन):** Words the student said INSTEAD of correct words
- Example: If reference has "Krishna" but student said "Vasudeva", this is a substitution
- Report: "आपने 'कृष्ण' की जगह 'वासुदेव' बोला"

**OMISSIONS (लोप):** Words from reference that student did NOT say at all
- Example: If reference has "Rama" but student never said it
- Report: "आपने 'राम' बिल्कुल नहीं बोला"

**ADDITIONS (अतिरिक्त):** Words student said that are NOT in reference
- Report: "आपने अतिरिक्त 'X' बोला जो मंत्र में नहीं है"

**MISPRONUNCIATIONS (उच्चारण दोष):** Words that are phonetically incorrect
- Example: "Krisna" instead of "Krishna" (missing 'h')
- Report: "कृष्ण में 'ष्ण' का उच्चारण ध्यान से करें"

### 2. SCORING RULES
- If student recited a COMPLETELY DIFFERENT mantra: Score 0-15
- If student got the right mantra but with major word substitutions: Score 15-40
- If student got most words right but with pronunciation issues: Score 40-70
- If student was mostly correct with minor issues: Score 70-90
- Near perfect: Score 90-100

### 3. HINDI FEEDBACK REQUIREMENTS
The hindi_feedback must be:
- Written in Devanagari script ONLY
- Sound like a patient, knowledgeable Sanskrit teacher
- Be SPECIFIC - mention exact words that were wrong
- Include at least ONE specific correction
- Be encouraging but honest
- Maximum 3-4 sentences
- Use natural Hindi, not robotic phrases

**Good Example:**
"बेटा, आपने मंत्र की शुरुआत अच्छी की, लेकिन 'कृष्ण' की जगह 'वासुदेव' बोल दिया। याद रखें - हरे कृष्ण मंत्र में 'राम' और 'कृष्ण' दोनों आते हैं। 'राम' शब्द आपने बोला ही नहीं। एक बार फिर ध्यान से सुनें और दोहराएं।"

**Bad Example (too generic):**
"कई शब्द गलत हैं। फिर से कोशिश करें।"

### 4. JSON RESPONSE FORMAT

{
  "overall_score": <0-100>,
  "feedback": "<English summary of main issues>",
  "word_analysis": [
    {"word": "<reference word>", "status": "correct|needs_work|incorrect", "feedback": "<what user said if different>"}
  ],
  "hindi_feedback": "<Detailed Hindi feedback as described above>",
  "detailed_errors": [
    {
      "type": "substitution|omission|addition|mispronunciation",
      "expected": "<correct word if applicable>",
      "actual": "<what user said if applicable>",
      "explanation_hindi": "<Hindi explanation>",
      "explanation_english": "<English explanation>"
    }
  ],
  "practice_suggestions": [
    "<Specific practice tip in Hindi>"
  ]
}

## IMPORTANT REMINDERS:
1. If user said "Vasudeva" multiple times but reference has "Krishna" - this is a MAJOR error, score should be LOW
2. If user missed entire sections (like never saying "Rama" in Hare Krishna Mahamantra) - explicitly call this out
3. The hindi_feedback is the MOST IMPORTANT output - it must sound like a real guru giving personal guidance
4. Don't just list errors - explain WHY the correct pronunciation matters

Now analyze the student's recitation:`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o', // Use GPT-4o for better Hindi generation and analysis
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: analysisPrompt },
      ],
      temperature: 0.4, // Slightly higher for more natural Hindi
      response_format: { type: 'json_object' },
      max_tokens: 2000,
    });

    const analysisText = completion.choices[0]?.message?.content;
    if (!analysisText) {
      throw new Error('No analysis generated');
    }

    const analysis = JSON.parse(analysisText);

    // Ensure all required fields have defaults
    return {
      overall_score: analysis.overall_score ?? 50,
      feedback: analysis.feedback ?? 'Analysis complete.',
      word_analysis: analysis.word_analysis ?? [],
      hindi_feedback: analysis.hindi_feedback ?? 'कृपया फिर से प्रयास करें।',
      detailed_errors: analysis.detailed_errors ?? [],
      practice_suggestions: analysis.practice_suggestions ?? [],
    };
  } catch (error) {
    console.error('GPT analysis error:', error);

    // Fallback to basic analysis if GPT fails
    return {
      overall_score: 50,
      feedback: 'Could not complete detailed analysis. Please try again.',
      word_analysis: [],
      hindi_feedback: 'विश्लेषण में समस्या हुई। कृपया पुनः प्रयास करें।',
      detailed_errors: [],
      practice_suggestions: [],
    };
  }
}
