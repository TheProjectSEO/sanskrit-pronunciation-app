export const FEEDBACK_LANGUAGES = [
  { code: 'hindi', label: 'हिन्दी', labelEn: 'Hindi' },
  { code: 'english', label: 'English', labelEn: 'English' },
  { code: 'kannada', label: 'ಕನ್ನಡ', labelEn: 'Kannada' },
  { code: 'tamil', label: 'தமிழ்', labelEn: 'Tamil' },
  { code: 'telugu', label: 'తెలుగు', labelEn: 'Telugu' },
] as const;

export type FeedbackLanguage = (typeof FEEDBACK_LANGUAGES)[number]['code'];

export const DEFAULT_LANGUAGE: FeedbackLanguage = 'hindi';

export function getLanguageLabel(code: string): string {
  const lang = FEEDBACK_LANGUAGES.find((l) => l.code === code);
  return lang ? lang.label : 'हिन्दी';
}

export function getLanguagePromptInstruction(code: string): string {
  switch (code) {
    case 'hindi':
      return 'Provide all feedback text (hindi_feedback, explanation_hindi, practice_suggestions) in Hindi (Devanagari script). Sound like a patient Hindi-speaking Sanskrit guru.';
    case 'english':
      return 'Provide all feedback text (hindi_feedback, explanation_hindi, practice_suggestions) in English. Sound like a patient, knowledgeable Sanskrit teacher. Use the hindi_feedback field for the main English feedback.';
    case 'kannada':
      return 'Provide all feedback text (hindi_feedback, explanation_hindi, practice_suggestions) in Kannada (ಕನ್ನಡ script). Sound like a patient Kannada-speaking Sanskrit guru. Use the hindi_feedback field for the main Kannada feedback.';
    case 'tamil':
      return 'Provide all feedback text (hindi_feedback, explanation_hindi, practice_suggestions) in Tamil (தமிழ் script). Sound like a patient Tamil-speaking Sanskrit guru. Use the hindi_feedback field for the main Tamil feedback.';
    case 'telugu':
      return 'Provide all feedback text (hindi_feedback, explanation_hindi, practice_suggestions) in Telugu (తెలుగు script). Sound like a patient Telugu-speaking Sanskrit guru. Use the hindi_feedback field for the main Telugu feedback.';
    default:
      return 'Provide all feedback text in Hindi (Devanagari script).';
  }
}
