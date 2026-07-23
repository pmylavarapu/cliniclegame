'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const NAV = [
  { href: '/', label: 'Play', icon: GamepadIcon },
  { href: '/how-to-play/', label: 'How To', icon: BookIcon },
  { href: '/how-it-works/', label: 'About', icon: InfoIcon },
];

export default function SiteHeader() {
  const pathname = usePathname() || '/';
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [menuOpen]);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/' || pathname === '';
    return pathname === href || pathname === href.replace(/\/$/, '');
  };

  return (
    <>
      <header className="sticky top-0 z-30 bg-bg/95 backdrop-blur-xl border-b border-border/60">
        <div className="mx-auto max-w-4xl px-4 sm:px-5 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="flex items-center hover:opacity-90 transition-opacity shrink-0"
            aria-label="Clinicle home"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo_long.png"
              alt="Clinicle — the game"
              width={2172}
              height={724}
              className="h-14 sm:h-24 w-auto block"
            />
          </Link>

          <nav
            className="hidden md:flex items-center gap-4"
            aria-label="Site navigation"
          >
            {NAV.map((item, i) => (
              <div key={item.href} className="flex items-center gap-4">
                {i > 0 && <span aria-hidden="true" className="h-4 w-px bg-border-strong" />}
                <Link
                  href={item.href}
                  className={[
                    'inline-flex items-center gap-1.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] transition-colors',
                    isActive(item.href)
                      ? 'text-primary border-b-2 border-primary'
                      : 'text-fg-soft hover:text-primary',
                  ].join(' ')}
                >
                  <item.icon />
                  {item.label}
                </Link>
              </div>
            ))}
          </nav>

          <button
            type="button"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="md:hidden inline-flex items-center justify-center h-10 w-10 -mr-2 rounded-full text-fg hover:bg-surface-2 active:scale-95 transition-all"
          >
            {menuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </header>

      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-30 bg-fg/20 backdrop-blur-sm animate-in md:hidden"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <nav
            className="fixed top-14 right-3 left-3 z-40 rounded-2xl bg-bg border border-border shadow-2xl animate-in md:hidden"
            aria-label="Site navigation"
          >
            <ul className="p-2">
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={[
                      'flex items-center gap-3 px-3 py-3 rounded-xl text-body font-semibold transition-colors',
                      isActive(item.href)
                        ? 'text-primary bg-primary/10'
                        : 'text-fg hover:bg-surface-2',
                    ].join(' ')}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </>
      )}
    </>
  );
}

function GamepadIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <line x1="6" y1="12" x2="10" y2="12" />
      <line x1="8" y1="10" x2="8" y2="14" />
      <line x1="15" y1="13" x2="15.01" y2="13" />
      <line x1="18" y1="11" x2="18.01" y2="11" />
      <rect x="2" y="6" width="20" height="12" rx="6" />
    </svg>
  );
}

function BookIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M4 8h16M4 16h16" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
