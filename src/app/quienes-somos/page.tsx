import { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { StorefrontNavbar } from '@/components/Storefront/StorefrontNavbar';
import { StorefrontFooter } from '@/components/Storefront/StorefrontFooter';
import { WHATSAPP_PHONE } from '@/lib/constants';
import { buildWhatsAppUrl } from '@/lib/whatsapp-link';
import { getGoogleReviews } from '@/lib/googleReviews';

/*
 * Quiénes somos, en la estética y la voz de /blog/anteojos-obras-de-arte
 * (pedido de Ishtar, 15/9/2026: "me gusta mucho más los anteojos como obra de
 * arte, replicarlo ahí, desde la estética hasta el contenido"). Esa nota NO se
 * toca: esta página toma su lenguaje —fondo negro, fotos en blanco y negro,
 * secciones numeradas, tipografía grande— pero cuenta otra cosa. La nota es
 * el manifiesto de Ishtar; esta es la gente que lo lleva adelante todos los
 * días. Por eso no repite la historia completa: la resume y enlaza.
 *
 * Fotos que Ishtar pidió conservar sí o sí: la de los tres en la puerta, los
 * retratos de Milena y de Matías, y el anuncio de Yani recibida — con una foto
 * de Yani SOLA con el diploma (pedido explícito: que no aparezca Ishtar).
 *
 * Todo dato de acá sale de lo que ya estaba publicado (esta página, la nota y
 * Nuestro Local). No se agregan años, cantidades de clientes ni alcances de
 * certificaciones que nadie confirmó.
 */

const PAGE_URL = 'https://atelieroptica.com.ar/quienes-somos';
const DESCRIPCION =
  'Detrás de Atelier Óptica hay un equipo de ópticos creativos en el Cerro de las Rosas: Ishtar y Yani, que la crearon, y Milena y Matías, que la atienden todos los días.';

export const metadata: Metadata = {
  title: 'Quiénes Somos',
  description: DESCRIPCION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: 'Quiénes Somos · Atelier Óptica',
    description: DESCRIPCION,
    type: 'website',
    url: PAGE_URL,
    images: [{ url: '/images/og/nuestro-local.jpg', width: 1200, height: 630, alt: 'Atelier Óptica' }],
  },
};

/*
 * OJO con lo que se promete acá (correcciones de Ishtar, 15/9/2026):
 *  · NO hay taller propio. No decir "taller propio", "nuestro taller" ni
 *    "vuelve al taller".
 *  · La garantía de adaptación es UN cambio de cristales. Nunca "hasta que
 *    quede", "hasta que sí" ni nada que suene a cambios ilimitados.
 */
const PRINCIPIOS = [
  {
    n: '01',
    titulo: 'Nadie es un número',
    texto: 'Somos una óptica de familia, no una cadena. El que te atiende hoy es el mismo que te recibe cuando volvés.',
  },
  {
    n: '02',
    titulo: 'La elección lleva lo que lleva',
    texto: 'Nadie te apura ni te despacha. Elegir un armazón es elegir cómo querés mirar el mundo, y eso no se resuelve en cinco minutos.',
  },
  {
    n: '03',
    titulo: 'Medido con tu armazón puesto',
    texto: 'Tomamos las medidas con el armazón que elegiste ya puesto, y tenés toda la paleta de cristales para probar en la mano antes de decidir.',
  },
  {
    n: '04',
    titulo: 'Garantía de adaptación',
    texto: 'Adaptarse a cristales nuevos lleva unos días. Si no te adaptás, dentro de los 30 días tenés un cambio de cristales sin cargo.',
  },
];

const EQUIPO = [
  {
    nombre: 'Milena',
    rol: 'Colaboradora especializada · Essilor Expert',
    foto: '/images/equipo/retrato-mostrador.jpg',
    alt: 'Milena, colaboradora especializada de Atelier Óptica, en el mostrador',
    texto: [
      'Te toma la receta, te ayuda a elegir el armazón y te explica qué cristal le va a cada uno, sin tecnicismos.',
      'Es de las que se adelantan: revisa cada detalle de la receta y del armazón antes de que haga falta preguntar, y no da nada por sabido.',
    ],
  },
  {
    nombre: 'Matías',
    rol: 'Colaborador especializado · Essilor Expert',
    foto: '/images/equipo/retrato-guardapolvo.jpg',
    alt: 'Matías, colaborador especializado de Atelier Óptica, junto a la pared de armazones',
    texto: [
      'Te acompaña desde el primer mensaje hasta el ajuste final del armazón en tu cara. Muchas de nuestras reseñas lo nombran a él.',
      'Se toma el tiempo que haga falta: explica cada paso con paciencia y no te deja ir hasta que entendiste todo lo que compraste.',
    ],
  },
];

