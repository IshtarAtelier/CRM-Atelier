import { headers } from "next/headers";
import { Sidebar } from "@/components/Sidebar";
import { GlobalTasks } from "@/components/GlobalTasks";
import { GlobalBalanceReminders } from "@/components/GlobalBalanceReminders";
import CommandPalette from "@/components/CommandPalette";

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
  );
}
