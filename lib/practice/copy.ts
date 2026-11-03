import type { FeedbackLanguage } from '@/lib/constants/languages';

export interface PracticeCopy {
  back: string;
  steps: [string, string, string];
  fullMantra: string;
  verse: (n: number) => string;
  tapWord: string;
  listenTitle: string;
  listen: string;
  pause: string;
  speeds: { veryslow: string; slow: string; normal: string };
  speedLabel: string;
  repeatTitle: string;
  startChant: string;
  stopChant: string;
  recordingHint: string;
  listening: string;
  /** Steps shown while an attempt is checked; each one is reported by the server. */
  progress: { sending: string; listening: string; writing: string; usually: string };
  bands: { close: string; getting_there: string; needs_practice: string };
  bandNote: string;
  heard: string;
  hearTeacher: string;
  hearYourself: string;
  hearGuru: string;
  practiceWord: string;
  tryAgain: string;
  verdictAsk: string;
  verdictYes: string;
  verdictNo: string;
  verdictThanks: string;
  progressTitle: string;
  progressFirst: string;
  progressNow: string;
  progressCount: (n: number) => string;
  nextVerse: string;
  listenAgain: string;
  feedbackIn: string;
  wordDrillTitle: string;
  done: string;
  close: string;
  errors: {
    micDenied: string;
    micDeniedSteps: string;
    micMissing: string;
    network: string;
    tooShort: string;
    tooQuiet: string;
    tooLong: string;
    decodeFailed: string;
    retry: string;
    loadFailed: string;
  };
}

const hi: PracticeCopy = {
  back: 'मंत्र सूची',
  steps: ['सुनें', 'दोहराएँ', 'गुरु की बात'],
  fullMantra: 'पूरा मंत्र',
  verse: (n) => `श्लोक ${n}`,
  tapWord: 'किसी भी शब्द को छूकर गुरुजी से सुनें',
  listenTitle: 'पहले गुरुजी को ध्यान से सुनें',
  listen: 'सुनें',
  pause: 'रोकें',
  speeds: { veryslow: 'बहुत धीमा', slow: 'धीमा', normal: 'सामान्य' },
  speedLabel: 'गति',
  repeatTitle: 'अब आप उसी तरह बोलें',
  startChant: 'बोलना शुरू करें',
  stopChant: 'पूरा हुआ',
  recordingHint: 'सुन रहे हैं… मंत्र पूरा होने पर “पूरा हुआ” दबाएँ',
  listening: 'गुरुजी ध्यान से सुन रहे हैं…',
  progress: { sending: 'आपकी रिकॉर्डिंग भेजी जा रही है', listening: 'हर शब्द सुनकर गुरुजी की आवाज़ से मिलाया जा रहा है', writing: 'गुरुजी सलाह लिख रहे हैं…', usually: 'आमतौर पर लगभग 8 सेकंड लगते हैं' },
  bands: { close: 'बहुत सुंदर, लगभग गुरुजी जैसा', getting_there: 'अच्छा, थोड़ा और अभ्यास', needs_practice: 'धीरे-धीरे फिर से अभ्यास करें' },
  bandNote: 'यह आकलन आपकी रिकॉर्डिंग में जो सुना गया उस पर आधारित है।',
  heard: 'सुनाई दिया',
  hearTeacher: 'गुरुजी',
  hearYourself: 'आप',
  hearGuru: 'सुनें',
  practiceWord: 'यह शब्द अभ्यास करें',
  tryAgain: 'फिर से बोलें',
  verdictAsk: 'क्या यह आकलन सही था?',
  verdictYes: 'हाँ, सही',
  verdictNo: 'नहीं, गलत',
  verdictThanks: 'धन्यवाद। आपकी रिकॉर्डिंग गुरुजी तक पहुँचेगी, ताकि ऐप और बेहतर सुन सके।',
  progressTitle: 'आपकी प्रगति',
  progressFirst: 'शुरुआत',
  progressNow: 'अभी',
  progressCount: (n) => `${n} बार अभ्यास`,
  nextVerse: 'अगला श्लोक',
  listenAgain: 'गुरुजी को फिर सुनें',
  feedbackIn: 'मार्गदर्शन की भाषा',
  wordDrillTitle: 'एक शब्द का अभ्यास',
  done: 'हो गया',
  close: 'बंद करें',
  errors: {
    micDenied: 'माइक्रोफ़ोन की अनुमति नहीं मिली।',
    micDeniedSteps: 'Chrome में ऊपर ताले (🔒) के निशान पर दबाएँ → अनुमतियाँ → माइक्रोफ़ोन → अनुमति दें। फिर नीचे “फिर कोशिश करें” दबाएँ।',
    micMissing: 'इस फ़ोन पर माइक्रोफ़ोन नहीं मिला।',
    network: 'इंटरनेट धीमा है या टूट गया। आपकी रिकॉर्डिंग सुरक्षित है।',
    tooShort: 'रिकॉर्डिंग बहुत छोटी थी। पूरा मंत्र बोलें।',
    tooQuiet: 'आवाज़ बहुत धीमी थी। फ़ोन पास रखकर फिर बोलें।',
    tooLong: 'रिकॉर्डिंग 20 सेकंड से लंबी थी। एक श्लोक चुनकर बोलें।',
    decodeFailed: 'यह रिकॉर्डिंग पढ़ी नहीं जा सकी। एक बार फिर बोलें।',
    retry: 'फिर कोशिश करें',
    loadFailed: 'मंत्र खुल नहीं पाया।',
  },
};

