import { Metadata } from "next";
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { StorefrontFooter } from "@/components/Storefront/StorefrontFooter";
import { FloatingWhatsApp } from "@/components/Storefront/FloatingWhatsApp";
import { CristalCTA } from "@/components/cristales/CristalCTA";
import { AccordionItem } from "@/components/Storefront/Accordion";

export const metadata: Metadata = {
  title: "Óptica Abierta Ahora y Reparación de Anteojos | Atelier Óptica",
  description: "Servicio de urgencia para anteojos recetados. Reparación de armazones, cambio de plaquetas y cristales monofocales gracias a nuestro laboratorio propio.",
  keywords: ["optica abierta ahora", "reparacion de anteojos", "anteojos en 1 hora", "optica de turno cordoba", "soldar armazon", "arreglo de anteojos rotos"],
};

export default function UrgenciasPage() {
  return (
    <div className="bg-[#faf8f5] text-black min-h-screen flex flex-col">
      <StorefrontNavbar theme="dark" />
      
      <main className="flex-grow pt-32 pb-16">
        <section className="px-6 mb-16">
          <div className="max-w-4xl mx-auto text-center">
            <span className="inline-block py-1 px-3 rounded-full bg-red-100 text-red-800 text-sm font-bold tracking-widest uppercase mb-4">Servicio Rápido</span>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              Urgencias Ópticas y Reparaciones
            </h1>
            <p className="text-lg text-black/60 md:text-xl max-w-2xl mx-auto">
              Sabemos que perder o romper tus anteojos es una verdadera urgencia. Nuestro laboratorio cuenta con la tecnología para ofrecerte <strong>soluciones en tiempo récord</strong>.
            </p>
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-6 mb-24 grid md:grid-cols-2 gap-8">
          {/* Card: Anteojos Express */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-[#e8e2db] flex flex-col">
            <div className="text-4xl mb-4">⏱️</div>
            <h2 className="text-2xl font-bold mb-3">Anteojos Recetados Express</h2>
            <p className="text-black/70 mb-6 flex-grow">
              Al contar con laboratorio propio y un amplio stock de cristales monofocales blancos y con filtro azul, podemos armar tus nuevos anteojos para visión lejana o cercana con prioridad.
            </p>
            <ul className="space-y-2 mb-8 text-sm font-medium">
              <li className="flex items-center gap-2">✓ Cristales monofocales en stock</li>
              <li className="flex items-center gap-2">✓ Armado computarizado de alta precisión</li>
              <li className="flex items-center gap-2">✓ Gran variedad de armazones disponibles</li>
            </ul>
          </div>

          {/* Card: Clínica del Anteojo */}
          <div className="bg-[#283f5a] text-white p-8 rounded-2xl shadow-md flex flex-col">
            <div className="text-4xl mb-4">🔧</div>
            <h2 className="text-2xl font-bold mb-3">Clínica de Reparaciones</h2>
            <p className="text-white/80 mb-6 flex-grow">
              ¿Se aflojó un tornillo, se cayó una patilla o te sentaste arriba de tu armazón favorito? Antes de descartarlos, consultanos. Revivimos armazones que parecían perdidos.
            </p>
            <ul className="space-y-2 mb-8 text-sm font-medium text-white/90">
              <li className="flex items-center gap-2">✓ Ajuste general, nivelado y limpieza ultrasónica</li>
              <li className="flex items-center gap-2">✓ Cambio de tornillos y plaquetas de silicona</li>
              <li className="flex items-center gap-2">✓ Reemplazo de cristales rayados en tu propio marco</li>
            </ul>
          </div>
        </section>

        <section className="max-w-4xl mx-auto px-6 mb-24">
          <h2 className="text-2xl md:text-3xl font-bold mb-8 text-center">Preguntas Frecuentes sobre Reparaciones</h2>
          
          <div className="space-y-4">
            <AccordionItem title="¿Por qué NO debo usar &apos;La Gotita&apos; o pegamentos fuertes en mis anteojos rotos?" defaultOpen={true}>
              <p>
                Los pegamentos a base de cianoacrilato (como La Gotita o SuperGlue) <strong>arruinan irreversiblemente</strong> el acetato y el zilo del armazón, quemando el material y manchando los cristales. Además, cristalizan la unión, haciendo imposible una soldadura o reparación profesional posterior. Si se te rompieron, traelos como estén.
              </p>
            </AccordionItem>

            <AccordionItem title="¿Se pueden pulir los cristales rayados?">
              <p>
                No. A diferencia del vidrio convencional de una ventana o un auto, los cristales oftalmológicos modernos tienen múltiples capas de tratamientos muy delicados (Antirreflex, Filtro UV, Filtro Azul, Laca Endurecedora). <strong>Pulirlos destruiría tu graduación y estos tratamientos</strong>. La única solución segura para la salud visual es cambiar los cristales manteniendo tu armazón.
              </p>
            </AccordionItem>

            <AccordionItem title="¿Hacen cristales multifocales en el acto?">
              <p>
                No. Los cristales multifocales, al requerir tecnología digital Free-Form (tallado punto por punto) y la toma de medidas exactas de tu postura e inclinación pantoscópica, se envían a laboratorios de alta complejidad (como Essilor/Varilux) y tienen una demora normal de 10 a 15 días hábiles.
              </p>
            </AccordionItem>
          </div>
        </section>

        <CristalCTA 
          title="Resolvemos tu problema hoy"
          description="Mandanos una foto de la rotura de tus anteojos o pasanos tu receta por WhatsApp para que te confirmemos si tenemos stock para armarte el lente express."
          buttonText="Consultar Urgencia por WhatsApp"
          whatsappMotivo="Urgencia óptica: "
        />
      </main>

      <StorefrontFooter />
      <FloatingWhatsApp />
    </div>
  );
}