type Resena = { author_name?: string; rating?: number; text?: string; relative_time_description?: string };

/**
 * Reseñas REALES de Google (las mismas que usan la landing y /resenas). Se
 * muestran solo las de 5 estrellas con texto, primero las que nombran a
 * alguien del equipo. Se recortan al final de oración para que las tarjetas
 * queden parejas. Si Google no responde, `getGoogleReviews` devuelve reseñas
 * reales de respaldo con rating 0: en ese caso no se muestra el promedio ni la
 * cantidad, porque un número inventado es peor que ninguno.
 */
function elegirResenas(reviews: Resena[]) {
  const nombraEquipo = (t: string) => /\b(matías|matias|milena)\b/i.test(t);
  return reviews
    .filter((r) => (r.rating ?? 0) >= 5 && r.text && r.author_name)
    .sort((a, b) => Number(nombraEquipo(b.text!)) - Number(nombraEquipo(a.text!)))
    .slice(0, 4)
    .map((r) => {
      const full = r.text!.trim().replace(/\s+/g, ' ');
      let texto = full;
      if (full.length > 260) {
        // Se arma por ORACIONES: la primera, y si la reseña nombra a alguien del
        // equipo, también la oración donde lo nombra. Un recorte por caracteres
        // se comía justo esa parte ("Destaco especialmente la atención de
        // Matías" quedaba afuera), que es la que más dice en esta página.
        const oraciones = full.match(/[^.!?]+[.!?]+/g)?.map((s) => s.trim()) ?? [full];
        const conNombre = oraciones.find((s, i) => i > 0 && nombraEquipo(s));
        if (conNombre) {
          texto = `${oraciones[0]} … ${conNombre}`;
        } else {
          // Sin nombre: oraciones enteras en orden mientras entren en 260.
          const juntas: string[] = [];
          for (const s of oraciones) {
            if ([...juntas, s].join(' ').length > 260 && juntas.length) break;
            juntas.push(s);
          }
          texto = juntas.join(' ');
        }
        if (texto.length > 320) texto = `${texto.slice(0, 317).trimEnd()}…`;
      }
      return { nombre: r.author_name!.trim(), texto, cuando: r.relative_time_description || '' };
    });
}

function SectionLabel({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 mb-8">
      <span className="text-[11px] tracking-[0.3em] text-white/70 font-mono">{n}</span>
      <span className="h-px flex-1 bg-white/15" />
      <span className="text-[11px] uppercase tracking-[0.3em] text-white/60">{children}</span>
    </div>
  );
}

// Las reseñas se refrescan cada hora, igual que en el resto del sitio.
export const revalidate = 3600;