const en: PracticeCopy = {
  back: 'Mantras',
  steps: ['Listen', 'Repeat', "Guru's word"],
  fullMantra: 'Full mantra',
  verse: (n) => `Verse ${n}`,
  tapWord: 'Tap any word to hear the teacher say it',
  listenTitle: 'First, listen to the teacher closely',
  listen: 'Listen',
  pause: 'Pause',
  speeds: { veryslow: 'Very slow', slow: 'Slow', normal: 'Normal' },
  speedLabel: 'Speed',
  repeatTitle: 'Now say it the same way',
  startChant: 'Start chanting',
  stopChant: 'Done',
  recordingHint: 'Listening… tap Done when you finish the mantra',
  listening: 'The guru is listening closely…',
  progress: { sending: 'Sending your recording', listening: 'Listening to each word and comparing with the teacher', writing: 'The guru is writing advice…', usually: 'Usually takes about 8 seconds' },
  bands: { close: 'Beautiful, very close to the teacher', getting_there: 'Good, a little more practice', needs_practice: 'Slowly, practise it again' },
  bandNote: 'Based on what we could hear in your recording.',
  heard: 'Sounded like',
  hearTeacher: 'Teacher',
  hearYourself: 'You',
  hearGuru: 'Hear it',
  practiceWord: 'Practise this word',
  tryAgain: 'Chant again',
  verdictAsk: 'Was this verdict right?',
  verdictYes: 'Yes, right',
  verdictNo: 'No, wrong',
  verdictThanks: 'Thank you. Your recording goes to the teacher so the app learns to listen better.',
  progressTitle: 'Your progress',
  progressFirst: 'First',
  progressNow: 'Now',
  progressCount: (n) => `${n} attempts`,
  nextVerse: 'Next verse',
  listenAgain: 'Listen to the teacher again',
  feedbackIn: 'Guidance language',
  wordDrillTitle: 'Practise one word',
  done: 'Done',
  close: 'Close',
  errors: {
    micDenied: 'Microphone permission was not given.',
    micDeniedSteps: 'In Chrome, tap the lock (🔒) at the top → Permissions → Microphone → Allow. Then tap “Try again” below.',
    micMissing: 'No microphone was found on this phone.',
    network: 'The internet is slow or dropped. Your recording is safe.',
    tooShort: 'That recording was very short. Chant the whole mantra.',
    tooQuiet: 'That was too quiet. Hold the phone closer and chant again.',
    tooLong: 'The recording was longer than 20 seconds. Choose one verse.',
    decodeFailed: 'We could not read that recording. Please chant once more.',
    retry: 'Try again',
    loadFailed: 'This mantra could not be opened.',
  },
};

