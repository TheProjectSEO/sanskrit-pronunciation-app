'use client';

import { SessionProvider } from 'next-auth/react';
import { ReactNode } from 'react';
import { AppLanguageProvider } from '@/lib/i18n/AppLanguage';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <AppLanguageProvider>{children}</AppLanguageProvider>
    </SessionProvider>
  );
}
