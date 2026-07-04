import { Metadata } from "next";
import { AccordionItem } from "@/components/Storefront/Accordion";
import { CristalHero } from "@/components/cristales/CristalHero";
import { CristalFeatures } from "@/components/cristales/CristalFeatures";
import { CristalCTA } from "@/components/cristales/CristalCTA";

export const metadata: Metadata = {
  alternates: { canonical: '/cristales-opticos/antirreflejo' },
  title: "Antirreflejo AR & Blue | Cristal Monofocal Estándar",
  description: "Cristal orgánico monofocal con antirreflejo (AR) o con filtro de luz azul (Blue): la base ideal para cualquier receta, al mejor precio de entrada.",
  keywords: "Antirreflejo, AR, Blue, Cristal Monofocal, Orgánico Blanco, Óptica, Atelier",
};

export default function AntirreflejoPage() {
  return (
    <div className="bg-[#faf8f5]">
      <CristalHero
        preTitle="Monofocal · Base"
        title="Antirreflejo AR & Blue"
        description={
          <>
            El punto de partida de cualquier anteojo recetado.
            <br className="hidden md:block" />
            Cristal orgánico monofocal con <strong>antirreflejo (AR)</strong> para quitar los reflejos y mejorar la nitidez, o con <strong>Blue</strong> para sumarle filtro de luz azul sin cambiar de presupuesto.
          </>
        }
      />

      <CristalFeatures
        features={[
          { icon: "🚫", title: "Antirreflejo (AR)", subtitle: "Menos reflejos, mejor nitidez y estética" },
          { icon: "🔵", title: "Blue", subtitle: "Suma filtro de luz azul al mismo cristal" },
          { icon: "💰", title: "Entrada accesible", subtitle: "La base más elegida para uso diario" },
        ]}
      />

      <section className="w-full py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Dos versiones, un mismo cristal base</h2>
            <p className="text-black/60 text-lg">
              Ambas parten del mismo orgánico blanco estándar (índice 1.50); la diferencia está en el tratamiento de superficie.
            </p>
          </div>

          <AccordionItem
            title="Antirreflejo (AR)"
            subtitle="El clásico: quita brillos y reflejos molestos."
            defaultOpen={true}
          >
            <p className="mb-4">
              El tratamiento antirreflejo elimina los reflejos de luces, pantallas y faros que rebotan en la superficie del cristal, mejorando la nitidez con la que ves y con la que te ven los demás.
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Recomendado como mínimo para cualquier anteojo recetado, de uso diario o para manejar de noche.</li>
              <li>Es la opción más elegida cuando no hay una necesidad puntual de filtrar luz azul.</li>
            </ul>
          </AccordionItem>

          <AccordionItem
            title="Blue"
            subtitle="El mismo antirreflejo, con protección extra para pantallas."
          >
            <p className="mb-4">
              La versión Blue suma al antirreflejo un filtro de luz azul, pensado para quienes pasan varias horas frente al celular o la computadora pero buscan la opción más económica dentro del monofocal.
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Buena puerta de entrada antes de dar el salto a líneas premium como Eyezen o Super Blue 1.60.</li>
              <li>Recomendado para estudiantes y trabajo de oficina con presupuesto ajustado.</li>
            </ul>
          </AccordionItem>

          <AccordionItem
            title="¿Cuándo conviene subir de nivel?"
            subtitle="Guía rápida para no gastar de más ni de menos."
          >
            <p className="mb-4">
              Si tu graduación es alta y buscás un cristal más fino, o si tu prioridad es el descanso visual con pantallas, conviene mirar nuestras opciones de mayor índice o boost de lectura.
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Traé tu receta y te asesoramos sin vueltas sobre qué tratamiento te conviene.</li>
            </ul>
          </AccordionItem>
        </div>
      </section>

      <CristalCTA
        title="El cristal correcto para empezar, sin vueltas"
        description={
          <>
            Si buscás un monofocal simple y confiable, el antirreflejo AR o Blue es la base. Contanos tu receta y te decimos cuál conviene según tu día a día.
          </>
        }
        buttonText="Consultar por AR o Blue"
        whatsappMotivo="Consulta por cristal monofocal antirreflejo AR o Blue"
      />
    </div>
  );
}
