import { Metadata } from 'next';
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { StorefrontFooter } from "@/components/Storefront/StorefrontFooter";
import { WHATSAPP_PHONE } from '@/lib/constants';

export const metadata: Metadata = {
  alternates: { canonical: '/blog/diferencia-miopia-hipermetropia-astigmatismo' },
  title: "Diferencia entre Miopía, Hipermetropía y Astigmatismo | Atelier Óptica",
  description: "Descubrí la diferencia entre miopía, hipermetropía y astigmatismo. Interpretá tu receta oftalmológica con Atelier Óptica en Córdoba. Asesoramiento experto.",
  keywords: ["diferencia miopía hipermetropía astigmatismo", "anteojos de receta Córdoba", "óptica Cerro de las Rosas", "óptica Nueva Córdoba", "interpretar receta oftalmológica", "cristales divergentes", "cristales convergentes", "astigmatismo cilindro y eje", "Atelier Óptica"],
};

export default function MiopiaHipermetropiaAstigmatismoBlog() {
  return (
    <div className="min-h-screen flex flex-col bg-stone-50">
      <StorefrontNavbar />
      
      <main className="flex-grow container mx-auto px-4 py-12 max-w-3xl">
        <article className="prose prose-stone lg:prose-lg mx-auto">
          <header className="mb-10">
            <h1 className="text-4xl font-medium tracking-tight text-stone-800 mb-4">
              ¿Miopía, Hipermetropía o Astigmatismo? Entendiendo tu Receta Oftalmológica
            </h1>
            <p className="text-stone-500 text-sm">Por Atelier Óptica - Córdoba, Argentina</p>
          </header>

          <div className="space-y-6 text-stone-700">
            <p>
              Seguro alguna vez saliste del consultorio del médico oftalmólogo, miraste la receta que te dio y pensaste: <em>&quot;¿Qué significan todos estos números, signos y palabras?&quot;</em>. Como ópticos contactólogos en <strong>Atelier Óptica</strong>, recibimos estas prescripciones todos los días desde distintos puntos de <strong>Córdoba</strong>, como el <strong>Cerro de las Rosas</strong> y <strong>Nueva Córdoba</strong>. Nuestro principal compromiso es interpretar con exactitud técnica esa información para armar el anteojo ideal para vos.
            </p>
            <p>
              Es clave aclarar que los anteojos no &quot;curan&quot; una condición visual, sino que compensan ópticamente el recorrido de la luz para que disfrutes de una visión perfecta. Hoy queremos explicarte de forma sencilla —y desde nuestra perspectiva experta en el mostrador— de qué se tratan las tres ametropías más comunes que vemos en las recetas: la miopía, la hipermetropía y el astigmatismo.
            </p>

            <h2 className="text-2xl font-semibold text-stone-800 mt-8 mb-4">
              1. Miopía: Cuando el mundo de lejos se vuelve borroso
            </h2>
            <p>
              La miopía es, sin dudas, el defecto visual más recurrente. Quienes tienen miopía suelen ver impecable de cerca (ideal para leer un buen libro o mirar el celular), pero todo lo que está a distancia pierde nitidez.
            </p>
            <p>
              ¿Por qué pasa esto? Físicamente, ocurre porque el globo ocular es levemente más largo de lo habitual. Esto provoca que la luz enfoque <em>antes</em> de llegar a la retina. En tu receta médica, el oftalmólogo lo va a indicar con <strong>números negativos</strong> (por ejemplo, -2.00 en la columna de Esfera).
            </p>
            <p>
              <strong>¿Cómo lo resolvemos en la óptica?</strong> Una vez que nos acercás tu receta, utilizamos cristales divergentes o &quot;negativos&quot;. Estos cristales son más gruesos en los bordes y más finos en el centro. Dependiendo de tu graduación, nuestro equipo te va a asesorar sobre qué tipo de armazón conviene más para que el lente quede estético, súper liviano y con los bordes bien contenidos.
            </p>

            <h2 className="text-2xl font-semibold text-stone-800 mt-8 mb-4">
              2. Hipermetropía: El esfuerzo constante para enfocar
            </h2>
            <p>
              La hipermetropía tiene una particularidad: exige un esfuerzo extra para enfocar de cerca y, en graduaciones más altas, también termina afectando la visión lejana. Esto sucede porque el ojo es apenas más corto de lo normal, intentando enfocar la luz <em>detrás</em> de la retina, lo que suele causar fatiga visual al final del día.
            </p>
            <p>
              En la receta oftalmológica, lo vas a identificar fácilmente porque el profesional indica <strong>números positivos</strong> (por ejemplo, +1.50).
            </p>
            <p>
              <strong>Desde el mostrador de Atelier:</strong> Para corregir la hipermetropía empleamos cristales convergentes (positivos), que se caracterizan por ser más gruesos en el centro y finos en los bordes. Como especialistas, te ayudaremos a elegir armazones que armonicen con este diseño, optimizando los cristales con materiales de alto índice o tallado asférico para garantizarte máxima comodidad y una estética insuperable, sin el temido efecto de &quot;ojo de lupa&quot;.
            </p>

            <h2 className="text-2xl font-semibold text-stone-800 mt-8 mb-4">
              3. Astigmatismo: Una cuestión de curvas y formas
            </h2>
            <p>
              El astigmatismo es extremadamente común y suele acompañar a la miopía o a la hipermetropía. Ocurre cuando la córnea no es perfectamente esférica (redonda), sino que presenta una curvatura más ovalada. El resultado: las imágenes se ven algo distorsionadas, alargadas o con &quot;sombras&quot;, sin importar si estás mirando de cerca o de lejos.
            </p>
            <p>
              En tu receta, este dato se anota en la columna de <strong>Cilindro (CIL)</strong> y siempre va acompañado de un <strong>Eje</strong>. Este eje es un valor expresado en grados (entre 0° y 180°) que nos indica a los ópticos la posición exacta y milimétrica en la que debemos montar el cristal para compensar esa irregularidad de tu córnea.
            </p>

            <h2 className="text-2xl font-semibold text-stone-800 mt-8 mb-4">
              El primer gran paso siempre es tu médico oftalmólogo
            </h2>
            <p>
              Nos apasiona ayudarte a ver mejor y potenciar tu estilo, pero es fundamental recordar que en <strong>Atelier Óptica no medimos la vista ni diagnosticamos patologías</strong>. Legal y profesionalmente, diagnosticar condiciones visuales o recetar tu graduación es tarea exclusiva de tu <strong>médico oftalmólogo</strong>. Te recomendamos visitarlo religiosamente una vez al año para un control de salud visual integral.
            </p>
            <p>
              Una vez que el médico te entregue tu receta, ¡ahí entramos en acción! Ya sea que estés en pleno centro de <strong>Córdoba</strong>, en el <strong>Cerro de las Rosas</strong> o en cualquier punto del país (¡hacemos envíos a toda la Argentina!), te esperamos para interpretar esos valores. Te brindaremos un asesoramiento técnico de excelencia sobre cristales, tratamientos antirreflex, filtros de protección azul y armazones de diseño.
            </p>
            <p className="font-semibold text-stone-800 mt-6">
              ¿Ya fuiste al oftalmólogo y tenés tu receta lista? Vení a visitarnos o escribinos y juntos vamos a buscar ese anteojo que no te vas a querer sacar nunca.
            </p>
          </div>
        
          {/* CTA WHATSAPP AUTOMÁTICO */}
          <div className="mt-16 bg-black/5 p-8 md:p-12 rounded-2xl text-center border border-black/10">
            <h3 className="text-2xl font-medium tracking-tight mb-4">¿Necesitás asesoramiento personalizado con tu receta?</h3>
            <p className="text-black/70 mb-8 max-w-xl mx-auto">
              Comunicate directamente con nuestro equipo de ópticos por WhatsApp. Estamos listos para ayudarte a interpretar tu graduación y encontrar el cristal y armazón perfectos para tu visión.
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