import { Metadata } from "next";
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { StorefrontFooter } from "@/components/Storefront/StorefrontFooter";
import Link from "next/link";
import Image from "next/image";
import { WHATSAPP_PHONE } from '@/lib/constants';

export const metadata: Metadata = {
  title: "Cómo limpiar tus anteojos sin rayarlos: Consejos de un óptico | Atelier Óptica",
  description: "Descubrí la forma correcta de limpiar tus anteojos de receta y lentes de sol sin dañar el cristal ni los tratamientos antirreflejo. Consejos expertos desde Córdoba. Envíos a toda Argentina. Cuotas sin interés. Atención personalizada y asesoramiento estético.",
  keywords: ["óptica Argentina", "envíos a toda Argentina", "cuotas", "atención personalizada", "anteojos de receta", "como limpiar anteojos sin rayar"],
};

export default function ComoLimpiarAnteojosPage() {
  return (
    <div className="bg-[#faf8f5] text-black min-h-screen selection:bg-black selection:text-white" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
      <StorefrontNavbar theme="light" />
      
      <main className="max-w-3xl mx-auto px-5 pt-32 pb-24">
        {/* Header del Artículo */}
        <header className="mb-12">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-black/50 mb-6">
            <Link href="/blog" className="hover:text-black transition-colors">Blog</Link>
            <span>/</span>
            <span>Cuidado y Mantenimiento</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-medium tracking-tight tracking-tight mb-6 leading-tight">
            Cómo limpiar tus anteojos correctamente sin rayar el cristal
          </h1>
          <div className="flex items-center gap-4 text-sm text-black/60">
            <span>Por: El equipo de Atelier Óptica</span>
            <span>·</span>
            <span>Tiempo de lectura: 3 min</span>
          </div>
        </header>

        {/* Contenido */}
        <article className="prose prose-lg max-w-none prose-headings:font-medium tracking-tight prose-headings:tracking-tight prose-a:text-black prose-a:underline-offset-4 hover:prose-a:opacity-70 prose-img:rounded-xl">
          <p className="lead text-xl text-black/80 font-medium">
            Seguro te pasó: estás apurado, ves una manchita en el cristal, agarrás el borde de la remera, frotás fuerte y seguís. Grave error. Si querés que tus anteojos te duren y que los tratamientos (como el antirreflejo) sigan intactos, tenés que dejar esas malas costumbres.
          </p>

          <p>
            En <strong>Atelier Óptica</strong> armamos miles de anteojos y conocemos a fondo la composición de los cristales, ya sean orgánicos o de policarbonato. Por eso, te traemos la guía definitiva, de óptico a paciente, para cuidar tu inversión visual.
          </p>

          <h2 className="text-2xl mt-12 mb-6">Los 3 enemigos mortales de tus cristales</h2>
          <p>
            Antes de contarte cómo limpiarlos, hablemos de lo que <strong>nunca tenés que hacer</strong>. Existen tres cosas que arruinan la superficie óptica:
          </p>
          <ul className="space-y-4 mb-8">
            <li>
              <strong>El papel higiénico o las servilletas de papel:</strong> Están hechos de pulpa de madera. Básicamente, cuando limpiás tus anteojos con papel, los estás lijando en miniatura.
            </li>
            <li>
              <strong>La ropa (tu remera, camisa o bufanda):</strong> La tela acumula polvo y partículas invisibles a simple vista. Además, los tejidos no están diseñados para superficies ópticas delicadas.
            </li>
            <li>
              <strong>El agua caliente o productos químicos fuertes:</strong> El agua muy caliente, el alcohol puro, la lavandina o el limpiavidrios de casa destruyen los tratamientos de los cristales, en especial el antirreflejo y el filtro contra luz azul.
            </li>
          </ul>

          <div className="bg-black/5 p-8 rounded-2xl my-10 border border-black/10">
            <h3 className="text-xl font-medium tracking-tight mb-4 mt-0">El método infalible: Agua y Jabón Neutro</h3>
            <p className="mb-0">
              Es simple, económico y lo mejor que le podés hacer a tus lentes. Aquí el paso a paso:
            </p>
            <ol className="mt-4 mb-0 space-y-3">
              <li><strong>Enjuagá primero:</strong> Poné los anteojos bajo un chorrito de agua tibia (no caliente) para arrastrar el polvo superficial.</li>
              <li><strong>Aplicá jabón neutro:</strong> Una gotita minúscula en cada lente. Usá las yemas de tus dedos (¡limpias!) para frotar suavemente ambos lados del cristal y el armazón.</li>
              <li><strong>Enjuagá bien:</strong> Asegurate de que no queden restos de jabón, especialmente en los bordes de la montura.</li>
              <li><strong>Secado profesional:</strong> Sacudí un poco el exceso de agua y secalos <strong>únicamente</strong> con un paño de microfibra limpio o, en su defecto, dejando que se sequen solos o con un pañuelo de tela de algodón 100% que no suelte pelusas.</li>
            </ol>
          </div>

          <h2 className="text-2xl mt-12 mb-6">¿Y si estoy en la calle? El poder de la Microfibra</h2>
          <p>
            Sabemos que no siempre tenés una bacha a mano. Para esos momentos, el paño de microfibra es tu mejor amigo. Es el único tejido diseñado para atrapar la suciedad y la grasa sin rayar. 
          </p>
          <p>
            <strong>Un tip clave:</strong> La microfibra también se lava. Si la usás por semanas y no la lavás, acumula la grasa de los cristales y termina ensuciando más de lo que limpia. Lavala a mano, con jabón neutro, y dejala secar al aire.
          </p>
          <p>
            También podés usar líquidos limpia-cristales específicos de óptica, que vienen formulados para no dañar los tratamientos. Evitá comprar cualquier spray dudoso en la calle.
          </p>

          <h2 className="text-2xl mt-12 mb-6">Ajuste y Mantenimiento del Armazón</h2>
          <p>
            Si notás que limpiarlos te cuesta porque las patillas están flojas o los cristales parecen tener "juego" en el armazón, no intentes ajustarlos vos mismo. Podés quebrar el acetato o dañar el lente.
          </p>
          <p>
            En <strong>Atelier Óptica</strong> siempre estamos dispuestos a revisar y ajustar tu armazón, hacerle una limpieza profunda por ultrasonido o cambiarte las plaquetas si están amarillas. 
          </p>

          <hr className="my-12 border-black/10" />

          <div className="bg-black text-white p-8 rounded-2xl">
            <h3 className="text-xl font-medium tracking-tight mb-4 mt-0 text-white">Un recordatorio importante para tu salud visual</h3>
            <p className="text-white/80 mb-0">
              Nosotros nos encargamos de que tus anteojos sean perfectos, pero la salud de tus ojos es lo primero. Recordá siempre <strong>visitar a tu médico oftalmólogo</strong> al menos una vez al año para el control de tu vista. Nosotros trabajamos sobre la receta que te da el profesional de la salud visual para garantizarte la mejor calidad óptica y estética.
            </p>
          </div>

          <div className="mt-12 flex flex-col items-center text-center">
            <p className="font-medium text-lg mb-6">¿Tus cristales ya están demasiado rayados y necesitás unos nuevos?</p>
            <Link 
              href="/tienda" 
              className="inline-flex h-12 items-center justify-center bg-black text-white px-8 text-sm font-bold uppercase tracking-widest hover:bg-black/80 transition-colors"
            >
              Ver colección de armazones
            </Link>
          </div>
        
          {/* CTA WHATSAPP AUTOMÁTICO */}
          <div className="mt-16 bg-black/5 p-8 md:p-12 rounded-2xl text-center border border-black/10">
            <h3 className="text-2xl font-medium tracking-tight mb-4">¿Necesitás asesoramiento personalizado?</h3>
            <p className="text-black/70 mb-8 max-w-xl mx-auto">
              Comunicate directamente con nuestro equipo de ópticos por WhatsApp. Estamos para ayudarte a encontrar el cristal y armazón perfecto según tu receta oftalmológica.
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
