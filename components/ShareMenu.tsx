'use client';

import { useEffect, useRef, useState } from 'react';

type Props = {
  text: string;
  url?: string;
  title?: string;
};

export default function ShareMenu({ text, url, title = 'Clinicle' }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setCanNativeShare(
      typeof navigator !== 'undefined' && typeof navigator.share === 'function',
    );
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(t) &&
        btnRef.current &&
        !btnRef.current.contains(t)
      ) {
        setOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const shareUrl =
    url ??
    (typeof window !== 'undefined' ? window.location.origin + '/' : '');

  const encoded = encodeURIComponent(text);
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(title);

  const options: { label: string; href?: string; onClick?: () => void; icon: React.ReactNode }[] =
    [
      {
        label: 'X / Twitter',
        href: `https://twitter.com/intent/tweet?text=${encoded}&url=${encodedUrl}`,
        icon: <TwitterIcon />,
      },
      {
        label: 'Facebook',
        href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encoded}`,
        icon: <FacebookIcon />,
      },
      {
        label: 'Reddit',
        href: `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`,
        icon: <RedditIcon />,
      },
      {
        label: 'LinkedIn',
        href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
        icon: <LinkedInIcon />,
      },
      {
        label: 'Email',
        href: `mailto:?subject=${encodedTitle}&body=${encoded}%0A%0A${encodedUrl}`,
        icon: <EmailIcon />,
      },
      {
        label: 'Text message',
        href: `sms:?&body=${encoded}%20${encodedUrl}`,
        icon: <SmsIcon />,
      },
      {
        label: copied ? 'Copied!' : 'Copy',
        onClick: async () => {
          try {
            await navigator.clipboard.writeText(`${text}\n\n${shareUrl}`);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          } catch {}
        },
        icon: <CopyIcon />,
      },
    ];

  const openNativeShare = async () => {
    try {
      await navigator.share({ text, url: shareUrl, title });
    } catch {
      /* user cancelled */
    }
  };

  const primaryLabel = copied ? 'Copied to clipboard' : 'Share result';

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => {
          if (canNativeShare) openNativeShare();
          else setOpen((v) => !v);
        }}
        className="w-full h-11 rounded-md bg-primary text-white font-semibold shadow-card hover:brightness-110 active:brightness-95 active:translate-y-px transition-[filter,transform] inline-flex items-center justify-center gap-2"
        aria-haspopup={canNativeShare ? undefined : 'menu'}
        aria-expanded={canNativeShare ? undefined : open}
      >
        <ShareIcon />
        <span>{primaryLabel}</span>
      </button>

      {canNativeShare && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-2 w-full h-9 rounded-md border border-border text-xs font-semibold uppercase tracking-[0.14em] text-fg-soft hover:text-fg hover:border-border-strong hover:bg-surface-2 transition-colors"
        >
          More options
        </button>
      )}

      {open && (
        <div
          ref={menuRef}
          role="menu"
          className="absolute z-30 left-0 right-0 mt-2 rounded-lg border border-border bg-white shadow-lg p-2 animate-in"
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
            {options.map((opt) =>
              opt.href ? (
                <a
                  key={opt.label}
                  href={opt.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  role="menuitem"
                  className="flex flex-col items-center justify-center gap-1.5 rounded-md px-2 py-3 text-[11px] font-semibold text-fg-soft hover:text-fg hover:bg-surface-2 transition-colors"
                  onClick={() => setOpen(false)}
                >
                  <span className="text-fg">{opt.icon}</span>
                  <span className="text-center leading-tight">{opt.label}</span>
                </a>
              ) : (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => {
                    opt.onClick?.();
                  }}
                  role="menuitem"
                  className="flex flex-col items-center justify-center gap-1.5 rounded-md px-2 py-3 text-[11px] font-semibold text-fg-soft hover:text-fg hover:bg-surface-2 transition-colors"
                >
                  <span className="text-fg">{opt.icon}</span>
                  <span className="text-center leading-tight">{opt.label}</span>
                </button>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ShareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}
function TwitterIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13.5 9H16V6h-2.5C11.57 6 10 7.57 10 9.5V11H8v3h2v7h3v-7h2.5l.5-3H13V9.5c0-.28.22-.5.5-.5z" />
    </svg>
  );
}
function RedditIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M22 12.06c0-1.22-1-2.2-2.22-2.2-.6 0-1.14.23-1.54.62a10.86 10.86 0 0 0-5.78-1.83l1-4.6 3.2.68a1.6 1.6 0 1 0 .17-.98l-3.56-.76a.5.5 0 0 0-.59.38l-1.12 5.28c-2.2.1-4.18.72-5.7 1.83a2.2 2.2 0 1 0-2.4 3.63c-.04.24-.07.48-.07.73 0 3.72 4.32 6.72 9.65 6.72s9.65-3 9.65-6.72c0-.25-.03-.5-.08-.74A2.2 2.2 0 0 0 22 12.06zM7 13.6a1.4 1.4 0 1 1 2.8 0 1.4 1.4 0 0 1-2.8 0zm8.62 3.85c-.98.98-2.84 1.06-3.62 1.06s-2.64-.08-3.62-1.06a.4.4 0 0 1 .56-.56c.62.62 1.94.84 3.06.84s2.44-.22 3.06-.84a.4.4 0 0 1 .56.56zm-.4-2.45a1.4 1.4 0 1 1 0-2.8 1.4 1.4 0 0 1 0 2.8z" />
    </svg>
  );
}
function LinkedInIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M4.98 3.5C4.98 4.88 3.87 6 2.5 6S0 4.88 0 3.5 1.13 1 2.5 1s2.48 1.12 2.48 2.5zM.22 8h4.56v14H.22zM8.34 8H12.7v1.92h.06c.6-1.14 2.08-2.34 4.28-2.34 4.58 0 5.42 3.02 5.42 6.94V22h-4.52v-6.24c0-1.5-.02-3.42-2.08-3.42-2.08 0-2.4 1.62-2.4 3.3V22H8.34z" />
    </svg>
  );
}
function EmailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}
function SmsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
function CopyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  );
}