const ta: PracticeCopy = {
  ...en,
  back: 'மந்திரங்கள்',
  steps: ['கேளுங்கள்', 'திருப்பிச் சொல்லுங்கள்', 'குருவின் சொல்'],
  fullMantra: 'முழு மந்திரம்',
  verse: (n) => `ஸ்லோகம் ${n}`,
  tapWord: 'எந்த சொல்லையும் தொட்டு குரு சொல்வதைக் கேளுங்கள்',
  listenTitle: 'முதலில் குருவை கவனமாகக் கேளுங்கள்',
  listen: 'கேளுங்கள்',
  pause: 'நிறுத்து',
  speeds: { veryslow: 'மிக மெதுவாக', slow: 'மெதுவாக', normal: 'சாதாரணம்' },
  speedLabel: 'வேகம்',
  repeatTitle: 'இப்போது அதே போல் சொல்லுங்கள்',
  startChant: 'சொல்லத் தொடங்கு',
  stopChant: 'முடிந்தது',
  recordingHint: 'கேட்கிறோம்… முடிந்ததும் “முடிந்தது” அழுத்துங்கள்',
  listening: 'குரு கவனமாகக் கேட்கிறார்…',
  progress: { sending: 'உங்கள் பதிவு அனுப்பப்படுகிறது', listening: 'ஒவ்வொரு சொல்லையும் கேட்டு குருவின் குரலுடன் ஒப்பிடப்படுகிறது', writing: 'குரு ஆலோசனை எழுதுகிறார்…', usually: 'பொதுவாக சுமார் 8 வினாடிகள் ஆகும்' },
  bands: { close: 'அருமை, குருவைப் போலவே', getting_there: 'நன்று, இன்னும் சிறிது பயிற்சி', needs_practice: 'மெதுவாக மீண்டும் பயிற்சி செய்யுங்கள்' },
  bandNote: 'உங்கள் பதிவில் கேட்டதை வைத்து மதிப்பிடப்பட்டது.',
  heard: 'கேட்டது',
  hearTeacher: 'குரு',
  hearYourself: 'நீங்கள்',
  hearGuru: 'கேளுங்கள்',
  practiceWord: 'இந்த சொல்லைப் பயிற்சி செய்',
  tryAgain: 'மீண்டும் சொல்லுங்கள்',
  verdictAsk: 'இந்த மதிப்பீடு சரியா?',
  verdictYes: 'ஆம், சரி',
  verdictNo: 'இல்லை, தவறு',
  verdictThanks: 'நன்றி. உங்கள் பதிவு குருவிடம் செல்லும்.',
  progressTitle: 'உங்கள் முன்னேற்றம்',
  progressFirst: 'தொடக்கம்',
  progressNow: 'இப்போது',
  progressCount: (n) => `${n} முயற்சிகள்`,
  nextVerse: 'அடுத்த ஸ்லோகம்',
  listenAgain: 'குருவை மீண்டும் கேளுங்கள்',
  feedbackIn: 'வழிகாட்டல் மொழி',
  wordDrillTitle: 'ஒரு சொல் பயிற்சி',
  done: 'முடிந்தது',
  close: 'மூடு',
  errors: {
    micDenied: 'மைக்ரோஃபோன் அனுமதி கிடைக்கவில்லை.',
    micDeniedSteps: 'Chrome-ல் மேலே உள்ள பூட்டு (🔒) → அனுமதிகள் → மைக்ரோஃபோன் → அனுமதி. பிறகு கீழே “மீண்டும் முயற்சி” அழுத்துங்கள்.',
    micMissing: 'இந்த ஃபோனில் மைக்ரோஃபோன் இல்லை.',
    network: 'இணையம் மெதுவாக உள்ளது அல்லது துண்டிக்கப்பட்டது. உங்கள் பதிவு பாதுகாப்பாக உள்ளது.',
    tooShort: 'பதிவு மிகச் சிறியது. முழு மந்திரத்தையும் சொல்லுங்கள்.',
    tooQuiet: 'குரல் மிக மெதுவாக இருந்தது. ஃபோனை அருகில் வைத்துச் சொல்லுங்கள்.',
    tooLong: 'பதிவு 20 விநாடிகளுக்கு மேல். ஒரு ஸ்லோகத்தைத் தேர்ந்தெடுங்கள்.',
    decodeFailed: 'பதிவைப் படிக்க முடியவில்லை. மீண்டும் சொல்லுங்கள்.',
    retry: 'மீண்டும் முயற்சி',
    loadFailed: 'இந்த மந்திரத்தைத் திறக்க முடியவில்லை.',
  },
};

