import './globals.css';
import {
  Luckiest_Guy,
  Space_Grotesk,
  IBM_Plex_Mono,
} from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';

const displayFont = Luckiest_Guy({
  subsets: ['latin'],
  variable: '--font-display',
  weight: '400',
});

const bodyFont = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-body',
});

const monoFont = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500', '600'],
});

export const metadata = {
  title: 'Bachejoa Map — Reporta baches en Navojoa',
  description:
    'Mapa interactivo para reportar baches en Navojoa, Sonora. Juega, reporta y mejora tu ruta.',
  openGraph: {
    title: 'Bachejoa Map — Reporta baches en Navojoa',
    description:
      'Mapa interactivo para reportar baches en Navojoa, Sonora. Juega, reporta y mejora tu ruta.',
    images: ['/thumb.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Bachejoa Map — Reporta baches en Navojoa',
    description:
      'Mapa interactivo para reportar baches en Navojoa, Sonora. Juega, reporta y mejora tu ruta.',
    images: ['/thumb.png'],
  },
  icons: {
    icon: [
      { url: '/favicon/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon/favicon.ico', sizes: 'any' },
    ],
    apple: [{ url: '/favicon/apple-touch-icon.png', sizes: '180x180' }],
  },
  manifest: '/favicon/site.webmanifest',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body
        className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable} min-h-screen bg-sky-200 text-slate-900 antialiased font-[var(--font-body)]`}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
