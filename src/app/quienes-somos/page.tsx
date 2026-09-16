import { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { StorefrontNavbar } from '@/components/Storefront/StorefrontNavbar';
import { StorefrontFooter } from '@/components/Storefront/StorefrontFooter';
import { Sparkles, Eye, MapPin, Heart, GraduationCap } from 'lucide-react';
import { WHATSAPP_PHONE } from '@/lib/constants';
import { buildWhatsAppUrl } from '@/lib/whatsapp-link';

export const metadata: Metadata = {
  title: "Quiénes Somos",
  description: "Detrás de Atelier Óptica estamos Ishtar y Yani: una óptica de familia en el Cerro de las Rosas. Diseño, atención personalizada y cristales de alta gama.",
  alternates: { canonical: 'https://atelieroptica.com.ar/quienes-somos' },
  openGraph: {
    title: "Quiénes Somos",
    description: "Detrás de Atelier Óptica estamos Ishtar y Yani: una óptica de familia en el Cerro de las Rosas. Diseño, atención personalizada y cristales de alta gama.",
    type: "website",
    url: "https://atelieroptica.com.ar/quienes-somos",
    images: [
      {
        url: "/images/og/nuestro-local.jpg",
        width: 1200,
        height: 630,
        alt: "Atelier Óptica",
      }
    ]
  }
};

export default function QuienesSomosPage() {
  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 pb-20">
      <StorefrontNavbar theme="light" />

      {/* Sin id: #main-content ya lo usa el div del layout raíz. */}
      <main>
      {/* Hero Section */}
      <div className="bg-primary/5 py-16 lg:py-24 border-b border-primary/10 pt-32">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl lg:text-5xl font-black text-stone-900 dark:text-white tracking-tight mb-6">
            Quiénes <span className="text-primary italic">Somos</span>
          </h1>
          <p className="text-xl text-stone-600 dark:text-stone-400 max-w-2xl mx-auto leading-relaxed">
            En Atelier Óptica, tu visión es nuestra obra maestra. Somos un equipo de ópticos creativos que ama lo que hace.
          </p>
        </div>
      </div>

      {/* Fachada: lo primero que se ve es que el lugar existe y tiene puerta.
          Y desde 9/2026, que adentro hay gente. La anterior era del local vacío
          y de lejos; esta es la puerta con el equipo parado en ella.
          `object-position` al 26% y no al centro: la foto es vertical y la banda
          recorta una franja angosta (en escritorio se ve apenas el 24% del
          alto). Centrada caía en los torsos y les cortaba la cabeza; al 26%
          entran las tres caras enteras con aire arriba. */}
      <div className="relative w-full h-[280px] sm:h-[380px] lg:h-[460px]">
        <Image
          src="/images/equipo/equipo-puerta.jpg"
          alt="El equipo de Atelier Óptica en la puerta del local, en José Luis de Tejeda 4380, Cerro de las Rosas"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[center_26%]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950/70 via-stone-950/10 to-transparent" />
        <p className="absolute bottom-5 left-0 right-0 text-center text-white text-[11px] font-bold uppercase tracking-widest px-4">
          José Luis de Tejeda 4380 · Cerro de las Rosas, Córdoba
        </p>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">

        {/* Intro */}
        <section className="bg-white dark:bg-stone-900 rounded-3xl overflow-hidden border border-stone-200 dark:border-stone-800 shadow-sm">
          <div className="grid md:grid-cols-2">
            <div className="p-8 lg:p-12 relative overflow-hidden order-2 md:order-1">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <Eye className="w-48 h-48" />
              </div>
              <h2 className="text-3xl font-black text-stone-900 dark:text-white mb-6 relative z-10">Cuidado visual <span className="text-primary">100% personalizado</span></h2>
              <div className="text-stone-600 dark:text-stone-300 space-y-4 text-lg relative z-10">
                <p>
                  Creemos que cuidar tu salud visual puede ser una experiencia moderna, cálida y distinta a las ópticas tradicionales. Con una sólida trayectoria y un compromiso constante con la capacitación y la innovación, queremos transformar la forma en que vivís tus anteojos.
                </p>
                <p className="font-medium text-stone-800 dark:text-stone-200">
                  Porque para nosotros, ver bien también es verte bien.
                </p>
              </div>
            </div>
            <div className="relative min-h-[280px] md:min-h-full order-1 md:order-2">
              <Image
                src="/images/blog/mostrador-marmol.webp"
                alt="Mostrador de mármol de Atelier Óptica"
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
          </div>
        </section>

        {/* Somos nosotras: el texto arriba y las dos fotos del carrusel abajo */}
        <section>
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl font-black text-stone-900 dark:text-white mb-4">
              Detrás de Atelier <span className="text-primary italic">somos nosotras</span>
            </h2>
            <p className="text-lg text-stone-600 dark:text-stone-300 mb-8">
              Ishtar y Yani. Una óptica de familia, no una cadena. Por eso acá nadie es un número.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
            <div className="relative aspect-[9/16] rounded-3xl overflow-hidden border border-stone-200 dark:border-stone-800">
              <Image
                src="/images/blog/ishtar/hermanas-espejo.jpg"
                alt="Ishtar y Yani reflejadas en un espejo redondo"
                fill
                sizes="(max-width: 640px) 50vw, 400px"
                className="object-cover"
              />
            </div>
            <div className="relative aspect-[9/16] rounded-3xl overflow-hidden border border-stone-200 dark:border-stone-800">
              <Image
                src="/images/blog/ishtar/hermanas-anteojos.jpg"
                alt="Ishtar y Yani, las hermanas detrás de Atelier Óptica"
                fill
                sizes="(max-width: 640px) 50vw, 400px"
                className="object-cover"
              />
            </div>
          </div>

          {/* La tercera va apaisada y cruzando las dos columnas: es horizontal
              (3000x2000), y meterla en un hueco vertical como el de arriba
              obligaba a recortarla tanto que se perdía el local — que es
              justamente lo que muestra. Acá abajo de las otras dos, ancha, se
              lee como lo que es: el momento de atender.
              Sin nombres en el alt: no se le ve la cara, así que decir quién es
              sería inventarlo. */}
          <div className="relative aspect-[3/2] rounded-3xl overflow-hidden border border-stone-200 dark:border-stone-800 mb-8">
            <Image
              src="/images/blog/guardapolvo-atelier.jpg"
              alt="Atendiendo en el local de Atelier Óptica, con un anteojo de sol en la mano"
              fill
              sizes="(max-width: 768px) 100vw, 896px"
              className="object-cover"
            />
          </div>
          <ul className="space-y-3 max-w-2xl mx-auto">
            {[
              "El que te atiende hoy es el mismo que te ajusta el aro en un año",
              "Nadie te apura ni te despacha: la elección lleva lo que lleva",
              "El nombre está en juego en cada anteojo que sale del taller"
            ].map((item, i) => (
              <li key={i} className="flex items-start text-stone-700 dark:text-stone-300">
                <div className="w-2 h-2 bg-primary rounded-full mt-2 mr-3 flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </section>

        {/* ── Nuestro equipo ─────────────────────────────────────────────────
            Antes esto eran dos tarjetas sueltas de Ishtar y Yani, sin foto (las
            únicas sueltas de Ishtar eran de viaje y desentonaban). Ahora hay
            fotos del local hechas para esto, y el equipo es de cuatro, así que
            se arma como apartado: quiénes crearon la óptica y quiénes atienden.

            Los retratos son de las dos personas que están de guardapolvo en las
            fotos. A las creadoras no se les pone retrato nuevo acá porque las
            suyas ya están arriba, en "somos nosotras". */}
        <section id="equipo" className="scroll-mt-28">
          <div className="max-w-2xl mx-auto text-center mb-8">
            <h2 className="text-3xl font-black text-stone-900 dark:text-white mb-4">
              Nuestro <span className="text-primary italic">equipo</span>
            </h2>
            <p className="text-lg text-stone-600 dark:text-stone-300">
              Cuatro personas y un solo mostrador: dos que armaron la óptica y dos que la atienden todos los días.
            </p>
          </div>

          <div className="relative aspect-[3/2] rounded-3xl overflow-hidden border border-stone-200 dark:border-stone-800 mb-10">
            <Image
              src="/images/equipo/equipo-mostrador.jpg"
              alt="El equipo de Atelier Óptica atendiendo en el mostrador de mármol"
              fill
              sizes="(max-width: 768px) 100vw, 896px"
              className="object-cover"
            />
          </div>

          {/* Creadoras */}
          <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-stone-500 dark:text-stone-400 mb-4">
            Las creadoras
          </h3>
          <div className="grid sm:grid-cols-2 gap-6 mb-10">
            {[
              {
                nombre: "Ishtar",
                rol: "Creadora",
                texto: "Desde el primer día. Elige cada armazón que entra al local y sigue tu pedido hasta que te lo entrega puesto.",
              },
              {
                nombre: "Yani",
                rol: "Creadora · Licenciada en Nutrición (UNC)",
                texto: "Del mismo equipo de siempre, y flamante egresada de la UNC. Para nosotras la salud se cuida entera: la vista es parte de ese todo.",
              },
            ].map((p) => (
              <article key={p.nombre} className="bg-white dark:bg-stone-900 rounded-3xl p-8 border border-stone-200 dark:border-stone-800 shadow-sm">
                <h4 className="text-2xl font-bold text-stone-900 dark:text-white">{p.nombre}</h4>
                <p className="text-primary text-[11px] font-bold uppercase tracking-widest mt-1 mb-3">{p.rol}</p>
                <p className="text-stone-600 dark:text-stone-300">{p.texto}</p>
              </article>
            ))}
          </div>

          {/* Quienes atienden. El sello Essilor Expert va como dato, sin
              explicarlo de más: es la certificación de Essilor, y decir qué
              habilita exactamente sería inventarle alcance. */}
          <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-stone-500 dark:text-stone-400 mb-4">
            Colaboradores especializados
          </h3>
          <div className="grid sm:grid-cols-2 gap-6">
            {[
              {
                nombre: "Milena",
                rol: "Colaboradora especializada",
                foto: "/images/equipo/retrato-mostrador.jpg",
                alt: "Milena, colaboradora especializada de Atelier Óptica, en el mostrador",
                texto: "Te toma la receta, te ayuda a elegir el armazón y te explica qué cristal le va a cada uno.",
              },
              {
                nombre: "Matías",
                rol: "Colaborador especializado",
                foto: "/images/equipo/retrato-guardapolvo.jpg",
                alt: "Matías, colaborador especializado de Atelier Óptica, junto a la pared de armazones",
                texto: "Del armado al ajuste final. Si el anteojo no te queda cómodo, vuelve al taller hasta que sí.",
              },
            ].map((p) => (
              <article key={p.nombre} className="bg-white dark:bg-stone-900 rounded-3xl overflow-hidden border border-stone-200 dark:border-stone-800 shadow-sm flex flex-col">
                <div className="relative aspect-[4/5]">
                  <Image
                    src={p.foto}
                    alt={p.alt}
                    fill
                    sizes="(max-width: 640px) 100vw, 440px"
                    className="object-cover object-top"
                  />
                </div>
                <div className="p-6 sm:p-8">
                  <h4 className="text-2xl font-bold text-stone-900 dark:text-white">{p.nombre}</h4>
                  <p className="text-primary text-[11px] font-bold uppercase tracking-widest mt-1 mb-1">
                    {p.rol}
                  </p>
                  <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-stone-700 dark:text-stone-200 bg-stone-100 dark:bg-stone-800 rounded-full px-3 py-1 mb-3">
                    <Sparkles className="w-3 h-3 text-primary" />
                    Essilor Expert
                  </p>
                  <p className="text-stone-600 dark:text-stone-300">{p.texto}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Yani recibida: el orgullo de familia, con la foto de las dos */}
        <section className="bg-primary/5 rounded-3xl overflow-hidden border border-primary/10">
          <div className="grid md:grid-cols-2 items-center">
            <div className="relative aspect-[4/5] md:aspect-auto md:h-full md:min-h-[420px]">
              <Image
                src="/images/blog/ishtar/hermanas-diploma.jpg"
                alt="Ishtar y Yani con el diploma de Licenciada en Nutrición de la UNC"
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover object-top"
              />
            </div>
            <div className="p-8 lg:p-12">
              <div className="w-12 h-12 bg-white dark:bg-stone-900 rounded-2xl flex items-center justify-center text-primary mb-6 shadow-sm">
                <GraduationCap className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-stone-900 dark:text-white mb-4">Y el equipo sigue creciendo</h2>
              <p className="text-stone-600 dark:text-stone-300">
                Yani se recibió de Licenciada en Nutrición en la Universidad Nacional de Córdoba. Un orgullo de familia que también dice algo de cómo trabajamos: nos tomamos la salud en serio, entera.
              </p>
            </div>
          </div>
        </section>

        {/* Mision */}
        <section className="grid md:grid-cols-2 gap-8">
          <div className="bg-primary/5 rounded-3xl p-8 lg:p-10 border border-primary/10">
            <div className="w-12 h-12 bg-white dark:bg-stone-900 rounded-2xl flex items-center justify-center text-primary mb-6 shadow-sm">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-2xl font-bold text-stone-900 dark:text-white mb-4">Nuestra misión</h3>
            <p className="text-stone-600 dark:text-stone-300 mb-6">
              Brindar un servicio óptico que combine tecnología de vanguardia, asesoramiento personalizado y productos con diseño y calidad, pensados para cada mirada.
            </p>
            <ul className="space-y-3">
              {[
                "Cristales y lentes de última generación",
                "Atención profesional y cercana",
                "Soluciones visuales que cuidan tu salud y potencian tu estilo"
              ].map((item, i) => (
                <li key={i} className="flex items-start text-stone-700 dark:text-stone-300">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2 mr-3 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-stone-100 dark:bg-stone-900 rounded-3xl p-8 lg:p-10 border border-stone-200 dark:border-stone-800">
            <div className="w-12 h-12 bg-white dark:bg-stone-800 rounded-2xl flex items-center justify-center text-primary mb-6 shadow-sm">
              <Heart className="w-6 h-6" />
            </div>
            <h3 className="text-2xl font-bold text-stone-900 dark:text-white mb-4">Calidad, experiencia y estilo</h3>
            <p className="text-stone-600 dark:text-stone-300 mb-6">
              Llevamos años ayudando a miles de personas a ver mejor y verse mejor. Trabajamos con marcas líderes como Varilux, Vulk y Rusty para ofrecerte:
            </p>
            <ul className="space-y-3">
              {[
                "Alta calidad óptica",
                "Máximo confort y adaptación",
                "Diseños con identidad y estilo propio"
              ].map((item, i) => (
                <li key={i} className="flex items-start text-stone-700 dark:text-stone-300">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2 mr-3 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* El local, en dos fotos */}
        <section>
          <div className="grid grid-cols-2 gap-4 sm:gap-6">
            <div className="relative aspect-[3/4] rounded-3xl overflow-hidden border border-stone-200 dark:border-stone-800">
              <Image
                src="/images/blog/muestrario-smart-lens.webp"
                alt="Muestrario de colores de cristales Smart Lens en el local"
                fill
                sizes="(max-width: 640px) 50vw, 400px"
                className="object-cover"
              />
            </div>
            <div className="relative aspect-[3/4] rounded-3xl overflow-hidden border border-stone-200 dark:border-stone-800">
              <Image
                src="/images/blog/fachada-ladrillo.webp"
                alt="Cartel de Atelier Óptica sobre la pared de ladrillo"
                fill
                sizes="(max-width: 640px) 50vw, 400px"
                className="object-cover"
              />
            </div>
          </div>
          <p className="text-center text-stone-600 dark:text-stone-400 mt-6">
            Taller propio, mostrador de mármol y toda la paleta de cristales para probar en la mano.{' '}
            <Link href="/nuestro-local" className="text-primary font-medium underline underline-offset-4 hover:no-underline">
              Conocé el local
            </Link>
          </p>
        </section>

        {/* Ubicacion */}
        <section className="bg-white dark:bg-stone-900 rounded-3xl p-8 lg:p-12 border border-stone-200 dark:border-stone-800 shadow-sm text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary mx-auto mb-6">
            <MapPin className="w-8 h-8" />
          </div>
          <h2 className="text-3xl font-black text-stone-900 dark:text-white mb-4">Dónde estamos</h2>
          <p className="text-lg text-stone-600 dark:text-stone-300 max-w-2xl mx-auto mb-6">
            Nos encontramos en <strong>José Luis de Tejeda 4380</strong>, en el corazón del Cerro de las Rosas, Córdoba. Un espacio pensado para que elijas tus anteojos como se elige una prenda de autor. Sin turno previo.
          </p>
          <p className="text-primary font-medium">¿Vivís en otra ciudad? ¡No hay problema! Hacemos envíos a todo el país.</p>
        </section>

        {/* Cierre */}
        <div className="text-center pt-8">
          <h3 className="text-2xl font-bold text-stone-900 dark:text-white mb-4">Te acompañamos a descubrir tu visión del mundo</h3>
          <p className="text-stone-600 dark:text-stone-400 max-w-xl mx-auto mb-8">
            Desde el primer momento, estamos acá para ayudarte, asesorarte y acompañarte en cada paso. Porque en Atelier Óptica, tu visión es nuestra obra maestra.
          </p>
          <a
            href={buildWhatsAppUrl("¡Hola! Quiero conocer más sobre Atelier Óptica y recibir asesoramiento.", { phone: WHATSAPP_PHONE })}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-stone-900 text-white px-8 py-4 text-[11px] font-bold uppercase tracking-widest hover:bg-[#c8a55c] transition-colors rounded-full"
          >
            Hablar con un Asesor
          </a>
        </div>

      </div>

      </main>

      <StorefrontFooter />

    </div>
  );
}
