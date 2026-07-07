import { Metadata } from 'next';
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { StorefrontFooter } from "@/components/Storefront/StorefrontFooter";
import { AlertTriangle, Glasses, RefreshCcw } from 'lucide-react';

export const metadata: Metadata = {
  title: "Políticas de Cambio",
  description: "Conocé nuestras políticas de cambio, devoluciones y garantía de adaptación para lentes multifocales y anteojos de sol.",
  alternates: { canonical: 'https://atelieroptica.com.ar/politicas-de-cambio' },
};

export default function PoliticasDeCambioPage() {
  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 pb-20">
      <StorefrontNavbar theme="light" />
      
      <div className="bg-primary/5 py-16 lg:py-24 border-b border-primary/10 pt-32">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl lg:text-5xl font-black text-stone-900 dark:text-white tracking-tight mb-6">
            Políticas de <span className="text-primary italic">Cambio</span>
          </h1>
          <p className="text-xl text-stone-600 dark:text-stone-400 max-w-2xl mx-auto leading-relaxed">
            Transparencia y tranquilidad en cada compra.
          </p>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="space-y-12 text-stone-600 dark:text-stone-300 leading-relaxed text-lg">
          
          <section className="bg-white dark:bg-stone-900 rounded-3xl p-8 lg:p-10 border border-stone-200 dark:border-stone-800 shadow-sm relative overflow-hidden">
            <div className="flex items-center gap-4 mb-6 relative z-10">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary flex-shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-stone-900 dark:text-white">Anteojos Recetados (Cristales a medida)</h2>
            </div>
            <div className="space-y-4 relative z-10">
              <p>
                En Atelier Óptica nos especializamos en la confección de cristales oftálmicos de alta precisión. Todos nuestros anteojos recetados son fabricados a medida y de forma exclusiva para cada paciente, basándonos en sus especificaciones médicas (receta) y medidas anatómicas (distancia interpupilar, altura, etc.).
              </p>
              <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/50 rounded-2xl p-6 text-orange-900 dark:text-orange-200">
                <p>
                  Por este motivo, y de acuerdo a las excepciones previstas en la normativa vigente, <strong>una vez iniciada la producción en laboratorio, los cristales no admiten cancelaciones, cambios ni devoluciones.</strong>
                </p>
              </div>
            </div>
          </section>

          <section className="bg-white dark:bg-stone-900 rounded-3xl p-8 lg:p-10 border border-stone-200 dark:border-stone-800 shadow-sm">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary flex-shrink-0">
                <Glasses className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-stone-900 dark:text-white">Garantía de Adaptación en Multifocales</h2>
            </div>
            <p className="mb-4">
              A pesar de no admitir devoluciones, ofrecemos una garantía total de adaptación para todos nuestros cristales multifocales de la marca premium Varilux.
            </p>
            <p>
              Si el paciente no logra adaptarse dentro de los primeros 30 días, nos comprometemos a reemplazar los cristales sin costo adicional. Para hacer efectiva esta garantía, será indispensable la presentación de una nueva receta emitida por el médico oftalmólogo tratante (no deben transcurrir más de 90 días entre ambas recetas).
            </p>
          </section>

          <section className="bg-white dark:bg-stone-900 rounded-3xl p-8 lg:p-10 border border-stone-200 dark:border-stone-800 shadow-sm">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary flex-shrink-0">
                <RefreshCcw className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-stone-900 dark:text-white">Anteojos de Sol y Armazones (Sin graduación)</h2>
            </div>
            <p className="mb-4">
              Para productos estándar como anteojos de sol sin receta o armazones de venta libre, aceptamos cambios o devoluciones dentro de los 10 días corridos desde la recepción del producto. 
            </p>
            <p>
              El producto debe ser devuelto en perfectas condiciones, sin indicios de uso, con sus etiquetas intactas y en su estuche/empaque original. Los costos de envío por devoluciones de productos estándar corren por cuenta del cliente, salvo en casos de fallas de fábrica comprobables.
            </p>
          </section>

        </div>
      </main>

      <StorefrontFooter />
      
    </div>
  );
}
