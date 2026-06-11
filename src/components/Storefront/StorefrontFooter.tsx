import Link from "next/link";
import Image from "next/image";
import { WHATSAPP_PHONE } from "@/lib/constants";

export function StorefrontFooter() {
  return (
    <footer className="w-full relative z-10 overflow-hidden">
      
      {/* Cinematic Background Image */}
      <div className="absolute inset-0 z-0">
        <Image 
          src="/footer-hands-compressed.jpg" 
          alt="Atelier Creation" 
          fill 
          loading="lazy"
          className="object-cover object-center"
        />
      </div>

      {/* Footer Content Overlay (Frosted Glass Nude effect) */}
      <div className="relative z-10 w-full h-full bg-white/70 backdrop-blur-2xl dark:bg-stone-900/80 border-t border-black/5 dark:border-white/5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 px-5 py-12">
          
          {/* Links principales */}
          <div className="flex flex-col gap-3">
            <p className="text-[10px] uppercase tracking-widest font-bold text-stone-400 mb-2">Atelier</p>
            <Link href="/contacto" className="text-[13px] font-medium hover:opacity-60 transition-opacity">Contact Us</Link>
            <Link href="/faq" className="text-[13px] font-medium hover:opacity-60 transition-opacity">Customer Service / FAQ</Link>
            <Link href="/nuestro-local" className="text-[13px] font-medium hover:opacity-60 transition-opacity">Store Locator</Link>
            <Link href="/resenas" className="text-[13px] font-medium hover:opacity-60 transition-opacity">Reseñas</Link>
            <Link href="/blog" className="text-[13px] font-medium hover:opacity-60 transition-opacity">Editorial</Link>
          </div>

          {/* Ubicación */}
          <div className="flex flex-col gap-3">
            <p className="text-[10px] uppercase tracking-widest font-bold text-stone-400 mb-2">Visitanos</p>
            <p className="text-[13px] font-medium leading-relaxed dark:text-stone-300">
              José Luis de Tejeda 4380<br />
              Cerro de las Rosas, Córdoba
            </p>
            <a href="https://www.google.com/maps?cid=14830223812501661125" target="_blank" rel="noopener noreferrer" className="text-[12px] font-medium hover:opacity-60 transition-opacity underline decoration-stone-300 underline-offset-4 mt-1">
              Ver en Google Maps
            </a>
          </div>

          {/* Políticas Legales */}
          <div className="flex flex-col gap-3">
            <p className="text-[10px] uppercase tracking-widest font-bold text-stone-400 mb-2">Legales</p>
            <Link href="/politicas-de-cambio" className="text-[13px] font-medium hover:opacity-60 transition-opacity">Cambios y Devoluciones</Link>
            <Link href="/politicas-de-cambio" className="text-[13px] font-medium hover:opacity-60 transition-opacity">Términos y Condiciones</Link>
            <Link href="/politicas-de-cambio" className="text-[13px] font-medium hover:opacity-60 transition-opacity">Políticas de Privacidad</Link>
          </div>

          {/* Redes sociales */}
          <div className="flex flex-col gap-3">
            <p className="text-[10px] uppercase tracking-widest font-bold text-stone-400 mb-2">Social</p>
            <a href="https://instagram.com/atelieroptica_" target="_blank" rel="noopener noreferrer" className="text-[13px] font-medium hover:opacity-60 transition-opacity">Instagram</a>
            <a href="https://www.youtube.com/@atelieroptica" target="_blank" rel="noopener noreferrer" className="text-[13px] font-medium hover:opacity-60 transition-opacity">YouTube</a>
            <a href={`https://wa.me/${WHATSAPP_PHONE}`} target="_blank" rel="noopener noreferrer" className="text-[13px] font-medium hover:opacity-60 transition-opacity">WhatsApp</a>
          </div>
          
        </div>

        {/* Info extra (Pagos y AFIP) */}
        <div className="border-t border-black/5 dark:border-white/5 px-5 py-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex gap-4 items-center">
            <span className="text-[11px] text-stone-400 font-medium">Tarjetas de Crédito • Débito • Transferencia</span>
            <span className="w-1 h-1 rounded-full bg-stone-300"></span>
            <span className="text-[11px] text-stone-400 font-medium">Envíos a todo el país</span>
          </div>
          <p className="text-[11px] text-stone-400">Comprobante AFIP Data Fiscal</p>
        </div>

        {/* Copyright */}
        <div className="border-t border-black/5 dark:border-white/5 px-5 py-6">
          <p className="text-[12px] text-stone-500 font-medium">© 2026 ATELIER ÓPTICA. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
