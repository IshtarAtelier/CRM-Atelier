import { Metadata } from "next";
import Image from "next/image";
import { AccordionItem } from "@/components/Storefront/Accordion";
import { CristalHero } from "@/components/cristales/CristalHero";
import { CristalFeatures } from "@/components/cristales/CristalFeatures";
import { CristalCTA } from "@/components/cristales/CristalCTA";

export const metadata: Metadata = {
  alternates: { canonical: '/cristales-opticos/stellest' },
  title: "Stellest Control Miopía Infantil",
  description: "Cristales Stellest de Essilor con tecnología H.A.L.T. Comprobado clínicamente que ralentizan la miopía en niños un 67%.",
  keywords: "Stellest, Miopía, Niños, Cristales Infantiles, Control Miopía, Essilor, H.A.L.T, Óptica, Atelier, Córdoba",
};

export default function StellestPage() {
  return (
    <div className="bg-[#faf8f5]">
      <CristalHero 
        preTitle="Tratamiento Clínico Infantil"
        title="Stellest · Control Miopía"
        description={
          <>
            No basta con corregir la visión, hay que frenar su avance.
            <br className="hidden md:block" />
            Essilor Stellest™ es una lente revolucionaria que no solo permite que los niños vean nítidamente, sino que <strong>actúa de forma activa sobre el globo ocular</strong> para controlar la progresión miópica.
          </>
        }
      />

      <CristalFeatures 
        features={[
          { icon: "📉", title: "Eficacia Clínica", subtitle: "Ralentiza la progresión en un 67% promedio" },
          { icon: "🔬", title: "Tecnología H.A.L.T.", subtitle: "Constelación de 1021 microlentes invisibles" },
          { icon: "🛡️", title: "Máxima Seguridad", subtitle: "Fabricado en Policarbonato ultra resistente" },
        ]}
      />

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

      <section className="w-full py-12 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="relative h-64 md:h-80 w-full rounded-2xl overflow-hidden shadow-lg">
            <Image src="/images/stellest/stellest-1.jpeg" alt="Stellest Control Miopía 1" fill className="object-cover" />
          </div>
          <div className="relative h-64 md:h-80 w-full rounded-2xl overflow-hidden shadow-lg">
            <Image src="/images/stellest/stellest-2.jpeg" alt="Stellest Control Miopía 2" fill className="object-cover" />
          </div>
          <div className="relative h-64 md:h-80 w-full rounded-2xl overflow-hidden shadow-lg">
            <Image src="/images/stellest/stellest-3.jpeg" alt="Stellest Control Miopía 3" fill className="object-cover" />
          </div>
        </div>
      </section>

      <CristalCTA 
        title="El futuro de sus ojos comienza hoy"
        description={
          <>
            Cada dioptría que logremos frenar durante la niñez significa un menor riesgo de desarrollar desprendimiento de retina, glaucoma o cataratas miópicas severas en su adultez. 
            <br className="mt-4" />
            Traenos la receta de su oftalmopediatra para comenzar el tratamiento adecuado.
          </>
        }
        buttonText="Consulta con un óptico pediátrico"
        whatsappMotivo="Asesoramiento sobre tratamiento Stellest Control Miopía"
      />
    </div>
  );
}
