import { Metadata } from "next";
import Link from "next/link";
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { StorefrontFooter } from "@/components/Storefront/StorefrontFooter";
import { GoogleReviews } from "@/components/Storefront/GoogleReviews";
import { AccordionItem } from "@/components/Storefront/Accordion";
import { CristalCTA } from "@/components/cristales/CristalCTA";
import { getGoogleReviews } from "@/lib/googleReviews";
import { buildOpticianSchema } from "@/lib/schema";
import { BUSINESS_INFO } from "@/lib/business-info";
import { FAQ_FLAT } from "@/lib/faq-data";
import { GARANTIA_ADAPTACION } from "@/lib/garantia";
import { buildWhatsAppUrl, currentPageUrl } from "@/lib/whatsapp-link";

export const revalidate = 300;

const SITE_URL = "https://atelieroptica.com.ar";
const PAGE_PATH = "/optica-cordoba";
const PAGE_URL = `${SITE_URL}${PAGE_PATH}`;

/**
 * El claim "mejor puntuada" solo se muestra (y solo entra al title) mientras el
 * rating real de Google lo respalde. Si algún día baja, la página se degrada
 * sola a un título sin claim en el próximo revalidate.
 */
const claimBackedByRating = (rating: number, count: number) =>
  rating >= 4.8 && count >= 20;

export async function generateMetadata(): Promise<Metadata> {
  const { rating, userRatingCount } = await getGoogleReviews();
  const withClaim = claimBackedByRating(rating, userRatingCount);

  const title = withClaim
    ? `La Óptica Mejor Puntuada de Córdoba (★ ${rating.toFixed(1).replace(".", ",")} en Google)`
    : "Óptica en Córdoba | Atelier Óptica · Cerro de las Rosas";
  const description = withClaim
    ? `Atelier Óptica: ★ ${rating.toFixed(1).replace(".", ",")} en Google con +${userRatingCount} reseñas. Cristales Varilux, laboratorio propio, cuotas sin interés y envíos a todo el país. Cerro de las Rosas, Córdoba.`
    : "Atelier Óptica, en el Cerro de las Rosas: cristales Varilux, laboratorio propio, cuotas sin interés y envíos a todo el país.";

  return {
    title,
    description,
    keywords: [
      "optica en cordoba",
      "opticas cordoba",
      "la mejor optica de cordoba",
      "optica cerro de las rosas",
      "anteojos recetados cordoba",
      "lentes multifocales cordoba",
    ],
    alternates: { canonical: PAGE_URL },
    openGraph: {
      type: "website",
      url: PAGE_URL,
      title,
      description,
      images: [
        {
          url: "/images/og/nuestro-local.jpg",
          width: 1200,
          height: 630,
          alt: "Fachada de Atelier Óptica en el Cerro de las Rosas, Córdoba",
        },
      ],
    },
  };
}

/** FAQ de esta landing: subconjunto de la única fuente de contenido (faq-data). */
const FAQ_QUESTIONS = new Set([
  "¿Hacen envíos a todo el país?",
  "¿Trabajan con obras sociales?",
  "Tengo la receta del oftalmólogo, ¿cómo compro mis lentes?",
  "¿Qué medios de pago aceptan? ¿Hay cuotas y descuentos?",
  "¿Tienen garantía los cristales multifocales?",
  "¿Hacen lentes para el control de la miopía en chicos?",
  "¿Puedo probarme los anteojos antes de comprarlos?",
]);
const pageFaqs = FAQ_FLAT.filter((f) => FAQ_QUESTIONS.has(f.q));

const GUIDES = [
  { href: "/blog/guia-armazones-segun-rostro", label: "Cómo elegir armazones según tu rostro" },
  { href: "/blog/guia-precios-multifocales-argentina", label: "Precios de multifocales en Argentina" },
  { href: "/blog/control-miopia-infantil-lentes", label: "Control de miopía infantil" },
  { href: "/blog/lentes-polarizados-vs-comunes", label: "Lentes polarizados vs. comunes" },
  { href: "/blog/guia-cristales", label: "Guía completa de cristales" },
  { href: "/blog/como-leer-receta-oftalmologica", label: "Cómo leer tu receta oftalmológica" },
];

