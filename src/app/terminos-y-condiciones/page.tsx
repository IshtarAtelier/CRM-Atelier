import { Metadata } from 'next';
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { StorefrontFooter } from "@/components/Storefront/StorefrontFooter";
import { FloatingWhatsApp } from "@/components/Storefront/FloatingWhatsApp";
import { Shield, FileText, CreditCard } from 'lucide-react';

export const metadata: Metadata = {
  title: "Términos y Condiciones | Atelier Óptica Córdoba",
  description: "Conocé los términos y condiciones de compra en Atelier Óptica. Procesamiento de pagos seguro con Payway y regulaciones de salud visual.",
  alternates: { canonical: 'https://www.atelieroptica.com.ar/terminos-y-condiciones' },
};

export default function TerminosYCondicionesPage() {
  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 pb-20">
      <StorefrontNavbar theme="light" />
      
      <div className="bg-primary/5 py-16 lg:py-24 border-b border-primary/10 pt-32">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl lg:text-5xl font-black text-stone-900 dark:text-white tracking-tight mb-6">
            Términos y <span className="text-primary italic">Condiciones</span>
          </h1>
          <p className="text-xl text-stone-600 dark:text-stone-400 max-w-2xl mx-auto leading-relaxed">
            Marco legal para una compra transparente y segura.
          </p>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="space-y-12 text-stone-600 dark:text-stone-300 leading-relaxed text-lg">
          
          <section className="bg-white dark:bg-stone-900 rounded-3xl p-8 lg:p-10 border border-stone-200 dark:border-stone-800 shadow-sm">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary flex-shrink-0">
                <Shield className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-stone-900 dark:text-white">1. Regulaciones Sanitarias y de Salud Visual</h2>
            </div>
            <div className="space-y-4">
              <p>
                Atelier Óptica opera bajo las regulaciones vigentes del Ministerio de Salud de la Provincia de Córdoba y las normativas de la Administración Nacional de Medicamentos, Alimentos y Tecnología Médica (ANMAT) para establecimientos de óptica médica.
              </p>
              <p>
                Toda compra de cristales recetados (con graduación) requiere la presentación obligatoria de una receta emitida por un médico oftalmólogo matriculado en la República Argentina. No nos hacemos responsables de las molestias derivadas de datos incorrectos en recetas enviadas por el usuario.
              </p>
            </div>
          </section>

          <section className="bg-white dark:bg-stone-900 rounded-3xl p-8 lg:p-10 border border-stone-200 dark:border-stone-800 shadow-sm">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary flex-shrink-0">
                <CreditCard className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-stone-900 dark:text-white">2. Procesamiento de Pagos y Financiación</h2>
            </div>
            <div className="space-y-4">
              <p>
                Los pagos realizados con tarjeta de crédito en nuestra plataforma son procesados a través de la pasarela de pago <strong>Payway (Prisma Medios de Pago S.A.)</strong>, garantizando altos estándares de encriptación y seguridad digital (SSL/PCI-DSS).
              </p>
              <p>
                Las promociones de cuotas sin interés (ej: 6 cuotas sin interés) están sujetas a las condiciones y promociones bancarias vigentes provistas por Payway y pueden ser modificadas sin previo aviso. El descuento del 15% por efectivo o transferencia bancaria se aplicará sobre el precio de lista indicado en la tienda.
              </p>
            </div>
          </section>

          <section className="bg-white dark:bg-stone-900 rounded-3xl p-8 lg:p-10 border border-stone-200 dark:border-stone-800 shadow-sm">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary flex-shrink-0">
                <FileText className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-stone-900 dark:text-white">3. Tiempos de Fabricación y Despacho</h2>
            </div>
            <div className="space-y-4">
              <p>
                Los tiempos de preparación estimados son de <strong>2 días hábiles</strong> para armazones solos o anteojos de sol sin receta, y de <strong>5 a 7 días hábiles</strong> para cristales recetados debido al proceso de calibración y laboratorio.
              </p>
              <p>
                Una vez despachado el pedido mediante el correo postal, se le enviará un código de seguimiento al cliente. Atelier Óptica no se responsabiliza por demoras operativas exclusivas del servicio de correo.
              </p>
            </div>
          </section>

        </div>
      </main>

      <StorefrontFooter />
      <FloatingWhatsApp />
    </div>
  );
}
