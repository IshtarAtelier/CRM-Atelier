import { Metadata } from 'next';
import Link from 'next/link';
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { StorefrontFooter } from "@/components/Storefront/StorefrontFooter";
import { TEXTO_VENTANILLA_FEDERAL, URL_VENTANILLA_FEDERAL_RECLAMOS } from '@/lib/constants/defensa-consumidor';
import { ArrepentimientoForm } from './ArrepentimientoForm';

/**
 * Botón de arrepentimiento (Disp. 954/2025). Auditoría del 25/9/2026: la
 * ruta daba 404 y no había link en ninguna página.
 *
 * TEXTO LEGAL A REVISAR antes del deploy (Ishtar + abogado): el plazo que se
 * cita es el del art. 34 de la Ley 24.240. Qué pasa con los anteojos con
 * cristales hechos a medida y quién paga el envío de la devolución NO se
 * dicen acá a propósito: están en revisión (docs/legales-tienda-borrador-revision.md).
 */
export const metadata: Metadata = {
  title: "Botón de arrepentimiento",
  description: "Pedí la revocación de una compra online en Atelier Óptica sin registrarte. Te damos un código de trámite al instante.",
  alternates: { canonical: 'https://atelieroptica.com.ar/arrepentimiento' },
};

export default function ArrepentimientoPage() {
  return (
    <div className="min-h-screen bg-stone-50">
      <StorefrontNavbar theme="light" />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-32 pb-20">
        <h1 className="text-4xl lg:text-5xl font-serif text-stone-900 tracking-tight mb-6">
          Botón de arrepentimiento
        </h1>

        <div className="space-y-4 text-[17px] leading-relaxed text-stone-700 mb-10">
          <p>
            Si compraste en nuestra tienda online y te arrepentiste, podés pedir la revocación de la compra acá, sin registrarte.
          </p>
          <p>
            Tenés <strong className="text-stone-900">10 días corridos</strong> contados desde que recibiste el producto o desde la compra, lo que haya pasado último (art. 34 de la Ley 24.240 de Defensa del Consumidor).
          </p>
          <p>
            Al enviar el formulario te mostramos un <strong className="text-stone-900">código de trámite</strong>. Guardalo: es tu constancia. Después te contactamos para coordinar la devolución.
          </p>
        </div>

        <ArrepentimientoForm />

        <div className="mt-12 space-y-2 text-[15px] text-stone-600">
          <p>
            Condiciones de cambios y devoluciones:{' '}
            <Link href="/politicas-de-cambio" className="text-[#8a6d3b] font-semibold underline underline-offset-4">Cambios y Devoluciones</Link>.
          </p>
          <p>
            Si no te dimos respuesta, podés hacer un reclamo en la{' '}
            <a href={URL_VENTANILLA_FEDERAL_RECLAMOS} target="_blank" rel="noopener noreferrer" className="text-[#8a6d3b] font-semibold underline underline-offset-4">
              {TEXTO_VENTANILLA_FEDERAL}
            </a>.
          </p>
        </div>
      </main>

      <StorefrontFooter />
    </div>
  );
}
