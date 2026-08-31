import { Metadata } from 'next';
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { StorefrontFooter } from "@/components/Storefront/StorefrontFooter";
import { Lock, Heart, ShieldAlert, Bot } from 'lucide-react';
import { WHATSAPP_PHONE, WHATSAPP_PHONE_DISPLAY } from '@/lib/constants';

export const metadata: Metadata = {
  title: "Políticas de Privacidad",
  description: "Cómo tratamos tus datos personales, de pago y tus recetas oftalmológicas en Atelier Óptica, y cómo usamos inteligencia artificial para atenderte por WhatsApp.",
  alternates: { canonical: 'https://atelieroptica.com.ar/politicas-de-privacidad' },
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
                Puertas adentro de Atelier, esas recetas y los datos que contienen se tratan de manera
                confidencial: las consultan nuestro Director Técnico Óptico y el personal de laboratorio
                autorizado, para la confección y el calibrado de los lentes recetados. No las usamos con
                fines publicitarios ni se las vendemos a nadie.
              </p>
              <p>
                Fuera de Atelier tienen dos destinos, y preferimos que los sepas antes de mandarnos nada:
                el laboratorio óptico que fabrica tus cristales, y —si nos escribís por WhatsApp— el
                servicio de inteligencia artificial con el que atendemos ese canal. Eso último te lo
                explicamos en detalle en el punto que sigue.
              </p>
            </div>
          </section>

          <section className="bg-white dark:bg-stone-900 rounded-3xl p-8 lg:p-10 border border-stone-200 dark:border-stone-800 shadow-sm">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary flex-shrink-0">
                <Bot className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-stone-900 dark:text-white">3. Atención por WhatsApp e Inteligencia Artificial</h2>
            </div>
            <div className="space-y-4">
              <p>
                Para atender las consultas que llegan por WhatsApp usamos servicios de{' '}
                <strong>inteligencia artificial de terceros</strong> (hoy, los modelos de Google). En
                criollo: el contenido de esa conversación —los mensajes de texto y también las imágenes
                que nos mandás— se envía a los servidores de ese proveedor, que es quien los interpreta y
                nos ayuda a redactar la respuesta o a ordenar los datos de la charla.
              </p>
              <p>
                Cuando nos mandás la <strong>foto de una receta</strong>, esa imagen recorre el mismo
                camino: se envía al proveedor de inteligencia artificial, una vez para reconocer que
                efectivamente es una receta y otra como parte del historial de la conversación. Una receta
                suele traer el nombre del paciente, la graduación de cada ojo y, según el caso, la obra
                social, el DNI y la firma del profesional que la emitió. Son{' '}
                <strong>datos de salud</strong>, y así los consideramos.
              </p>
              <p>
                A ese proveedor le pedimos lo que necesitamos para responderte y nada más; no lo
                autorizamos a ningún otro uso. Lo que no podemos decirte es que tu receta nunca sale de
                nuestros sistemas, porque no sería cierto.
              </p>
              <p>
                Si preferís que tus datos no pasen por ahí, tenés dos caminos sin inteligencia artificial
                de por medio: acercarte al local, o escribirnos a{' '}
                <a href="mailto:ventas@atelieroptica.com.ar" className="text-primary font-semibold hover:underline">
                  ventas@atelieroptica.com.ar
                </a>
                , donde te contesta una persona del equipo. Y en cualquier momento podés pedirnos que
                borremos lo que ya nos mandaste: cómo hacerlo está en los puntos 4 y 5.
              </p>
            </div>
          </section>

          <section className="bg-white dark:bg-stone-900 rounded-3xl p-8 lg:p-10 border border-stone-200 dark:border-stone-800 shadow-sm">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary flex-shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-stone-900 dark:text-white">4. Derechos del Titular de los Datos</h2>
            </div>
            <div className="space-y-4">
              <p>
                Como titular de tus datos tenés derecho a <strong>acceder</strong> a ellos,{' '}
                <strong>rectificarlos</strong> si algo está mal y pedir que los{' '}
                <strong>suprimamos</strong>. Vale para todo lo que tengamos: tu ficha, tus compras, tus
                recetas y las conversaciones de WhatsApp.
              </p>
              <p>
                Se ejerce escribiendo a{' '}
                <a href="mailto:ventas@atelieroptica.com.ar" className="text-primary font-semibold hover:underline">
                  ventas@atelieroptica.com.ar
                </a>{' '}
                o por WhatsApp al{' '}
                <a
                  href={`https://wa.me/${WHATSAPP_PHONE}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary font-semibold hover:underline"
                >
                  {WHATSAPP_PHONE_DISPLAY}
                </a>
                , indicando tu nombre completo y el teléfono o email con el que nos contactaste. En el
                punto 5 está el detalle de cómo funciona la eliminación y qué documentación estamos
                obligados a conservar.
              </p>
              <p className="text-sm text-stone-500 dark:text-stone-400">
                La Agencia de Acceso a la Información Pública, en su carácter de órgano de control de la
                Ley Nº 25.326, atiende las denuncias y reclamos de quienes vean afectados sus derechos
                por incumplimiento de las normas de protección de datos personales.
              </p>
            </div>
          </section>

          {/*
            Sección de eliminación de datos, con id propio.

            El id `eliminacion-de-datos` es la URL que Meta exige al crear una app
            (https://atelieroptica.com.ar/politicas-de-privacidad#eliminacion-de-datos).
            Meta no valida que el ancla exista, pero es lo que ve una persona que
            viene a reclamar sus datos: si el id no está, la página abre arriba de
            todo y no encuentra nada.

            Si se renombra esta sección, hay que actualizar la URL en la
            configuración de la app de Meta.
          */}
          <section
            id="eliminacion-de-datos"
            className="bg-white dark:bg-stone-900 rounded-3xl p-8 lg:p-10 border border-stone-200 dark:border-stone-800 shadow-sm scroll-mt-28"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary flex-shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-stone-900 dark:text-white">5. Cómo eliminar tus datos</h2>
            </div>
            <div className="space-y-4">
              <p>
                Si querés que borremos la información que tenemos sobre vos, escribinos a{' '}
                <a href="mailto:ventas@atelieroptica.com.ar" className="text-primary font-semibold hover:underline">
                  ventas@atelieroptica.com.ar
                </a>{' '}
                o por WhatsApp al{' '}
                <a
                  href={`https://wa.me/${WHATSAPP_PHONE}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary font-semibold hover:underline"
                >
                  {WHATSAPP_PHONE_DISPLAY}
                </a>
                , indicando tu nombre completo y el teléfono o email con el que nos contactaste.
              </p>
              <p>
                Resolvemos el pedido dentro de los <strong>10 días hábiles</strong> y te confirmamos
                por el mismo medio cuando esté hecho. Se elimina tu ficha, tus datos de contacto y el
                historial de conversaciones.
              </p>
              <p>
                Hay una excepción que la ley nos obliga a mantener: los{' '}
                <strong>comprobantes fiscales</strong> de compras ya realizadas y las{' '}
                <strong>recetas oftalmológicas</strong> asociadas a un pedido confeccionado. Son
                documentación respaldatoria que debemos conservar por los plazos legales. Todo lo
                demás se borra.
              </p>
              <p className="text-sm text-stone-500 dark:text-stone-400">
                Si nos escribiste solo por WhatsApp y nunca compraste, tu eliminación es completa y
                sin excepciones.
              </p>
              <p className="text-sm text-stone-500 dark:text-stone-400">
                Un límite honesto: borramos lo que está en nuestros sistemas y dejamos de enviarle tus
                datos al servicio de inteligencia artificial del punto 3, pero lo que ese proveedor ya
                procesó se rige por sus propias políticas y no está bajo nuestro control.
              </p>
            </div>
          </section>

          <p className="text-sm text-stone-500 dark:text-stone-400 text-center">
            Última actualización: 31/08/2026
          </p>

        </div>
      </main>

      <StorefrontFooter />
      
    </div>
  );
}
