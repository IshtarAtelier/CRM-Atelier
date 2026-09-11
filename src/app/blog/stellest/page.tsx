import { Metadata } from "next";
import Image from "next/image";
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { StorefrontFooter } from "@/components/Storefront/StorefrontFooter";
import { WHATSAPP_PHONE } from '@/lib/constants';
import { YouTubeEmbed } from '@/components/blog/YouTubeEmbed';
import { VIDEOS_POR_SLUG } from '@/lib/constants/videos-blog';

/**
 * LA NOTA DEDICADA A STELLEST.
 *
 * Ishtar, 9/9/2026: "creá en el blog un apartado especial que hable únicamente
 * de Stellest, con imágenes".
 *
 * Existía la nota de control de miopía, que compara Stellest con MyoFix. Esta es
 * distinta a propósito: no compara con nada. Es la página a la que se manda al
 * padre que ya escuchó "Stellest" del oftalmopediatra y quiere saber qué es.
 *
 * LAS FOTOS son las gráficas oficiales de Essilor que ya están en
 * public/images/stellest/ (ver su LEEME.md). Se usan los ORIGINALES, no los
 * recortes `-cristal`: esos existen solo para las piezas de redes, donde nuestro
 * texto se superpone y choca con la tipografía de Essilor. Acá no se superpone
 * nada, así que va la gráfica entera, con su logo y su copy.
 */
export const metadata: Metadata = {
  alternates: { canonical: 'https://atelieroptica.com.ar/blog/stellest' },
  title: "Lentes Stellest de Essilor en Córdoba: qué son y cómo frenan la miopía",
  description: "Todo sobre los cristales Stellest de Essilor: la tecnología H.A.L.T., sus 1.021 microlentes, el 67% de ralentización comprobado y qué esperar de verdad. Atelier Óptica, Cerro de las Rosas, Córdoba.",
  keywords: ["Stellest", "lentes Stellest Córdoba", "Stellest Essilor", "H.A.L.T.", "control de miopía infantil", "miopía niños Córdoba", "Cerro de las Rosas", "Atelier Óptica"],
};

const FOTOS = [
  { src: '/images/stellest/stellest-2.jpeg', alt: 'Anteojo con cristales Stellest visto de frente: se distingue la sombra de los anillos concéntricos de microlentes.' },
  { src: '/images/stellest/stellest-3.jpeg', alt: 'Anteojo con cristales Stellest en tres cuartos, con las dos sombras de anillos concéntricos bien visibles.' },
];

