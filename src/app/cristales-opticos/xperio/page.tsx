import { Metadata } from "next";
import { AccordionItem } from "@/components/Storefront/Accordion";
import { CristalHero } from "@/components/cristales/CristalHero";
import { CristalFeatures } from "@/components/cristales/CristalFeatures";
import { CristalCTA } from "@/components/cristales/CristalCTA";

export const metadata: Metadata = {
  alternates: { canonical: '/cristales-opticos/xperio' },
  title: "Xperio Polarizados Premium",
  description: "Lentes polarizadas Xperio para confort total al sol. Cortan los reflejos cegadores de la ruta, la nieve y el agua. Categoría 3.",
  keywords: "Xperio, Polarizados, Lentes de Sol, Reflejos, Conducción, Óptica, Atelier, Córdoba",
};

export default function XperioPage() {
  return (
    <div className="bg-[#faf8f5]">
      <CristalHero 
        preTitle="Performance Outdoor"
        title="Xperio · Polarizados"
        description={
          <>
            Mucho más que un &quot;lente oscuro&quot;.
            <br className="hidden md:block" />
            Mientras los lentes de sol normales solo oscurecen tu vista, la tecnología Xperio® actúa como una <strong>persiana óptica</strong> bloqueando los destellos peligrosos y cegadores de la luz reflejada.
          </>
        }
      />

      <CristalFeatures 
        features={[
          { icon: "☀️", title: "Polarización Categ. 3", subtitle: "Eliminación total del resplandor" },
          { icon: "🚘", title: "Seguridad Vial", subtitle: "Recorta los destellos del asfalto húmedo" },
          { icon: "👓", title: "Alta Prescripción", subtitle: "Disponibles en multifocales y altos aumentos" },
        ]}
      />

      <section className="w-full py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">El Poder del Polarizado</h2>
            <p className="text-black/60 text-lg">
              Entendé cómo adaptar tu lente de sol a la actividad exacta que vas a realizar.
            </p>
          </div>

          <AccordionItem 
            title="¿Cómo funciona el efecto persiana?" 
            subtitle="La física detrás de la visión nítida al sol."
            defaultOpen={true}
          >
            <p className="mb-4">
              La luz del sol se propaga en todas las direcciones. Cuando choca contra una superficie plana (como el agua, la ruta, la nieve o el capó de otro auto), la luz se concentra y se refleja de forma horizontal. Esto genera el &quot;destello cegador&quot; o resplandor.
            </p>
            <ul className="list-disc pl-5 mb-4 space-y-2">
              <li>Un lente de sol común (solo teñido) oscurece todo por igual, pero el destello horizontal sigue encandilando.</li>
              <li>El film interno de los cristales <strong>Xperio</strong> actúa como una matriz vertical (como si fueran los barrotes de una persiana) que absorbe y bloquea esa luz horizontal.</li>
              <li>El resultado: lográs ver &quot;a través&quot; del reflejo (por ejemplo, podés ver el fondo del agua en vez del destello del sol sobre la superficie).</li>
            </ul>
          </AccordionItem>

          <AccordionItem 
            title="Especialización: Ruta y Asfalto" 
            subtitle="Conducción profesional y segura."
          >
            <p className="mb-4">
              Para los viajes por ruta, los reflejos del asfalto mojado o las horas del atardecer son críticos. El polarizado mejora notablemente tu tiempo de reacción.
            </p>
            <ul className="list-disc pl-5 mb-4 space-y-2">
              <li>Mejora la agudeza visual al no obligarte a entrecerrar los ojos.</li>
              <li>Color recomendado: <strong>Gris o Verde G15</strong>. El gris mantiene los colores de las señales de tránsito neutros y puros, mientras que el verde alivia la fatiga ocular a lo largo de las horas.</li>
            </ul>
          </AccordionItem>

          <AccordionItem 
            title="Especialización: Náutica, Pesca y Nieve" 
            subtitle="Contraste máximo en superficies extremas."
          >
            <p className="mb-4">
              El agua y la nieve son las superficies más reflectantes del mundo natural. Estar horas sin protección adecuada puede causar &quot;ceguera de nieve&quot; (fotokeratitis).
            </p>
            <ul className="list-disc pl-5 mb-4 space-y-2">
              <li>Elimina por completo el &quot;velo&quot; blanco del agua, permitiendo ver a los peces o el relieve de las olas con máxima precisión.</li>
              <li>Color recomendado: <strong>Marrón</strong>. El lente marrón filtra un porcentaje alto de luz azul ambiental, lo que realza los contrastes dramáticamente, permitiendo distinguir hundimientos en la nieve o en la arena con muchísima más facilidad que un cristal gris.</li>
            </ul>
          </AccordionItem>

          <AccordionItem 
            title="Recetas Complejas (Multifocales y Curvos)" 
            subtitle="Polarizados a medida."
          >
            <p className="mb-4">
              Históricamente, si tenías aumento alto o usabas multifocales, no podías acceder a anteojos de sol deportivos o envolventes. Hoy la tecnología Xperio se talla a medida:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Se pueden hacer en diseños progresivos (Varilux Xperio).</li>
              <li>Se pueden adaptar a armazones envolventes o curvados (curva base especial) manteniendo la óptica impecable en los bordes.</li>
            </ul>
          </AccordionItem>
        </div>
      </section>

      <CristalCTA 
        title="Armá tu lente de sol ideal"
        description={
          <>
            Elegí un buen armazón estilo aviador, deportivo o clásico grueso, y decinos tu receta. En Atelier transformamos cualquier gafa en el mejor lente de sol con aumento polarizado que hayas usado.
          </>
        }
        buttonText="Armar mis lentes de Sol Xperio"
        whatsappMotivo="Asesoramiento para armado de Lentes de Sol Polarizados Xperio"
      />
    </div>
  );
}
