import './globals.css'
import { Providers } from './providers'

export const metadata = {
  title: 'Tapaswe - Sanskrit Pronunciation',
  description: 'Perfect your Sanskrit pronunciation with Tapaswe',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
