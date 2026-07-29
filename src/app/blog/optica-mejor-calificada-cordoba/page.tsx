import { Metadata } from 'next';
import Link from 'next/link';
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { StorefrontFooter } from "@/components/Storefront/StorefrontFooter";
import { Star, Microscope, Award, HeartHandshake, ShieldCheck, MapPin } from "lucide-react";
import { getGoogleReviews } from '@/lib/googleReviews';
import { BUSINESS_INFO } from '@/lib/business-info';
import { buildWhatsAppUrl, currentPageUrl } from '@/lib/whatsapp-link';

export const revalidate = 300;

const PAGE_PATH = '/blog/optica-mejor-calificada-cordoba';
const PAGE_URL = `https://atelieroptica.com.ar${PAGE_PATH}`;

/** Mismo umbral que /optica-cordoba: el claim solo se emite si el rating lo banca. */
const claimBackedByRating = (rating: number, count: number) => rating >= 4.8 && count >= 20;

export async function generateMetadata(): Promise<Metadata> {
  const { rating, userRatingCount } = await getGoogleReviews();
  const stars = rating.toFixed(1).replace('.', ',');
  const withClaim = claimBackedByRating(rating, userRatingCount);

  const title = withClaim
    ? `Por qué somos la óptica mejor calificada de Córdoba (★ ${stars} con +${userRatingCount} reseñas)`
    : 'Qué hacemos distinto en Atelier Óptica, Córdoba';
  const description = withClaim
    ? `★ ${stars} en Google con más de ${userRatingCount} reseñas. Te contamos las seis cosas que hacemos distinto: laboratorio propio, medición Essilor Expert, garantía de adaptación y asesoramiento sin apuro.`
    : 'Laboratorio propio, medición Essilor Expert, garantía de adaptación y asesoramiento sin apuro: qué hacemos distinto en nuestra óptica de Córdoba.';

  return {
    alternates: { canonical: PAGE_URL },
    title: { absolute: `${title} | Atelier Óptica` },
    description,
    keywords: [
      'mejor optica de cordoba',
      'optica mejor calificada cordoba',
      'opticas recomendadas cordoba',
      'resenas optica cordoba',
      'optica cerro de las rosas',
      'atelier optica opiniones',
    ],
    openGraph: {
      type: 'article',
      url: PAGE_URL,
      title,
      description,
      images: [{ url: '/images/blog/fachada-ladrillo.webp', width: 1200, height: 630, alt: 'Fachada de Atelier Óptica en el Cerro de las Rosas, Córdoba' }],
    },
  };
}

const REASONS = [
  {
    icon: Microscope,
    title: 'Laboratorio propio, no un intermediario',
    body: 'La mayoría de las ópticas manda todo a tallar afuera y espera. Nosotros tenemos laboratorio propio con armado computarizado, así que controlamos la precisión del montaje y podemos resolver en el día un monofocal express o la reparación de un armazón que se rompió. Cuando algo sale mal, no hay a quién echarle la culpa: lo arreglamos nosotros.',
  },
  {
    icon: Award,
    title: 'La medición la hace un Essilor Expert',
    body: 'Un multifocal mal medido no se arregla con una marca cara: se arregla midiendo bien. Matías Turchi está certificado como Essilor Expert y toma las medidas de altura, distancia interpupilar e inclinación de cada paciente. Esa es la razón por la que la mayoría de nuestros pacientes de multifocales se adapta sin drama.',
  },
  {
    icon: ShieldCheck,
    title: 'Garantía de adaptación de 30 días',
    body: 'Todos los cristales multifocales Varilux y los monofocales Super Blue tienen garantía de adaptación: si dentro de los primeros 30 días no te adaptás, te cambiamos los cristales sin costo. Solo pedimos una receta nueva de tu oftalmólogo, emitida a menos de 90 días de la anterior.',
  },
  {
    icon: HeartHandshake,
    title: 'Asesoramiento sin apuro (y sin vender de más)',
    body: 'Es lo que más aparece en las reseñas: que nadie te apura y que nadie te empuja el cristal más caro. Si tu receta no justifica un multifocal premium, te lo decimos. Preferimos que vuelvas dentro de dos años a venderte hoy algo que no necesitás.',
  },
  {
    icon: Star,
    title: 'Diseño que no vas a encontrar en todas las ópticas',
    body: 'Trabajamos armazones de diseño seleccionados uno por uno, no la góndola estándar que se repite en toda la ciudad. Y te ayudamos a elegir el que va con tu rostro, que es la mitad del trabajo.',
  },
  {
    icon: MapPin,
    title: 'Estés donde estés',
    body: `Podés visitarnos en ${BUSINESS_INFO.address} —atendemos ${BUSINESS_INFO.hours.toLowerCase()}— o resolver todo por WhatsApp y recibir tus anteojos en tu casa: enviamos a todo el país con seguimiento. También te dejamos la factura lista para pedir el reintegro a tu obra social o prepaga.`,
  },
];

