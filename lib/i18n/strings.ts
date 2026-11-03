export type AppLang = 'en' | 'hi';

const en = {
  nav: { home: 'Home', mantras: 'Mantras', record: 'Record', profile: 'Profile', admin: 'Admin', signIn: 'Sign In', signOut: 'Sign out' },
  home: {
    empty: 'No mantras available yet.', emptySub: 'Check back soon!', other: 'Other', continue: 'Continue practising',
    week: 'This week', attempts: (n: number) => `${n} recitations`, mantrasPractised: (n: number) => `${n} mantras practised`, bestScore: (n: number) => `Best score ${n}%`,
    ctaTitle: 'Start Your Journey', ctaBody: 'Sign in to track progress and get personalized feedback', ctaButton: 'Get Started Free',
    verses: (n: number) => `${n} verses`,
  },
  mantras: {
    title: 'Mantras', search: 'Search mantras', all: 'All', mine: 'My recordings', allDeities: 'All deities', none: 'No mantras match.',
    mineEmpty: 'You have not recorded a mantra yet.', recordOne: 'Record a mantra',
    status: { private: 'Only people with the link', submitted: 'Waiting for review', rejected: 'Not accepted', published: 'In the library', draft: 'Draft' },
    share: 'Copy share link', copied: 'Link copied', submit: 'Submit to library', practise: 'Practise', remove: 'Delete',
    confirmRemove: 'Delete this recording? This cannot be undone.', confirmYes: 'Yes, delete', confirmNo: 'Cancel',
  },
  record: {
    title: 'Record a mantra', intro: 'Record a mantra from your tradition so family and friends can practise it with your voice.',
    name: 'Name', namePh: 'e.g. Kuldevi stuti', deva: 'Text in Devanagari (optional)', roman: 'Text in English letters (optional)',
    textHint: 'If you leave the text empty, we write down what you recite. You can correct it afterwards.',
    deity: 'Deity (optional)', none: 'None',
    step1: '1. Details', step2: '2. Your recording', step3: '3. Save',
    start: 'Start recording', stop: 'Stop', again: 'Record again', or: 'or', upload: 'Upload an audio file', recorded: (s: number) => `Recorded ${s}s`,
    save: 'Save recording', saving: 'Saving and listening…', saved: 'Saved', savedBody: 'Only people with this link can practise it. Submit it to the library if you want everyone to see it.',
    open: 'Practise it now', mine: 'My recordings', signIn: 'Sign in to record your own mantras.',
    errors: { name: 'Please give it a name.', audio: 'Please record or upload the mantra.', mic: 'Microphone is blocked. Allow it in your browser settings.', tooLong: 'Keep it under 3 minutes.', failed: 'Could not save. Please try again.' },
  },
  profile: {
    title: 'Profile', progress: 'My progress', noProgress: 'Practise a mantra and your progress shows up here.', attempts: (n: number) => `${n} attempts`, last: 'Last', best: 'Best',
    language: 'App language', feedback: 'Guru feedback language', account: 'Account', role: 'Role', signOut: 'Sign out', admin: 'Open admin',
  },
};

