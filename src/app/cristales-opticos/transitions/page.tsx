import { Metadata } from "next";
import { AccordionItem } from "@/components/Storefront/Accordion";
import { CristalHero } from "@/components/cristales/CristalHero";
import { CristalFeatures } from "@/components/cristales/CristalFeatures";
import { CristalCTA } from "@/components/cristales/CristalCTA";

export const metadata: Metadata = {
  title: "Transitions Inteligentes | Atelier Óptica",
  description: "Lentes Transitions GEN S y XTRActive. La mejor tecnología fotocromática de Essilor. Se adaptan a cualquier condición de luz.",
  keywords: "Transitions, Fotocromáticos, Transitions GEN S, XTRActive, Lentes Inteligentes, Luz, Sol, Óptica, Atelier",
};

export default function TransitionsPage() {
  return (
    <div className="bg-[#faf8f5]">
      <CristalHero 
        preTitle="Lentes Inteligentes a la Luz"
        title="Transitions · Fotocromáticos"
        description={
          <>
            Más que un cristal oscuro. Una gestión inteligente de la luz.
            <br className="hidden md:block" />
            No todos los fotocromáticos son iguales. Con tecnología matricial a nano-escala, la familia Transitions® se adapta a tu entorno de vida brindando protección y estética vibrante.
          </>
        }
      />

      <CristalFeatures 
        features={[
          { icon: "⚡", title: "Velocidad Extrema", subtitle: "Aclaramiento y oscurecimiento en segundos" },
          { icon: "🕶️", title: "Bloqueo UV 100%", subtitle: "Incluso estando transparentes" },
          { icon: "🎨", title: "Style Colors", subtitle: "8 colores vibrantes y de tendencia" },
        ]}
      />

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

      <CristalCTA 
        title="El fin de cargar con dos anteojos"
        description={
          <>
            Combinar tu receta multifocal o monofocal con tecnología Transitions te permite tener un anteojo &quot;Todo Terreno&quot;. Ya sea que salgas apurado de casa o cambies de ambiente de trabajo, tu visión siempre estará protegida sin esfuerzo.
          </>
        }
        buttonText="Quiero elegir mi color Transitions"
        whatsappMotivo="Asesoramiento tecnología Transitions"
      />
    </div>
  );
}
