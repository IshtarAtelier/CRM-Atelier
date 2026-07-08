import { Metadata } from 'next';
import { StorefrontNavbar } from '@/components/Storefront/StorefrontNavbar';
import { StorefrontFooter } from '@/components/Storefront/StorefrontFooter';
import { WHATSAPP_PHONE } from '@/lib/constants';

export const metadata: Metadata = {
  alternates: { canonical: 'https://atelieroptica.com.ar/blog/materiales-armazones-acetato-tr90' },
  title: { absolute: "Acetato Italiano vs Metal vs Inyectado: ¿Cuál dura más? | Óptica en Córdoba" },
  description: "Descubrí las diferencias entre anteojos de acetato, metal e inyectado. Analizamos durabilidad, estética y alergias. Tu óptica en Córdoba (Nueva Córdoba, Cerro de las Rosas). Envíos a todo el país.",
  keywords: ["óptica en Córdoba", "armazones acetato italiano", "anteojos de metal", "armazones inyectados TR90", "Nueva Córdoba", "Cerro de las Rosas", "anteojos de receta Córdoba", "lentes hipoalergénicos"],
};

export default function MaterialesArmazonesPage() {
  return (
    <div className="min-h-screen bg-[#faf8f5] text-black font-sans selection:bg-black selection:text-white pb-20">
      <StorefrontNavbar theme="light" />

      <main className="max-w-3xl mx-auto px-6 pt-32 lg:pt-40">
        <article>
          <header className="mb-12 lg:mb-16 text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#999] mb-4">Guía de Materiales</p>
            <h1 className="text-3xl lg:text-5xl font-normal tracking-tight mb-6 lg:mb-8 leading-tight">
              Acetato Italiano vs Metal vs Inyectado: ¿Cuál armazón dura más?
            </h1>
            <p className="text-[14px] lg:text-[15px] text-[#666] leading-relaxed max-w-2xl mx-auto">
              Elegir el anteojo perfecto va mucho más allá de la moda. Descubrí cómo responde cada material frente al uso diario, cuál es ideal para tu tipo de piel y cuál se adapta mejor a la receta de tu médico oftalmólogo.
            </p>
          </header>

          <div className="space-y-12 lg:space-y-16 text-[15px] leading-relaxed text-gray-800">
            
            <section>
              <p className="mb-6">
                ¡Hola! Somos el equipo de <strong>Atelier Óptica</strong>, tu óptica boutique de confianza en <strong>Córdoba</strong>. Un escenario súper frecuente en nuestro local es cuando llegás con la receta en mano, después de haber visitado a tu <strong>médico oftalmólogo</strong> (¡ese control anual es innegociable!). Una vez que definimos qué cristales necesitás, surge la pregunta del millón: <em>&quot;¿Qué armazón me conviene llevar?&quot;</em>
              </p>
              <p className="mb-6">
                Para que tus próximos anteojos te acompañen intactos en tu rutina diaria (ya sea caminando por <strong>Nueva Córdoba</strong> o disfrutando un café en el <strong>Cerro de las Rosas</strong>), hoy desglosamos los tres materiales más elegidos: el acetato italiano, el metal y el inyectado (como el famoso TR90). Evaluaremos tres pilares fundamentales: <strong>durabilidad, estética y alergias</strong>.
              </p>
            </section>

            <section className="border-t border-black/10 pt-12">
              <h2 className="text-2xl font-medium mb-6">1. Acetato Italiano (Acetato de Celulosa)</h2>
              <p className="mb-6">
                El acetato es el monarca absoluto de la óptica prémium. No es un plástico industrial; proviene de fibras naturales como el algodón y la madera, dándole propiedades excepcionales y un acabado único.
              </p>
              <ul className="list-disc pl-5 space-y-4 mb-6">
                <li>
                  <strong>Durabilidad:</strong> Altísima con el cuidado adecuado. Lo más fascinante del acetato para nosotros, los ópticos, es que resulta <em>termomoldeable</em>. Si te sentás sobre tus lentes por accidente, la mayoría de las veces podemos aplicar calor en nuestro taller y devolverles su forma perfecta para que calce a la perfección.
                </li>
                <li>
                  <strong>Estética:</strong> Inigualable. Posee un brillo natural y permite acabados pulidos a mano que lucen increíblemente sofisticados. Además, logra tramas de colores profundas (como los codiciados diseños carey o habana) imposibles de imitar con otros materiales.
                </li>
                <li>
                  <strong>Alergias:</strong> Gracias a su origen vegetal, es un material <strong>100% hipoalergénico</strong>. Es la opción número uno si tenés piel sensible y querés evitar rojeces o irritaciones cutáneas.
                </li>
              </ul>
            </section>

            <section className="border-t border-black/10 pt-12">
              <h2 className="text-2xl font-medium mb-6">2. Metal (Monel, Acero Quirúrgico y Titanio)</h2>
              <p className="mb-6">
                Los armazones metálicos son un clásico que nunca falla. Abarcan desde los icónicos diseños redondos retro hasta las discretas monturas al aire que resultan casi imperceptibles en el rostro.
              </p>
              <ul className="list-disc pl-5 space-y-4 mb-6">
                <li>
                  <strong>Durabilidad:</strong> Excelente. Su resistencia depende de la aleación elegida. El titanio es, sin dudas, el campeón invicto: es irrompible, ultraliviano e inmune a la corrosión del sudor. A diferencia del acetato, el metal utiliza plaquetas nasales, lo que nos permite ajustar el anteojo al milímetro sobre el puente de tu nariz.
                </li>
                <li>
                  <strong>Estética:</strong> Minimalista, súper ligera y elegante. Despejan la mirada y aportan un estilo sutil, limpio y distinguido.
                </li>
                <li>
                  <strong>Alergias:</strong> ¡Atención acá! Si sabés que tenés alergia al níquel, debés evitar las aleaciones básicas. En Atelier Óptica siempre te recomendaremos ir a lo seguro con acero quirúrgico o titanio puro, que son completamente seguros para tu piel.
                </li>
              </ul>
            </section>

            <section className="border-t border-black/10 pt-12">
              <h2 className="text-2xl font-medium mb-6">3. Inyectado (TR90, Grilamid y Plásticos Flexibles)</h2>
              <p className="mb-6">
                Fabricados mediante moldes inyectados, son los reyes indiscutidos de los anteojos deportivos y el <em>street style</em> urbano gracias a su extrema flexibilidad.
              </p>
              <ul className="list-disc pl-5 space-y-4 mb-6">
                <li>
                  <strong>Durabilidad:</strong> Brutalmente resistentes a los impactos. El TR90, por ejemplo, tiene &quot;memoria&quot;: podés doblarlo y recupera su forma original al instante. Sin embargo, ¡dato clave!, no se pueden moldear con calor como el acetato. Si las patillas te aprietan detrás de las orejas, el margen de ajuste manual que tenemos los ópticos es bastante menor.
                </li>
                <li>
                  <strong>Estética:</strong> Vibrante y descontracturada. Ofrecen colores intensos, terminaciones mate y mucha versatilidad en diseños envolventes. Aunque no tienen el lujo del acetato, ganan por goleada en comodidad y estilo relajado.
                </li>
                <li>
                  <strong>Alergias:</strong> Al ser polímeros de alta tecnología libres de metales expuestos, resultan altamente hipoalergénicos e ideales para todo tipo de usuarios.
                </li>
              </ul>
            </section>

            <section className="border-t border-black/10 pt-12 bg-gray-50 p-8 rounded-lg">
              <h2 className="text-xl font-medium mb-4">Nuestra sugerencia como ópticos expertos en Córdoba</h2>
              <p className="mb-4">
                Entonces, <strong>¿cuál material dura más?</strong> La respuesta está en tu estilo de vida. Si buscás una pieza noble, eterna y llena de personalidad, el acetato italiano es un viaje de ida. Si priorizás que tus lentes no pesen absolutamente nada, el titanio es la mejor inversión. Y si sos de los que dejan los anteojos sueltos en el auto o hacés deporte al aire libre por las sierras cordobesas, un inyectado flexible te va a salvar de cualquier apuro.
              </p>
              <p className="mb-4 text-sm text-gray-500 italic">
                Recordá que <strong>en la óptica no diagnosticamos patologías ni recetamos graduaciones</strong>. Nunca prometemos curar afecciones visuales. Tu primer paso irremplazable para cuidar tu salud visual es visitar a tu médico oftalmólogo. Una vez que tengas tu receta, ¡te esperamos en Atelier Óptica! Nos encargamos de brindarte el mejor asesoramiento técnico y estético para adaptar esos cristales al armazón perfecto.
              </p>
            </section>

          </div>

          <div className="mt-16 lg:mt-20 p-8 lg:p-12 border border-black text-center">
            <h3 className="text-xl font-medium mb-3">¿Ya tenés tu receta oftalmológica?</h3>
            <p className="text-[14px] text-[#666] mb-8 max-w-md mx-auto">
              Escribinos por WhatsApp, pasanos una foto de la receta de tu oftalmólogo y recibí nuestro asesoramiento exclusivo. Atendemos en Córdoba y hacemos envíos a toda Argentina.
            </p>
            <a href={`https://wa.me/${WHATSAPP_PHONE}`} target="_blank" rel="noopener noreferrer" className="inline-block bg-black text-white px-8 py-4 text-[11px] font-bold uppercase tracking-widest hover:opacity-70 transition-all duration-300 transition-opacity">
              Asesoramiento por WhatsApp
            </a>
          </div>

        </article>
      </main>

      <StorefrontFooter />
    </div>
  );
}