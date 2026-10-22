import Image from "next/image";
import Link from "next/link";
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { StorefrontFooter } from "@/components/Storefront/StorefrontFooter";
import { WHATSAPP_PHONE } from "@/lib/constants";
import { formatDateLong } from "@/lib/format-date";
import { BUSINESS_INFO } from "@/lib/business-info";
import { NOTAS_MARCAS_CRISTALES, type NotaMarcaCristal as Nota } from "@/lib/constants/notas-marcas-cristales";

/**
 * Plantilla única de las notas de marcas de cristales (Hoya, Pentax, Kodak…).
 * El contenido vive en notas-marcas-cristales.ts; acá solo se dibuja, así las
 * siete notas se ven iguales y el bloque "Las otras marcas" se arma solo.
 */
const ORIGEN = "https://atelieroptica.com.ar";

export function NotaMarcaCristal({ nota }: { nota: Nota }) {
  const wsp = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(`Hola! Quiero consultar por cristales ${nota.marca}`)}`;
  const otras = NOTAS_MARCAS_CRISTALES.filter((n) => n.slug !== nota.slug);
  const url = `${ORIGEN}/blog/${nota.slug}`;
  // Datos estructurados: Article (quién y cuándo), FAQPage (preguntas que
  // Google y los asistentes de IA citan textual) y BreadcrumbList.
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: nota.title,
      description: nota.metaDescription,
      abstract: nota.resumen,
      image: [`${ORIGEN}${nota.imageUrl}`],
      datePublished: nota.date,
      dateModified: nota.date,
      inLanguage: "es-AR",
      mainEntityOfPage: url,
      about: { "@type": "Brand", name: nota.marca },
      author: { "@type": "Organization", "@id": BUSINESS_INFO.entityId, name: BUSINESS_INFO.name, url: ORIGEN },
      publisher: {
        "@type": "Organization",
        "@id": BUSINESS_INFO.entityId,
        name: BUSINESS_INFO.name,
        logo: { "@type": "ImageObject", url: `${ORIGEN}/images/logo-negro.png` },
      },
    },
    nota.faqs.length > 0 && {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: nota.faqs.map((f) => ({
        "@type": "Question",
        name: f.pregunta,
        acceptedAnswer: { "@type": "Answer", text: f.respuesta },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Blog", item: `${ORIGEN}/blog` },
        { "@type": "ListItem", position: 2, name: "Marcas de cristales", item: `${ORIGEN}/blog/categoria/marcas-de-cristales` },
        { "@type": "ListItem", position: 3, name: nota.marca, item: url },
      ],
    },
  ].filter(Boolean);

  return (
    <div className="min-h-screen flex flex-col bg-stone-50">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <StorefrontNavbar theme="light" />
      <main className="flex-grow container mx-auto px-4 pt-32 pb-20 max-w-4xl">
        <article className="blog-article w-full max-w-none">
          <nav aria-label="Migas" className="text-xs text-stone-600 mb-4">
            <Link href="/blog" className="hover:underline">Blog</Link> /{" "}
            <Link href="/blog/categoria/marcas-de-cristales" className="font-bold uppercase tracking-[0.2em] text-[var(--dorado-texto)] hover:underline">
              Marcas de cristales
            </Link>
          </nav>
          <h1 className="text-4xl md:text-5xl font-serif text-stone-900 mb-8 leading-tight">{nota.title}</h1>
          <p className="text-sm text-stone-600 mb-8">
            Por Atelier Óptica, Cerro de las Rosas, Córdoba · <time dateTime={nota.date}>{formatDateLong(`${nota.date}T12:00:00`)}</time>
          </p>
          <div className="border-l-4 border-[var(--dorado-texto)] bg-white rounded-r-lg p-6 mb-8">
            <p className="text-xs font-bold uppercase tracking-widest text-stone-600 mb-2">En pocas palabras</p>
            <p className="text-stone-800 leading-relaxed m-0">{nota.resumen}</p>
          </div>
          {nota.intro.map((p, i) => (
            <p key={i} className="text-lg text-stone-700 leading-relaxed mb-6">{p}</p>
          ))}

          <Image
            src={nota.imageUrl}
            alt={nota.imageAlt}
            width={1200}
            height={800}
            priority
            sizes="(min-width: 896px) 896px, 100vw"
            className="w-full h-auto rounded-xl shadow-md my-8"
          />

          {nota.secciones.map((s) => (
            <section key={s.titulo}>
              <h2 className="text-2xl font-serif text-stone-900 mt-12 mb-4">{s.titulo}</h2>
              {s.parrafos?.map((p, i) => (
                <p key={i} className="text-stone-700 leading-relaxed mb-6">{p}</p>
              ))}
              {s.items && s.items.some((it) => it.imagen) ? (
                <div className="grid sm:grid-cols-2 gap-6 mb-6">
                  {s.items.map((it) => (
                    <div key={it.nombre} className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                      {it.imagen && (
                        <Image
                          src={it.imagen}
                          alt={`Cristal ${it.nombre} de ${nota.marca}`}
                          width={600}
                          height={600}
                          sizes="(min-width: 640px) 430px, 100vw"
                          className="w-full h-auto"
                        />
                      )}
                      <div className="p-5">
                        <h3 className="text-lg font-bold text-stone-900 mb-2">{it.nombre}</h3>
                        <p className="text-stone-700 leading-relaxed m-0">{it.texto}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : s.items ? (
                <ul className="list-disc pl-5 text-stone-700 leading-relaxed mb-6 space-y-3">
                  {s.items.map((it) => (
                    <li key={it.nombre}>
                      <strong>{it.nombre}:</strong> {it.texto}
                    </li>
                  ))}
                </ul>
              ) : null}
              {s.imagen && (
                <Image src={s.imagen.src} alt={s.imagen.alt} width={1200} height={800} sizes="(min-width: 896px) 896px, 100vw" className="w-full h-auto max-h-[520px] object-cover rounded-xl my-6" />
              )}
            </section>
          ))}

          {nota.faqs.length > 0 && (
            <section>
              <h2 className="text-2xl font-serif text-stone-900 mt-12 mb-4">Preguntas frecuentes</h2>
              {nota.faqs.map((f) => (
                <div key={f.pregunta} className="mb-6">
                  <h3 className="text-lg font-bold text-stone-900 mb-2">{f.pregunta}</h3>
                  <p className="text-stone-700 leading-relaxed">{f.respuesta}</p>
                </div>
              ))}
            </section>
          )}

          <div className="bg-stone-900 text-stone-50 rounded-lg p-8 my-12 text-center">
            <p className="text-xl font-serif mb-2 m-0">¿Querés saber si {nota.marca} es para vos?</p>
            <p className="text-sm text-stone-300 mb-6 mt-2">
              Traé tu receta y te comparamos opciones, tiempos y formas de pago. Estamos en el Cerro de las Rosas y
              enviamos a todo el país.
            </p>
            <a
              href={wsp}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center bg-[#25D366] text-stone-950 px-8 py-4 rounded-full font-bold uppercase tracking-widest hover:bg-[#1ebe57] transition-all"
            >
              Consultar por WhatsApp
            </a>
          </div>

          <section className="mt-12">
            <h2 className="text-2xl font-serif text-stone-900 mb-4">Las otras marcas que trabajamos</h2>
            <ul className="grid sm:grid-cols-2 gap-3 list-none p-0">
              {otras.map((n) => (
                <li key={n.slug}>
                  <Link
                    href={`/blog/${n.slug}`}
                    className="block rounded-lg border border-stone-200 bg-white p-4 hover:border-stone-400 transition-colors"
                  >
                    <span className="font-bold text-stone-900">{n.marca}</span>
                    <span className="block text-sm text-stone-600">{n.linkText}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <p className="text-xs text-stone-600 leading-relaxed mt-12 pt-6 border-t border-stone-200">
            En Atelier Óptica somos ópticos especialistas, no médicos: asesoramos sobre cristales a partir de tu receta.
            {nota.marca !== "Atelier" && ` ${nota.marca} es una marca registrada de su fabricante.`}
            {nota.cristalesHref && (
              <>
                {" "}Ver también la ficha en el{" "}
                <Link href={nota.cristalesHref} className="underline">área de cristales</Link>.
              </>
            )}
          </p>
        </article>
      </main>
      <StorefrontFooter />
    </div>
  );
}
