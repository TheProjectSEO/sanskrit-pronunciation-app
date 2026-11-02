import { openai, MODELS } from './openai';
import type { AttemptResult, Band, SayAgainReason, ScoredWord } from './types';

type Lang = 'hindi' | 'english' | 'kannada' | 'tamil' | 'telugu';
const LANG_NAME: Record<Lang, string> = {
  hindi: 'Hindi in Devanagari script',
  english: 'simple Indian English',
  kannada: 'Kannada in Kannada script',
  tamil: 'Tamil in Tamil script',
  telugu: 'Telugu in Telugu script',
};

/** Fixed lines, so an uncertain attempt never produces model-written claims. */
export const SAY_AGAIN: Record<Lang, Record<SayAgainReason | 'different_mantra', string>> = {
  hindi: {
    unclear: 'आवाज़ साफ़ नहीं आई। फ़ोन को पास रखकर एक बार फिर बोलिए।',
    noisy: 'आसपास बहुत शोर है। किसी शांत जगह पर एक बार फिर बोलिए।',
    too_quiet: 'आवाज़ बहुत धीमी थी। थोड़ा ऊँचा बोलकर फिर से प्रयास करें।',
    unsure: 'मैं ठीक से सुन नहीं पाया। गुरुजी को एक बार और सुनें, फिर दोहराएँ।',
    different_mantra: 'यह कोई दूसरा मंत्र लगता है। ऊपर लिखा मंत्र सुनकर वही दोहराएँ।',
  },
  english: {
    unclear: "I couldn't hear that clearly. Hold the phone closer and say it once more.",
    noisy: 'There is a lot of background noise. Find a quiet spot and try once more.',
    too_quiet: 'That was very soft. Say it a little louder and try again.',
    unsure: "I'm not sure I heard you right. Listen to the teacher once more, then repeat.",
    different_mantra: 'That sounds like a different mantra. Listen to the one shown and repeat it.',
  },
  kannada: {
    unclear: 'ಧ್ವನಿ ಸ್ಪಷ್ಟವಾಗಿ ಕೇಳಿಸಲಿಲ್ಲ. ಫೋನ್ ಹತ್ತಿರ ಇಟ್ಟು ಮತ್ತೊಮ್ಮೆ ಹೇಳಿ.',
    noisy: 'ಸುತ್ತಲೂ ತುಂಬಾ ಗದ್ದಲವಿದೆ. ಶಾಂತ ಸ್ಥಳದಲ್ಲಿ ಮತ್ತೊಮ್ಮೆ ಪ್ರಯತ್ನಿಸಿ.',
    too_quiet: 'ಧ್ವನಿ ತುಂಬಾ ಮೃದುವಾಗಿತ್ತು. ಸ್ವಲ್ಪ ಜೋರಾಗಿ ಮತ್ತೆ ಹೇಳಿ.',
    unsure: 'ನನಗೆ ಸರಿಯಾಗಿ ಕೇಳಿಸಲಿಲ್ಲ. ಗುರುಗಳನ್ನು ಮತ್ತೊಮ್ಮೆ ಕೇಳಿ, ನಂತರ ಪುನರಾವರ್ತಿಸಿ.',
    different_mantra: 'ಇದು ಬೇರೆ ಮಂತ್ರದಂತೆ ಕೇಳುತ್ತಿದೆ. ತೋರಿಸಿದ ಮಂತ್ರವನ್ನು ಕೇಳಿ ಅದನ್ನೇ ಹೇಳಿ.',
  },
  tamil: {
    unclear: 'குரல் தெளிவாக கேட்கவில்லை. ஃபோனை அருகில் வைத்து மீண்டும் ஒருமுறை சொல்லுங்கள்.',
    noisy: 'சுற்றிலும் அதிக சத்தம் உள்ளது. அமைதியான இடத்தில் மீண்டும் முயற்சிக்கவும்.',
    too_quiet: 'குரல் மிகவும் மெதுவாக இருந்தது. சற்று சத்தமாக மீண்டும் சொல்லுங்கள்.',
    unsure: 'எனக்கு சரியாக கேட்கவில்லை. குருவை மீண்டும் கேட்டு, பிறகு திருப்பிச் சொல்லுங்கள்.',
    different_mantra: 'இது வேறு மந்திரம் போல் தெரிகிறது. காட்டப்பட்ட மந்திரத்தைக் கேட்டு அதையே சொல்லுங்கள்.',
  },
  telugu: {
    unclear: 'స్వరం స్పష్టంగా వినబడలేదు. ఫోన్ దగ్గరగా పెట్టి మరోసారి చెప్పండి.',
    noisy: 'చుట్టూ చాలా శబ్దం ఉంది. ప్రశాంతమైన చోట మరోసారి ప్రయత్నించండి.',
    too_quiet: 'స్వరం చాలా మెల్లగా ఉంది. కొంచెం గట్టిగా మళ్ళీ చెప్పండి.',
    unsure: 'నాకు సరిగ్గా వినబడలేదు. గురువుగారిని మరోసారి విని, తర్వాత పునరావృతం చేయండి.',
    different_mantra: 'ఇది వేరే మంత్రంలా అనిపిస్తోంది. చూపిన మంత్రాన్ని విని అదే చెప్పండి.',
  },
};

