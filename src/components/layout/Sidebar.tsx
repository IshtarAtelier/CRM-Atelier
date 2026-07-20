"use client";
import Image from "next/image";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Glasses, ClipboardList, LayoutDashboard, Cog, FileText, Contact, Calculator, ShoppingCart, Wallet, Search, Menu, X, Receipt, Banknote, TrendingDown, ChevronLeft, ChevronRight, Wrench, Globe, FlaskConical, Store, LineChart, Star } from "lucide-react";
import { motion } from "framer-motion";
import { UserProfile } from "@/components/admin/UserProfile";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { WhatsAppBadge } from "@/components/ui/WhatsAppBadge";
import { WebSalesBadge } from "@/components/ui/WebSalesBadge";
import { ContactsAttentionBadge } from "@/components/ui/ContactsAttentionBadge";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";

interface SidebarProps {
  userName?: string;
  userRole?: string;
  userId?: string;
}

export function Sidebar({ userName = "Usuario", userRole = "STAFF", userId = "" }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  const isAdmin = userRole === "ADMIN";

  // Load saved state on mount
  useEffect(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    if (saved === 'true') {
      setIsCollapsed(true);
      document.documentElement.style.setProperty('--sidebar-width', '5rem');
    }
    setMounted(true);
  }, []);

  // Update CSS variable and save state when toggled
  useEffect(() => {
    if (!mounted) return;
    document.documentElement.style.setProperty('--sidebar-width', isCollapsed ? '5rem' : '16rem');
    localStorage.setItem('sidebarCollapsed', isCollapsed.toString());
  }, [isCollapsed, mounted]);

  // Close drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, searchParams]);

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
      { href: "/admin/leads", label: "Embudo de Leads", icon: ClipboardList, adminOnly: false },
      // Captación B2B: la página además valida acceso propio (ADMIN o
      // email en OPTICAS_LEADS_EMAILS — Milena entra por URL directa si no es ADMIN)
      { href: "/admin/opticas", label: "↳ Captación Ópticas", icon: Store, adminOnly: true, isSubLink: true },
      { href: "/admin/inventario", label: "Stock y Productos", icon: Glasses, adminOnly: true },
      { href: "/admin/web", label: "Sitio Web", icon: ShoppingCart, adminOnly: true },
      { href: "/admin/analitica", label: "↳ Analítica Web", icon: LineChart, adminOnly: true, isSubLink: true },
      { href: "/admin/resenas", label: "↳ Reseñas", icon: Star, adminOnly: true, isSubLink: true },
      { href: "/admin/cotizador", label: "Cotizador", icon: Calculator, adminOnly: false },
      { href: "/admin/ventas", label: "Ventas / Laboratorio", icon: ClipboardList, adminOnly: false },
      { href: "/admin/ventas?mode=WEB", label: "↳ Ventas Web", icon: Globe, adminOnly: false, isSubLink: true },
      { href: "/admin/ventas?mode=POST_VENTA", label: "↳ Post Venta", icon: Wrench, adminOnly: false, isSubLink: true },
      { href: "/admin/laboratorio/costos", label: "↳ Costos de Lab", icon: FlaskConical, adminOnly: true, isSubLink: true },
      { href: "/admin/facturacion", label: "Facturación", icon: Receipt, adminOnly: true },
      { href: "/admin/whatsapp", label: "WhatsApp", icon: WhatsAppIcon, adminOnly: false },
      { href: "/admin/caja", label: "Caja Efectivo", icon: Banknote, adminOnly: false },
      { href: "/admin/caja/vendedores", label: "↳ Caja Vendedores", icon: Wallet, adminOnly: false, isSubLink: true },
      { href: "/admin/gastos", label: "Gastos", icon: TrendingDown, adminOnly: true },
      { href: "/admin/administracion", label: "Administración", icon: Wallet, adminOnly: true },
      { href: "/admin/reportes", label: "Reportes", icon: FileText, adminOnly: true },
      { href: "/admin/desarrollo", label: "Desarrollo", icon: Wrench, adminOnly: true },
      { href: "/admin/configuracion", label: "Configuración", icon: Cog, adminOnly: true },
    ];

  const links = allLinks.filter(link => !link.adminOnly || isAdmin);

  const sidebarContent = (
    <>
      <div className={`px-5 py-6 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
        {!isCollapsed ? (
          <Image unoptimized src="/assets/logo-atelier-optica.png" alt="Logo Atelier Óptica" width={150} height={40} className="h-10 object-contain brightness-0 invert opacity-95 transition-opacity hover:opacity-100" />
        ) : (
          <div className="w-9 h-9 bg-gradient-to-tr from-[#9e7f65] to-[#c2a38a] rounded-xl flex items-center justify-center font-black text-white text-base shadow-[0_4px_12px_rgba(158,127,101,0.3)] hover:scale-105 transition-transform duration-300">
            A
          </div>
        )}
        {/* Close button only on mobile */}
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-2 rounded-xl hover:bg-white/10 text-stone-400 transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      <nav className={`flex-1 overflow-y-auto space-y-1.5 no-scrollbar ${isCollapsed ? 'px-2' : 'px-4'}`}>
        {links.map((link) => {
          const Icon = link.icon;
          let isActive = pathname === link.href || (link.href !== "/admin" && pathname.startsWith(link.href) && !link.href.includes('?'));
          
          if (link.href === '/admin/caja') {
             isActive = pathname === '/admin/caja';
          } else if (link.href === '/admin/ventas') {
             isActive = pathname === '/admin/ventas' && searchParams.get('mode') !== 'POST_VENTA' && searchParams.get('mode') !== 'WEB';
          } else if (link.href === '/admin/ventas?mode=POST_VENTA') {
             isActive = pathname === '/admin/ventas' && searchParams.get('mode') === 'POST_VENTA';
          } else if (link.href === '/admin/ventas?mode=WEB') {
             isActive = pathname === '/admin/ventas' && searchParams.get('mode') === 'WEB';
          }

          return (
            <Link
              key={link.href}
              href={link.href}
              title={isCollapsed ? link.label : undefined}
              className={`relative flex items-center gap-3 py-2.5 rounded-xl transition-all duration-300 group ${
                isCollapsed ? 'justify-center px-0' : 'px-3'
              } ${isActive ? 'text-[#c2a38a]' : 'text-stone-400 hover:text-stone-100 hover:bg-white/[0.03]'}`}
            >
              {isActive && (
                <motion.div
                  layoutId="active-pill"
                  className="absolute inset-0 bg-gradient-to-r from-[#c2a38a]/18 to-[#c2a38a]/4 rounded-xl border-l-[3px] border-[#c2a38a] shadow-[0_0_15px_rgba(194,163,138,0.1)]"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <div className={`relative z-10 flex items-center gap-3 w-full transition-transform duration-300 ${isActive ? 'translate-x-0.5' : 'group-hover:translate-x-1'}`}>
                <Icon size={18} className={`transition-all duration-300 w-[18px] h-[18px] shrink-0 ${isActive ? 'text-[#c2a38a] drop-shadow-[0_0_8px_rgba(194,163,138,0.4)]' : 'text-stone-500 group-hover:text-[#c2a38a]'}`} />
                {!isCollapsed && <span className={`text-[10px] font-semibold whitespace-nowrap tracking-wide uppercase transition-colors ${isActive ? 'text-white font-bold' : 'text-stone-400 group-hover:text-stone-200'}`}>{link.label}</span>}
                {link.label === "WhatsApp" && !isCollapsed && <WhatsAppBadge />}
                {link.label === "↳ Ventas Web" && !isCollapsed && <WebSalesBadge />}
                {link.label === "Contactos y Clientes" && !isCollapsed && <ContactsAttentionBadge />}
                {link.label === "WhatsApp" && isCollapsed && (
                  <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-[#12100f] shadow-[0_0_8px_#22c55e]"></div>
                )}
                {link.label === "Contactos y Clientes" && isCollapsed && <ContactsAttentionBadge collapsed />}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto relative pb-4">
        {/* Toggle Collapse Button for Desktop */}
        <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:flex absolute -right-3 top-[-40px] w-6 h-6 bg-[#161413] border border-white/[0.08] rounded-full items-center justify-center text-stone-400 hover:text-white shadow-md z-50 transition-all hover:scale-110 hover:border-[#c2a38a]/40"
        >
            {isCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>

        {!isCollapsed ? (
            <button
            onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
            className="mx-4 mb-2.5 w-[calc(100%-2rem)] flex items-center gap-2.5 px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-stone-400 hover:text-stone-200 transition-all cursor-pointer hover:border-white/[0.12]"
            >
            <Search size={14} className="text-stone-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider flex-1 text-left text-stone-400">Buscar...</span>
            <kbd className="px-1.5 py-0.5 bg-white/[0.06] rounded text-[9px] font-black border border-white/[0.08] text-stone-300 hidden sm:inline">⌘K</kbd>
            </button>
        ) : (
            <button
            onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
            title="Buscar (⌘K)"
            className="mx-auto mb-2.5 w-9 h-9 flex items-center justify-center rounded-xl bg-white/[0.03] border border-white/[0.06] text-stone-400 hover:text-[#c2a38a] hover:border-[#c2a38a]/20 transition-all cursor-pointer"
            >
            <Search size={14} />
            </button>
        )}
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-2 py-4">
            <NotificationBell />
          </div>
        ) : (
          <div className="px-2 pb-6 lg:pb-2">
            <UserProfile name={userName} role={userRole} userId={userId} bell={<NotificationBell />} />
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2.5 bg-gradient-to-b from-[#181615] via-[#0e0c0b] to-[#080707] border border-white/[0.08] rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all animate-in fade-in duration-200"
        aria-label="Abrir menú"
      >
        <Menu size={20} className="text-stone-300" />
      </button>

      {/* Desktop sidebar — always visible on lg+ */}
      <div 
        style={{ width: 'var(--sidebar-width, 16rem)' }}
        className="hidden lg:block fixed left-0 top-0 h-screen z-[60] transition-[width] duration-300 ease-in-out"
      >
        <aside className="absolute inset-y-4 left-4 right-4 bg-gradient-to-b from-[#181615]/95 via-[#0e0c0b]/95 to-[#080707]/95 backdrop-blur-3xl border border-white/[0.08] rounded-[2.2rem] shadow-[0_20px_50px_rgba(0,0,0,0.65)] flex flex-col transition-all duration-300">
          {sidebarContent}
        </aside>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in fade-in duration-200"
          onClick={() => setMobileOpen(false)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`lg:hidden fixed top-0 left-0 h-[100dvh] w-72 bg-gradient-to-b from-[#181615] via-[#0e0c0b] to-[#080707] border-r border-white/[0.08] flex flex-col z-50 transition-transform duration-300 ease-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
