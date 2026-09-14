import type { Metadata } from 'next';
import { IBM_Plex_Sans } from 'next/font/google';
import './globals.css';

// Tipografía institucional — MASTER.md sección 3.
const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ibm-plex-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Seguridad Ciudadana | GAMC Cochabamba',
  description:
    'Plataforma web de la Dirección de Seguridad Ciudadana del Gobierno Autónomo Municipal de Cochabamba.',
  icons: {
    icon: [
      { url: '/logo-gamc.png', type: 'image/png', sizes: 'any' },
      { url: '/escudo-cochabamba.png', type: 'image/png', sizes: 'any' },
    ],
    shortcut: '/logo-gamc.png',
    apple: '/logo-gamc.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={ibmPlexSans.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
