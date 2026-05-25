import { headers } from "next/headers";
import { Sidebar } from "@/components/Sidebar";
import { GlobalTasks } from "@/components/GlobalTasks";
import { GlobalReviewRequests } from "@/components/GlobalReviewRequests";
import { GlobalBalanceReminders } from "@/components/GlobalBalanceReminders";
import { GlobalOpportunities } from "@/components/GlobalOpportunities";
import CommandPalette from "@/components/CommandPalette";
import { LeadToastNotifications } from "@/components/LeadToastNotifications";
import { CopilotChat } from "@/components/CopilotChat";

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
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar userName={userName} userRole={userRole} userId={userId} />
      <main className="flex-1 min-w-0 ml-0 lg:ml-[var(--sidebar-width,16rem)] min-h-screen relative flex flex-col pt-16 lg:pt-0 transition-[margin] duration-300 ease-in-out">
        {/* Floating dock for quick actions */}
        <div className="fixed bottom-6 right-20 md:bottom-8 md:right-[104px] z-[40] flex items-center gap-1 p-1 bg-white/60 dark:bg-stone-900/60 backdrop-blur-xl border border-stone-200/50 dark:border-stone-800/50 rounded-full shadow-lg hover:shadow-xl hover:border-stone-300/80 dark:hover:border-stone-700/80 transition-all duration-300">
          <GlobalOpportunities />
          <GlobalBalanceReminders />
          <GlobalReviewRequests />
          <GlobalTasks />
        </div>

        <CommandPalette />
        <LeadToastNotifications />
        <CopilotChat userName={userName} userRole={userRole} />
        <div className="flex-1 relative">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background -z-10" />
          {children}
        </div>
      </main>
    </div>
  );
}
