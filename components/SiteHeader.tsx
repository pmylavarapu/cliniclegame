'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const MENU_NAV = [
  { href: '/', label: 'Today' },
  { href: '/how-to-play/', label: 'How to play' },
  { href: '/how-it-works/', label: 'How it works' },
  { href: '/feedback/', label: 'Feedback' },
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
      <header className="sticky top-0 z-30 bg-bg/85 backdrop-blur-xl border-b border-border/60">
        <div className="mx-auto max-w-2xl px-4 sm:px-5 h-20 sm:h-20 flex items-center justify-between">
          <Link
            href="/"
            onClick={() => {
              if (pathname === '/' || pathname === '') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
            className="flex items-center hover:opacity-80 transition-opacity"
            aria-label="Clinicle home"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Clinicle"
              width={690}
              height={252}
              className="h-14 sm:h-14 w-auto"
            />
          </Link>
          <button
            type="button"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="inline-flex items-center justify-center h-11 w-11 -mr-2 rounded-full text-fg hover:bg-surface-2 active:scale-95 transition-all"
          >
            {menuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </header>

      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-30 bg-fg/20 backdrop-blur-sm animate-in"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <nav
            className="fixed top-16 right-3 left-3 sm:left-auto sm:w-72 z-40 rounded-2xl bg-bg border border-border shadow-2xl animate-in"
            aria-label="Site navigation"
          >
            <ul className="p-2">
              {MENU_NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={[
                      'flex items-center justify-between px-3 py-3 rounded-xl text-body font-semibold transition-colors',
                      isActive(item.href)
                        ? 'bg-primary/10 text-primary'
                        : 'text-fg hover:bg-surface-2',
                    ].join(' ')}
                  >
                    <span>{item.label}</span>
                    {isActive(item.href) && (
                      <span aria-hidden="true">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12l5 5L20 7" />
                        </svg>
                      </span>
                    )}
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

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M4 8h16M4 16h16" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