const kn: PracticeCopy = {
  ...en,
  back: 'ಮಂತ್ರಗಳು',
  steps: ['ಕೇಳಿ', 'ಪುನರಾವರ್ತಿಸಿ', 'ಗುರುವಿನ ಮಾತು'],
  fullMantra: 'ಪೂರ್ಣ ಮಂತ್ರ',
  verse: (n) => `ಶ್ಲೋಕ ${n}`,
  tapWord: 'ಯಾವುದೇ ಪದವನ್ನು ಒತ್ತಿ ಗುರುಗಳು ಹೇಳುವುದನ್ನು ಕೇಳಿ',
  listenTitle: 'ಮೊದಲು ಗುರುಗಳನ್ನು ಗಮನವಿಟ್ಟು ಕೇಳಿ',
  listen: 'ಕೇಳಿ',
  pause: 'ನಿಲ್ಲಿಸಿ',
  speeds: { veryslow: 'ತುಂಬಾ ನಿಧಾನ', slow: 'ನಿಧಾನ', normal: 'ಸಾಮಾನ್ಯ' },
  speedLabel: 'ವೇಗ',
  repeatTitle: 'ಈಗ ಅದೇ ರೀತಿ ಹೇಳಿ',
  startChant: 'ಹೇಳಲು ಪ್ರಾರಂಭಿಸಿ',
  stopChant: 'ಮುಗಿಯಿತು',
  recordingHint: 'ಕೇಳುತ್ತಿದ್ದೇವೆ… ಮುಗಿದ ನಂತರ “ಮುಗಿಯಿತು” ಒತ್ತಿ',
  listening: 'ಗುರುಗಳು ಗಮನವಿಟ್ಟು ಕೇಳುತ್ತಿದ್ದಾರೆ…',
  progress: { sending: 'ನಿಮ್ಮ ರೆಕಾರ್ಡಿಂಗ್ ಕಳುಹಿಸಲಾಗುತ್ತಿದೆ', listening: 'ಪ್ರತಿ ಪದವನ್ನು ಕೇಳಿ ಗುರುಗಳ ಧ್ವನಿಯೊಂದಿಗೆ ಹೋಲಿಸಲಾಗುತ್ತಿದೆ', writing: 'ಗುರುಗಳು ಸಲಹೆ ಬರೆಯುತ್ತಿದ್ದಾರೆ…', usually: 'ಸಾಮಾನ್ಯವಾಗಿ ಸುಮಾರು 8 ಸೆಕೆಂಡುಗಳು ಬೇಕಾಗುತ್ತದೆ' },
  bands: { close: 'ಅದ್ಭುತ, ಗುರುಗಳಂತೆಯೇ', getting_there: 'ಚೆನ್ನಾಗಿದೆ, ಇನ್ನಷ್ಟು ಅಭ್ಯಾಸ', needs_practice: 'ನಿಧಾನವಾಗಿ ಮತ್ತೆ ಅಭ್ಯಾಸ ಮಾಡಿ' },
  bandNote: 'ನಿಮ್ಮ ರೆಕಾರ್ಡಿಂಗ್‌ನಲ್ಲಿ ಕೇಳಿಸಿದ್ದನ್ನು ಆಧರಿಸಿದೆ.',
  heard: 'ಕೇಳಿಸಿದ್ದು',
  hearTeacher: 'ಗುರು',
  hearYourself: 'ನೀವು',
  hearGuru: 'ಕೇಳಿ',
  practiceWord: 'ಈ ಪದ ಅಭ್ಯಾಸ ಮಾಡಿ',
  tryAgain: 'ಮತ್ತೆ ಹೇಳಿ',
  verdictAsk: 'ಈ ಮೌಲ್ಯಮಾಪನ ಸರಿಯೇ?',
  verdictYes: 'ಹೌದು, ಸರಿ',
  verdictNo: 'ಇಲ್ಲ, ತಪ್ಪು',
  verdictThanks: 'ಧನ್ಯವಾದಗಳು. ನಿಮ್ಮ ಧ್ವನಿಮುದ್ರಣ ಗುರುಗಳಿಗೆ ತಲುಪುತ್ತದೆ.',
  progressTitle: 'ನಿಮ್ಮ ಪ್ರಗತಿ',
  progressFirst: 'ಆರಂಭ',
  progressNow: 'ಈಗ',
  progressCount: (n) => `${n} ಪ್ರಯತ್ನಗಳು`,
  nextVerse: 'ಮುಂದಿನ ಶ್ಲೋಕ',
  listenAgain: 'ಗುರುಗಳನ್ನು ಮತ್ತೆ ಕೇಳಿ',
  feedbackIn: 'ಮಾರ್ಗದರ್ಶನದ ಭಾಷೆ',
  wordDrillTitle: 'ಒಂದು ಪದದ ಅಭ್ಯಾಸ',
  done: 'ಮುಗಿಯಿತು',
  close: 'ಮುಚ್ಚಿ',
  errors: {
    micDenied: 'ಮೈಕ್ರೊಫೋನ್ ಅನುಮತಿ ಸಿಗಲಿಲ್ಲ.',
    micDeniedSteps: 'Chrome ನಲ್ಲಿ ಮೇಲಿನ ಬೀಗ (🔒) → ಅನುಮತಿಗಳು → ಮೈಕ್ರೊಫೋನ್ → ಅನುಮತಿಸಿ. ನಂತರ ಕೆಳಗೆ “ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ” ಒತ್ತಿ.',
    micMissing: 'ಈ ಫೋನ್‌ನಲ್ಲಿ ಮೈಕ್ರೊಫೋನ್ ಸಿಗಲಿಲ್ಲ.',
    network: 'ಇಂಟರ್ನೆಟ್ ನಿಧಾನವಾಗಿದೆ ಅಥವಾ ಕಡಿತಗೊಂಡಿದೆ. ನಿಮ್ಮ ರೆಕಾರ್ಡಿಂಗ್ ಸುರಕ್ಷಿತವಾಗಿದೆ.',
    tooShort: 'ರೆಕಾರ್ಡಿಂಗ್ ತುಂಬಾ ಚಿಕ್ಕದು. ಪೂರ್ಣ ಮಂತ್ರ ಹೇಳಿ.',
    tooQuiet: 'ಧ್ವನಿ ತುಂಬಾ ಮೃದು. ಫೋನ್ ಹತ್ತಿರ ಇಟ್ಟು ಮತ್ತೆ ಹೇಳಿ.',
    tooLong: 'ರೆಕಾರ್ಡಿಂಗ್ 20 ಸೆಕೆಂಡಿಗಿಂತ ಉದ್ದ. ಒಂದು ಶ್ಲೋಕ ಆರಿಸಿ.',
    decodeFailed: 'ರೆಕಾರ್ಡಿಂಗ್ ಓದಲಾಗಲಿಲ್ಲ. ಮತ್ತೊಮ್ಮೆ ಹೇಳಿ.',
    retry: 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ',
    loadFailed: 'ಈ ಮಂತ್ರವನ್ನು ತೆರೆಯಲಾಗಲಿಲ್ಲ.',
  },
};

