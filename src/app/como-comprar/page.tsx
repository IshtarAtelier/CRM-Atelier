import { Metadata } from 'next';
import { StorefrontNavbar } from '@/components/Storefront/StorefrontNavbar';
import { StorefrontFooter } from '@/components/Storefront/StorefrontFooter';
import { FloatingWhatsApp } from '@/components/Storefront/FloatingWhatsApp';
import { ShoppingBag, Truck, CreditCard, ShieldCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: "Cómo Comprar | Atelier Óptica Córdoba",
  description: "Guía paso a paso para realizar tus compras online en Atelier Óptica de manera segura. Envíos a todo el país y métodos de pago.",
};

export default function ComoComprarPage() {
  const steps = [
    {
      icon: <ShoppingBag className="w-6 h-6" />,
      title: "1. Elegí tus productos",
      description: "Navegá por nuestras categorías y seleccioná los armazones o lentes de sol que más te gusten. Hacé clic en 'Agregar al carrito'. Si necesitás cristales recetados, ¡escribinos por WhatsApp para asesorarte!"
    },
    {
      icon: <ShieldCheck className="w-6 h-6" />,
      title: "2. Confirmá tu compra",
      description: "Revisá que los productos en tu carrito sean los correctos e ingresá tus datos de contacto. Asegurate de que tu email esté bien escrito para recibir el seguimiento de tu pedido."
    },
    {
      icon: <Truck className="w-6 h-6" />,
      title: "3. Elegí el método de envío",
      description: "Hacemos envíos a todo el país. Ingresá tu código postal para ver los costos y tiempos estimados. Si estás en Córdoba, también podés elegir 'Retiro por local'."
    },
    {
      icon: <CreditCard className="w-6 h-6" />,
      title: "4. Medio de pago",
      description: "Podés pagar con tarjeta de crédito (tenemos cuotas sin interés) o elegir la opción de transferencia bancaria para acceder a descuentos especiales en efectivo."
    }
  ];

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 pb-20">
      <StorefrontNavbar theme="light" />
      
      <div className="bg-primary/5 py-16 lg:py-24 border-b border-primary/10 pt-32">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl lg:text-5xl font-black text-stone-900 dark:text-white tracking-tight mb-6">
            Cómo <span className="text-primary italic">Comprar</span>
          </h1>
          <p className="text-xl text-stone-600 dark:text-stone-400 max-w-2xl mx-auto leading-relaxed">
            Comprar tus anteojos online es rápido, fácil y 100% seguro. Te explicamos paso a paso.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          {steps.map((step, index) => (
            <div key={index} className="bg-white dark:bg-stone-900 rounded-3xl p-8 border border-stone-200 dark:border-stone-800 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-6">
                {step.icon}
              </div>
              <h3 className="text-xl font-bold text-stone-900 dark:text-white mb-3">{step.title}</h3>
              <p className="text-stone-600 dark:text-stone-400 leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>

        <section className="bg-stone-900 dark:bg-stone-800 rounded-3xl p-8 lg:p-12 text-center text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent" />
          <div className="relative z-10">
            <h2 className="text-3xl font-black mb-4">¿Tenés dudas con tu receta?</h2>
            <p className="text-stone-300 max-w-2xl mx-auto mb-8 text-lg">
              Si necesitás encargar cristales graduados o multifocales, la mejor manera es contactarnos directamente. Nuestro equipo de ópticos revisará tu receta oftalmológica y te recomendará el mejor lente para tu caso.
            </p>
            <a 
              href="https://wa.me/5493541215971"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-primary text-white font-bold py-4 px-8 rounded-full hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25"
            >
              Consultar por WhatsApp
            </a>
          </div>
        </section>

      </div>

      <StorefrontFooter />
      <FloatingWhatsApp />
    </div>
  );
}
