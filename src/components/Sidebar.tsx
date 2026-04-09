"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Glasses, Package, ClipboardList, LayoutDashboard, Cog, FileText, Contact, Calculator, ShoppingCart, MessageCircle, Wallet, Search, Menu, X, Receipt, Banknote } from "lucide-react";
import { UserProfile } from "./UserProfile";
import { NotificationBell } from "./NotificationBell";

interface SidebarProps {
  userName?: string;
  userRole?: string;
}

export function Sidebar({ userName = "Usuario", userRole = "STAFF" }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin = userRole === "ADMIN";

  // Close drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const allLinks = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard, adminOnly: false },
    { href: "/contactos", label: "Contactos y Clientes", icon: Contact, adminOnly: false },
    { href: "/inventario", label: "Stock y Productos", icon: Glasses, adminOnly: true },
    { href: "/cotizador", label: "Cotizador", icon: Calculator, adminOnly: false },
    { href: "/ventas", label: "Ventas / Laboratorio", icon: ShoppingCart, adminOnly: false },
    { href: "/facturacion", label: "Facturación", icon: Receipt, adminOnly: true },
    { href: "/whatsapp", label: "WhatsApp", icon: MessageCircle, adminOnly: false },
    { href: "/caja", label: "Caja Efectivo", icon: Banknote, adminOnly: false },
    { href: "/administracion", label: "Administración", icon: Wallet, adminOnly: true },
    { href: "/reportes", label: "Reportes", icon: FileText, adminOnly: true },
    { href: "/configuracion", label: "Configuración", icon: Cog, adminOnly: true },
  ];

  const links = allLinks.filter(link => !link.adminOnly || isAdmin);

  const sidebarContent = (
    <>
      <div className="px-5 py-5 flex items-center justify-between">
        <img src="/assets/logo-atelier-optica.png" alt="Logo Atelier Óptica" className="h-10 object-contain dark:invert" />
        {/* Close button only on mobile */}
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-2 rounded-xl hover:bg-foreground/5 text-foreground/50 transition-colors"
        >
          <X size={20} />
        </button>
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
          <kbd className="px-1.5 py-0.5 bg-foreground/5 rounded text-[9px] font-bold border border-foreground/10 hidden sm:inline">⌘K</kbd>
        </button>
        <div className="flex items-center gap-1 px-2">
          {isAdmin && <NotificationBell />}
          <div className="flex-1">
            <UserProfile name={userName} role={userRole} />
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2.5 bg-sidebar border border-sidebar-border rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all"
        aria-label="Abrir menú"
      >
        <Menu size={20} className="text-foreground/70" />
      </button>

      {/* Desktop sidebar — always visible on lg+ */}
      <aside className="hidden lg:flex w-64 bg-sidebar border-r border-sidebar-border h-screen flex-col fixed left-0 top-0 z-40">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-in fade-in duration-200"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`lg:hidden fixed top-0 left-0 h-screen w-72 bg-sidebar border-r border-sidebar-border flex flex-col z-50 transition-transform duration-300 ease-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
