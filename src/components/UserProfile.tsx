"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useState } from "react";

export function UserProfile({ name, role }: { name: string, role: string }) {
    const router = useRouter();
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            await fetch("/api/auth/logout", { method: "POST" });
            router.push("/login");
            router.refresh(); // Force reload to clear middleware state
        } catch (error) {
            console.error("Error logging out", error);
            setIsLoggingOut(false);
        }
    };

    const initial = name ? name.charAt(0).toUpperCase() : "U";
    const roleDisplay = role === "ADMIN" ? "Administrativo" : "Operativo";

    return (
        <div className="p-4 border-t border-sidebar-border bg-sidebar">
            <div className="flex items-center justify-between px-2 py-2">
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold flex-shrink-0">
                        {initial}
                    </div>
                    <div className="flex flex-col overflow-hidden">
                        <span className="text-sm font-medium truncate text-foreground">{name}</span>
                        <span className="text-xs text-foreground/50 truncate">{roleDisplay}</span>
                    </div>
                </div>
                <button
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="p-2 text-foreground/40 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors flex-shrink-0"
                    title="Cerrar sesión"
                >
                    <LogOut size={18} />
                </button>
            </div>
        </div>
    );
}
