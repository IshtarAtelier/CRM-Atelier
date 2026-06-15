import { Metadata } from "next";
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { StorefrontFooter } from "@/components/Storefront/StorefrontFooter";
import { FloatingWhatsApp } from "@/components/Storefront/FloatingWhatsApp";
import { AccordionItem } from "@/components/Storefront/Accordion";
import { CristalCTA } from "@/components/cristales/CristalCTA";

export const metadata: Metadata = {
  title: "Ópticas con Obras Sociales y Prepagas | Atelier Óptica",
  description: "Confeccionamos facturas y documentación para reintegros de prepagas y obras sociales como OSDE, Swiss Medical, Galeno y Apross. Presupuestamos tu receta.",
  keywords: ["optica con osde", "optica con swiss medical", "reintegros anteojos", "obras sociales opticas", "descuentos en cristales", "optica cordoba"],
};

export default function ObrasSocialesPage() {
  return (
    <div className="bg-[#faf8f5] text-black min-h-screen flex flex-col">
      <StorefrontNavbar theme="dark" />
      
      <main className="flex-grow pt-32 pb-16">
        <section className="px-6 mb-16">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              Obras Sociales y Prepagas
            </h1>
            <p className="text-lg text-black/60 md:text-xl max-w-2xl mx-auto">
              Te facilitamos toda la documentación necesaria para que puedas gestionar tus <strong>reintegros</strong> con las principales coberturas médicas del país.
            </p>
          </div>
        </section>

        <section className="max-w-4xl mx-auto px-6 mb-24">
          <div className="bg-white p-8 md:p-12 rounded-2xl shadow-sm border border-[#e8e2db] mb-12">
            <h2 className="text-2xl font-bold mb-4">¿Cómo funciona el sistema de reintegros?</h2>
            <p className="mb-6 text-black/70 leading-relaxed">
              En Atelier Óptica trabajamos bajo el sistema de <strong>reintegros</strong> para brindarte la mayor libertad posible al momento de elegir armazones de diseño y cristales premium (como Varilux o Zeiss) sin estar limitado a las cartillas básicas.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 bg-[#faf8f5] rounded-xl">
                <div className="text-3xl mb-3">📄</div>
                <h3 className="font-bold mb-2">1. Traés tu receta</h3>
                <p className="text-sm text-black/60">Nos enviás o traés la orden médica de tu oftalmólogo (digital o física).</p>
              </div>
              <div className="p-6 bg-[#faf8f5] rounded-xl">
                <div className="text-3xl mb-3">👓</div>
                <h3 className="font-bold mb-2">2. Elegís lo mejor</h3>
                <p className="text-sm text-black/60">Seleccionás el armazón que más te guste y los cristales con la tecnología ideal para vos.</p>
              </div>
              <div className="p-6 bg-[#faf8f5] rounded-xl">
                <div className="text-3xl mb-3">🧾</div>
                <h3 className="font-bold mb-2">3. Gestionás tu reintegro</h3>
                <p className="text-sm text-black/60">Te entregamos la factura oficial con los códigos requeridos por tu prepaga para que tramites la devolución del dinero.</p>
              </div>
            </div>
          </div>

          <h2 className="text-2xl md:text-3xl font-bold mb-8 text-center">Preguntas Frecuentes sobre Coberturas</h2>
          
          <div className="space-y-4">
            <AccordionItem title="¿Qué documentación me entregan para presentar en OSDE, Swiss Medical o Galeno?" defaultOpen={true}>
              <p>
                Te entregaremos la <strong>Factura B o A</strong> detallando los conceptos exactos solicitados por la Superintendencia de Servicios de Salud (por ejemplo: &quot;Armazón recetado&quot; y &quot;Cristales Orgánicos Blancos/Antirreflex&quot;). Con esta factura y la receta de tu médico oftalmólogo, podés cargar el trámite directamente en la App de tu prepaga.
              </p>
            </AccordionItem>

            <AccordionItem title="¿Qué monto me cubre mi obra social o prepaga?">
              <p>
                El porcentaje o monto fijo de cobertura <strong>depende estrictamente del plan que tengas contratado</strong> (ej. OSDE 210 vs OSDE 410). Te recomendamos consultar previamente con atención al cliente de tu prepaga para saber cuál es tu tope de reintegro anual para óptica.
              </p>
            </AccordionItem>

            <AccordionItem title="¿Cuáles son los requisitos de la receta médica?">
              <p>
                Para que la prepaga o mutual (como Apross o Jerárquicos) autorice tu reintegro, la orden debe incluir:
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Fecha de emisión (suele tener una validez de 30 a 60 días).</li>
                <li>Nombre, apellido y número de afiliado del paciente.</li>
                <li>Diagnóstico o agudeza visual (OD/OI).</li>
                <li>Firma y sello legible del médico oftalmólogo.</li>
              </ul>
            </AccordionItem>

            <AccordionItem title="¿Los descuentos son acumulables con las promociones de la óptica?">
              <p>
                ¡Sí! Podés aprovechar nuestras <strong>promociones (como cuotas sin interés o descuentos en efectivo)</strong> al momento de pagar en la óptica, y luego recibir el dinero adicional del reintegro por parte de tu obra social, haciendo que tus anteojos nuevos sean sumamente accesibles.
              </p>
            </AccordionItem>
          </div>
        </section>

        <CristalCTA 
          title="¿Tenés dudas sobre tu receta o cobertura?"
          description="Mandanos una foto de la orden médica y te pasamos un presupuesto detallado con las distintas gamas de cristales para que puedas presentarlo a tu prepaga."
          buttonText="Presupuestar por WhatsApp"
          whatsappMotivo="Consulta sobre Obras Sociales y Reintegros"
        />
      </main>

      <StorefrontFooter />
      <FloatingWhatsApp />
    </div>
  );
}