export default async function QuienesSomosPage() {
  const datosResenas = await getGoogleReviews().catch(() => ({ reviews: [], rating: 0, userRatingCount: 0 }));
  const resenas = elegirResenas(datosResenas.reviews as Resena[]);
  const hayPromedio = datosResenas.rating > 0 && datosResenas.userRatingCount > 0;

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-white selection:text-black">
      <StorefrontNavbar theme="dark" />

      <main>
        {/* HERO — los tres en la puerta del local. `object-position` al 26%:
            la foto es vertical y la banda la recorta; centrada caía en los
            torsos y cortaba las cabezas. */}
        <header className="relative min-h-[92vh] flex items-end overflow-hidden border-b border-white/10">
          <div className="absolute inset-0">
            <Image
              src="/images/equipo/equipo-puerta.jpg"
              alt="El equipo de Atelier Óptica en la puerta del local, en José Luis de Tejeda 4380, Cerro de las Rosas"
              fill
              priority
              sizes="100vw"
              className="object-cover object-[center_26%] grayscale contrast-110 brightness-[0.7]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-black/60" />
          </div>

          <div className="relative z-10 w-full px-6 lg:px-16 pb-16 lg:pb-24 pt-40">
            <p className="text-[11px] uppercase tracking-[0.4em] text-white/70 mb-6">Quiénes somos — Atelier Óptica</p>
            <h1 className="text-[13vw] leading-[0.92] sm:text-6xl lg:text-8xl font-normal tracking-tight max-w-5xl">
              Una óptica<br />de autor.<br />No de paso.
            </h1>
            <p className="mt-8 text-white/80 text-[15px] lg:text-lg leading-relaxed max-w-xl">
              Somos ópticos creativos en el Cerro de las Rosas. Cuatro personas, un solo mostrador y la misma obsesión por el detalle.
            </p>
          </div>

          <div className="absolute bottom-6 right-6 lg:right-16 z-10 text-[11px] tracking-[0.2em] text-white/70 hidden sm:block">
            SCROLL ↓
          </div>
        </header>

        {/* 01 — EL NOMBRE */}
        <section className="px-6 lg:px-16 pt-24 lg:pt-32 pb-20 lg:pb-28 max-w-3xl mx-auto">
          <SectionLabel n="01">El nombre</SectionLabel>
          <p className="text-2xl lg:text-3xl leading-[1.4] font-light text-white/95 mb-8">
            Un atelier no es un negocio ni un consultorio: <span className="text-white">es el lugar donde se hacen obras</span>. Elegimos ese nombre a propósito.
          </p>
          <div className="space-y-6 text-white/70 text-[15px] lg:text-base leading-relaxed">
            <p>
              Atelier nació de tres cosas que durante mucho tiempo parecieron mundos separados: el arte, el comercio y la salud visual. Nació también de un papelito que dos hermanas escribieron y todavía guardan, donde diseñaron en la mente una óptica armada con pedacitos de todas las que habían conocido por el mundo.
            </p>
            <p>
              Por eso creemos que cuidar tu vista puede ser una experiencia cálida y distinta a la de una óptica tradicional.{' '}
              <span className="text-white italic">Porque para nosotros, ver bien también es verte bien.</span>
            </p>
          </div>
          <Link
            href="/blog/anteojos-obras-de-arte"
            className="inline-block mt-10 text-[11px] uppercase tracking-[0.25em] text-white/80 border-b border-white/30 pb-1 hover:text-white hover:border-white transition-colors"
          >
            Leé el manifiesto completo →
          </Link>
        </section>

        {/* EL EQUIPO TRABAJANDO — full bleed */}
        <section className="relative aspect-[4/3] sm:aspect-[16/9] lg:aspect-[21/9]">
          <Image
            src="/images/equipo/equipo-mostrador.jpg"
            alt="El equipo de Atelier Óptica atendiendo en el mostrador de mármol"
            fill
            sizes="100vw"
            className="object-cover grayscale"
          />
        </section>
        <p className="text-center text-[11px] uppercase tracking-[0.25em] text-white/70 py-6 border-b border-white/10 px-6">
          Un solo mostrador, todos los días
        </p>

        {/* 02 — LAS CREADORAS */}
        <section className="px-6 lg:px-16 pt-20 lg:pt-28 pb-20 lg:pb-28 max-w-3xl mx-auto">
          <SectionLabel n="02">Las socias fundadoras</SectionLabel>
          <h2 className="text-3xl lg:text-5xl font-normal leading-tight mb-8">Ishtar y Yani</h2>
          <div className="space-y-6 text-white/70 text-[15px] lg:text-base leading-relaxed">
            <p>
              <span className="text-white">Ishtar</span> es socia fundadora y está a cargo de la dirección artística de Atelier. Elige cada uno de los armazones que hay en la óptica.
            </p>
            <p>
              <span className="text-white">Yani</span> es su hermana. Metódica, apasionada, amante de la salud en todas sus formas. Sostuvo el primer año de Atelier —el más difícil— mientras terminaba su carrera y viajaba una hora todos los días para llegar. La <span className="text-white">Cápsula Escarlata</span>, nuestra nueva cápsula 2026, está inspirada en ella.
            </p>
            <p>
              Empezaron en un rinconcito de la Galería Gitana. Un día Ishtar la llamó y le dijo{' '}
              <em className="text-white/85">&quot;hermana, levantá el piso, que nos mudamos&quot;</em>. Así llegaron a la calle, y a vos.
            </p>
          </div>
        </section>

        {/* 03 — EL ANUNCIO DE YANI. Foto de Yani sola con el diploma: Ishtar
            pidió explícitamente que en esta no aparezca ella. */}
        <section className="border-t border-white/10">
          <div className="grid md:grid-cols-2">
            <div className="relative aspect-[4/5] md:aspect-auto md:min-h-[640px]">
              <Image
                src="/images/blog/ishtar/hermana-diploma.jpg"
                alt="Yani levantando su diploma de Licenciada en Nutrición de la Universidad Nacional de Córdoba"
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover object-top grayscale"
              />
            </div>
            <div className="px-6 lg:px-16 py-20 lg:py-28 flex flex-col justify-center">
              <SectionLabel n="03">Una noticia</SectionLabel>
              <h2 className="text-3xl lg:text-5xl font-normal leading-tight mb-8">Yani se recibió</h2>
              <div className="space-y-6 text-white/70 text-[15px] lg:text-base leading-relaxed">
                <p>
                  Licenciada en Nutrición por la Universidad Nacional de Córdoba. La misma que sostuvo el primer año de la óptica, estudiando y trabajando a la vez.
                </p>
                <p>
                  Un orgullo de familia que también dice algo de cómo trabajamos:{' '}
                  <span className="text-white">nos tomamos la salud en serio, entera</span>. La vista es parte de ese todo.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 04 — QUIENES TE ATIENDEN */}
        <section id="equipo" className="border-t border-white/10 scroll-mt-28">
          <div className="px-6 lg:px-16 pt-20 lg:pt-28 pb-14 max-w-3xl mx-auto">
            <SectionLabel n="04">Quienes te atienden</SectionLabel>
            <h2 className="text-3xl lg:text-5xl font-normal leading-tight mb-8">Milena y Matías</h2>
            <div className="space-y-6 text-white/70 text-[15px] lg:text-base leading-relaxed">
              <p>
                Están en el local todos los días. Los dos tienen <span className="text-white">una trayectoria muy amplia en óptica</span>, la certificación Essilor Expert y algo que no se enseña: <span className="text-white">aman lo que hacen</span>.
              </p>
              <p>
                Son pacientes, saben muchísimo y analizan cada detalle antes de que haga falta preguntar. Se aseguran de que te vayas con todo entendido, y cada compra sale con una confirmación ultra detallada de todo lo que llevás.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2">
            {EQUIPO.map((p, i) => (
              <figure key={p.nombre} className={i === 0 ? 'border-r border-white/10' : ''}>
                <div className="relative aspect-[3/4]">
                  <Image
                    src={p.foto}
                    alt={p.alt}
                    fill
                    sizes="50vw"
                    className="object-cover object-top grayscale"
                  />
                </div>
                <figcaption className="px-4 sm:px-8 lg:px-12 py-8 lg:py-10 border-b border-white/10">
                  <h3 className="text-2xl lg:text-3xl font-normal">{p.nombre}</h3>
                  <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-white/70 mt-2 mb-4">{p.rol}</p>
                  <div className="space-y-3 text-white/70 text-[14px] lg:text-[15px] leading-relaxed">
                    {p.texto.map((t) => <p key={t}>{t}</p>)}
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* 05 — LO QUE DICEN. Reseñas reales de Google; si no hay, la sección no existe. */}
        {resenas.length > 0 && (
          <section className="border-t border-white/10 px-6 lg:px-16 py-20 lg:py-28">
            <div className="max-w-3xl mx-auto mb-14">
              <SectionLabel n="05">Lo que dicen</SectionLabel>
              <h2 className="text-3xl lg:text-5xl font-normal leading-tight mb-6">En palabras de quienes nos eligieron</h2>
              {hayPromedio && (
                <p className="text-white/70 text-[15px] lg:text-base leading-relaxed">
                  <span className="text-white">{datosResenas.rating.toFixed(1)} de 5</span> en Google, con{' '}
                  <span className="text-white">{datosResenas.userRatingCount.toLocaleString('es-AR')} reseñas reales</span>.
                </p>
              )}
            </div>
            <div className="max-w-5xl mx-auto grid sm:grid-cols-2 border-t border-white/10">
              {resenas.map((r, i) => (
                <figure
                  key={r.nombre + i}
                  className={`py-10 sm:p-10 border-b border-white/10 ${i % 2 === 0 ? 'sm:border-r' : ''}`}
                >
                  <p className="text-[13px] tracking-[0.3em] text-white mb-5" aria-label="5 estrellas">★★★★★</p>
                  <blockquote className="text-white/85 text-[16px] lg:text-lg leading-relaxed font-light">
                    &ldquo;{r.texto}&rdquo;
                  </blockquote>
                  <figcaption className="mt-6 text-[11px] uppercase tracking-[0.25em] text-white/70">
                    {r.nombre}{r.cuando ? ` · ${r.cuando}` : ''}
                  </figcaption>
                </figure>
              ))}
            </div>
            <div className="max-w-5xl mx-auto mt-10 text-center">
              <Link
                href="/resenas"
                className="inline-block text-[11px] uppercase tracking-[0.25em] text-white/80 border-b border-white/30 pb-1 hover:text-white hover:border-white transition-colors"
              >
                Leé todas las reseñas →
              </Link>
            </div>
          </section>
        )}

        {/* 06 — COMO TRABAJAMOS */}
        <section className="border-t border-white/10 px-6 lg:px-16 py-20 lg:py-28">
          <div className="max-w-3xl mx-auto mb-14">
            <SectionLabel n="06">Cómo trabajamos</SectionLabel>
            <h2 className="text-3xl lg:text-5xl font-normal leading-tight mb-6">Lo que no negociamos</h2>
            <p className="text-white/70 text-[15px] lg:text-base leading-relaxed max-w-xl">
              Trabajamos con cristales de alta gama y marcas como Varilux, Vulk y Rusty. Pero lo que nos define no es la vidriera.
            </p>
          </div>
          <div className="max-w-5xl mx-auto grid sm:grid-cols-2 divide-y sm:divide-y-0 divide-white/10">
            {PRINCIPIOS.map((p, i) => (
              <div key={p.titulo} className={`py-8 sm:p-10 ${i % 2 === 0 ? 'sm:border-r border-white/10' : ''} ${i < 2 ? 'sm:border-b border-white/10' : ''}`}>
                <span className="text-[11px] font-mono text-white/70">{p.n}</span>
                <h3 className="text-xl font-normal mt-3 mb-3">{p.titulo}</h3>
                <p className="text-white/70 text-[14px] leading-relaxed">{p.texto}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 07 — EL LOCAL */}
        <section className="border-t border-white/10">
          <div className="px-6 lg:px-16 pt-20 lg:pt-28 pb-14 max-w-3xl mx-auto">
            <SectionLabel n="07">El local</SectionLabel>
            <h2 className="text-3xl lg:text-5xl font-normal leading-tight mb-8">Donde pasa todo</h2>
            <p className="text-white/70 text-[15px] lg:text-base leading-relaxed">
              Un espacio en el Cerro de las Rosas pensado para que elijas tus anteojos como se elige una prenda de autor. Sin turno previo.
            </p>
          </div>
          <div className="grid grid-cols-2">
            <div className="relative aspect-[3/4]">
              {/* La paleta queda en COLOR: es lo único de la página donde el
                  color es el contenido (los tonos de cristal). */}
              <Image
                src="/images/equipo/paleta-cristales-entrega.jpg"
                alt="Entrega de un pedido sobre el mostrador, con la paleta de colores de cristales a la vista"
                fill
                sizes="50vw"
                className="object-cover"
              />
            </div>
            <div className="relative aspect-[3/4]">
              <Image
                src="/images/blog/fachada-ladrillo.webp"
                alt="Cartel de Atelier Óptica sobre la pared de ladrillo"
                fill
                sizes="50vw"
                className="object-cover grayscale"
              />
            </div>
          </div>
          <p className="text-center text-[11px] uppercase tracking-[0.25em] text-white/70 py-6 border-b border-white/10 px-6">
            La entrega, con toda la paleta de cristales a la vista ·{' '}
            <Link href="/nuestro-local" className="underline underline-offset-4 hover:text-white">
              Conocé el local
            </Link>
          </p>
        </section>

        {/* CIERRE */}
        <section className="px-6 lg:px-16 py-24 lg:py-32 max-w-3xl mx-auto">
          <blockquote className="border-t border-b border-white/15 py-10 mb-14">
            <p className="text-2xl lg:text-4xl font-light leading-tight text-white">
              Somos ópticos creativos.<br />Tu visión es nuestra obra maestra.
            </p>
            <footer className="mt-6 text-[11px] uppercase tracking-[0.25em] text-white/70">Atelier Óptica</footer>
          </blockquote>

          <div className="text-center">
            <h2 className="text-2xl lg:text-3xl font-normal mb-4">Vení a conocernos</h2>
            <p className="text-white/70 text-[14px] mb-10 max-w-md mx-auto leading-relaxed">
              José Luis de Tejeda 4380, Cerro de las Rosas, Córdoba. ¿Vivís en otra ciudad? Hacemos envíos a todo el país.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href={buildWhatsAppUrl('¡Hola! Quiero conocer más sobre Atelier Óptica y recibir asesoramiento.', { phone: WHATSAPP_PHONE })}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-white text-black px-8 py-4 text-[11px] font-bold uppercase tracking-widest hover:bg-white/85 transition-colors"
              >
                Escribinos por WhatsApp
              </a>
              <Link
                href="/tienda"
                className="inline-block border border-white/30 px-8 py-4 text-[11px] font-bold uppercase tracking-widest hover:bg-white hover:text-black transition-colors"
              >
                Ver la colección
              </Link>
            </div>
            <p className="text-white/70 text-[13px] leading-relaxed italic mt-14">
              En la óptica no diagnosticamos ni recetamos: tu primer paso siempre es el médico oftalmólogo. Con la receta en mano, el resto es nuestro trabajo.
            </p>
          </div>
        </section>
      </main>

      <StorefrontFooter />
    </div>
  );
}