export function asLang(code: string): Lang {
  return (['hindi', 'english', 'kannada', 'tamil', 'telugu'].includes(code) ? code : 'hindi') as Lang;
}

const ISSUE_HINT: Record<string, string> = {
  vowel_length: 'long vs short vowel (e.g. ā vs a, ī vs i)',
  aspiration: 'aspirated consonant (bh, dh, gh, kh, ph, th) said without breath, or the reverse',
  retroflex: 'retroflex (ṭ ḍ ṇ ṣ, tongue curled back) said as dental, or the reverse',
  sibilant: 'ś / ṣ / s confusion',
  visarga: 'visarga (ḥ, a soft echo of the vowel) dropped or overdone',
  anusvara: 'anusvāra (ṃ, nasal) dropped or changed',
  substitution: 'a different sound or word was said',
  missing: 'the word was skipped',
  extra: 'an extra sound was added',
  other: 'the word sounded different from the teacher',
};

/**
 * One correction per attempt, in the student's language. The model only sees issues
 * that both ears confirmed, so it cannot invent new mistakes.
 */
export async function guruFeedback(opts: {
  lang: Lang;
  band: Band;
  words: ScoredWord[];
  mantraDevanagari: string;
}): Promise<{ guru_line: string; focus: AttemptResult['focus'] }> {
  const issues = opts.words.filter((w) => w.status !== 'ok');
  const focusWord = issues.find((w) => w.status === 'wrong') ?? issues[0] ?? null;

  const facts = {
    mantra: opts.mantraDevanagari,
    result: opts.band,
    words_correct: opts.words.length - issues.length,
    words_total: opts.words.length,
    focus: focusWord
      ? { word: focusWord.word, devanagari: focusWord.devanagari, sounded_like: focusWord.heard, problem: ISSUE_HINT[focusWord.issue ?? 'other'] }
      : null,
    other_words_to_check: issues.filter((w) => w !== focusWord).map((w) => w.word),
  };

  const res = await openai().chat.completions.create({
    model: MODELS.guru,
    reasoning_effort: 'low',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are a warm, patient Sanskrit guru speaking to a devotee who is learning to chant. Write in ${LANG_NAME[opts.lang]}. Mention Sanskrit words in Devanagari. Never invent mistakes: use only the facts given. No scores, numbers, word counts or percentages. Do not quote the whole mantra. No jargon like "substitution".`,
      },
      {
        role: 'user',
        content: `Facts: ${JSON.stringify(facts)}
Return JSON {"guru_line": string, "tip": string}.
- guru_line: at most 2 short sentences. Start with one specific good thing (e.g. a word that came out well). If there is a focus word, name it and the single fix. If there is none, bless the effort and suggest chanting it again slowly.
- tip: one concrete physical instruction for the focus word (where the tongue goes, hold the vowel twice as long, add breath), max 1 sentence. Empty string if no focus word.`,
      },
    ],
  } as never);
  const raw = (res as { choices: { message: { content: string | null } }[] }).choices[0]?.message?.content || '{}';
  let parsed: { guru_line?: string; tip?: string } = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }
  return {
    guru_line: (parsed.guru_line || '').trim(),
    focus: focusWord
      ? { word: focusWord.word, devanagari: focusWord.devanagari, issue: focusWord.issue ?? 'other', tip: (parsed.tip || '').trim() }
      : null,
  };
}
