import type { ReactNode } from 'react';
import Link from 'next/link';
import { StorefrontNavbar } from '@/components/Storefront/StorefrontNavbar';
import { StorefrontFooter } from '@/components/Storefront/StorefrontFooter';
import { WHATSAPP_PHONE } from '@/lib/constants';
import { NOTAS_STELLEST, notaStellest } from '@/lib/constants/stellest-notas';

/**
 * El molde de TODAS las notas de Stellest (menos la madre, /blog/stellest,
 * que tiene sus gráficas y su propio diseño).
 *
 * Existe para que las ocho notas se vean iguales, cierren igual (CTA de
 * WhatsApp + aclaración de que somos ópticos, no médicos) y se enlacen entre
 * sí solas: el bloque "Más sobre Stellest" sale de `NOTAS_STELLEST`, así que
 * una nota nueva aparece en las demás sin tocarlas. Regla del CLAUDE.md: lo
 * que se muestra en más de un lugar se arma en un solo helper.
 */
export function NotaStellest({
  slug,
  eyebrow = 'Control de miopía infantil',
  lead,
  children,
  ctaTitulo = '¿Te recetaron Stellest y querés consultar?',
  ctaTexto = 'Traé la receta y te explicamos todo: materiales, tiempos y formas de pago. Estamos en el Cerro de las Rosas, Córdoba.',
  mensajeWhatsApp = 'Hola! Quiero consultar por los lentes Stellest para mi hijo/a',
}: {
  slug: string;
  eyebrow?: string;
  lead: ReactNode;
  children: ReactNode;
  ctaTitulo?: string;
  ctaTexto?: string;
  mensajeWhatsApp?: string;
}) {
  const nota = notaStellest(slug);
  const wsp = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(mensajeWhatsApp)}`;

  return (
    <div className="min-h-screen flex flex-col bg-stone-50">
      <StorefrontNavbar theme="light" />

      <main className="flex-grow container mx-auto px-4 pt-32 pb-20 max-w-4xl">
        <article className="blog-article w-full max-w-none">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--dorado-texto)] mb-4">{eyebrow}</p>
          <h1 className="text-4xl md:text-5xl font-serif text-stone-900 mb-8 leading-tight">{nota.title}</h1>

          <div className="text-lg text-stone-700 leading-relaxed mb-8">{lead}</div>

          {children}

          <div className="bg-stone-900 text-stone-50 rounded-lg p-8 my-12 text-center">
            <p className="text-xl font-serif mb-2 m-0">{ctaTitulo}</p>
            <p className="text-sm text-stone-300 mb-6 mt-2">{ctaTexto}</p>
            <a
              href={wsp}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center bg-[#25D366] text-stone-950 px-8 py-4 rounded-full font-bold uppercase tracking-widest hover:bg-[#1ebe57] transition-all hover:scale-105"
            >
              Consultar por WhatsApp
            </a>
          </div>

          <MasSobreStellest actual={slug} />

          <p className="text-xs text-stone-500 leading-relaxed mt-12 pt-6 border-t border-stone-200">
            En Atelier Óptica somos ópticos especialistas, no médicos: asesoramos sobre cristales y
            armazones a partir de la receta de tu oftalmopediatra. No hacemos medición de vista ni
            diagnósticos. Stellest es una marca registrada de Essilor. Los datos clínicos citados
            (67 % de ralentización promedio a dos años, con uso de al menos 12 horas diarias)
            corresponden al ensayo clínico de Essilor y son promedios de estudio, no una promesa
            individual.
          </p>
        </article>
      </main>

      <StorefrontFooter />
    </div>
  );
}

/** Subtítulo de sección, igual en todas las notas. */
export function H2({ children }: { children: ReactNode }) {
  return <h2 className="text-2xl font-serif text-stone-900 mt-12 mb-4">{children}</h2>;
}

/** Párrafo de cuerpo, igual en todas las notas. */
export function P({ children }: { children: ReactNode }) {
  return <p className="text-stone-700 leading-relaxed mb-6">{children}</p>;
}

/** Recuadro dorado para lo que hay que leer sí o sí. */
export function Destacado({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="bg-[#c8a55c]/10 border border-[#c8a55c]/40 rounded-lg p-6 my-10">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8a6d33] m-0">{titulo}</p>
      <div className="text-stone-800 leading-relaxed mt-3">{children}</div>
    </div>
  );
}

/** Lista con viñetas, igual en todas las notas. */
export function Lista({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc pl-6 text-stone-700 leading-relaxed mb-6 space-y-2">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}

/**
 * El bloque de links cruzados. Lo usan todas las notas del grupo y también la
 * nota madre (/blog/stellest) y la página de producto (/cristales-opticos/stellest),
 * que tienen diseño propio: así ninguna queda fuera de la red de enlaces.
 */
export function MasSobreStellest({ actual }: { actual?: string }) {
  const otras = NOTAS_STELLEST.filter((n) => n.slug !== actual);
  return (
    <nav aria-label="Más sobre Stellest" className="my-12">
      <h2 className="text-2xl font-serif text-stone-900 mb-4">Más sobre Stellest</h2>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 list-none p-0 m-0">
        {otras.map((n) => (
          <li key={n.slug} className="m-0">
            <Link
              href={`/blog/${n.slug}`}
              className="block bg-white border border-stone-200 rounded-lg px-5 py-4 text-stone-800 hover:border-[#c8a55c] hover:text-stone-950 transition-colors no-underline"
            >
              {n.linkText}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
