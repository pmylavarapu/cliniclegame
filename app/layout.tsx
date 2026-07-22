import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Clinicle — guess the diagnosis',
  description: 'Semantle for medical diagnoses. A new secret diagnosis every day.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b border-border">
          <div className="mx-auto max-w-2xl px-5 h-14 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 hover:opacity-70 transition-opacity">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.svg" alt="" width={28} height={28} className="w-7 h-7" />
              <span className="text-xl font-semibold tracking-tight">linicle</span>
            </Link>
            <nav className="flex items-center gap-5 text-sm">
              <Link href="/" className="hover:text-primary transition-colors">Today</Link>
              <Link href="/archive/" className="hover:text-primary transition-colors">Archive</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-2xl px-5 py-8">{children}</main>
      </body>
    </html>
  );
}
