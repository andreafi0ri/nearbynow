import { ScrollViewStyleReset } from "expo-router/html";

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <ScrollViewStyleReset />
        <meta name="impact-site-verification" value="c28e0e6f-671c-4881-be2e-1a758e98e71b" />
        <meta name="google-site-verification" content="m7iJAREJhSRrNVZ2UJbdNmzE9DXqijeOrqhEeXEsozI" />
        {/* Google Analytics */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-6ENK256D12" />
        <script dangerouslySetInnerHTML={{ __html: `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-6ENK256D12');
        `}} />
      </head>
      <body>{children}</body>
    </html>
  );
}
