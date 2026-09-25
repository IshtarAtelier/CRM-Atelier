import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { StorefrontFooter } from "@/components/Storefront/StorefrontFooter";
import { GaleriaDiapositivas } from "@/components/cristales/GaleriaDiapositivas";
import { WHATSAPP_PHONE } from "@/lib/constants";
import { MYOLENS } from "@/lib/cristales/smart-lens";

/**
 * Nota dedicada a MyoLens, con las láminas oficiales de Smart Lens
 * (src/lib/cristales/smart-lens.ts). Pedido de Ishtar, 25/9/2026.
 */
export const metadata: Metadata = {
  alternates: { canonical: "https://atelieroptica.com.ar/blog/myolens" },
  title: "MyoLens: por qué un miope ve mejor con un monofocal hecho para miopes",
  description:
    "La paradoja del monofocal común, que sobrecorrige al miope en la periferia, y cómo MyoLens de Smart Lens lo resuelve con inteligencia artificial: precisión en todo el cristal, relajación de cerca y lentes más finos.",
  keywords: ["MyoLens", "Smart Lens", "lentes para miopes", "monofocal para miopía", "Microcell Optimization", "Córdoba", "Atelier Óptica"],
};

export default function MyoLensBlogPage() {
  const wsp = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent("Hola! Quiero consultar por los cristales MyoLens")}`;
  return (
    <div className="min-h-screen flex flex-col bg-stone-50">
      <StorefrontNavbar theme="light" />
      <main className="flex-grow container mx-auto px-4 pt-32 pb-20 max-w-4xl">
        <article className="blog-article w-full max-w-none">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--dorado-texto)] mb-4">Cristales</p>
          <h1 className="text-4xl md:text-5xl font-serif text-stone-900 mb-8 leading-tight">
            MyoLens: el monofocal pensado solo para miopes
          </h1>
          <p className="text-lg text-stone-700 leading-relaxed mb-8">
            Un monofocal común usa la misma geometría para un miope que para un hipermétrope, aunque sus ojos necesiten
            cosas distintas. <strong>MyoLens</strong>, de Smart Lens, es un monofocal diseñado con inteligencia artificial
            únicamente para miopes.
          </p>

          <Image src={MYOLENS.portada.src} alt={MYOLENS.portada.alt} width={1580} height={890} priority sizes="(min-width: 896px) 896px, 100vw" className="w-full h-auto rounded-xl shadow-md my-8" />

          <h2 className="text-2xl font-serif text-stone-900 mt-12 mb-4">La paradoja del cristal común</h2>
          <p className="text-stone-700 leading-relaxed mb-6">
            En el centro del cristal la graduación es exacta: si tu receta dice -4, ves con -4. Pero cuando mirás hacia los
            costados, la curva del lente, la inclinación del armazón y la distancia al ojo hacen que el ojo reciba más:
            -4,4 o -4,8. Esa <strong>sobrecorrección en la periferia</strong> cansa la vista y, según Smart Lens, en el
            miope podría incluso incentivar que la miopía avance.
          </p>
          <GaleriaDiapositivas diapositivas={MYOLENS.problema} credito="Láminas: Smart Lens." />

          <h2 className="text-2xl font-serif text-stone-900 mt-12 mb-4">Qué cambia con MyoLens</h2>
          <ul className="list-disc pl-5 text-stone-700 leading-relaxed mb-6 space-y-2">
            <li><strong>Precisión y confort:</strong> la tecnología de microceldas (Microcell Optimization Tech) corrige la potencia en toda el área del lente, mires hacia donde mires.</li>
            <li><strong>Relajación de cerca:</strong> un pequeño refuerzo de potencia en la zona de lectura, calculado con inteligencia artificial (AI-Get Technology), para jornadas largas de lectura y celular.</li>
            <li><strong>Salud visual:</strong> en cualquier zona del cristal, el ojo recibe exactamente la graduación de la receta.</li>
            <li><strong>Más finos y livianos</strong> que los monofocales tradicionales, por su geometría individualizada.</li>
          </ul>
          <GaleriaDiapositivas diapositivas={MYOLENS.tecnologia} />

          <h2 className="text-2xl font-serif text-stone-900 mt-12 mb-4">Para quién es</h2>
          <p className="text-stone-700 leading-relaxed mb-6">
            Para miopes de cualquier edad, con o sin astigmatismo, que usan anteojos todo el día, y especialmente para
            quien pasa muchas horas de cerca. Cubre miopías de hasta -12,00 y astigmatismos de hasta -6,00, en todos los
            materiales del orgánico 1.5 al alto índice 1.67. Trae protección UV, antirraya, antirreflejo y antiestático, y
            se puede pedir polarizado, fotosensible o con filtro BlueTech.
          </p>
          <GaleriaDiapositivas diapositivas={[...MYOLENS.uso, ...MYOLENS.especificaciones]} />

          <h2 className="text-2xl font-serif text-stone-900 mt-12 mb-4">¿Y para chicos?</h2>
          <p className="text-stone-700 leading-relaxed mb-6">
            MyoLens corrige; no está pensado para frenar la miopía. Para un chico con miopía que sube, Smart Lens tiene{" "}
            <Link href="/blog/myofix" className="underline font-bold">MyoFix</Link>, un tratamiento de control de miopía.
          </p>
          <GaleriaDiapositivas diapositivas={[MYOLENS.familia]} columnas={1} />

          <div className="bg-stone-900 text-stone-50 rounded-lg p-8 my-12 text-center">
            <p className="text-xl font-serif mb-2 m-0">¿Sos miope y querés probarlos?</p>
            <p className="text-sm text-stone-300 mb-6 mt-2">Traé tu receta y te contamos material, tiempos y formas de pago. Estamos en el Cerro de las Rosas y enviamos a todo el país.</p>
            <a href={wsp} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center bg-[#25D366] text-stone-950 px-8 py-4 rounded-full font-bold uppercase tracking-widest hover:bg-[#1ebe57] transition-all">
              Consultar por WhatsApp
            </a>
          </div>

          <p className="text-xs text-stone-600 leading-relaxed mt-12 pt-6 border-t border-stone-200">
            En Atelier Óptica somos ópticos especialistas, no médicos: asesoramos sobre cristales a partir de tu receta.
            MyoLens es una marca de Smart Lens; las imágenes son láminas oficiales de Smart Lens. Ver también la ficha de{" "}
            <Link href="/cristales-opticos/myolens" className="underline">MyoLens en el área de cristales</Link>.
          </p>
        </article>
      </main>
      <StorefrontFooter />
    </div>
  );
}
