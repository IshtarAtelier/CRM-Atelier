import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Script from "next/script";
import { ThemeProvider } from "next-themes";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});



export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://crm-atelier-production-ae72.up.railway.app'),
  title: {
    default: "Atelier Óptica | Armazones, Cristales y Multifocales en Cuotas",
    template: "%s | Atelier Óptica"
  },
  description: "Óptica especializada en salud visual. Promociones en lentes multifocales, cuotas sin interés y envíos a todo el país. Presupuestamos tu receta por WhatsApp.",
  keywords: ["optica cordoba", "multifocales en cuotas", "precio multifocales", "anteojos de sol", "lentes de contacto con envio", "anteojos recetados", "armazones", "salud visual", "reparacion de anteojos", "optica con obra social"],
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
        height: 140,
        alt: "Atelier Óptica Córdoba",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Atelier Óptica Córdoba | Cuidado Visual Personalizado",
    description: "Somos ópticos creativos con una sola pasión: Cuidar tu salud visual ofreciendo los mejores diseños de anteojos.",
    images: ["/images/og-image.jpg"],
  },
  manifest: "/manifest.json",
  icons: {
    icon: "/assets/logo-pwa-192.png",
    apple: "/assets/logo-pwa-512.png",
  },
  verification: {
    google: "AjRzLWV7Kf6VgRcityyLkoXxJDag70DOQ2vxUompEgE",
  },
  other: { "theme-color": "#c8a55c" },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
};

import { Toaster } from "sonner";
import { TrackingScripts } from "@/components/Storefront/TrackingScripts";
import { FloatingWhatsApp } from "@/components/Storefront/FloatingWhatsApp";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="dns-prefetch" href="https://firebasestorage.googleapis.com" />
        <link rel="preconnect" href="https://firebasestorage.googleapis.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://storage.googleapis.com" />
      </head>
      <body
        className={`${geistSans.variable} antialiased selection:bg-primary/30`}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:p-4 focus:bg-background focus:text-foreground">Saltar al contenido principal</a>
          <div className="min-h-screen bg-background text-foreground" id="main-content">
            {children}
          </div>
          <Toaster position="top-right" richColors />
          <FloatingWhatsApp />
          <TrackingScripts />

          <Script strategy="afterInteractive" id="sw-register">{`
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.register('/sw.js').catch(() => {});
            }
          `}</Script>
        </ThemeProvider>
      </body>
    </html>
  );
}