const te: PracticeCopy = {
  ...en,
  back: 'మంత్రాలు',
  steps: ['వినండి', 'తిరిగి చెప్పండి', 'గురువు మాట'],
  fullMantra: 'పూర్తి మంత్రం',
  verse: (n) => `శ్లోకం ${n}`,
  tapWord: 'ఏ పదాన్నైనా తాకి గురువుగారు చెప్పేది వినండి',
  listenTitle: 'ముందుగా గురువుగారిని శ్రద్ధగా వినండి',
  listen: 'వినండి',
  pause: 'ఆపండి',
  speeds: { veryslow: 'చాలా నెమ్మదిగా', slow: 'నెమ్మదిగా', normal: 'సాధారణం' },
  speedLabel: 'వేగం',
  repeatTitle: 'ఇప్పుడు అదే విధంగా చెప్పండి',
  startChant: 'చెప్పడం ప్రారంభించండి',
  stopChant: 'అయిపోయింది',
  recordingHint: 'వింటున్నాం… పూర్తయ్యాక “అయిపోయింది” నొక్కండి',
  listening: 'గురువుగారు శ్రద్ధగా వింటున్నారు…',
  progress: { sending: 'మీ రికార్డింగ్ పంపబడుతోంది', listening: 'ప్రతి పదాన్ని విని గురువుగారి స్వరంతో పోలుస్తున్నాం', writing: 'గురువుగారు సలహా రాస్తున్నారు…', usually: 'సాధారణంగా సుమారు 8 సెకన్లు పడుతుంది' },
  bands: { close: 'అద్భుతం, గురువుగారిలాగే', getting_there: 'బాగుంది, ఇంకొంచెం సాధన', needs_practice: 'నెమ్మదిగా మళ్ళీ సాధన చేయండి' },
  bandNote: 'మీ రికార్డింగ్‌లో వినబడిన దాని ఆధారంగా.',
  heard: 'వినబడింది',
  hearTeacher: 'గురువు',
  hearYourself: 'మీరు',
  hearGuru: 'వినండి',
  practiceWord: 'ఈ పదం సాధన చేయండి',
  tryAgain: 'మళ్ళీ చెప్పండి',
  verdictAsk: 'ఈ అంచనా సరైనదేనా?',
  verdictYes: 'అవును, సరైనది',
  verdictNo: 'కాదు, తప్పు',
  verdictThanks: 'ధన్యవాదాలు. మీ రికార్డింగ్ గురువుగారికి చేరుతుంది.',
  progressTitle: 'మీ పురోగతి',
  progressFirst: 'మొదట',
  progressNow: 'ఇప్పుడు',
  progressCount: (n) => `${n} ప్రయత్నాలు`,
  nextVerse: 'తదుపరి శ్లోకం',
  listenAgain: 'గురువుగారిని మళ్ళీ వినండి',
  feedbackIn: 'మార్గదర్శన భాష',
  wordDrillTitle: 'ఒక పదం సాధన',
  done: 'అయిపోయింది',
  close: 'మూసివేయి',
  errors: {
    micDenied: 'మైక్రోఫోన్ అనుమతి లభించలేదు.',
    micDeniedSteps: 'Chrome లో పైన తాళం (🔒) → అనుమతులు → మైక్రోఫోన్ → అనుమతించు. తర్వాత కింద “మళ్ళీ ప్రయత్నించండి” నొక్కండి.',
    micMissing: 'ఈ ఫోన్‌లో మైక్రోఫోన్ కనబడలేదు.',
    network: 'ఇంటర్నెట్ నెమ్మదిగా ఉంది లేదా ఆగిపోయింది. మీ రికార్డింగ్ సురక్షితం.',
    tooShort: 'రికార్డింగ్ చాలా చిన్నది. పూర్తి మంత్రం చెప్పండి.',
    tooQuiet: 'స్వరం చాలా మెల్లగా ఉంది. ఫోన్ దగ్గరగా పెట్టి మళ్ళీ చెప్పండి.',
    tooLong: 'రికార్డింగ్ 20 సెకన్ల కంటే ఎక్కువ. ఒక శ్లోకం ఎంచుకోండి.',
    decodeFailed: 'రికార్డింగ్ చదవలేకపోయాం. మరోసారి చెప్పండి.',
    retry: 'మళ్ళీ ప్రయత్నించండి',
    loadFailed: 'ఈ మంత్రాన్ని తెరవలేకపోయాం.',
  },
};

const ALL: Record<FeedbackLanguage, PracticeCopy> = { hindi: hi, english: en, tamil: ta, kannada: kn, telugu: te };
export const LANG_ATTR: Record<FeedbackLanguage, string> = { hindi: 'hi', english: 'en', tamil: 'ta', kannada: 'kn', telugu: 'te' };
export function copyFor(lang: FeedbackLanguage): PracticeCopy {
  return ALL[lang] ?? hi;
}
