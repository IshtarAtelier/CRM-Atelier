import { Metadata } from 'next';
import { StorefrontNavbar } from '@/components/Storefront/StorefrontNavbar';
import { StorefrontFooter } from '@/components/Storefront/StorefrontFooter';
import { WHATSAPP_PHONE } from '@/lib/constants';

export const metadata: Metadata = {
  alternates: { canonical: '/blog/materiales-armazones-acetato-tr90' },
  title: "Acetato Italiano vs Metal vs Inyectado: ¿Cuál dura más?",
  description: "Descubrí las diferencias entre armazones de acetato, metal e inyectado. Analizamos la durabilidad, estética y si causan alergias. Asesoramiento óptico en Córdoba. Envíos a toda Argentina. Cuotas sin interés. Atención personalizada y asesoramiento estético.",
  keywords: ["óptica Argentina", "envíos a toda Argentina", "cuotas", "atención personalizada", "anteojos de receta", "materiales armazones acetato tr90"],
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
              Acetato Italiano vs Metal vs Inyectado: ¿Cuál dura más?
            </h1>
            <p className="text-[14px] lg:text-[15px] text-[#666] leading-relaxed max-w-2xl mx-auto">
              Elegir el armazón perfecto va más allá de la moda. Conocé cómo responde cada material frente al uso diario, si es apto para tu tipo de piel y cuál se adapta mejor a la receta que te dio tu oftalmólogo.
            </p>
          </header>

          <div className="space-y-12 lg:space-y-16 text-[15px] leading-relaxed text-gray-800">
            
            <section>
              <p className="mb-6">
                Hola, somos del equipo de <strong>Atelier Óptica</strong>. Un escenario muy común en el local es cuando llegás con la receta después de haber visitado a tu <strong>médico oftalmólogo</strong> (¡ese control anual es fundamental, no te cuelgues!). Y una vez que tenemos claro qué cristales necesitás, surge la gran pregunta: <em>“¿Qué armazón me conviene llevar?”</em>
              </p>
              <p className="mb-6">
                Para que tus próximos anteojos te acompañen de la mejor manera, hoy vamos a desglosar los tres materiales más populares en el mundo de la óptica: el acetato italiano, el metal y el inyectado (como el TR90). Analizaremos tres puntos clave: <strong>durabilidad, estética y alergias</strong>.
              </p>
            </section>

            <section className="border-t border-black/10 pt-12">
              <h2 className="text-2xl font-medium mb-6">1. Acetato Italiano (Acetato de Celulosa)</h2>
              <p className="mb-6">
                El acetato es el rey de la óptica premium. No es un plástico común, sino que proviene de fibras naturales como el algodón y la madera, lo que le otorga características únicas.
              </p>
              <ul className="list-disc pl-5 space-y-4 mb-6">
                <li>
                  <strong>Durabilidad:</strong> Altísima si se cuida correctamente. Lo mejor que tiene el acetato para nosotros, los ópticos, es que es <em>termomoldeable</em>. Si un día te sentás arriba de los anteojos sin querer, muchas veces podemos calentarlos en la óptica y devolverles su forma original para que te calcen perfectos otra vez.
                </li>
                <li>
                  <strong>Estética:</strong> Insuperable. Tiene un brillo natural, un pulido a mano que lo hace lucir muy fino y permite combinaciones de colores (los famosos diseños carey o habana) que otros materiales no logran conseguir con la misma profundidad.
                </li>
                <li>
                  <strong>Alergias:</strong> Al ser de origen vegetal, es un material hipoalergénico. Es ideal si tenés piel sensible y querés evitar cualquier reacción cutánea.
                </li>
              </ul>
            </section>

            <section className="border-t border-black/10 pt-12">
              <h2 className="text-2xl font-medium mb-6">2. Metal (Monel, Acero Quirúrgico y Titanio)</h2>
              <p className="mb-6">
                Los armazones de metal son un clásico atemporal. Desde los icónicos diseños redondos onda retro hasta armazones al aire súper discretos.
              </p>
              <ul className="list-disc pl-5 space-y-4 mb-6">
                <li>
                  <strong>Durabilidad:</strong> Excelente. Resisten muchísimo, aunque el nivel de resistencia varía según la aleación. El titanio es el campeón absoluto: es súper fuerte, ultra liviano y resistente a la corrosión del sudor. A diferencia del acetato, el metal requiere de plaquetas nasales para sostenerse, lo que nos permite a los ópticos ajustarlas al milímetro sobre el puente de tu nariz.
                </li>
                <li>
                  <strong>Estética:</strong> Minimalista, ligera y elegante. Aportan una mirada más despejada y clásica.
                </li>
                <li>
                  <strong>Alergias:</strong> Acá hay que prestar atención. Si sabés que sos alérgico al níquel, alejate de las aleaciones metálicas básicas. En ese caso, siempre te vamos a recomendar buscar materiales específicos como el acero quirúrgico o el titanio puro, que son 100% hipoalergénicos.
                </li>
              </ul>
            </section>

            <section className="border-t border-black/10 pt-12">
              <h2 className="text-2xl font-medium mb-6">3. Inyectado (TR90, Grilamid y Plásticos Flexibles)</h2>
              <p className="mb-6">
                Estos son los armazones fabricados a partir de moldes inyectados. Son los reyes indiscutidos de los anteojos deportivos y la moda casual urbana.
              </p>
              <ul className="list-disc pl-5 space-y-4 mb-6">
                <li>
                  <strong>Durabilidad:</strong> Extremadamente resistentes a los impactos y flexiones. Los materiales como el TR90 tienen &quot;memoria&quot;, por lo que podés doblarlos y vuelven a su posición inicial. Pero ¡ojo!, a diferencia del acetato, no se pueden moldear con calor. Si la patilla te aprieta detrás de la oreja, el margen de ajuste manual que tenemos en la óptica es mucho menor.
                </li>
                <li>
                  <strong>Estética:</strong> Colores vibrantes, terminaciones mate y mucha versatilidad en diseños envolventes. Carecen de ese brillo lujoso del acetato, pero lo compensan con una onda más descontracturada y moderna.
                </li>
                <li>
                  <strong>Alergias:</strong> Son plásticos de alta tecnología sin metales expuestos, lo que los vuelve muy seguros e hipoalergénicos para todo tipo de pieles.
                </li>
              </ul>
            </section>

            <section className="border-t border-black/10 pt-12 bg-gray-50 p-8 rounded-lg">
              <h2 className="text-xl font-medium mb-4">Nuestra sugerencia como ópticos</h2>
              <p className="mb-4">
                Entonces, <strong>¿cuál dura más?</strong> La respuesta depende de tu día a día. Si querés un material noble, para toda la vida y con mucho estilo, el acetato es un viaje de ida. Si buscás que los anteojos no te pesen nada en la cara, el titanio es la inversión correcta. Y si sos de dejar los anteojos tirados por cualquier lado o los usás para hacer deporte, un inyectado flexible te va a salvar las papas más de una vez.
              </p>
              <p className="mb-4 text-sm text-gray-500 italic">
                Recordá que <strong>en la óptica no diagnosticamos patologías ni recetamos aumentos</strong>. Nunca te vamos a prometer curar ninguna condición visual. Tu primer paso, indispensable para cuidar tu salud visual, es siempre visitar a tu médico oftalmólogo. Una vez que te dé tu receta, ¡te esperamos en Atelier Óptica! Acá nos encargamos de asesorarte técnicamente sobre tus cristales y de adaptar esa receta al mejor armazón para vos.
              </p>
            </section>

          </div>

          <div className="mt-16 lg:mt-20 p-8 lg:p-12 border border-black text-center">
            <h3 className="text-xl font-medium mb-3">¿Ya tenés tu receta oftalmológica?</h3>
            <p className="text-[14px] text-[#666] mb-8 max-w-md mx-auto">
              Escribinos por WhatsApp, envianos la foto de la receta que te dio el oftalmólogo y te asesoramos de forma personalizada.
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
