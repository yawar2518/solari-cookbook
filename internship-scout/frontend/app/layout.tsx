import type { Metadata, Viewport } from 'next'
import { Inter, Sora } from 'next/font/google'
import { ToastProvider } from '@/components/providers/ToastProvider'
import './globals.css'

const sora = Sora({ subsets: ['latin'], variable: '--font-sora', weight: ['400', '500', '600', '700', '800'] })
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', weight: ['400', '500', '600'] })

export const metadata: Metadata = {
  title: { default: 'fyt — Find your fit', template: '%s · fyt' },
  description:
    'fyt reads your background in plain English and matches you to real jobs and internships ranked by fit — not just keyword filters.',
  applicationName: 'fyt',
  openGraph: {
    title: 'fyt — Find your fit',
    siteName: 'fyt',
    description: 'Context-aware job and internship matching for students and early-career professionals.',
    type: 'website',
  },
}

export const viewport: Viewport = {
  themeColor: '#050A18',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sora.variable} ${inter.variable}`}>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  )
}
