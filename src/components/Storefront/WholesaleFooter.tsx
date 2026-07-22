import Link from "next/link";
import { WHATSAPP_PHONE } from "@/lib/constants";

// Footer del canal mayorista — marca Cápsula Escarlata, sin NINGÚN dato de
// Atelier (dirección, redes, local, blog, obras sociales). Solo lo útil para
// una óptica. Se muestra a sesiones OPTICA en /tienda y demás páginas públicas.
export function WholesaleFooter() {
  const waLink = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(
    "Hola! Consulta sobre el canal mayorista de Cápsula Escarlata.",
  )}`;
  return (
    <footer className="w-full bg-stone-950 border-t border-white/10 text-stone-300">
      <div className="mx-auto w-full max-w-6xl px-6 md:px-10 py-12 flex flex-col gap-8 md:flex-row md:justify-between md:items-start">
        <div>
          <p
            className="text-lg font-bold tracking-widest text-[#c8a55c] mb-2"
            style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
          >
            CÁPSULA ESCARLATA
          </p>
          <p className="text-[13px] text-stone-400 max-w-xs leading-relaxed">
            Armazones de diseño de autor. Canal mayorista para ópticas — precios
            netos por unidad.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-[10px] uppercase tracking-widest font-bold text-stone-300 mb-1">Canal mayorista</p>
          <Link href="/tienda" className="text-[13px] font-medium text-stone-200 hover:text-white transition-colors">Catálogo</Link>
          <a href={waLink} target="_blank" rel="noopener noreferrer" className="text-[13px] font-medium text-stone-200 hover:text-white transition-colors">WhatsApp</a>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto w-full max-w-6xl px-6 md:px-10 py-6">
          <p className="text-[12px] text-stone-400 font-medium">© 2026 Cápsula Escarlata. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
