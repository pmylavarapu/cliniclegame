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
  title: 'Clinicle — guess the diagnosis',
  description:
    'Semantle for medical diagnoses. A new secret diagnosis every day.',
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
        <main className="flex-1 mx-auto w-full max-w-2xl px-5 pt-10 sm:pt-14 pb-16">
          {children}
        </main>
        <footer className="border-t border-border">
          <div className="mx-auto max-w-2xl px-5 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-caption text-muted">
            <div>
              Developed by{' '}
              <a
                href="https://github.com/pmylavarapu"
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
