import './globals.css';
import type { Metadata } from 'next';
import { Nunito } from 'next/font/google';
import SiteHeader from '@/components/SiteHeader';

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  display: 'swap',
  variable: '--font-nunito',
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
    <html lang="en" className={nunito.variable}>
      <body className="min-h-screen font-sans antialiased text-fg">
        <SiteHeader />
        <main className="mx-auto max-w-2xl px-5 py-8 sm:py-10">{children}</main>
        <footer className="mx-auto max-w-2xl px-5 pb-10 pt-6 border-t border-border text-center text-sm text-muted">
          Developed by{' '}
          <a
            href="https://github.com/pmylavarapu"
            target="_blank"
            rel="noopener noreferrer"
            className="text-link font-semibold hover:underline"
          >
            @PMylavarapuMD
          </a>{' '}
          · Updated {new Date().getFullYear()}
        </footer>
      </body>
    </html>
  );
}
