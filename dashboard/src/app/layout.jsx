import './globals.css';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: {
    default: 'ShorTul — Short links. Faster journeys.',
    template: '%s — ShorTul',
  },
  description: 'ShorTul is a premium URL shortener built on Cloudflare\'s global edge network. Lightning-fast redirects, real-time analytics, and a beautiful dashboard.',
  keywords: ['url shortener', 'short links', 'link shortener', 'cloudflare', 'analytics', 'shorTul'],
  openGraph: {
    title: 'ShorTul — Short links. Faster journeys.',
    description: 'Lightning-fast URL shortener built on Cloudflare\'s global edge network.',
    url: 'https://shortul.app',
    siteName: 'ShorTul',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ShorTul — Short links. Faster journeys.',
    description: 'Lightning-fast URL shortener built on Cloudflare\'s global edge network.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport = {
  themeColor: '#0a0a1a',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="canonical" href="https://shortul.app" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SoftwareApplication',
              name: 'ShorTul',
              applicationCategory: 'WebApplication',
              operatingSystem: 'Web',
              description: 'Lightning-fast URL shortener built on Cloudflare\'s global edge network.',
              offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'USD',
              },
            }),
          }}
        />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
