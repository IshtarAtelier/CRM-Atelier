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
  title: "Atelier Óptica",
  description: "Sistema de gestión para Atelier Óptica",
  manifest: "/manifest.json",
  other: { "theme-color": "#c8a55c" },
};

import { Sidebar } from "@/components/Sidebar";
import { GlobalTasks } from "@/components/GlobalTasks";
import { GlobalBalanceReminders } from "@/components/GlobalBalanceReminders";
import CommandPalette from "@/components/CommandPalette";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const userName = headersList.get("x-user-name") || "Usuario";
  const userRole = headersList.get("x-user-role") || "STAFF";

  // Determine if we're on the login page by checking if user headers are set
  const isAuthenticated = headersList.get("x-user-id") !== null;

  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased selection:bg-primary/30`}
      >
        {isAuthenticated ? (
          <div className="flex min-h-screen bg-background text-foreground">
            <Sidebar userName={userName} userRole={userRole} />
            <main className="flex-1 ml-0 lg:ml-64 min-h-screen relative flex flex-col pt-16 lg:pt-0">
              <GlobalTasks />
              <GlobalBalanceReminders />
              <CommandPalette />
              <div className="flex-1 relative">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background -z-10" />
                {children}
              </div>
            </main>
          </div>
        ) : (
          <div className="min-h-screen bg-background text-foreground">
            {children}
          </div>
        )}
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
