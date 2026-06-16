"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Glasses, ClipboardList, LayoutDashboard, Cog, FileText, Contact, Calculator, ShoppingCart, Wallet, Search, Menu, X, Receipt, Banknote, TrendingDown, ChevronLeft, ChevronRight, Wrench } from "lucide-react";
import { motion } from "framer-motion";
import { UserProfile } from '../admin/UserProfile';
import { NotificationBell } from '../ui/NotificationBell';
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";

interface SidebarProps {
  userName?: string;
  userRole?: string;
  userId?: string;
}

export function Sidebar({ userName = "Usuario", userRole = "STAFF", userId = "" }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const isAdmin = userRole === "ADMIN";

  // Load saved state on mount
  useEffect(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    if (saved === 'true') {
      setIsCollapsed(true);
    }
  }, []);

  // Update CSS variable and save state when toggled
  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-width', isCollapsed ? '5rem' : '16rem');
    localStorage.setItem('sidebarCollapsed', isCollapsed.toString());
  }, [isCollapsed]);

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
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard, adminOnly: false },
    { href: "/admin/contactos", label: "Contactos y Clientes", icon: Contact, adminOnly: false },
    { href: "/admin/inventario", label: "Stock y Productos", icon: Glasses, adminOnly: true },
    { href: "/admin/web", label: "Sitio Web", icon: ShoppingCart, adminOnly: true },
    { href: "/admin/cotizador", label: "Cotizador", icon: Calculator, adminOnly: false },
    { href: "/admin/ventas", label: "Ventas / Laboratorio", icon: ClipboardList, adminOnly: false },
    { href: "/admin/facturacion", label: "Facturación", icon: Receipt, adminOnly: true },
    { href: "/admin/whatsapp", label: "WhatsApp", icon: WhatsAppIcon, adminOnly: false },
    { href: "/admin/caja", label: "Caja Efectivo", icon: Banknote, adminOnly: false },
    { href: "/admin/gastos", label: "Gastos", icon: TrendingDown, adminOnly: true },
    { href: "/admin/administracion", label: "Administración", icon: Wallet, adminOnly: true },
    { href: "/admin/reportes", label: "Reportes", icon: FileText, adminOnly: true },
    { href: "/admin/desarrollo", label: "Desarrollo", icon: Wrench, adminOnly: true },
    { href: "/admin/configuracion", label: "Configuración", icon: Cog, adminOnly: true },
  ];

  const links = allLinks.filter(link => !link.adminOnly || isAdmin);

  const sidebarContent = (
    <>
      <div className={`px-5 py-5 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
        {!isCollapsed ? (
          <img src="/assets/logo-atelier-optica.png" alt="Logo Atelier Óptica" className="h-10 object-contain dark:invert" />
        ) : (
          <div className="w-8 h-8 bg-stone-900 dark:bg-white rounded-xl flex items-center justify-center font-black text-white dark:text-stone-900 text-lg">
            A
          </div>
        )}
        {/* Close button only on mobile */}
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-2 rounded-xl hover:bg-foreground/5 text-foreground/50 transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      <nav className={`flex-1 overflow-y-auto space-y-1.5 ${isCollapsed ? 'px-2' : 'px-4'}`}>
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href || (link.href !== "/admin" && pathname.startsWith(link.href));

          return (
            <Link
              key={link.href}
              href={link.href}
              title={isCollapsed ? link.label : undefined}
              className={`relative flex items-center gap-3 py-2.5 rounded-xl transition-colors duration-300 group ${
                isCollapsed ? 'justify-center px-0' : 'px-3'
              } ${!isActive && "text-foreground/60 hover:text-foreground"}`}
            >
              {isActive && (
                <motion.div
                  layoutId="active-pill"
                  className="absolute inset-0 bg-primary/10 rounded-xl"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <div className={`relative z-10 flex items-center gap-3 ${isActive ? 'text-xsrimary' : 'group-hover:scale-105 transition-transform duration-300'}`}>
                <Icon size={20} />
                {!isCollapsed && <span className="text-sm font-medium">{link.label}</span>}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto relative">
        {/* Toggle Collapse Button for Desktop */}
        <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:flex absolute -right-3 top-[-40px] w-6 h-6 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-full items-center justify-center text-stone-500 hover:text-stone-900 dark:hover:text-white shadow-sm z-50 transition-transform hover:scale-110"
        >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        {!isCollapsed ? (
            <button
            onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
            className="mx-4 mb-2 w-[calc(100%-2rem)] flex items-center gap-2 px-3 py-2 rounded-lg text-foreground/40 hover:text-foreground/70 hover:bg-foreground/5 transition-all cursor-pointer"
            >
            <Search size={16} />
            <span className="text-xs flex-1 text-left">Buscar...</span>
            <kbd className="px-1.5 py-0.5 bg-foreground/5 rounded text-xs font-bold border border-foreground/10 hidden sm:inline">⌘K</kbd>
            </button>
        ) : (
            <button
            onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
            title="Buscar (⌘K)"
            className="mx-auto mb-2 w-10 h-10 flex items-center justify-center rounded-lg text-foreground/40 hover:text-foreground/70 hover:bg-foreground/5 transition-all cursor-pointer"
            >
            <Search size={16} />
            </button>
        )}
        <div className={`flex items-center gap-1 ${isCollapsed ? 'justify-center py-4 flex-col' : 'px-2 pb-6 lg:pb-2'}`}>
          {isAdmin && <NotificationBell />}
          {!isCollapsed && (
            <div className="flex-1 overflow-hidden">
                <UserProfile name={userName} role={userRole} userId={userId} />
            </div>
          )}
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
      <div 
        style={{ width: 'var(--sidebar-width, 16rem)' }}
        className="hidden lg:block fixed left-0 top-0 h-screen z-[60] transition-[width] duration-300 ease-in-out"
      >
        <aside className="absolute inset-y-4 left-4 right-4 bg-white/70 dark:bg-[#221d1a]/70 backdrop-blur-2xl border border-black/5 dark:border-white/5 rounded-[2rem] shadow-2xl flex flex-col transition-all duration-300">
          {sidebarContent}
        </aside>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-in fade-in duration-200"
          onClick={() => setMobileOpen(false)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`lg:hidden fixed top-0 left-0 h-[100dvh] w-72 bg-sidebar border-r border-sidebar-border flex flex-col z-50 transition-transform duration-300 ease-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
