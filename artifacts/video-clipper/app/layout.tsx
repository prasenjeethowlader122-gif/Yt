import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Providers from './providers'
import '../src/index.css'

export const metadata: Metadata = {
  title: 'ClipForge — Precision video tools',
  description: 'Cut exactly what you mean from permitted YouTube and Facebook sources.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="bg-background">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
