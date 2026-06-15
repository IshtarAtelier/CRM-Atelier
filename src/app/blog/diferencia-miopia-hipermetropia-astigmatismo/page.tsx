import { Metadata } from 'next';
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { StorefrontFooter } from "@/components/Storefront/StorefrontFooter";
import { WHATSAPP_PHONE } from '@/lib/constants';




export const metadata: Metadata = {
  title: "diferencia miopia hipermetropia astigmatismo | Atelier Óptica",
  description: "Descubrí todo sobre diferencia miopia hipermetropia astigmatismo en Atelier Óptica. Envíos a toda Argentina, cuotas sin interés y atención personalizada.",
  keywords: ["óptica Argentina", "envíos a toda Argentina", "cuotas", "atención personalizada", "anteojos de receta", "diferencia miopia hipermetropia astigmatismo"],
};

export default function MiopiaHipermetropiaAstigmatismoBlog() {
  return (
    <div className="min-h-screen flex flex-col bg-stone-50">
      <StorefrontNavbar />
      
      <main className="flex-grow container mx-auto px-4 py-12 max-w-3xl">
        <article className="prose prose-stone lg:prose-lg mx-auto">
          <header className="mb-10">
            <h1 className="text-4xl font-medium tracking-tight text-stone-800 mb-4">
              ¿Miopía, Hipermetropía o Astigmatismo? Entendiendo tu Receta
            </h1>
            <p className="text-stone-500 text-sm">Por Atelier Óptica - Córdoba, Argentina</p>
          </header>

          <div className="space-y-6 text-stone-700">
            <p>
              Seguro alguna vez saliste del consultorio del médico oftalmólogo, miraste la receta que te dio y pensaste: <em>"¿Qué significan todos estos números y palabras?"</em>. Como ópticos, en <strong>Atelier Óptica</strong> recibimos esas recetas todos los días y nuestro trabajo principal es interpretarlas para armar el anteojo ideal para vos.
            </p>
            <p>
              Es importante aclarar que los anteojos no &quot;curan&quot; ninguna condición, sino que compensan ópticamente el recorrido de la luz para que veas bien. Hoy queremos explicarte de forma sencilla, y desde nuestra perspectiva en el mostrador, de qué se tratan las tres condiciones más comunes que vemos en las recetas: la miopía, la hipermetropía y el astigmatismo.
            </p>

            <h2 className="text-2xl font-semibold text-stone-800 mt-8 mb-4">
              1. Miopía: Cuando lo lejos se ve borroso
            </h2>
            <p>
              La miopía es, probablemente, la condición de la que más escuchamos hablar. Las personas con miopía suelen ver muy bien de cerca (como cuando leen un libro o miran el celular), pero todo lo que está lejos se vuelve borroso. 
            </p>
            <p>
              Físicamente, esto sucede porque el ojo es un poquito más largo de lo habitual, lo que hace que la luz enfoque <em>antes</em> de llegar a la retina. En tu receta, el oftalmólogo lo va a indicar con números negativos (por ejemplo, -2.00). 
            </p>
            <p>
              <strong>¿Cómo lo resolvemos en la óptica?</strong> Una vez que nos traés la receta, usamos cristales divergentes o &quot;negativos&quot;. Estos cristales son más gruesos en los bordes y más finos en el centro. Dependiendo de la graduación, te vamos a asesorar sobre qué tipo de armazón conviene más para que el cristal quede estético, liviano y bien contenido.
            </p>

            <h2 className="text-2xl font-semibold text-stone-800 mt-8 mb-4">
              2. Hipermetropía: El esfuerzo extra para enfocar
            </h2>
            <p>
              La hipermetropía tiene la particularidad de requerir un esfuerzo extra para enfocar de cerca, y en graduaciones más altas, también puede afectar la visión de lejos. Sucede porque el ojo es apenas más corto de lo normal, intentando enfocar la luz <em>detrás</em> de la retina.
            </p>
            <p>
              En la receta médica, lo vas a notar porque el profesional indica números positivos (por ejemplo, +1.50).
            </p>
            <p>
              <strong>Desde el mostrador de Atelier:</strong> Para la hipermetropía utilizamos cristales convergentes o &quot;positivos&quot;, que son más gruesos en el centro y más finos en los bordes. Como expertos, te vamos a ayudar a elegir armazones que sostengan bien este diseño y optimizarlos con materiales de alto índice o asféricos para que te sientas súper cómodo.
            </p>

            <h2 className="text-2xl font-semibold text-stone-800 mt-8 mb-4">
              3. Astigmatismo: Una cuestión de formas
            </h2>
            <p>
              El astigmatismo es súper común. Ocurre cuando la córnea no es perfectamente redonda, sino que tiene una curva un poco más ovalada. Esto genera que las imágenes se vean algo distorsionadas, alargadas o con &quot;sombras&quot;, sin importar la distancia. 
            </p>
            <p>
              En tu receta oftalmológica, se anota en la columna de &quot;Cilindro&quot; (CIL) y siempre va acompañado de un &quot;Eje&quot;. El eje es un valor (entre 0 y 180 grados) que nos indica a los ópticos la posición exacta en la que debemos montar y tallar tu cristal para compensar esa forma irregular del ojo.
            </p>

            <h2 className="text-2xl font-semibold text-stone-800 mt-8 mb-4">
              El primer paso siempre es tu médico oftalmólogo
            </h2>
            <p>
              Nos encanta ayudarte a ver mejor y con estilo, pero es fundamental recordar que en <strong>Atelier Óptica no medimos la vista ni diagnosticamos patologías</strong>. Esa no es nuestra especialidad, y legalmente no nos corresponde. Diagnosticar condiciones como cataratas o glaucoma, y recetar tu graduación, es tarea exclusiva de tu <strong>médico oftalmólogo</strong>. Siempre te recomendamos visitarlo anualmente para un control completo de tu salud visual.
            </p>
            <p>
              Una vez que el médico te entregue tu receta oftalmológica, ¡ahí sí entramos nosotros! Te esperamos en nuestro local para interpretar esos valores y brindarte todo nuestro asesoramiento técnico sobre cristales, tratamientos (como el antirreflex o los filtros de protección) y armazones.
            </p>
            <p className="font-semibold text-stone-800 mt-6">
              ¿Ya fuiste al oftalmólogo y tenés tu receta lista? Vení a visitarnos y buscamos el anteojo perfecto para vos.
            </p>
          </div>
        
          {/* CTA WHATSAPP AUTOMÁTICO */}
          <div className="mt-16 bg-black/5 p-8 md:p-12 rounded-2xl text-center border border-black/10">
            <h3 className="text-2xl font-medium tracking-tight mb-4">¿Necesitás asesoramiento personalizado?</h3>
            <p className="text-black/70 mb-8 max-w-xl mx-auto">
              Comunicate directamente con nuestro equipo de ópticos por WhatsApp. Estamos para ayudarte a encontrar el cristal y armazón perfecto según tu receta oftalmológica.
            </p>
            <a 
              href={`https://wa.me/${WHATSAPP_PHONE}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center bg-[#25D366] text-white px-8 py-4 rounded-full font-bold uppercase tracking-widest hover:bg-[#1ebe57] transition-all hover:scale-105"
            >
              Consultar por WhatsApp
            </a>
          </div>

        </article>
      </main>

      <StorefrontFooter />
    </div>
  );
}
