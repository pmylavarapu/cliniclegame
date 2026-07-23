import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import SiteHeader from '@/components/SiteHeader';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://clinicle.app'),
  title: 'Clinicle – the daily medical diagnosis game',
  description:
    'A new secret diagnosis every day. Guess medical words and phrases – the closer you get, the higher your score. Semantle for medicine.',
  keywords: [
    'Clinicle',
    'daily medical game',
    'medical Wordle',
    'medical Semantle',
    'diagnosis game',
    'medicine puzzle',
    'medical vocabulary',
  ],
  openGraph: {
    title: 'Clinicle – the daily medical diagnosis game',
    description:
      'One secret diagnosis a day. Guess words and phrases; get closer, get warmer. Free, no login.',
    url: 'https://clinicle.app',
    siteName: 'Clinicle',
    images: [
      {
        url: '/logo.png',
        width: 740,
        height: 312,
        alt: 'Clinicle',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Clinicle – daily medical diagnosis game',
    description:
      'One diagnosis a day. Guess words; get closer, get warmer. #Clinicle',
    images: ['/logo.png'],
    creator: '@PMylavarapuMD',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen flex flex-col font-sans antialiased text-fg text-body">
        <SiteHeader />
        <main className="flex-1 mx-auto w-full max-w-2xl px-4 sm:px-5 pt-10 sm:pt-14 pb-16">
          {children}
        </main>
        <footer className="border-t border-border">
          <div className="mx-auto max-w-2xl px-4 sm:px-5 py-5 flex flex-col sm:flex-row items-center justify-between gap-1.5 text-caption text-muted">
            <div>
              Developed by{' '}
              <a
                href="https://twitter.com/PMylavarapuMD"
                target="_blank"
                rel="noopener noreferrer"
                className="text-link font-medium hover:underline"
              >
                @PMylavarapuMD
              </a>
            </div>
            <div className="tabular">Updated {new Date().getFullYear()}</div>
          </div>
        </footer>
      </body>
    </html>
  );
}
