import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { StorefrontFooter } from "@/components/Storefront/StorefrontFooter";
import { GaleriaDiapositivas } from "@/components/cristales/GaleriaDiapositivas";
import { WHATSAPP_PHONE } from "@/lib/constants";
import { MYOFIX } from "@/lib/cristales/smart-lens";

/**
 * Nota dedicada a MyoFix, con las láminas oficiales de Smart Lens
 * (src/lib/cristales/smart-lens.ts). Pedido de Ishtar, 25/9/2026: subir el
 * material de Myofix "tal cual" para el blog y el área de cristales.
 */
export const metadata: Metadata = {
  alternates: { canonical: "https://atelieroptica.com.ar/blog/myofix" },
  title: "MyoFix de Smart Lens: el cristal que frena la miopía en chicos",
  description:
    "Qué es MyoFix, cómo funciona su Defocus Technology, desde qué edad se usa, cuántas horas por día y qué graduaciones cubre. Con las láminas oficiales de Smart Lens. Atelier Óptica, Córdoba.",
  keywords: ["MyoFix", "Smart Lens", "control de miopía infantil", "Defocus Technology", "miopía niños Córdoba", "Atelier Óptica"],
};

export default function MyoFixBlogPage() {
  const wsp = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent("Hola! Quiero consultar por los cristales MyoFix para mi hijo/a")}`;
  return (
    <div className="min-h-screen flex flex-col bg-stone-50">
      <StorefrontNavbar theme="light" />
      <main className="flex-grow container mx-auto px-4 pt-32 pb-20 max-w-4xl">
        <article className="blog-article w-full max-w-none">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--dorado-texto)] mb-4">Control de miopía infantil</p>
          <h1 className="text-4xl md:text-5xl font-serif text-stone-900 mb-8 leading-tight">
            MyoFix: el cristal que ayuda a frenar la miopía de los chicos
          </h1>
          <p className="text-lg text-stone-700 leading-relaxed mb-8">
            Si tu hijo usa anteojos y cada control la graduación sube, no es que los anteojos &quot;le hagan mal&quot;:
            el ojo de un chico miope sigue creciendo. <strong>MyoFix</strong>, de Smart Lens, es un cristal pensado para
            eso. Corrige la visión como cualquier anteojo y, además, le manda al ojo una señal para que frene ese
            crecimiento.
          </p>

          <Image src={MYOFIX.portada.src} alt={MYOFIX.portada.alt} width={1580} height={890} priority sizes="(min-width: 896px) 896px, 100vw" className="w-full h-auto rounded-xl shadow-md my-8" />

          <h2 className="text-2xl font-serif text-stone-900 mt-12 mb-4">Por qué se habla de una epidemia</h2>
          <p className="text-stone-700 leading-relaxed mb-6">
            La Organización Mundial de la Salud estima que en 2050 la mitad de la población mundial va a ser miope. Pesan
            la genética, pero también los hábitos: más horas de cerca, más pantallas y menos tiempo al aire libre. En los
            chicos la miopía avanza sobre todo en la edad escolar y se estabiliza cerca de los 20 años: lo que se haga en
            esos años define con cuánta graduación llegan a adultos.
          </p>
          <GaleriaDiapositivas diapositivas={MYOFIX.epidemia} credito="Láminas: Smart Lens." />

          <h2 className="text-2xl font-serif text-stone-900 mt-12 mb-4">Cómo funciona: Defocus Technology</h2>
          <p className="text-stone-700 leading-relaxed mb-6">
            El cristal tiene una <strong>zona central con la graduación exacta</strong>, para que tu hijo vea nítido, y
            alrededor una <strong>zona de desenfoque periférico</strong>. Esa periferia hace foco por delante de la retina,
            y esa señal lleva al ojo a engrosar la coroides, la capa que está detrás de la retina. Una coroides más gruesa
            acompaña un ojo que se alarga menos, que es justamente lo que hace subir la graduación.
          </p>
          <GaleriaDiapositivas diapositivas={MYOFIX.tecnologia} />
          <p className="text-stone-700 leading-relaxed mb-6">
            La investigación clínica preliminar de Smart Lens mostró esa respuesta fisiológica: engrosamiento de la
            coroides en los chicos que usaron MyoFix. Es un tratamiento para <strong>ralentizar</strong> la miopía; no la
            cura ni la hace retroceder.
          </p>

          <h2 className="text-2xl font-serif text-stone-900 mt-12 mb-4">Desde qué edad y cuántas horas</h2>
          <ul className="list-disc pl-5 text-stone-700 leading-relaxed mb-6 space-y-2">
            <li>Se recomienda <strong>a partir de los 5 años</strong>, o cuando el médico detecta una miopía que progresa.</li>
            <li>Se puede usar todo el día. Para que funcione como tratamiento, <strong>mínimo 2 horas diarias</strong>, sobre todo después de las 18.</li>
            <li>Lo indica el oftalmólogo en la receta: &quot;tratamiento de control de miopía MyoFix&quot;.</li>
            <li>Las medidas se toman igual que para un monofocal común.</li>
          </ul>
          <GaleriaDiapositivas diapositivas={MYOFIX.uso} />

          <h2 className="text-2xl font-serif text-stone-900 mt-12 mb-4">Finos, resistentes y con todo incluido</h2>
          <p className="text-stone-700 leading-relaxed mb-6">
            Se fabrican con tecnología Freeform digital, individualizados, y salen más finos que un cristal común, algo
            que en el colegio importa. Cubren miopías de hasta -12,00 y astigmatismos de hasta -6,00, y se hacen en todos
            los materiales, del orgánico 1.5 al alto índice 1.67, incluido el policarbonato para los más movedizos. Traen
            de fábrica protección UV, antirraya, antirreflejo y antiestático, y se pueden pedir polarizados, fotosensibles
            o con filtro BlueTech.
          </p>
          <GaleriaDiapositivas diapositivas={[...MYOFIX.ventajas, ...MYOFIX.especificaciones]} />

          <h2 className="text-2xl font-serif text-stone-900 mt-12 mb-4">Lo que podés hacer en casa</h2>
          <p className="text-stone-700 leading-relaxed mb-6">
            El cristal hace una parte; los hábitos, la otra. Dos horas por día al aire libre, un descanso cada 20 minutos
            de pantalla, 30 centímetros de distancia a la pantalla o el libro, buena luz en casa y nada de pantallas las
            dos horas antes de dormir.
          </p>
          <GaleriaDiapositivas diapositivas={[MYOFIX.consejos]} columnas={1} />

          <p className="text-stone-700 leading-relaxed mb-6">
            ¿Querés comparar? Leé también la nota de <Link href="/blog/stellest" className="underline font-bold">Stellest</Link>, el otro
            cristal de control de miopía que trabajamos, y la ficha de <Link href="/cristales-opticos/myofix" className="underline font-bold">MyoFix en el área de cristales</Link>.
          </p>

          <div className="bg-stone-900 text-stone-50 rounded-lg p-8 my-12 text-center">
            <p className="text-xl font-serif mb-2 m-0">¿El oftalmólogo le indicó control de miopía?</p>
            <p className="text-sm text-stone-300 mb-6 mt-2">Traé la receta y te explicamos materiales, tiempos y formas de pago. Estamos en el Cerro de las Rosas y enviamos a todo el país.</p>
            <a href={wsp} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center bg-[#25D366] text-stone-950 px-8 py-4 rounded-full font-bold uppercase tracking-widest hover:bg-[#1ebe57] transition-all">
              Consultar por WhatsApp
            </a>
          </div>

          <p className="text-xs text-stone-600 leading-relaxed mt-12 pt-6 border-t border-stone-200">
            En Atelier Óptica somos ópticos especialistas, no médicos: asesoramos sobre cristales a partir de la receta del
            oftalmólogo. MyoFix es una marca de Smart Lens; las imágenes son láminas oficiales de Smart Lens.
          </p>
        </article>
      </main>
      <StorefrontFooter />
    </div>
  );
}