export default async function OpticaCordobaPage() {
  const reviewsData = await getGoogleReviews();
  const { rating, userRatingCount } = reviewsData;
  const withClaim = claimBackedByRating(rating, userRatingCount);
  const ratingLabel = rating > 0 ? rating.toFixed(1).replace(".", ",") : null;

  // Sin aggregateRating: las reseñas las junta y muestra Google, no este sitio
  // (marcarlas acá es self-serving). Ver src/lib/schema.ts.
  const opticianJsonLd = buildOpticianSchema();

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: pageFaqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Inicio", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Óptica en Córdoba", item: PAGE_URL },
    ],
  };

  const whatsappUrl = buildWhatsAppUrl("Consulta óptica Córdoba: ", {
    pageUrl: currentPageUrl(PAGE_PATH),
  });

  return (
    <div className="bg-[#faf8f5] text-black min-h-screen flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(opticianJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <StorefrontNavbar theme="light" />

      <main className="flex-grow pt-32 pb-16">
        {/* Hero */}
        <section className="px-6 mb-16">
          <div className="max-w-4xl mx-auto text-center">
            {ratingLabel && (
              <Link
                href="/resenas"
                className="inline-flex items-center gap-2 py-2 px-4 rounded-full bg-amber-50 border border-amber-200 text-amber-900 text-sm font-bold mb-6 hover:bg-amber-100 transition-colors"
              >
                <span className="text-amber-500">★★★★★</span>
                {ratingLabel} en Google · +{userRatingCount} reseñas
              </Link>
            )}
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              {withClaim
                ? "La óptica mejor puntuada de Córdoba"
                : "Tu óptica de confianza en Córdoba"}
            </h1>
            <p className="text-lg text-black/60 md:text-xl max-w-2xl mx-auto mb-10">
              Atelier Óptica, en el corazón del Cerro de las Rosas: armazones de
              diseño, cristales <strong>Varilux de Essilor</strong>, laboratorio
              propio y atención personalizada. Comprá en el local o desde tu casa,
              con <strong>envíos a todo el país</strong>.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-stone-900 hover:bg-[#c8a55c] text-white px-8 py-4 rounded-full font-bold uppercase tracking-widest text-sm transition-all shadow-lg"
              >
                Hablar con un asesor
              </a>
              <Link
                href="/tienda"
                className="inline-block bg-white border border-stone-300 hover:border-stone-900 text-stone-900 px-8 py-4 rounded-full font-bold uppercase tracking-widest text-sm transition-all"
              >
                Ver catálogo
              </Link>
            </div>
          </div>
        </section>

        {/* Por qué elegir Atelier */}
        <section className="max-w-5xl mx-auto px-6 mb-24">
          <h2 className="text-2xl md:text-3xl font-bold mb-10 text-center">
            ¿Por qué elegir Atelier Óptica?
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#e8e2db]">
              <div className="text-3xl mb-3">⭐</div>
              <h3 className="text-lg font-bold mb-2">Reseñas reales de Google</h3>
              <p className="text-sm text-black/70">
                {ratingLabel
                  ? `${ratingLabel} de puntuación con más de ${userRatingCount} opiniones verificadas de clientes de Córdoba.`
                  : "Opiniones verificadas de clientes de Córdoba que nos eligen y vuelven."}
              </p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#e8e2db]">
              <div className="text-3xl mb-3">🔬</div>
              <h3 className="text-lg font-bold mb-2">Laboratorio propio</h3>
              <p className="text-sm text-black/70">
                Armado computarizado de alta precisión, monofocales express y
                clínica de reparaciones para resolver tu urgencia en el día.
              </p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#e8e2db]">
              <div className="text-3xl mb-3">👓</div>
              <h3 className="text-lg font-bold mb-2">Cristales Varilux</h3>
              <p className="text-sm text-black/70">
                Multifocales premium de Essilor. {GARANTIA_ADAPTACION.RESUMEN}
              </p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#e8e2db]">
              <div className="text-3xl mb-3">💳</div>
              <h3 className="text-lg font-bold mb-2">Cuotas y descuentos</h3>
              <p className="text-sm text-black/70">
                {BUSINESS_INFO.installmentsPromo}, {BUSINESS_INFO.discountCashPercent}%
                de descuento en efectivo o {BUSINESS_INFO.discountTransferPercent}%
                por transferencia.
              </p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#e8e2db]">
              <div className="text-3xl mb-3">🧾</div>
              <h3 className="text-lg font-bold mb-2">Obras sociales y prepagas</h3>
              <p className="text-sm text-black/70">
                Te entregamos la factura y la documentación lista para pedir tu
                reintegro en OSDE, Swiss Medical, Galeno, Apross y más.
              </p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#e8e2db]">
              <div className="text-3xl mb-3">📦</div>
              <h3 className="text-lg font-bold mb-2">Envíos a todo el país</h3>
              <p className="text-sm text-black/70">
                Despachamos por Correo Argentino y Andreani con código de
                seguimiento. También podés retirar sin cargo en el local.
              </p>
            </div>
          </div>
        </section>

        {/* Catálogo */}
        <section className="max-w-5xl mx-auto px-6 mb-24">
          <h2 className="text-2xl md:text-3xl font-bold mb-10 text-center">
            Nuestro catálogo
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { href: "/tienda", title: "Armazones", desc: "Diseño exclusivo para tu receta" },
              { href: "/lentes-de-sol", title: "Lentes de sol", desc: "Protección UV con estilo" },
              { href: "/cristales-opticos/varilux", title: "Multifocales", desc: "Varilux de Essilor" },
              { href: "/arma-tus-lentes", title: "Armá tus lentes", desc: "Elegí armazón y cristales online" },
            ].map((c) => (
              <Link
                key={c.href}
                href={c.href}
                className="bg-[#283f5a] text-white p-6 rounded-2xl shadow-md hover:-translate-y-1 transition-transform flex flex-col"
              >
                <h3 className="text-lg font-bold mb-2">{c.title}</h3>
                <p className="text-sm text-white/80 flex-grow">{c.desc}</p>
                <span className="text-sm font-bold mt-4">Ver más →</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Reseñas */}
        <section className="mb-24">
          <GoogleReviews />
        </section>

        {/* Visitanos */}
        <section className="max-w-4xl mx-auto px-6 mb-24">
          <div className="bg-white p-8 md:p-12 rounded-2xl shadow-sm border border-[#e8e2db] text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-6">
              Visitanos en el Cerro de las Rosas
            </h2>
            <p className="text-black/70 mb-2 font-medium">{BUSINESS_INFO.address}</p>
            <p className="text-black/70 mb-6">{BUSINESS_INFO.hours}</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href={BUSINESS_INFO.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-white border border-stone-300 hover:border-stone-900 text-stone-900 px-8 py-3 rounded-full font-bold uppercase tracking-widest text-sm transition-all"
              >
                Cómo llegar
              </a>
              <Link
                href="/nuestro-local"
                className="inline-block bg-white border border-stone-300 hover:border-stone-900 text-stone-900 px-8 py-3 rounded-full font-bold uppercase tracking-widest text-sm transition-all"
              >
                Conocer el local
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="max-w-4xl mx-auto px-6 mb-24">
          <h2 className="text-2xl md:text-3xl font-bold mb-8 text-center">
            Preguntas frecuentes
          </h2>
          <div className="space-y-4">
            {pageFaqs.map((f, i) => (
              <AccordionItem key={f.q} title={f.q} defaultOpen={i === 0}>
                <p>{f.a}</p>
              </AccordionItem>
            ))}
          </div>
          <p className="text-center mt-8 text-sm text-black/60">
            <Link href="/faq" className="underline underline-offset-4 hover:text-black">
              Ver todas las preguntas frecuentes →
            </Link>
          </p>
        </section>

        {/* Guías */}
        <section className="max-w-4xl mx-auto px-6 mb-24">
          <h2 className="text-2xl md:text-3xl font-bold mb-8 text-center">
            Guías para elegir mejor
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {GUIDES.map((g) => (
              <Link
                key={g.href}
                href={g.href}
                className="bg-white p-5 rounded-xl shadow-sm border border-[#e8e2db] font-medium hover:border-stone-400 transition-colors"
              >
                {g.label} →
              </Link>
            ))}
          </div>
        </section>

        <CristalCTA
          pathname={PAGE_PATH}
          title="¿Listo para ver mejor?"
          description="Mandanos tu receta por WhatsApp y te asesoramos sin cargo, o visitanos en el Cerro de las Rosas."
          buttonText="Consultar por WhatsApp"
          whatsappMotivo="Consulta óptica Córdoba: "
        />
      </main>

      <StorefrontFooter />
    </div>
  );
}