export default async function OpticaMejorCalificadaPage() {
  const { rating, userRatingCount } = await getGoogleReviews();
  const stars = rating > 0 ? rating.toFixed(1).replace('.', ',') : null;
  const withClaim = claimBackedByRating(rating, userRatingCount);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: withClaim
      ? `Por qué somos la óptica mejor calificada de Córdoba`
      : 'Qué hacemos distinto en Atelier Óptica, Córdoba',
    description:
      'Las seis cosas que explican nuestra puntuación en Google: laboratorio propio, medición Essilor Expert, garantía de adaptación, asesoramiento sin apuro, diseño seleccionado y envíos a todo el país.',
    image: 'https://atelieroptica.com.ar/images/blog/fachada-ladrillo.webp',
    mainEntityOfPage: PAGE_URL,
    author: { '@type': 'Organization', name: BUSINESS_INFO.name, '@id': BUSINESS_INFO.entityId },
    publisher: {
      '@type': 'Organization',
      name: BUSINESS_INFO.name,
      logo: { '@type': 'ImageObject', url: 'https://atelieroptica.com.ar/assets/logo-pwa-512.png' },
    },
  };

  const whatsappUrl = buildWhatsAppUrl('Hola! Vi la nota del blog y quiero asesorarme: ', {
    pageUrl: currentPageUrl(PAGE_PATH),
  });

  return (
    <div className="min-h-screen bg-[#faf8f5] flex flex-col font-sans selection:bg-black selection:text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <StorefrontNavbar />

      <main className="flex-grow">
        {/* HERO */}
        <section className="pt-32 pb-16 md:pt-40 md:pb-20 bg-white">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <span className="text-sm font-bold uppercase tracking-[0.2em] text-neutral-400 mb-4 block">
              Nuestra forma de trabajar
            </span>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-light tracking-tight mb-6 text-[#111]">
              {withClaim
                ? 'Por qué somos la óptica mejor calificada de Córdoba'
                : 'Qué hacemos distinto en Atelier Óptica'}
            </h1>
            {stars && (
              <Link
                href="/resenas"
                className="inline-flex items-center gap-2 py-2 px-4 rounded-full bg-amber-50 border border-amber-200 text-amber-900 text-sm font-bold mb-8 hover:bg-amber-100 transition-colors"
              >
                <span className="text-amber-500">★★★★★</span>
                {stars} en Google · +{userRatingCount} reseñas verificadas
              </Link>
            )}
            <p className="text-lg text-[#444] leading-relaxed max-w-2xl mx-auto">
              Una puntuación así no se compra ni se explica sola: es la suma de{' '}
              {userRatingCount > 0 ? `más de ${userRatingCount} personas` : 'cientos de personas'} que
              salieron conformes del local y se tomaron el trabajo de escribirlo. Acá te contamos, sin
              vueltas, qué hacemos distinto.
            </p>
          </div>
        </section>

        {/* CONTENIDO */}
        <section className="py-12 md:py-20 bg-[#faf8f5]">
          <div className="max-w-3xl mx-auto px-6">
            <div className="blog-article w-full max-w-none">
              <p className="text-neutral-700 mb-10">
                Antes que nada, una aclaración que nos parece importante: en Atelier{' '}
                <strong>no diagnosticamos ni recetamos</strong>. Eso es trabajo de tu médico
                oftalmólogo. Lo nuestro es lo que pasa después de la receta —elegir el armazón, medir
                con precisión, tallar y montar los cristales— y es ahí donde se define si vas a ver
                bien y a sentirte cómodo, o si vas a terminar con unos anteojos guardados en un cajón.
              </p>

              <h2 className="text-3xl font-light text-[#111] mt-12 mb-8">
                Las seis cosas que hacemos distinto
              </h2>

              {REASONS.map(({ icon: Icon, title, body }) => (
                <div key={title} className="mb-12">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-neutral-900 rounded-full flex items-center justify-center text-white flex-shrink-0">
                      <Icon className="w-6 h-6" />
                    </div>
                    <h3 className="text-2xl font-medium text-[#111] m-0">{title}</h3>
                  </div>
                  <p className="text-neutral-700">{body}</p>
                </div>
              ))}

              <hr className="border-black/10 my-10" />

              <h2 className="text-2xl font-medium text-[#111] mb-4">
                Qué mirar antes de elegir cualquier óptica
              </h2>
              <p className="text-neutral-700 mb-6">
                Más allá de nosotros, si estás comparando ópticas en Córdoba te dejamos las preguntas
                que conviene hacer en cualquier mostrador: ¿quién toma las medidas y con qué
                certificación?, ¿el laboratorio es propio o terceriza?, ¿qué pasa si no me adapto al
                multifocal?, ¿me entregan la documentación para el reintegro de mi obra social? Las
                respuestas a esas cuatro preguntas explican casi toda la diferencia de precio y de
                resultado entre una óptica y otra.
              </p>

              <div className="bg-neutral-100 p-6 rounded-lg border border-black/10 mb-10">
                <h3 className="text-lg font-medium text-[#111] m-0 mb-3">Seguí leyendo</h3>
                <ul className="list-disc pl-6 text-neutral-700 m-0 space-y-2 text-sm">
                  <li>
                    <Link href="/blog/guia-armazones-segun-rostro" className="underline underline-offset-4">
                      Qué armazón va con la forma de tu rostro
                    </Link>
                  </li>
                  <li>
                    <Link href="/blog/guia-precios-multifocales-argentina" className="underline underline-offset-4">
                      Cuánto cuestan los multifocales en Argentina
                    </Link>
                  </li>
                  <li>
                    <Link href="/blog/como-leer-receta-oftalmologica" className="underline underline-offset-4">
                      Cómo leer tu receta oftalmológica
                    </Link>
                  </li>
                  <li>
                    <Link href="/optica-cordoba" className="underline underline-offset-4">
                      Todo sobre nuestra óptica en Córdoba
                    </Link>
                  </li>
                </ul>
              </div>

              <div className="bg-black text-white p-8 rounded-xl text-center mt-12">
                <Star className="w-10 h-10 mx-auto mb-4 opacity-80" />
                <h3 className="text-2xl font-light mb-4">Vení a comprobarlo</h3>
                <p className="text-white/80 mb-6 max-w-lg mx-auto">
                  Traé tu receta al local del Cerro de las Rosas y te asesoramos sin cargo y sin
                  apuro. Si estás lejos, mandanos una foto de la receta por WhatsApp: te
                  presupuestamos y te lo enviamos a tu casa.
                </p>
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-[#faf8f5] text-black px-8 py-3 font-medium rounded-full hover:bg-neutral-200 transition-colors"
                >
                  Consultar por WhatsApp
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <StorefrontFooter />
    </div>
  );
}
