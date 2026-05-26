import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://www.atelieroptica.com.ar'),
  title: {
    default: "Atelier Óptica Córdoba | Multifocales, Anteojos y Lentes de Contacto",
    template: "%s | Atelier Óptica Córdoba"
  },
  description: "Óptica en Córdoba especializada en multifocales, anteojos recetados, de sol y lentes de contacto. Atención personalizada y armazones de diseño.",
  keywords: ["optica cordoba", "multifocales", "anteojos de sol", "lentes de contacto", "anteojos recetados", "armazones", "salud visual", "optica cerro de las rosas"],
  openGraph: {
    type: "website",
    locale: "es_AR",
    url: "https://www.atelieroptica.com.ar",
    siteName: "Atelier Óptica",
    title: "Atelier Óptica Córdoba | Cuidado Visual Personalizado",
    description: "Somos ópticos creativos con una sola pasión: Cuidar tu salud visual ofreciendo los mejores diseños de anteojos.",
    images: [
      {
        url: "/images/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Atelier Óptica Córdoba",
      },
    ],
  },
  manifest: "/manifest.json",
  icons: {
    icon: "/assets/logo-atelier-optica.png",
    apple: "/assets/logo-atelier-optica.png",
  },
  other: { "theme-color": "#c8a55c" },
};

import { TrackingScripts } from "@/components/Storefront/TrackingScripts";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased selection:bg-primary/30`}
      >
        <div className="min-h-screen bg-background text-foreground">
          {children}
        </div>
        <TrackingScripts />
        <script dangerouslySetInnerHTML={{
          __html: `
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(() => {});
          }
        `}} />
      </body>
    </html>
  );
}
