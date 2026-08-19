import { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { StorefrontNavbar } from '@/components/Storefront/StorefrontNavbar';
import { StorefrontFooter } from '@/components/Storefront/StorefrontFooter';
import { WHATSAPP_PHONE } from '@/lib/constants';

const PAGE_PATH = '/blog/anteojos-obras-de-arte';
const PAGE_URL = `https://atelieroptica.com.ar${PAGE_PATH}`;

export const metadata: Metadata = {
  alternates: { canonical: PAGE_URL },
  title: { absolute: 'Los anteojos son obras de arte: más de 100 procesos detrás de cada par | Atelier Óptica' },
  description:
    'Arte, comercio y salud visual. Ishtar Pissano, creadora de Atelier Óptica, cuenta por qué un anteojo es una obra de arte con más de 100 procesos productivos y cómo nació una óptica donde se fusionan el arte y el diseño.',
  keywords: [
    'atelier optica',
    'ishtar pissano',
    'anteojos obra de arte',
    'optica creativa cordoba',
    'armazones de diseño cordoba',
    'optica cerro de las rosas',
    'arte y diseño anteojos',
  ],
  openGraph: {
    type: 'article',
    url: PAGE_URL,
    title: 'Los anteojos son obras de arte',
    description: 'Más de 100 procesos productivos detrás de cada par. Donde se fusionan el arte y el diseño.',
    images: [{ url: '/images/blog/arte-en-foco/01-monalisa.jpg', width: 1080, height: 1350, alt: 'La Gioconda vista a través de un cristal en foco' }],
  },
};

const PROCESOS = [
  {
    titulo: 'El acetato',
    texto:
      'Nace de fibras de algodón y madera. Se lamina en planchas de colores, se corta, se fresa, se pule en tambores durante días y se termina a mano. Un carey bien hecho no se imita: se ve en la profundidad de la trama.',
  },
  {
    titulo: 'El metal',
    texto:
      'Se estampa, se suelda, se baña, se ajusta. Un puente que calza y una plaqueta que no marca son decisiones de décimas de milímetro que alguien tomó antes de que el anteojo llegue a tu cara.',
  },
  {
    titulo: 'El cristal',
    texto:
      'Se calcula para tu receta, se talla, se pule, se trata y se calibra al eje exacto de tu mirada.',
  },
  {
    titulo: 'El ajuste',
    texto:
      'El último proceso es el que casi nadie ve: sentarte, mirarte, calentar una varilla, corregir un ángulo. Ahí un objeto se vuelve tuyo.',
  },
];

const OBRAS = [
  { src: '/images/blog/arte-en-foco/01-monalisa.jpg', alt: 'La Gioconda con anteojos, vista a través de un cristal en foco', pie: 'La Gioconda' },
  { src: '/images/blog/arte-en-foco/02-venus.jpg', alt: 'El Nacimiento de Venus con anteojos, vista a través de un cristal en foco', pie: 'El Nacimiento' },
  { src: '/images/blog/arte-en-foco/03-perla.jpg', alt: 'La joven de la perla con anteojos, vista a través de un cristal en foco', pie: 'La Chica de la Perla' },
  { src: '/images/blog/arte-en-foco/04-dali.jpg', alt: 'Dalí con anteojos, visto a través de un cristal en foco', pie: 'La Persistencia' },
];

export default function AnteojosObrasDeArtePage() {
  return (
    <div className="min-h-screen bg-[#faf8f5] text-black font-sans selection:bg-black selection:text-white pb-20">
      <StorefrontNavbar theme="light" />

      <main className="max-w-3xl mx-auto px-6 pt-32 lg:pt-40">
        <article>
          <header className="mb-12 lg:mb-16 text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#999] mb-4">Manifiesto</p>
            <h1 className="text-3xl lg:text-5xl font-normal tracking-tight mb-6 lg:mb-8 leading-tight">
              Los anteojos son auténticas obras de arte
            </h1>
            <p className="text-[14px] lg:text-[15px] text-[#666] leading-relaxed max-w-2xl mx-auto">
              Detrás de cada par hay más de cien procesos productivos que nadie ve y todos notan cuando enfocan bien.
              Esta es la historia de por qué, con mi hermana, creamos una óptica donde se fusionan mis dos amores: el arte y el diseño.
            </p>
            <div className="mt-8 flex items-center justify-center gap-3">
              <span className="relative w-12 h-12 rounded-full overflow-hidden ring-1 ring-black/10">
                <Image src="/images/blog/ishtar/ishtar-retrato.jpg" alt="Ishtar Pissano" fill sizes="48px" className="object-cover object-top" />
              </span>
              <p className="text-[12px] uppercase tracking-[0.18em] text-[#999] text-left leading-relaxed">Por Ishtar Pissano<br />Creadora de Atelier Óptica</p>
            </div>
          </header>

          <figure className="mb-14 lg:mb-20">
            <div className="grid grid-cols-2 gap-3 max-w-2xl mx-auto">
              <div className="relative aspect-[4/5] overflow-hidden rounded-sm shadow-xl">
                <Image src="/images/blog/ishtar/ishtar-vidriera.jpg" alt="Ishtar Pissano" fill sizes="(max-width: 768px) 50vw, 340px" className="object-cover" priority />
              </div>
              <div className="relative aspect-[4/5] overflow-hidden rounded-sm shadow-xl">
                <Image src="/images/blog/arte-en-foco/01-monalisa.jpg" alt={OBRAS[0].alt} fill sizes="(max-width: 768px) 50vw, 340px" className="object-cover" priority />
              </div>
            </div>
            <figcaption className="text-center text-[12px] text-[#999] mt-4">Hay detalles que solo aparecen cuando se mira con precisión.</figcaption>
          </figure>

          <div className="space-y-12 lg:space-y-16 text-[15px] leading-relaxed text-gray-800">
            <section>
              <p className="mb-6 text-lg leading-relaxed">
                Mi vida se apoya en tres cosas: <strong>el arte</strong>, <strong>el comercio</strong> y <strong>la salud visual</strong>. Durante mucho tiempo las viví
                como mundos separados. Atelier nació el día que entendí que eran el mismo.
              </p>
              <p className="mb-6">
                Vengo de una familia envuelta en el arte desde siempre: mis padres, mis abuelos y todas las generaciones que recuerdo lo vivieron de una forma u otra. Yo estudié arte y elegí la escultura, el grabado y la pintura. Y después la vida, mi amor por los anteojos y por la moda me dejaron en la puerta de la salud visual: hace doce años me recibí de óptica contactóloga.
              </p>
              <p className="mb-6">
                Luego vino otro camino: más de diez años como gerente comercial, liderando grandes equipos en una empresa muy importante. Ahí aprendí la otra mitad del oficio, la que hace que una cosa hermosa llegue a alguien.
              </p>
              <figure className="my-10 grid grid-cols-2 gap-3">
                <div className="relative aspect-[3/4] overflow-hidden rounded-sm shadow-md">
                  <Image src="/images/blog/ishtar/ishtar-viaje.jpg" alt="Ishtar Pissano de viaje" fill sizes="(max-width: 768px) 50vw, 340px" className="object-cover" />
                </div>
                <div className="relative aspect-[3/4] overflow-hidden rounded-sm shadow-md">
                  <Image src="/images/blog/ishtar/ishtar-retrato.jpg" alt="Ishtar Pissano" fill sizes="(max-width: 768px) 50vw, 340px" className="object-cover" />
                </div>
                <figcaption className="col-span-2 text-center text-[12px] text-[#999]">Viajar, mirar, traerse partecitas de cada óptica del mundo.</figcaption>
              </figure>
              <p className="mb-6">
                Y soy amante de los viajes, de conocer miles de mundos. En cada país entré a ópticas: las recorrí, las miré con ojo de artista y de comerciante, y me traje partecitas de todas. Atelier reúne muchos países, muchas ópticas recorridas y miles de ideas.
              </p>
              <p className="mb-6">
                Un día la vida me juntó con el arte de nuevo, y con la creación me unió con mi hermana. Escribimos todo en un papelito que todavía guardamos: ahí diseñamos en nuestra mente esta óptica, armada con pedacitos de todas las que yo había conocido y que me inspiraron.
              </p>
              <p className="mb-6">
                Por eso el nombre. Un atelier no es un negocio ni un consultorio: es un taller donde se hacen obras. Y por eso las imágenes que nos acompañan son la Gioconda, la Venus, la chica de la perla, Dalí. No es un chiste visual: es una declaración. <em>El arte fue pensado para mirarlo con precisión.</em> Tu vida también.
              </p>
            </section>

            <section className="border-t border-black/10 pt-12">
              <h2 className="text-2xl font-medium mb-6">Mi hermana y la Cápsula Escarlata</h2>
              <p className="mb-6">
                Hay una parte de esta historia que es de ella. La <strong>Cápsula Escarlata</strong>, nuestra línea mayorista, está inspirada en mi hermana: amante de la salud en todas sus formas, licenciada en Nutrición, vegetariana, apasionada y metódica. La que lideró el primer año de Atelier, el más difícil de todos.
              </p>
              <p className="mb-6">
                Lo hizo mientras terminaba su licenciatura en Nutrición, estudiaba un curso de inglés para aplicar a una visa en el exterior y viajaba una hora todos los días para llegar. Con ese tiempo, que no le sobraba, llevó adelante la gestión de nuestro primer cliente. En ese corto tiempo nacimos.
              </p>
              <p className="mb-6">
                Nacimos en la <strong>Galería Gitana</strong>. Fue nuestro primer rinconcito: ahí nos ayudaron a nacer, a crear y a pensar. Pero teníamos que salir a la calle para poder llegar a la gente. Un día la llamé y le dije: <em>&quot;Hermana, levantá el piso, que nos mudamos&quot;</em>. Entre risas y llanto entendió que no era un chistecito. Y ahí nos vimos, sentadas en Cremolatti, mirando el pequeño localcito al que nos íbamos a mudar.
              </p>
              <p className="mb-6">
                Así que fuimos: una mudanza fugaz, reinventarnos otra vez, y dejar atrás el primer rinconcito que fue nuestro. Todo lo que Atelier es hoy empezó ahí, en ese año que ella sostuvo cuando casi no tenía horas.
              </p>
              <figure className="my-10 grid grid-cols-3 gap-3">
                <div className="relative aspect-[3/4] overflow-hidden rounded-sm shadow-md">
                  <Image src="/images/blog/ishtar/hermana-retrato.jpg" alt="Mi hermana" fill sizes="(max-width: 768px) 33vw, 230px" className="object-cover" />
                </div>
                <div className="relative aspect-[3/4] overflow-hidden rounded-sm shadow-md">
                  <Image src="/images/blog/ishtar/hermana-salon-optica.jpg" alt="Mi hermana en el Salón de la Óptica" fill sizes="(max-width: 768px) 33vw, 230px" className="object-cover" />
                </div>
                <div className="relative aspect-[3/4] overflow-hidden rounded-sm shadow-md">
                  <Image src="/images/blog/ishtar/hermana-armazon.jpg" alt="Mi hermana mostrando un armazón" fill sizes="(max-width: 768px) 33vw, 230px" className="object-cover" />
                </div>
                <figcaption className="col-span-3 text-center text-[12px] text-[#999]">Mi hermana. Metódica, apasionada, la que sostuvo el primer año.</figcaption>
              </figure>
            </section>

            <section className="border-t border-black/10 pt-12">
              <h2 className="text-2xl font-medium mb-3">Más de cien procesos que no se ven</h2>
              <p className="mb-8 text-[#666]">
                Un anteojo bien hecho pasa por más de cien procesos productivos antes de llegar a tu cara. Estos son los que más me importan.
              </p>
              <div className="grid sm:grid-cols-2 gap-6">
                {PROCESOS.map((p) => (
                  <div key={p.titulo} className="bg-white border border-black/10 p-6 rounded-sm">
                    <h3 className="text-base font-semibold mb-2">{p.titulo}</h3>
                    <p className="text-[14px] text-gray-700 leading-relaxed">{p.texto}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="border-t border-black/10 pt-12">
              <h2 className="text-2xl font-medium mb-6">Cada anteojo es una cosmovisión</h2>
              <p className="mb-6">
                Elegir un armazón es elegir cómo querés mirar el mundo y cómo querés que el mundo te mire. Volúmenes, materiales, un color de acetato, el peso de un metal fino: todo eso es una forma de ver. Por eso en Atelier no vendemos por tendencia. Elegimos cada pieza como se elige una obra: por el detalle. Porque el arte sin técnica es una intención.
              </p>
              <div className="grid grid-cols-2 gap-4 my-10">
                {OBRAS.map((o) => (
                  <figure key={o.src}>
                    <div className="relative aspect-[4/5] overflow-hidden rounded-sm shadow-md">
                      <Image src={o.src} alt={o.alt} fill sizes="(max-width: 768px) 50vw, 340px" className="object-cover" />
                    </div>
                    <figcaption className="text-center text-[11px] uppercase tracking-[0.15em] text-[#999] mt-2">{o.pie}</figcaption>
                  </figure>
                ))}
              </div>
            </section>

            <section className="border-t border-black/10 pt-12">
              <h2 className="text-2xl font-medium mb-6">Arte, comercio y salud visual</h2>
              <p className="mb-6">
                El arte me enseñó a mirar el detalle. El comercio me enseñó que una cosa hermosa que no llega a nadie no sirve. Y la salud visual me recordó que, al final, esto no es sobre objetos: es sobre personas que quieren ver bien y verse bien.
              </p>
              <p className="mb-6">
                Atelier es el lugar donde esas tres cosas dejan de pelearse. Un espacio en el Cerro de las Rosas, hecho de todo lo que vi en el mundo, pensado para que elijas tus anteojos como se elige una prenda de autor, con una garantía de adaptación que nos obliga a hacerlo bien.
              </p>
              <blockquote className="border-l-2 border-black pl-6 my-10 text-xl leading-relaxed italic">
                Somos ópticos creativos. Tu visión es nuestra obra maestra.
                <footer className="not-italic text-[12px] uppercase tracking-[0.18em] text-[#999] mt-4">Ishtar Pissano</footer>
              </blockquote>
              <p className="mb-4 text-sm text-gray-500 italic">
                En la óptica no diagnosticamos ni recetamos: tu primer paso siempre es el médico oftalmólogo. Con la receta en mano, el resto es nuestro trabajo.
              </p>
            </section>
          </div>

          <div className="mt-16 lg:mt-20 p-8 lg:p-12 border border-black text-center">
            <h3 className="text-xl font-medium mb-3">Vení a ver las obras de cerca</h3>
            <p className="text-[14px] text-[#666] mb-8 max-w-md mx-auto">
              José Luis de Tejeda 4380, Cerro de las Rosas, Córdoba. O escribinos por WhatsApp y te asesoramos.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a href={`https://wa.me/${WHATSAPP_PHONE}`} target="_blank" rel="noopener noreferrer" className="inline-block bg-black text-white px-8 py-4 text-[11px] font-bold uppercase tracking-widest hover:opacity-70 transition-opacity">
                Escribinos por WhatsApp
              </a>
              <Link href="/tienda" className="inline-block border border-black px-8 py-4 text-[11px] font-bold uppercase tracking-widest hover:bg-black hover:text-white transition-colors">
                Ver la colección
              </Link>
            </div>
          </div>
        </article>
      </main>

      <StorefrontFooter />
    </div>
  );
}
