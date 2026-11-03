'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { STRINGS, type AppLang, type Strings } from './strings';

const KEY = 'tapaswe.appLang';
const Ctx = createContext<{ lang: AppLang; setLang: (l: AppLang) => void; t: Strings }>({ lang: 'en', setLang: () => {}, t: STRINGS.en });

/** Interface language (English / Hindi), remembered on this device. */
export function AppLanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<AppLang>('en');
  useEffect(() => {
    try {
      const v = localStorage.getItem(KEY);
      if (v === 'en' || v === 'hi') setLangState(v);
    } catch { /* storage blocked: stay in English */ }
  }, []);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const setLang = (l: AppLang) => {
    setLangState(l);
    try { localStorage.setItem(KEY, l); } catch { /* ignore */ }
  };
  return <Ctx.Provider value={{ lang, setLang, t: STRINGS[lang] }}>{children}</Ctx.Provider>;
}

export const useAppLanguage = () => useContext(Ctx);
