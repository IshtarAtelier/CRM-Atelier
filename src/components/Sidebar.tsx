"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Glasses, Package, ClipboardList, LayoutDashboard, Cog, FileText, Contact, Calculator, ShoppingCart, MessageCircle, Wallet, Search } from "lucide-react";
import { UserProfile } from "./UserProfile";
import { NotificationBell } from "./NotificationBell";

interface SidebarProps {
  userName?: string;
  userRole?: string;
}

export function Sidebar({ userName = "Usuario", userRole = "STAFF" }: SidebarProps) {
  const pathname = usePathname();

  const isAdmin = userRole === "ADMIN";

  const allLinks = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard, adminOnly: false },
    { href: "/contactos", label: "Contactos y Clientes", icon: Contact, adminOnly: false },
    { href: "/inventario", label: "Stock y Productos", icon: Glasses, adminOnly: false },
    { href: "/cotizador", label: "Cotizador", icon: Calculator, adminOnly: false },
    { href: "/ventas", label: "Ventas / Laboratorio", icon: ShoppingCart, adminOnly: false },
    { href: "/whatsapp", label: "WhatsApp", icon: MessageCircle, adminOnly: false },
    { href: "/administracion", label: "Caja / Pagos", icon: Wallet, adminOnly: true },
    { href: "/reportes", label: "Reportes", icon: FileText, adminOnly: true },
    { href: "/configuracion", label: "Configuración", icon: Cog, adminOnly: true },
  ];

  const links = allLinks.filter(link => !link.adminOnly || isAdmin);

  return (
    <aside className="w-64 bg-sidebar border-r border-sidebar-border h-screen flex flex-col fixed left-0 top-0">
      <div className="px-5 py-5 flex items-center justify-center">
        <img src="/assets/logo-atelier-optica.png" alt="Logo Atelier Óptica" className="h-10 object-contain dark:invert" />
      </div>

      <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${isActive
                ? "bg-primary/10 text-primary font-medium shadow-sm"
                : "text-foreground/75 hover:bg-foreground/5 hover:text-foreground"
                }`}
            >
              <Icon size={20} className={isActive ? "text-primary" : "text-foreground/50"} />
              <span className="text-sm">{link.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto">
        <button
          onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
          className="mx-4 mb-2 w-[calc(100%-2rem)] flex items-center gap-2 px-3 py-2 rounded-lg text-foreground/40 hover:text-foreground/70 hover:bg-foreground/5 transition-all cursor-pointer"
        >
          <Search size={16} />
          <span className="text-xs flex-1 text-left">Buscar...</span>
          <kbd className="px-1.5 py-0.5 bg-foreground/5 rounded text-[9px] font-bold border border-foreground/10">⌘K</kbd>
        </button>
        <div className="flex items-center gap-1 px-2">
          {isAdmin && <NotificationBell />}
          <div className="flex-1">
            <UserProfile name={userName} role={userRole} />
          </div>
        </div>
      </div>
    </aside>
  );
}
