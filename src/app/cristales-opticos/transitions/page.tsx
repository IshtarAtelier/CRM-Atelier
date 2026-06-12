import Link from "next/link";
import { Metadata } from "next";
import { AccordionItem } from "@/components/Storefront/Accordion";

export const metadata: Metadata = {
  title: "Transitions Inteligentes | Atelier Óptica",
  description: "Lentes Transitions GEN S y XTRActive. La mejor tecnología fotocromática de Essilor. Se adaptan a cualquier condición de luz.",
  keywords: "Transitions, Fotocromáticos, Transitions GEN S, XTRActive, Lentes Inteligentes, Luz, Sol, Óptica, Atelier",
};

export default function TransitionsPage() {
  return (
    <div className="bg-[#faf8f5]">
      <section className="relative w-full pt-10 pb-20 px-6 md:pt-16 md:pb-28 bg-[#faf8f5]">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-black/50 mb-6">Lentes Inteligentes a la Luz</p>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-8">
            Transitions · Fotocromáticos
          </h1>
          <p className="text-lg md:text-xl text-black/70 max-w-3xl mx-auto leading-relaxed font-light">
            Más que un cristal oscuro. Una gestión inteligente de la luz.
            <br className="hidden md:block" />
            No todos los fotocromáticos son iguales. Con tecnología matricial a nano-escala, la familia Transitions® se adapta a tu entorno de vida brindando protección y estética vibrante.
          </p>
        </div>
      </section>

      <div className="w-full bg-black py-4 overflow-hidden border-y border-white/10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div className="flex items-center gap-3">
            <span className="text-white text-xl">⚡</span>
            <div>
              <h4 className="text-white font-bold text-sm">Velocidad Extrema</h4>
              <p className="text-white/60 text-xs mt-0.5">Aclaramiento y oscurecimiento en segundos</p>
            </div>
          </div>
          <div className="hidden md:block w-px h-10 bg-white/20"></div>
          <div className="flex items-center gap-3">
            <span className="text-white text-xl">🕶️</span>
            <div>
              <h4 className="text-white font-bold text-sm">Bloqueo UV 100%</h4>
              <p className="text-white/60 text-xs mt-0.5">Incluso estando transparentes</p>
            </div>
          </div>
          <div className="hidden md:block w-px h-10 bg-white/20"></div>
          <div className="flex items-center gap-3">
            <span className="text-white text-xl">🎨</span>
            <div>
              <h4 className="text-white font-bold text-sm">Style Colors</h4>
              <p className="text-white/60 text-xs mt-0.5">8 colores vibrantes y de tendencia</p>
            </div>
          </div>
        </div>
      </div>

      <section className="w-full py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">El Portafolio Transitions</h2>
            <p className="text-black/60 text-lg">
              Distintas generaciones y tecnologías para distintos niveles de sensibilidad a la luz.
            </p>
          </div>

          <AccordionItem 
            title="Transitions® GEN S™ (¡Nuevo!)" 
            subtitle="El nuevo estándar fotocromático ultrarrápido y vibrante."
            defaultOpen={true}
          >
            <p className="mb-4">
              <strong>GEN S</strong> es la tecnología más reciente y revolucionaria. Ha sido re-diseñada desde cero para ser la lente que &quot;rompe las reglas&quot; de los antiguos fotocromáticos que tardaban en aclararse.
            </p>
            <ul className="list-disc pl-5 mb-4 space-y-2">
              <li><strong>Velocidad incomparable:</strong> Se oscurecen en segundos bajo el sol y se aclaran de forma notablemente más rápida al entrar a interiores comparado con la generación anterior (Gen 8).</li>
              <li><strong>Rendimiento HD:</strong> Mantienen una altísima transparencia en interiores, sin ese &quot;tono residual&quot; molesto.</li>
              <li><strong>Colores Espectaculares:</strong> Disponibles en colores clásicos (Gris, Marrón, Verde) y la increíble paleta <em>Style Colors</em> (Zafiro, Amatista, Ámbar, Esmeralda, Rubí) para combinar con tu armazón como un accesorio de moda.</li>
            </ul>
          </AccordionItem>

          <AccordionItem 
            title="Transitions® XTRActive®" 
            subtitle="La solución definitiva para sensibilidad extrema y conducción."
          >
            <p className="mb-4">
              Un fotocromático tradicional reacciona a la radiación UV directa (por lo que no se oscurece detrás del parabrisas del auto, ya que el vidrio bloquea los rayos UV). <strong>Transitions XTRActive</strong> es diferente: cuenta con moléculas fotosensibles de amplio espectro que reaccionan también a la <em>luz visible</em>.
            </p>
            <ul className="list-disc pl-5 mb-4 space-y-2">
              <li><strong>¡Se oscurecen en el auto!</strong> Logran un oscurecimiento funcional detrás del parabrisas protegiéndote mientras manejás.</li>
              <li>Oscurecimiento extra intenso al aire libre, ideal para personas con fotofobia (gran sensibilidad a la luz) o post-cirugías oculares.</li>
              <li>Tienen un finísimo tinte residual protector en interiores frente a luces muy fuertes.</li>
            </ul>
          </AccordionItem>

          <AccordionItem 
            title="Transitions® XTRActive® Polarized™" 
            subtitle="Transición inteligente + polarizado dinámico."
          >
            <p className="mb-4">
              La evolución de la línea XTRActive. Además de oscurecerse en el sol y en el auto, incorpora una <strong>capa de polarización dinámica</strong>.
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>En interiores es transparente y sin polarizar.</li>
              <li>Al recibir impacto solar pleno al aire libre, además de oscurecerse, las moléculas se alinean para alcanzar un <strong>90% de eficiencia de polarización</strong>, cortando los reflejos cegadores del asfalto o del agua.</li>
              <li>El pináculo de la protección visual para usuarios exigentes.</li>
            </ul>
          </AccordionItem>
        </div>
      </section>

      <section className="w-full bg-white py-24 px-6 border-t border-[#e8e2db]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">El fin de cargar con dos anteojos</h2>
          <p className="text-lg text-black/70 mb-10 leading-relaxed">
            Combinar tu receta multifocal o monofocal con tecnología Transitions te permite tener un anteojo &quot;Todo Terreno&quot;. Ya sea que salgas apurado de casa o cambies de ambiente de trabajo, tu visión siempre estará protegida sin esfuerzo.
          </p>
          <Link 
            href={`/contacto?motivo=${encodeURIComponent("Asesoramiento tecnología Transitions")}`}
            className="inline-block bg-[#283f5a] hover:bg-[#1e3047] text-white px-10 py-4 rounded-full font-bold transition-all shadow-lg hover:shadow-xl hover:-translate-y-1"
          >
            Quiero elegir mi color Transitions
          </Link>
        </div>
      </section>
    </div>
  );
}