export default function StellestPage() {
  const wsp = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent('Hola! Quiero consultar por los lentes Stellest para mi hijo/a')}`;

  return (
    <div className="min-h-screen flex flex-col bg-stone-50">
      <StorefrontNavbar theme="light" />

      <main className="flex-grow container mx-auto px-4 pt-32 pb-20 max-w-4xl">
        <article className="blog-article w-full max-w-none">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#c8a55c] mb-4">Control de miopía infantil</p>
          <h1 className="text-4xl md:text-5xl font-serif text-stone-900 mb-8 leading-tight">
            Lentes Stellest: qué son, cómo funcionan y qué esperar de verdad
          </h1>

          <p className="text-lg text-stone-700 leading-relaxed mb-8">
            Si el oftalmopediatra te nombró <strong>Stellest</strong>, probablemente saliste del
            consultorio con la palabra anotada en un papel y poco más. Esta nota es para eso: contarte
            qué es exactamente ese cristal, qué hace, cuánto frena la miopía de tu hijo según los
            estudios, y —tan importante como lo anterior— qué necesita para funcionar.
          </p>

          {/* Ishtar, 9/9/2026: "es solo para ópticas certificadas". Es de las
              pocas cosas que Essilor NO le vende a cualquiera, así que decirlo
              es informar y diferenciarse a la vez. Va arriba, antes de las
              fotos: es lo que hace que el padre siga leyendo acá y no en otro
              lado. */}
          <div className="bg-[#c8a55c]/10 border border-[#c8a55c]/40 rounded-lg p-6 my-10">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8a6d33] m-0">
              Sólo ópticas certificadas
            </p>
            <p className="text-stone-800 leading-relaxed mt-3 m-0">
              Essilor no vende Stellest en cualquier óptica: hay que estar{' '}
              <strong>certificado</strong> para trabajarlo. <strong>Atelier Óptica lo está</strong>.
              Si te lo recetaron, no es un cristal que consigas en cualquier lado — y esa es
              justamente la razón por la que conviene preguntarnos antes de encargarlo.
            </p>
          </div>

          {/* Las dos gráficas juntas y acotadas en ancho: son 900×1600, y a
              sangre cada una se comía una pantalla entera de scroll. */}
          <figure className="my-10">
            <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto">
              {FOTOS.map((f) => (
                <Image
                  key={f.src}
                  src={f.src}
                  alt={f.alt}
                  width={900}
                  height={1600}
                  className="w-full rounded-lg shadow-md"
                />
              ))}
            </div>
            <figcaption className="text-xs text-stone-500 text-center mt-3">
              Los anillos concéntricos de Stellest: se ven en la sombra, no en la cara de tu hijo. Imágenes: Essilor.
            </figcaption>
          </figure>

          <h2 className="text-2xl font-serif text-stone-900 mt-12 mb-4">La miopía no es solo &quot;ver mal de lejos&quot;</h2>
          <p className="text-stone-700 leading-relaxed mb-6">
            En un chico miope el ojo crece más de lo que debería, y se alarga. Por eso la graduación
            sube año tras año: no es que los anteojos &quot;le hagan mal&quot;, es que el ojo sigue
            creciendo. Un cristal común corrige la visión —tu hijo ve bien— pero no le dice nada a ese
            crecimiento. Stellest sí.
          </p>

          <h2 className="text-2xl font-serif text-stone-900 mt-12 mb-4">Qué tiene adentro: la tecnología H.A.L.T.</h2>
          <p className="text-stone-700 leading-relaxed mb-6">
            Stellest usa <strong>H.A.L.T.</strong> (<em>Highly Aspherical Lenslet Target</em>). En la
            cara del cristal hay <strong>1.021 microlentes asféricas</strong> distribuidas en{' '}
            <strong>11 anillos concéntricos</strong>. El centro queda libre: por ahí tu hijo mira y ve
            nítido, como con cualquier anteojo. Las microlentes trabajan alrededor.
          </p>
          <p className="text-stone-700 leading-relaxed mb-6">
            Lo que hacen es crear un <strong>volumen de señal por delante de la retina</strong>. En
            criollo: le indican al ojo que deje de alargarse. No corrigen mejor —corrigen igual—, pero
            le sacan al ojo el estímulo que lo hace crecer.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-10">
            {[
              { n: '1.021', t: 'microlentes asféricas' },
              { n: '11', t: 'anillos concéntricos' },
              { n: '67%', t: 'menos progresión, en promedio' },
            ].map((d) => (
              <div key={d.n} className="bg-white border border-stone-200 rounded-lg p-6 text-center">
                <p className="text-3xl font-serif text-stone-900 m-0">{d.n}</p>
                <p className="text-xs uppercase tracking-wider text-stone-500 mt-2 m-0">{d.t}</p>
              </div>
            ))}
          </div>

          <h2 className="text-2xl font-serif text-stone-900 mt-12 mb-4">El 67%, dicho con precisión</h2>
          <p className="text-stone-700 leading-relaxed mb-6">
            El número que vas a ver en todos lados es <strong>67%</strong>. Vale la pena entender de
            dónde sale, porque es una cifra promedio y no una promesa individual: en el estudio
            clínico de dos años, los chicos que usaron Stellest{' '}
            <strong>al menos 12 horas por día, todos los días</strong>, tuvieron en promedio un 67%
            menos de progresión de la miopía que los que usaron lentes monofocales comunes.
          </p>
          <p className="text-stone-700 leading-relaxed mb-6">
            Dos cosas que se desprenden de ahí y que preferimos decirte antes y no después:{' '}
            <strong>Stellest no cura la miopía ni la hace retroceder</strong> —frena su avance—, y{' '}
            <strong>el resultado depende de que tu hijo los use</strong>. Un Stellest en la mochila no
            frena nada. Las 12 horas diarias no son una recomendación: son la condición del estudio.
          </p>

          <h2 className="text-2xl font-serif text-stone-900 mt-12 mb-4">¿Se le notan?</h2>
          <p className="text-stone-700 leading-relaxed mb-6">
            Es la primera pregunta de casi todos los chicos, y la respuesta es que{' '}
            <strong>no</strong>. Las 1.021 microlentes tienen un acabado estético: a simple vista es un
            cristal transparente como cualquier otro. Solo se insinúan los anillos en ciertos reflejos
            —como en las fotos de arriba, tomadas a propósito para que se vean—. Nadie en el aula se va
            a dar cuenta.
          </p>

          <h2 className="text-2xl font-serif text-stone-900 mt-12 mb-4">¿Para quién es?</h2>
          <p className="text-stone-700 leading-relaxed mb-6">
            Para chicos con miopía en progresión, que es cuando la graduación sube de un control al
            siguiente. Quien define si corresponde es el <strong>oftalmopediatra</strong>: nosotros no
            diagnosticamos ni medimos la vista. Lo que sí hacemos es fabricar el cristal según esa
            receta, elegir con vos el armazón adecuado —en control de miopía el armazón importa más de
            lo habitual, porque los anillos tienen que quedar alineados con la pupila— y tomar las
            medidas con precisión.
          </p>

          <h2 className="text-2xl font-serif text-stone-900 mt-12 mb-4">El armazón no es un detalle</h2>
          <p className="text-stone-700 leading-relaxed mb-6">
            Un armazón que se le corre por la nariz o que le queda ancho desplaza el centro óptico, y
            con él los anillos. El cristal sigue corrigiendo, pero pierde parte de su efecto de
            control. Por eso, cuando armamos un Stellest, dedicamos tiempo al calce y te explicamos
            cómo ajustarlo en casa. Y cuando vuelvan a control, revisámelo sin cargo.
          </p>

          {(VIDEOS_POR_SLUG['stellest'] || []).map((v) => (
            <YouTubeEmbed key={v.id} videoId={v.id} titulo={v.titulo} />
          ))}

          <div className="bg-stone-900 text-stone-50 rounded-lg p-8 my-12 text-center">
            <p className="text-xl font-serif mb-2 m-0">¿Te lo recetaron y querés consultar?</p>
            <p className="text-sm text-stone-300 mb-6 mt-2">
              Traé la receta y te explicamos todo: materiales, tiempos y formas de pago. Estamos en el
              Cerro de las Rosas y enviamos a todo el país.
            </p>
            <a
              href={wsp}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center bg-[#25D366] text-stone-950 px-8 py-4 rounded-full font-bold uppercase tracking-widest hover:bg-[#1ebe57] transition-all hover:scale-105"
            >
              Consultar por WhatsApp
            </a>
          </div>

          <p className="text-xs text-stone-500 leading-relaxed mt-12 pt-6 border-t border-stone-200">
            En Atelier Óptica somos ópticos especialistas, no médicos: asesoramos sobre cristales y
            armazones a partir de la receta de tu oftalmopediatra. No hacemos medición de vista ni
            diagnósticos. Stellest es una marca registrada de Essilor; las imágenes son gráficas
            oficiales de Essilor.
          </p>

        </article>
      </main>

      <StorefrontFooter />
    </div>
  );
}
