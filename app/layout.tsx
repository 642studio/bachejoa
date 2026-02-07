import './globals.css';
import {
  Luckiest_Guy,
  Space_Grotesk,
  IBM_Plex_Mono,
} from 'next/font/google';

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
  title: 'Bachejoa Map · Navojoa',
  description:
    'Mapa interactivo para reportar baches en Navojoa, Sonora. Juega, reporta y mejora tu ruta.',
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
      </body>
    </html>
  );
}
