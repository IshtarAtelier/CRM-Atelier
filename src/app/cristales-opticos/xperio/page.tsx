import Link from "next/link";
import { Metadata } from "next";
import { AccordionItem } from "@/components/Storefront/Accordion";

export const metadata: Metadata = {
  title: "Xperio Polarizados Premium | Atelier Óptica",
  description: "Lentes polarizadas Xperio para confort total al sol. Cortan los reflejos cegadores de la ruta, la nieve y el agua. Categoría 3.",
  keywords: "Xperio, Polarizados, Lentes de Sol, Reflejos, Conducción, Óptica, Atelier, Córdoba",
};

export default function XperioPage() {
  return (
    <div className="bg-[#faf8f5]">
      <section className="relative w-full pt-10 pb-20 px-6 md:pt-16 md:pb-28 bg-[#faf8f5]">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-black/50 mb-6">Performance Outdoor</p>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-8">
            Xperio · Polarizados
          </h1>
          <p className="text-lg md:text-xl text-black/70 max-w-3xl mx-auto leading-relaxed font-light">
            Mucho más que un &quot;lente oscuro&quot;.
            <br className="hidden md:block" />
            Mientras los lentes de sol normales solo oscurecen tu vista, la tecnología Xperio® actúa como una <strong>persiana óptica</strong> bloqueando los destellos peligrosos y cegadores de la luz reflejada.
          </p>
        </div>
      </section>

      <div className="w-full bg-black py-4 overflow-hidden border-y border-white/10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div className="flex items-center gap-3">
            <span className="text-white text-xl">☀️</span>
            <div>
              <h4 className="text-white font-bold text-sm">Polarización Categ. 3</h4>
              <p className="text-white/60 text-xs mt-0.5">Eliminación total del resplandor</p>
            </div>
          </div>
          <div className="hidden md:block w-px h-10 bg-white/20"></div>
          <div className="flex items-center gap-3">
            <span className="text-white text-xl">🚘</span>
            <div>
              <h4 className="text-white font-bold text-sm">Seguridad Vial</h4>
              <p className="text-white/60 text-xs mt-0.5">Recorta los destellos del asfalto húmedo</p>
            </div>
          </div>
          <div className="hidden md:block w-px h-10 bg-white/20"></div>
          <div className="flex items-center gap-3">
            <span className="text-white text-xl">👓</span>
            <div>
              <h4 className="text-white font-bold text-sm">Alta Prescripción</h4>
              <p className="text-white/60 text-xs mt-0.5">Disponibles en multifocales y altos aumentos</p>
            </div>
          </div>
        </div>
      </div>

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

      <section className="w-full bg-white py-24 px-6 border-t border-[#e8e2db]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">Armá tu lente de sol ideal</h2>
          <p className="text-lg text-black/70 mb-10 leading-relaxed">
            Elegí un buen armazón estilo aviador, deportivo o clásico grueso, y decinos tu receta. En Atelier transformamos cualquier gafa en el mejor lente de sol con aumento polarizado que hayas usado.
          </p>
          <Link 
            href={`/contacto?motivo=${encodeURIComponent("Asesoramiento para armado de Lentes de Sol Polarizados Xperio")}`}
            className="inline-block bg-[#283f5a] hover:bg-[#1e3047] text-white px-10 py-4 rounded-full font-bold transition-all shadow-lg hover:shadow-xl hover:-translate-y-1"
          >
            Armar mis lentes de Sol Xperio
          </Link>
        </div>
      </section>
    </div>
  );
}
