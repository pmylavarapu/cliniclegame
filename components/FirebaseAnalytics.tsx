'use client';

import Script from 'next/script';

/**
 * Google Analytics (GA4) via Firebase — feature-gated on
 * NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID being set. Gets auto pageviews,
 * geography (from IP), device/OS/browser, retention cohorts, session
 * counts. View at console.firebase.google.com → Analytics.
 *
 * The measurement ID is the "G-XXXXXXX" string in
 * Firebase Console → Project Settings → Integrations → Google Analytics.
 */
export default function FirebaseAnalytics() {
  const id = process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID;
  if (!id) return null;
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');`}
      </Script>
    </>
  );
}
