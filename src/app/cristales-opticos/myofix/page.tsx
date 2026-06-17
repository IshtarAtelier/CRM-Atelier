import { Metadata } from "next";
import { AccordionItem } from "@/components/Storefront/Accordion";
import { CristalHero } from "@/components/cristales/CristalHero";
import { CristalFeatures } from "@/components/cristales/CristalFeatures";
import { CristalCTA } from "@/components/cristales/CristalCTA";

export const metadata: Metadata = {
  alternates: { canonical: '/cristales-opticos/myofix' },
  title: "MyoFix Control de Miopía",
  description: "Lentes MyoFix by Smart Lens con Defocus Technology. Tratamiento terapéutico para ralentizar la miopía infantil progresiva.",
  keywords: "MyoFix, Smart Lens, Miopía, Control Miopía Niños, Defocus Technology, Óptica, Atelier, Córdoba",
};

export default function MyoFixPage() {
  return (
    <div className="bg-[#faf8f5]">
      <CristalHero 
        preTitle="Control de Miopía Infantil"
        title="MyoFix · Smart Lens"
        description={
          <>
            La miopía es la nueva epidemia global. Para 2050, el 50% de la población será miope.
            <br className="hidden md:block" />
            <strong>MyoFix</strong> es una lente terapéutica con <em>Defocus Technology</em> diseñada específicamente para ralentizar el alargamiento del globo ocular en niños a partir de los 5 años, evitando que desarrollen miopía severa en la adultez.
          </>
        }
      />

      <CristalFeatures 
        features={[
          { icon: "🎯", title: "Desenfoque Periférico", subtitle: "Frena la elongación del ojo" },
          { icon: "🛡️", title: "Protección Total", subtitle: "Antirraya, Antirreflejo y UV incluidos" },
          { icon: "👓", title: "Estética Fina", subtitle: "Lentes delgados para evitar el bullying" },
        ]}
      />

      <section className="w-full py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">¿Cómo funciona MyoFix?</h2>
            <p className="text-black/60 text-lg">
              Conocé la ciencia detrás del diseño óptico Freeform digital que está revolucionando la salud visual pediátrica.
            </p>
          </div>

          <AccordionItem 
            title="Defocus Technology: La ciencia del freno miópico" 
            subtitle="Engrosamiento fisiológico de la coroides."
            defaultOpen={true}
          >
            <p className="mb-4">
              A diferencia de una lente común, <strong>MyoFix</strong> cuenta con una zona central que tiene la graduación exacta del niño (para que vea nítido) y una zona perimetral de <em>desenfoque hipermetrópico periférico</em>.
            </p>
            <ul className="list-disc pl-5 mb-4 space-y-2">
              <li>Este desenfoque controlado le envía una señal fisiológica al ojo para que <strong>engrose la coroides</strong>.</li>
              <li>Al engrosarse, frena la elongación del globo ocular (la principal causa de que el aumento suba año tras año).</li>
              <li>El resultado: la progresión de la miopía se ralentiza dramáticamente.</li>
            </ul>
          </AccordionItem>

          <AccordionItem 
            title="Tratamiento Terapéutico y Adaptación" 
            subtitle="Desde los 5 años en adelante."
          >
            <p className="mb-4">
              Las lentes MyoFix son ideales para niños que recién inician su miopía o aquellos con miopía progresiva acelerada por pantallas y genética.
            </p>
            <ul className="list-disc pl-5 mb-4 space-y-2">
              <li><strong>Uso recomendado:</strong> Todo el día. Para lograr efecto terapéutico, se exige un uso mínimo de 2 horas diarias (especialmente después de las 18:00hs).</li>
              <li><strong>Adaptación simple:</strong> El proceso de toma de medidas en Atelier es igual al de una lente monofocal tradicional.</li>
              <li><strong>Graduaciones altas:</strong> Cubre desde neutro hasta miopías de -12.00 dioptrías, y corrige astigmatismos de hasta -6.00 dioptrías.</li>
            </ul>
          </AccordionItem>

          <AccordionItem 
            title="Tratamientos Premium Incluidos" 
            subtitle="Máxima durabilidad para la vida infantil."
          >
            <p className="mb-4">
              Sabemos que los anteojos de los niños sufren. Por eso, todos los cristales MyoFix ya vienen de fábrica con un paquete de protección integral:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Capa Antirraya:</strong> Resistencia extrema a los rayones.</li>
              <li><strong>Antirreflejo y Antiestático:</strong> Visión nítida, repele el polvo y mejora la estética.</li>
              <li><strong>Protección UV 100%.</strong></li>
              <li><em>Opcionales disponibles:</em> BlueTech (filtro azul de pantallas), Fotosensibles (Transitions) o Polarizados. Disponibles en policarbonato y altos índices para máxima resistencia a impactos y extrema delgadez.</li>
            </ul>
          </AccordionItem>
          
          <AccordionItem 
            title="Consejos de Higiene Visual para Padres" 
            subtitle="Regla 20-20-20 y hábitos saludables."
          >
            <p className="mb-4">
              El cristal hace la mitad del trabajo; los hábitos en casa hacen el resto. Como especialistas, recomendamos seguir estas pautas clínicas:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Actividad al aire libre:</strong> Al menos 2 horas por día con luz natural.</li>
              <li><strong>Descansos (Regla 20&apos;):</strong> Cada 20 minutos de pantalla, mirar a lo lejos para relajar el ojo.</li>
              <li><strong>Distancia:</strong> Asegurar un mínimo de 30cm entre los ojos y los dispositivos móviles o libros.</li>
              <li><strong>Luz Azul:</strong> Activar modos oscuros, agrandar textos y apagar todas las pantallas al menos 2 horas antes de dormir.</li>
            </ul>
          </AccordionItem>
        </div>
      </section>

      <CristalCTA 
        title="Un tratamiento a tiempo cambia su futuro"
        description={
          <>
            Una miopía severa en la adultez no solo significa usar cristales más gruesos; aumenta drásticamente el riesgo de desprendimiento de retina y maculopatías. 
            <br className="mt-4" />
            Traé la receta de su oftalmopediatra a Atelier. Nosotros nos encargamos de que la tecnología terapéutica <strong>MyoFix</strong> actúe correctamente.
          </>
        }
        buttonText="Consultar sobre tratamiento MyoFix"
        whatsappMotivo="Consulta sobre cristales pediátricos MyoFix"
      />
    </div>
  );
}
