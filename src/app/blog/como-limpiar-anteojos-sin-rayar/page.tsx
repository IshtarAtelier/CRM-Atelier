import { Metadata } from "next";
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { StorefrontFooter } from "@/components/Storefront/StorefrontFooter";
import Link from "next/link";
import { WHATSAPP_PHONE } from '@/lib/constants';

export const metadata: Metadata = {
  alternates: { canonical: '/blog/como-limpiar-anteojos-sin-rayar' },
  title: "Cómo limpiar anteojos sin rayar el cristal | Atelier Óptica",
  description: "Descubrí el método definitivo para limpiar tus lentes sin dañar el antirreflejo. Guía paso a paso, consejos de expertos en Córdoba y envíos a toda Argentina.",
  keywords: ["como limpiar anteojos sin rayar", "limpiar lentes de sol", "cuidado de anteojos", "optica cordoba", "nueva cordoba", "cerro de las rosas", "anteojos de receta", "envios a toda argentina"],
};

export default function ComoLimpiarAnteojosPage() {
  return (
    <div className="bg-[#faf8f5] text-black min-h-screen selection:bg-black selection:text-white font-sans">
      <StorefrontNavbar theme="light" />
      
      <main className="max-w-3xl mx-auto px-5 pt-32 pb-24">
        {/* Header del Artículo */}
        <header className="mb-12">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-black/50 mb-6">
            <Link href="/blog" className="hover:text-black transition-colors">Blog</Link>
            <span>/</span>
            <span>Cuidado y Mantenimiento</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-medium tracking-tight mb-6 leading-tight">
            Cómo limpiar tus anteojos sin rayar el cristal: La guía definitiva
          </h1>
          <div className="flex items-center gap-4 text-sm text-black/60">
            <span>Por: El equipo de Atelier Óptica</span>
            <span>·</span>
            <span>Tiempo de lectura: 3 min</span>
          </div>
        </header>

        {/* Contenido */}
        <article className="prose prose-lg max-w-none prose-headings:font-medium prose-headings:tracking-tight prose-a:text-black prose-a:underline-offset-4 hover:prose-a:opacity-70 prose-img:rounded-xl">
          <p className="lead text-xl text-black/80 font-medium">
            Seguro te pasó: estás caminando por las calles de Nueva Córdoba o tomando un café en el Cerro de las Rosas, notás una manchita en el cristal, agarrás el borde de la remera y frotás sin pensar. Grave error. Si querés que tus anteojos te duren y que tratamientos como el antirreflejo sigan intactos, es momento de cambiar esas costumbres.
          </p>

          <p>
            En <strong>Atelier Óptica</strong>, ubicados en el corazón de Córdoba, armamos miles de anteojos y conocemos a fondo la composición de los cristales, desde los orgánicos tradicionales hasta el policarbonato y el alto índice. Por eso, te traemos esta guía detallada, de óptico a paciente, para que aprendas a cuidar tu inversión visual al máximo.
          </p>

          <h2 className="text-2xl mt-12 mb-6">Los 3 enemigos mortales de tus cristales</h2>
          <p>
            Antes de contarte cómo limpiarlos correctamente, hablemos de lo que <strong>nunca tenés que hacer</strong>. Existen tres cosas muy comunes que arruinan la superficie óptica sin que te des cuenta:
          </p>
          <ul className="space-y-4 mb-8">
            <li>
              <strong>El papel higiénico o las servilletas de papel:</strong> Están hechos de pulpa de madera. Básicamente, cuando limpiás tus lentes con papel, los estás lijando a nivel microscópico. Adiós a la claridad.
            </li>
            <li>
              <strong>La ropa (tu remera, camisa o bufanda):</strong> La tela acumula polvo y partículas abrasivas invisibles a simple vista. Además, los tejidos de la ropa no están diseñados para superficies ópticas delicadas.
            </li>
            <li>
              <strong>El agua caliente o productos químicos fuertes:</strong> El agua a altas temperaturas, el alcohol puro, la lavandina o el limpiavidrios doméstico destruyen las capas protectoras, especialmente el antirreflejo y el filtro contra luz azul.
            </li>
          </ul>

          <div className="bg-black/5 p-8 rounded-2xl my-10 border border-black/10">
            <h3 className="text-xl font-medium tracking-tight mb-4 mt-0">El método infalible: Agua y Jabón Neutro</h3>
            <p className="mb-0">
              Es el método más simple, económico y seguro para la vida útil de tus lentes. Acá te dejamos el paso a paso que siempre recomendamos en el atelier:
            </p>
            <ol className="mt-4 mb-0 space-y-3">
              <li><strong>Enjuagá primero:</strong> Poné los anteojos bajo un chorrito de agua tibia (nunca caliente) para arrastrar el polvo superficial y la arenilla.</li>
              <li><strong>Aplicá jabón neutro:</strong> Usá apenas una gotita minúscula en cada lente. Masajeá suavemente ambos lados del cristal y el armazón utilizando las yemas de tus dedos (¡limpias!).</li>
              <li><strong>Enjuagá a fondo:</strong> Asegurate de que no queden restos de jabón, prestando especial atención a los rincones y bordes de la montura.</li>
              <li><strong>Secado profesional:</strong> Sacudí un poco el exceso de agua y secalos <strong>únicamente</strong> con un paño de microfibra limpio. En su defecto, dejalos secar solos o usá un pañuelo de tela de algodón 100% libre de pelusas. ¡Nunca uses toallas de baño!</li>
            </ol>
          </div>

          <h2 className="text-2xl mt-12 mb-6">¿Y si estoy en la calle? El poder de la Microfibra</h2>
          <p>
            Sabemos que no siempre tenés una bacha a mano mientras hacés tus trámites en el centro o vas camino al trabajo. Para esos momentos, el paño de microfibra es tu mejor aliado. Es el único tejido diseñado específicamente para atrapar la suciedad y la grasa sin rayar la lente. 
          </p>
          <p>
            <strong>Un tip clave:</strong> ¡La microfibra también se lava! Si la usás durante semanas sin limpiarla, acumula toda la grasa de los cristales y termina empastando más de lo que limpia. Lavala a mano, con jabón neutro, y dejala secar al aire libre.
          </p>
          <p>
            También podés complementar con líquidos limpia-cristales específicos de uso óptico, formulados para proteger los tratamientos. Evitá comprar sprays de dudosa procedencia en la calle que puedan corroer el antirreflejo.
          </p>

          <h2 className="text-2xl mt-12 mb-6">Ajuste y Mantenimiento del Armazón</h2>
          <p>
            Si notás que al limpiarlos las patillas están muy flojas o los cristales parecen tener &quot;juego&quot; dentro de la montura, no intentes ajustarlos forzando el marco en casa. Podés quebrar el acetato o dañar el lente de forma permanente.
          </p>
          <p>
            En <strong>Atelier Óptica</strong> siempre estamos a tu disposición para revisar y ajustar tu armazón con herramientas especializadas, hacerle una limpieza profunda por ultrasonido o cambiarte las plaquetas si ya están amarillas o incómodas.
          </p>

          <hr className="my-12 border-black/10" />

          <div className="bg-black text-white p-8 rounded-2xl">
            <h3 className="text-xl font-medium tracking-tight mb-4 mt-0 text-white">Un recordatorio importante para tu salud visual</h3>
            <p className="text-white/80 mb-0">
              Nosotros nos encargamos de que tus anteojos queden estética y técnicamente perfectos, pero la salud de tus ojos es lo primero. Recordá siempre <strong>visitar a tu médico oftalmólogo</strong> al menos una vez al año. Trabajamos sobre la receta que te da el profesional de la salud visual para garantizarte una visión óptima.
            </p>
          </div>

          <div className="mt-12 flex flex-col items-center text-center">
            <p className="font-medium text-lg mb-6">¿Tus cristales ya están demasiado rayados y es momento de renovarlos?</p>
            <Link 
              href="/tienda" 
              className="inline-flex h-12 items-center justify-center bg-black text-white px-8 text-sm font-bold uppercase tracking-widest hover:bg-black/80 transition-colors"
            >
              Explorar colección de armazones
            </Link>
          </div>
        
          {/* CTA WHATSAPP AUTOMÁTICO */}
          <div className="mt-16 bg-black/5 p-8 md:p-12 rounded-2xl text-center border border-black/10">
            <h3 className="text-2xl font-medium tracking-tight mb-4">¿Necesitás asesoramiento personalizado?</h3>
            <p className="text-black/70 mb-8 max-w-xl mx-auto">
              Comunicate directamente con nuestro equipo de ópticos por WhatsApp. Estamos para ayudarte a encontrar el cristal y armazón ideal según tu receta, estés en Córdoba o en cualquier punto del país.
            </p>
            <a 
              href={`https://wa.me/${WHATSAPP_PHONE}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center bg-[#25D366] text-white px-8 py-4 rounded-full font-bold uppercase tracking-widest hover:bg-[#1ebe57] transition-all hover:scale-105"
            >
              Consultar por WhatsApp
            </a>
          </div>

        </article>
      </main>

      <StorefrontFooter />
    </div>
  );
}
