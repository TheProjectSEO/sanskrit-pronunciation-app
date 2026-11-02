import type { Metadata, Viewport } from 'next';
import { Mukta, Tiro_Devanagari_Sanskrit, Noto_Sans_Tamil, Noto_Sans_Kannada, Noto_Sans_Telugu } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const mukta = Mukta({ subsets: ['latin', 'latin-ext', 'devanagari'], weight: ['400', '500', '600', '700'], variable: '--font-mukta', display: 'swap' });
const tiro = Tiro_Devanagari_Sanskrit({ subsets: ['latin', 'latin-ext', 'devanagari'], weight: '400', style: ['normal', 'italic'], variable: '--font-tiro', display: 'swap' });
const tamil = Noto_Sans_Tamil({ subsets: ['tamil'], weight: ['400', '600'], variable: '--font-noto-tamil', display: 'swap', preload: false });
const kannada = Noto_Sans_Kannada({ subsets: ['kannada'], weight: ['400', '600'], variable: '--font-noto-kannada', display: 'swap', preload: false });
const telugu = Noto_Sans_Telugu({ subsets: ['telugu'], weight: ['400', '600'], variable: '--font-noto-telugu', display: 'swap', preload: false });

export const metadata: Metadata = {
  title: 'Tapaswe · Sanskrit chanting with your teacher',
  description: 'Listen to the teacher, repeat, and hear one clear correction at a time.',
  applicationName: 'Tapaswe',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#5c1a12' },
    { media: '(prefers-color-scheme: dark)', color: '#3a100b' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hi" className={`${mukta.variable} ${tiro.variable} ${tamil.variable} ${kannada.variable} ${telugu.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
