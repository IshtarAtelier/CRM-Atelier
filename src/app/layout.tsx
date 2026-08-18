import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { STORE_ORIGIN } from "@/lib/constants";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  // Sin preload: la fuente del cuerpo no es necesaria para el LCP (los títulos del
  // hero usan serif del sistema). Así no compite por ancho de banda con la imagen
  // LCP en la ventana crítica del móvil 4G. El texto usa el fallback y luego cambia.
  preload: false,
  fallback: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
  adjustFontFallback: true,
});



export const metadata: Metadata = {
  // Base de TODA url relativa de metadata (og:image, canonical). Va contra el
  // dominio público, no contra el host interno de Railway: si no, cada vista
  // previa compartida por WhatsApp o redes carga la imagen desde esa dirección
  // y la deja a la vista. Mismo origen que usan los mails al cliente.
  metadataBase: new URL(STORE_ORIGIN),
  title: {
    default: "Atelier Óptica | Armazones, Cristales y Multifocales en Cuotas",
    template: "%s | Atelier Óptica"
  },
  description: "Óptica especializada en salud visual. Promociones en lentes multifocales, cuotas sin interés y envíos a todo el país. Presupuestamos tu receta por WhatsApp.",
  // `keywords` lo ignoran Google y Bing desde hace más de una década; lo único
  // que hace es publicar a qué términos apuntás. Se saca.
  openGraph: {
    type: "website",
    locale: "es_AR",
    url: "https://atelieroptica.com.ar",
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
import { ChunkReloadGuard } from "@/components/ChunkReloadGuard";
import AnalyticsTracker from "@/components/Storefront/AnalyticsTracker";
import WhatsAppAttribution from "@/components/Storefront/WhatsAppAttribution";
import CookieConsent from "@/components/Storefront/CookieConsent";

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
          {/* Antes que TrackingScripts: opt-out por defecto, así su efecto que
              sincroniza la cookie de consentimiento corre primero. */}
          <CookieConsent />
          {/* IDs resueltos en el servidor: ver la nota en TrackingScripts sobre
              por qué no se leen con process.env del lado del cliente. */}
          <TrackingScripts
            gaId={process.env.NEXT_PUBLIC_GA_ID}
            gaSecondaryId={process.env.NEXT_PUBLIC_GA_ID_SECONDARY}
            adsId={process.env.NEXT_PUBLIC_GOOGLE_ADS_TAG_ID || process.env.GOOGLE_ADS_CONVERSION_ID}
            adsPurchaseLabel={process.env.GOOGLE_ADS_CONVERSION_LABEL}
            adsWhatsAppLabel={process.env.GOOGLE_ADS_WHATSAPP_LABEL}
            adsCallLabel={process.env.GOOGLE_ADS_CALL_LABEL}
            pixelId={process.env.NEXT_PUBLIC_META_PIXEL_ID}
          />
          <AnalyticsTracker />
          <WhatsAppAttribution />
          <ChunkReloadGuard />
        </ThemeProvider>
      </body>
    </html>
  );
}
