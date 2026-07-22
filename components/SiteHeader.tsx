'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/', label: 'Today' },
  { href: '/archive/', label: 'Archive' },
  { href: '/how-to-play/', label: 'How to play' },
  { href: '/how-it-works/', label: 'How it works' },
  { href: '/sources/', label: 'Sources' },
  { href: '/feedback/', label: 'Feedback' },
];

export default function SiteHeader() {
  const pathname = usePathname() || '/';

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/' || pathname === '';
    return pathname === href || pathname === href.replace(/\/$/, '');
  };

  return (
    <header>
      <div className="pt-8 sm:pt-10 pb-4">
        <div className="mx-auto max-w-3xl px-5">
          <Link
            href="/"
            className="flex items-center justify-center group"
            aria-label="Clinicle home"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Clinicle"
              width={740}
              height={312}
              className="h-14 sm:h-16 w-auto group-hover:opacity-90 transition-opacity"
            />
          </Link>
        </div>
      </div>
      <nav className="border-b border-border">
        <div className="mx-auto max-w-3xl px-5">
          <ul className="flex flex-wrap items-center justify-center gap-1 sm:gap-1.5 py-3">
            {NAV.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={[
                      'inline-flex items-center px-3 py-1.5 rounded-md text-eyebrow uppercase font-semibold transition-colors',
                      active
                        ? 'bg-fg text-white'
                        : 'text-muted hover:text-fg hover:bg-surface-2',
                    ].join(' ')}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>
    </header>
  );
}
