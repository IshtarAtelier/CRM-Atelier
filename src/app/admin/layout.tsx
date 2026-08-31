import { headers } from "next/headers";
import { Sidebar } from "@/components/layout/Sidebar";
import { FloatingDock } from "@/components/ui/FloatingDock";
import CommandPalette from "@/components/ui/CommandPalette";
import { LeadToastNotifications } from "@/components/ui/LeadToastNotifications";
import { CopilotChat } from "@/components/admin/CopilotChat";
import NovedadesGuiadas from "@/components/admin/NovedadesGuiadas";
import { ErrorBoundary } from "@/components/ErrorBoundary";

import { PulsoProvider } from "@/components/mensajes/PulsoProvider";
import { WhatsAppProvider } from "@/components/whatsapp/WhatsAppProvider";
import { FloatingWhatsApp } from "@/components/whatsapp/FloatingWhatsApp";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const userName = headersList.get("x-user-name") || "Usuario";
  const userRole = headersList.get("x-user-role") || "STAFF";
  const userId = headersList.get("x-user-id") || "";

  return (
    <PulsoProvider>
    {/* Un solo WhatsApp para todo el panel: un socket, un contador y un único
        emisor de notificaciones. Antes cada pestaña abría TRES conexiones. */}
    <WhatsAppProvider>
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar userName={userName} userRole={userRole} userId={userId} />
      <main className="flex-1 min-w-0 ml-0 lg:ml-[var(--sidebar-width,16rem)] min-h-screen relative flex flex-col pt-16 lg:pt-0 transition-[margin] duration-300 ease-in-out">
        <FloatingDock />

        <CommandPalette />
        <NovedadesGuiadas />
        <LeadToastNotifications />
        <CopilotChat userName={userName} userRole={userRole} />
        {/* WhatsApp sin salir de la pantalla en la que estás. Se esconde solo
            cuando ya estás en /admin/whatsapp. */}
        <FloatingWhatsApp />
        
        <div className="flex-1 relative">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background -z-10" />
          <ErrorBoundary>{children}</ErrorBoundary>
        </div>
      </main>
    </div>
    </WhatsAppProvider>
    </PulsoProvider>
  );
}
