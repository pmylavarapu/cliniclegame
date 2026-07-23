'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const NAV = [
  { href: '/how-to-play/', label: 'How To', icon: GamepadIcon },
  { href: '/how-it-works/', label: 'About', icon: BookIcon },
  { href: '/feedback/', label: 'Feedback', icon: ChatIcon },
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
      <header className="sticky top-0 z-30 bg-[#091235] text-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-8 h-20 sm:h-24 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="flex items-center hover:opacity-90 transition-opacity shrink-0"
            aria-label="Clinicle home"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Clinicle — the game"
              width={1536}
              height={1024}
              className="h-14 sm:h-20 w-auto"
            />
          </Link>

          <nav
            className="hidden md:flex items-center gap-6"
            aria-label="Site navigation"
          >
            {NAV.map((item, i) => (
              <div key={item.href} className="flex items-center gap-6">
                {i > 0 && <span aria-hidden="true" className="h-6 w-px bg-white/25" />}
                <Link
                  href={item.href}
                  className={[
                    'inline-flex items-center gap-2 py-1 text-ui font-semibold transition-colors',
                    isActive(item.href)
                      ? 'text-primary border-b-2 border-primary'
                      : 'text-white/85 hover:text-white',
                  ].join(' ')}
                >
                  <item.icon
                    className={isActive(item.href) ? 'text-primary' : 'text-white/85'}
                  />
                  {item.label}
                </Link>
              </div>
            ))}
            <Link
              href="/"
              className="ml-2 inline-flex items-center gap-2 h-11 px-5 rounded-full bg-primary text-white text-ui font-bold hover:brightness-110 active:scale-[0.98] transition-[transform,filter]"
            >
              Play Now
              <ArrowRightIcon />
            </Link>
          </nav>

          <button
            type="button"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="md:hidden inline-flex items-center justify-center h-11 w-11 -mr-2 rounded-full text-white hover:bg-white/10 active:scale-95 transition-all"
          >
            {menuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </header>

      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm animate-in md:hidden"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <nav
            className="fixed top-20 right-3 left-3 z-40 rounded-2xl bg-[#091235] text-white border border-white/10 shadow-2xl animate-in md:hidden"
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
                        ? 'text-primary bg-white/5'
                        : 'text-white hover:bg-white/10',
                    ].join(' ')}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </Link>
                </li>
              ))}
              <li className="pt-1">
                <Link
                  href="/"
                  className="flex items-center justify-center gap-2 mx-1 mt-1 mb-1 h-11 rounded-full bg-primary text-white text-ui font-bold"
                >
                  Play Now
                  <ArrowRightIcon />
                </Link>
              </li>
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
      width="20"
      height="20"
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
      width="20"
      height="20"
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
      width="20"
      height="20"
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
