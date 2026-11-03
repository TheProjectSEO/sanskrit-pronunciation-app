import type { Metadata, Viewport } from 'next';
import { Tiro_Devanagari_Sanskrit } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

// Mantra text only; the interface uses the system font, as it always has.
const tiro = Tiro_Devanagari_Sanskrit({ subsets: ['latin', 'latin-ext', 'devanagari'], weight: '400', style: ['normal', 'italic'], variable: '--font-tiro', display: 'swap' });

export const metadata: Metadata = {
  title: 'Tapaswe - Sanskrit Pronunciation',
  description: 'Perfect your Sanskrit pronunciation with Tapaswe',
  applicationName: 'Tapaswe',
};

export const viewport: Viewport = {
  themeColor: '#FFFFFF',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={tiro.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
