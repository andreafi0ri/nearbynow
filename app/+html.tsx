import { ScrollViewStyleReset } from "expo-router/html";

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <ScrollViewStyleReset />
        <meta name="impact-site-verification" content="c28e0e6f-671c-4881-be2e-1a758e98e71b" />
        <meta name="google-site-verification" content="m7iJAREJhSRrNVZ2UJbdNmzE9DXqijeOrqhEeXEsozI" />
        <meta name="theme-color" content="#FAF7F3" />
        {/* PWA */}
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/nearbynow-apple-icon.png" />
        {/* Fonts — preconnect first, then CSS with display=swap so text renders immediately */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Inter — main app font; load before JS bundle so FCP has real text */}
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap" rel="stylesheet" />
        {/* JetBrains Mono — source badge pills */}
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@600&display=swap" rel="stylesheet" />
        {/* Google Analytics — deferred 3s so it never competes with first paint */}
        <script defer src="https://www.googletagmanager.com/gtag/js?id=G-6ENK256D12" />
        <script dangerouslySetInnerHTML={{ __html: `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          setTimeout(function() {
            gtag('js', new Date());
            gtag('config', 'G-6ENK256D12');
          }, 3000);
        `}} />
        {/* Service worker */}
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
          }
        `}} />
      </head>
      <body>{children}</body>
    </html>
  );
}