const hi: typeof en = {
  nav: { home: 'होम', mantras: 'मंत्र', record: 'रिकॉर्ड', profile: 'प्रोफ़ाइल', admin: 'एडमिन', signIn: 'प्रवेश करें', signOut: 'बाहर निकलें' },
  home: {
    empty: 'अभी कोई मंत्र नहीं है।', emptySub: 'जल्द ही जोड़े जाएँगे!', other: 'अन्य', continue: 'अभ्यास जारी रखें',
    week: 'इस सप्ताह', attempts: (n) => `${n} बार जाप`, mantrasPractised: (n) => `${n} मंत्रों का अभ्यास`, bestScore: (n) => `सर्वश्रेष्ठ ${n}%`,
    ctaTitle: 'अपनी यात्रा शुरू करें', ctaBody: 'प्रगति देखने और व्यक्तिगत मार्गदर्शन पाने के लिए प्रवेश करें', ctaButton: 'निःशुल्क शुरू करें',
    verses: (n) => `${n} श्लोक`,
  },
  mantras: {
    title: 'मंत्र', search: 'मंत्र खोजें', all: 'सभी', mine: 'मेरी रिकॉर्डिंग', allDeities: 'सभी देवता', none: 'कोई मंत्र नहीं मिला।',
    mineEmpty: 'आपने अभी कोई मंत्र रिकॉर्ड नहीं किया है।', recordOne: 'मंत्र रिकॉर्ड करें',
    status: { private: 'केवल लिंक वाले लोग', submitted: 'समीक्षा की प्रतीक्षा', rejected: 'स्वीकार नहीं हुआ', published: 'लाइब्रेरी में', draft: 'ड्राफ़्ट' },
    share: 'लिंक कॉपी करें', copied: 'लिंक कॉपी हुआ', submit: 'लाइब्रेरी में भेजें', practise: 'अभ्यास करें', remove: 'हटाएँ',
    confirmRemove: 'यह रिकॉर्डिंग हटाएँ? यह वापस नहीं आएगी।', confirmYes: 'हाँ, हटाएँ', confirmNo: 'रद्द करें',
  },
  record: {
    title: 'मंत्र रिकॉर्ड करें', intro: 'अपनी परंपरा का मंत्र रिकॉर्ड करें, ताकि परिवार और मित्र आपकी आवाज़ के साथ अभ्यास कर सकें।',
    name: 'नाम', namePh: 'जैसे कुलदेवी स्तुति', deva: 'देवनागरी में पाठ (वैकल्पिक)', roman: 'अंग्रेज़ी अक्षरों में पाठ (वैकल्पिक)',
    textHint: 'पाठ खाली छोड़ने पर हम आपकी रिकॉर्डिंग से लिख लेंगे। बाद में सुधार सकते हैं।',
    deity: 'देवता (वैकल्पिक)', none: 'कोई नहीं',
    step1: '1. विवरण', step2: '2. आपकी रिकॉर्डिंग', step3: '3. सहेजें',
    start: 'रिकॉर्डिंग शुरू करें', stop: 'रोकें', again: 'फिर से रिकॉर्ड करें', or: 'या', upload: 'ऑडियो फ़ाइल अपलोड करें', recorded: (s) => `${s} सेकंड रिकॉर्ड हुआ`,
    save: 'रिकॉर्डिंग सहेजें', saving: 'सहेज रहे हैं और सुन रहे हैं…', saved: 'सहेज लिया', savedBody: 'केवल इस लिंक वाले लोग इसका अभ्यास कर सकते हैं। सबके लिए लाइब्रेरी में भेजना हो तो “लाइब्रेरी में भेजें” दबाएँ।',
    open: 'अभी अभ्यास करें', mine: 'मेरी रिकॉर्डिंग', signIn: 'अपने मंत्र रिकॉर्ड करने के लिए प्रवेश करें।',
    errors: { name: 'कृपया नाम लिखें।', audio: 'कृपया मंत्र रिकॉर्ड या अपलोड करें।', mic: 'माइक्रोफ़ोन बंद है। ब्राउज़र सेटिंग में अनुमति दें।', tooLong: '3 मिनट से छोटा रखें।', failed: 'सहेज नहीं पाए। फिर से कोशिश करें।' },
  },
  profile: {
    title: 'प्रोफ़ाइल', progress: 'मेरी प्रगति', noProgress: 'किसी मंत्र का अभ्यास करें, आपकी प्रगति यहाँ दिखेगी।', attempts: (n) => `${n} प्रयास`, last: 'पिछला', best: 'सर्वश्रेष्ठ',
    language: 'ऐप की भाषा', feedback: 'गुरु मार्गदर्शन की भाषा', account: 'खाता', role: 'भूमिका', signOut: 'बाहर निकलें', admin: 'एडमिन खोलें',
  },
};

export const STRINGS: Record<AppLang, typeof en> = { en, hi };
export type Strings = typeof en;
