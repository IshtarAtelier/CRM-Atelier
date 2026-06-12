import Link from "next/link";
import { Metadata } from "next";
import { AccordionItem } from "@/components/Storefront/Accordion";

export const metadata: Metadata = {
  title: "Stellest Control Miopía Infantil | Atelier Óptica",
  description: "Cristales Stellest de Essilor con tecnología H.A.L.T. Comprobado clínicamente que ralentizan la miopía en niños un 67%.",
  keywords: "Stellest, Miopía, Niños, Cristales Infantiles, Control Miopía, Essilor, H.A.L.T, Óptica, Atelier, Córdoba",
};

export default function StellestPage() {
  return (
    <div className="bg-[#faf8f5]">
      <section className="relative w-full pt-10 pb-20 px-6 md:pt-16 md:pb-28 bg-[#faf8f5]">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-black/50 mb-6">Tratamiento Clínico Infantil</p>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-8">
            Stellest · Control Miopía
          </h1>
          <p className="text-lg md:text-xl text-black/70 max-w-3xl mx-auto leading-relaxed font-light">
            No basta con corregir la visión, hay que frenar su avance.
            <br className="hidden md:block" />
            Essilor Stellest™ es una lente revolucionaria que no solo permite que los niños vean nítidamente, sino que <strong>actúa de forma activa sobre el globo ocular</strong> para controlar la progresión miópica.
          </p>
        </div>
      </section>

      <div className="w-full bg-black py-4 overflow-hidden border-y border-white/10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div className="flex items-center gap-3">
            <span className="text-white text-xl">📉</span>
            <div>
              <h4 className="text-white font-bold text-sm">Eficacia Clínica</h4>
              <p className="text-white/60 text-xs mt-0.5">Ralentiza la progresión en un 67% promedio</p>
            </div>
          </div>
          <div className="hidden md:block w-px h-10 bg-white/20"></div>
          <div className="flex items-center gap-3">
            <span className="text-white text-xl">🔬</span>
            <div>
              <h4 className="text-white font-bold text-sm">Tecnología H.A.L.T.</h4>
              <p className="text-white/60 text-xs mt-0.5">Constelación de 1021 microlentes invisibles</p>
            </div>
          </div>
          <div className="hidden md:block w-px h-10 bg-white/20"></div>
          <div className="flex items-center gap-3">
            <span className="text-white text-xl">🛡️</span>
            <div>
              <h4 className="text-white font-bold text-sm">Máxima Seguridad</h4>
              <p className="text-white/60 text-xs mt-0.5">Fabricado en Policarbonato ultra resistente</p>
            </div>
          </div>
        </div>
      </div>

      <section className="w-full py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">La Ciencia detrás de Stellest</h2>
            <p className="text-black/60 text-lg">
              Comprender cómo funciona la lente te ayudará a entender por qué es la indicación médica número uno para miopía infantil progresiva.
            </p>
          </div>

          <AccordionItem 
            title="¿Por qué crece la Miopía Infantil?" 
            subtitle="El problema del globo ocular elongado."
            defaultOpen={true}
          >
            <p className="mb-4">
              En un niño miope, el globo ocular crece de forma más alargada de lo normal. La luz enfoca &quot;antes&quot; de llegar a la retina, lo que genera visión borrosa de lejos. 
              <br/><br/>
              Un lente genérico (monofocal estándar) proyecta la imagen nítida en el centro de la retina, pero en la zona periférica del ojo la imagen se proyecta &quot;por detrás&quot; de la retina. El cerebro del niño detecta ese desenfoque periférico y le da la señal al ojo de seguir creciendo (elongándose) para intentar alcanzar esa imagen, <strong>empeorando así la miopía mes a mes</strong>.
            </p>
          </AccordionItem>

          <AccordionItem 
            title="Tecnología H.A.L.T. (Highly Aspherical Lenslet Target)" 
            subtitle="El freno a la elongación."
          >
            <p className="mb-4">
              A simple vista, un lente Stellest parece un cristal común, pero está compuesto por un centro óptico nítido rodeado por <strong>11 anillos de 1021 microlentes asféricas</strong> invisibles al ojo humano.
            </p>
            <ul className="list-disc pl-5 mb-4 space-y-2">
              <li>Estas microlentes crean un &quot;volumen de señal de luz&quot; por delante de la retina periférica.</li>
              <li>Esta señal le &quot;avisa&quot; al ojo del niño que deje de crecer.</li>
              <li>Al frenar el alargamiento del globo ocular, <strong>la graduación se estabiliza</strong>.</li>
            </ul>
          </AccordionItem>

          <AccordionItem 
            title="Estadísticas Clínicas Oficiales" 
            subtitle="Resultados comprobados por EssilorLuxottica."
          >
            <p className="mb-4">
              Stellest ha sido evaluado en estudios clínicos de 3 años de duración, posicionándolo como líder mundial en manejo de miopía:
            </p>
            <ul className="list-disc pl-5 mb-4 space-y-2">
              <li><strong>67% de ralentización:</strong> Usando la lente al menos 12 horas al día, la miopía de los niños progresó un 67% menos en promedio comparado con aquellos usando lentes monofocales estándar.</li>
              <li>9 de cada 10 niños logran una <strong>visión tan nítida</strong> como con lentes monofocales de alta calidad.</li>
              <li>El 100% de los niños logra una adaptación completa <strong>en menos de 1 semana</strong>.</li>
            </ul>
          </AccordionItem>

          <AccordionItem 
            title="El Plan de Acompañamiento Atelier" 
            subtitle="No es solo entregar un lente."
          >
            <p className="mb-4">
              El manejo de la miopía requiere compromiso de la familia y la óptica. En Atelier no solo aseguramos un centrado preciso milimétrico (vital para que los anillos H.A.L.T. queden exactamente alineados con la pupila), sino que guiamos el tratamiento:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Auditoría del armazón: el lente Stellest requiere ciertas dimensiones de armazón para funcionar. Te orientamos hacia las marcas infantiles más seguras.</li>
              <li>Higiene visual: te ayudamos a establecer las pautas 20-20-20 y horas de exterior necesarias para acompañar el cristal.</li>
              <li>Garantía de adaptación con seguimiento programado.</li>
            </ul>
          </AccordionItem>
        </div>
      </section>

      <section className="w-full bg-white py-24 px-6 border-t border-[#e8e2db]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">El futuro de sus ojos comienza hoy</h2>
          <p className="text-lg text-black/70 mb-10 leading-relaxed">
            Cada dioptría que logremos frenar durante la niñez significa un menor riesgo de desarrollar desprendimiento de retina, glaucoma o cataratas miópicas severas en su adultez. 
            <br className="mt-4" />
            Traenos la receta de su oftalmopediatra para comenzar el tratamiento adecuado.
          </p>
          <Link 
            href={`/contacto?motivo=${encodeURIComponent("Asesoramiento sobre tratamiento Stellest Control Miopía")}`}
            className="inline-block bg-[#283f5a] hover:bg-[#1e3047] text-white px-10 py-4 rounded-full font-bold transition-all shadow-lg hover:shadow-xl hover:-translate-y-1"
          >
            Reservar Consulta Pediátrica
          </Link>
        </div>
      </section>
    </div>
  );
}
