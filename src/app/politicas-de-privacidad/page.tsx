import { Metadata } from 'next';
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { StorefrontFooter } from "@/components/Storefront/StorefrontFooter";
import { Lock, Heart, ShieldAlert } from 'lucide-react';

export const metadata: Metadata = {
  title: "Políticas de Privacidad",
  description: "Conocé cómo protegemos tus datos personales, de pago y tus recetas oftalmológicas en Atelier Óptica.",
  alternates: { canonical: 'https://www.atelieroptica.com.ar/politicas-de-privacidad' },
};

export default function PoliticasDePrivacidadPage() {
  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 pb-20">
      <StorefrontNavbar theme="light" />
      
      <div className="bg-primary/5 py-16 lg:py-24 border-b border-primary/10 pt-32">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl lg:text-5xl font-black text-stone-900 dark:text-white tracking-tight mb-6">
            Políticas de <span className="text-primary italic">Privacidad</span>
          </h1>
          <p className="text-xl text-stone-600 dark:text-stone-400 max-w-2xl mx-auto leading-relaxed">
            Protegemos tus datos personales, de pago y de salud.
          </p>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="space-y-12 text-stone-600 dark:text-stone-300 leading-relaxed text-lg">
          
          <section className="bg-white dark:bg-stone-900 rounded-3xl p-8 lg:p-10 border border-stone-200 dark:border-stone-800 shadow-sm">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary flex-shrink-0">
                <Lock className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-stone-900 dark:text-white">1. Protección de Datos de Pago (Payway)</h2>
            </div>
            <div className="space-y-4">
              <p>
                Atelier Óptica no almacena, procesa ni registra en sus servidores ningún dato de tarjeta de crédito o débito de los usuarios. Todo el procesamiento de pago se realiza directamente en el entorno seguro de <strong>Payway (Prisma Medios de Pago S.A.)</strong> mediante conexiones cifradas HTTPS/SSL.
              </p>
            </div>
          </section>

          <section className="bg-white dark:bg-stone-900 rounded-3xl p-8 lg:p-10 border border-stone-200 dark:border-stone-800 shadow-sm">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary flex-shrink-0">
                <Heart className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-stone-900 dark:text-white">2. Tratamiento de Datos de Salud (Recetas Médicas)</h2>
            </div>
            <div className="space-y-4">
              <p>
                De acuerdo con la <strong>Ley de Protección de Datos Personales Nº 25.326</strong> de la República Argentina, las recetas oftalmológicas adjuntadas por los usuarios se consideran datos sensibles relativos a la salud de las personas.
              </p>
              <p>
                Estas recetas y los datos que contienen se tratan de manera estrictamente confidencial. Únicamente son accesibles por nuestro Director Técnico Óptico y el personal de laboratorio autorizado para la confección y calibrado de los lentes recetados. No se comparten con ningún tercero ajeno al proceso médico-técnico.
              </p>
            </div>
          </section>

          <section className="bg-white dark:bg-stone-900 rounded-3xl p-8 lg:p-10 border border-stone-200 dark:border-stone-800 shadow-sm">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary flex-shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-stone-900 dark:text-white">3. Derechos del Titular de los Datos</h2>
            </div>
            <div className="space-y-4">
              <p>
                Los usuarios registrados o compradores en nuestro sitio web tienen derecho a solicitar el acceso, rectificación o eliminación total de sus datos personales de nuestras bases de datos comerciales en cualquier momento, enviando una solicitud por escrito a nuestros canales oficiales.
              </p>
            </div>
          </section>

        </div>
      </main>

      <StorefrontFooter />
      
    </div>
  );
}
