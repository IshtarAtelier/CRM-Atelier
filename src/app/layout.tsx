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
  title: "Atelier Óptica Córdoba | Multifocales, Anteojos y Lentes de Contacto",
  description: "Óptica en Córdoba especializada en multifocales, anteojos recetados, de sol y lentes de contacto.",
  manifest: "/manifest.json",
  other: { "theme-color": "#c8a55c" },
};

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
