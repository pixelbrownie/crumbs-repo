import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';

export const metadata: Metadata = {
  title: 'crumbs',
  description:
    'A minimalist, visual wishlist board. Save, categorize, and revisit the things you love.',
  metadataBase: new URL('https://crumbs.vercel.app'),
  manifest: '/manifest.json',
  icons: {
    icon: '/icon-192.png',
    apple: '/icon-512.png',
  },
  openGraph: {
    title: 'crumbs',
    description: 'every piece you love.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body className="font-sans antialiased bg-canvas text-ink">
        {children}
      </body>
    </html>
  );
}
