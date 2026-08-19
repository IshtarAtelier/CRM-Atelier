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
    n: '01',
    titulo: 'El acetato',
    texto: 'Nace de fibras de algodón y madera. Se lamina en planchas de colores, se corta, se fresa, se pule en tambores durante días y se termina a mano. Un carey bien hecho no se imita: se ve en la profundidad de la trama.',
  },
  {
    n: '02',
    titulo: 'El metal',
    texto: 'Se estampa, se suelda, se baña, se ajusta. Un puente que calza y una plaqueta que no marca son decisiones de décimas de milímetro que alguien tomó antes de que el anteojo llegue a tu cara.',
  },
  {
    n: '03',
    titulo: 'El cristal',
    texto: 'Se calcula para tu receta, se talla, se pule, se trata y se calibra al eje exacto de tu mirada.',
  },
  {
    n: '04',
    titulo: 'El ajuste',
    texto: 'El último proceso es el que casi nadie ve: sentarte, mirarte, calentar una varilla, corregir un ángulo. Ahí un objeto se vuelve tuyo.',
  },
];

const OBRAS = [
  { src: '/images/blog/arte-en-foco/01-monalisa.jpg', alt: 'La Gioconda con anteojos, vista a través de un cristal en foco', pie: 'La Gioconda' },
  { src: '/images/blog/arte-en-foco/02-venus.jpg', alt: 'El Nacimiento de Venus con anteojos, vista a través de un cristal en foco', pie: 'El Nacimiento' },
  { src: '/images/blog/arte-en-foco/03-perla.jpg', alt: 'La joven de la perla con anteojos, vista a través de un cristal en foco', pie: 'La Chica de la Perla' },
  { src: '/images/blog/arte-en-foco/04-dali.jpg', alt: 'Dalí con anteojos, visto a través de un cristal en foco', pie: 'La Persistencia' },
];

function SectionLabel({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 mb-8">
      <span className="text-[11px] tracking-[0.3em] text-white/35 font-mono">{n}</span>
      <span className="h-px flex-1 bg-white/15" />
      <span className="text-[11px] uppercase tracking-[0.3em] text-white/50">{children}</span>
    </div>
  );
}

export default function AnteojosObrasDeArtePage() {
  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-white selection:text-black">
      <StorefrontNavbar theme="dark" />

      <main>
        <article>
          {/* HERO */}
          <header className="relative min-h-[92vh] flex items-end overflow-hidden border-b border-white/10">
            <div className="absolute inset-0">
              <Image
                src="/images/blog/ishtar/ishtar-vidriera.jpg"
                alt="Ishtar Pissano"
                fill
                sizes="100vw"
                className="object-cover object-top grayscale contrast-125 brightness-[0.55]"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/70" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-black/60" />
            </div>

            <div className="relative z-10 w-full px-6 lg:px-16 pb-16 lg:pb-24 pt-40">
              <p className="text-[11px] uppercase tracking-[0.4em] text-white/45 mb-6">Manifiesto — Atelier Óptica</p>
              <h1 className="text-[13vw] leading-[0.92] sm:text-6xl lg:text-8xl font-normal tracking-tight max-w-5xl">
                Los anteojos son<br />auténticas obras<br />de arte.
              </h1>
              <p className="mt-8 text-white/60 text-[15px] lg:text-lg leading-relaxed max-w-xl">
                Detrás de cada par hay más de cien procesos productivos que nadie ve y todos notan cuando enfocan bien.
              </p>
              <div className="mt-10 flex items-center gap-4">
                <span className="relative w-14 h-14 rounded-full overflow-hidden ring-1 ring-white/30 grayscale">
                  <Image src="/images/blog/ishtar/ishtar-retrato.jpg" alt="Ishtar Pissano" fill sizes="56px" className="object-cover object-top" />
                </span>
                <p className="text-[11px] uppercase tracking-[0.25em] text-white/50 leading-relaxed">
                  Por Ishtar Pissano<br />Creadora de Atelier Óptica
                </p>
              </div>
            </div>

            <div className="absolute bottom-6 right-6 lg:right-16 z-10 text-[11px] tracking-[0.2em] text-white/30 hidden sm:block">
              SCROLL ↓
            </div>
          </header>

          {/* INTRO */}
          <section className="px-6 lg:px-16 pt-24 lg:pt-32 pb-20 lg:pb-28 max-w-3xl mx-auto">
            <SectionLabel n="01">Origen</SectionLabel>
            <p className="text-2xl lg:text-3xl leading-[1.4] font-light text-white/95 mb-8">
              Mi vida se apoya en tres cosas: <span className="text-white">el arte</span>, <span className="text-white">el comercio</span> y{' '}
              <span className="text-white">la salud visual</span>. Durante mucho tiempo las viví como mundos separados. Atelier nació el día que entendí que eran el mismo.
            </p>
            <div className="space-y-6 text-white/65 text-[15px] lg:text-base leading-relaxed">
              <p>
                Vengo de una familia envuelta en el arte desde siempre: mis padres, mis abuelos y todas las generaciones que recuerdo lo vivieron de una forma u otra. Yo estudié arte y elegí la escultura, el grabado y la pintura. Y después la vida, mi amor por los anteojos y por la moda me dejaron en la puerta de la salud visual: hace doce años me recibí de óptica contactóloga.
              </p>
              <p>
                Luego vino otro camino: más de diez años como gerente comercial, liderando grandes equipos en una empresa muy importante. Ahí aprendí la otra mitad del oficio, la que hace que una cosa hermosa llegue a alguien.
              </p>
              <p>
                Y soy amante de los viajes, de conocer miles de mundos. En cada país entré a ópticas: las recorrí, las miré con ojo de artista y de comerciante, y me traje partecitas de todas. Atelier reúne muchos países, muchas ópticas recorridas y miles de ideas.
              </p>
            </div>
          </section>

          {/* TRAVEL PHOTOS — full bleed */}
          <section className="grid grid-cols-2">
            <div className="relative aspect-[3/4]">
              <Image src="/images/blog/ishtar/ishtar-miami.jpg" alt="Ishtar Pissano en Miami Beach" fill sizes="50vw" className="object-cover grayscale" />
            </div>
            <div className="relative aspect-[3/4]">
              <Image src="/images/blog/ishtar/ishtar-gucci.jpg" alt="Ishtar Pissano de viaje" fill sizes="50vw" className="object-cover grayscale" />
            </div>
          </section>
          <p className="text-center text-[11px] uppercase tracking-[0.25em] text-white/35 py-6 border-b border-white/10">
            Viajar, mirar, traerse partecitas de cada óptica del mundo
          </p>

          {/* PAPELITO */}
          <section className="px-6 lg:px-16 py-20 lg:py-28 max-w-3xl mx-auto">
            <div className="space-y-6 text-white/65 text-[15px] lg:text-base leading-relaxed">
              <p>
                Un día la vida me juntó con el arte de nuevo, y con la creación me unió con mi hermana. Escribimos todo en un papelito que todavía guardamos: ahí diseñamos en nuestra mente esta óptica, armada con pedacitos de todas las que yo había conocido y que me inspiraron.
              </p>
              <p>
                Por eso el nombre. Un atelier no es un negocio ni un consultorio: es un taller donde se hacen obras. Y por eso las imágenes que nos acompañan son la Gioconda, la Venus, la chica de la perla, Dalí. No es un chiste visual: es una declaración.{' '}
                <span className="text-white italic">El arte fue pensado para mirarlo con precisión.</span> Tu vida también.
              </p>
            </div>
          </section>

          {/* HERMANA */}
          <section className="border-t border-white/10">
            <div className="px-6 lg:px-16 pt-20 lg:pt-28 pb-14 max-w-3xl mx-auto">
              <SectionLabel n="02">Mi hermana</SectionLabel>
              <h2 className="text-3xl lg:text-5xl font-normal leading-tight mb-8">La Cápsula Escarlata</h2>
              <div className="space-y-6 text-white/65 text-[15px] lg:text-base leading-relaxed">
                <p>
                  Hay una parte de esta historia que es de ella. La <span className="text-white">Cápsula Escarlata</span>, nuestra línea mayorista, está inspirada en mi hermana Yani: amante de la salud en todas sus formas, licenciada en Nutrición, vegetariana, apasionada y metódica. La que lideró el primer año de Atelier, el más difícil de todos.
                </p>
                <p>
                  Lo hizo mientras terminaba su licenciatura en Nutrición, estudiaba un curso de inglés para aplicar a una visa en el exterior y viajaba una hora todos los días para llegar. Con ese tiempo, que no le sobraba, llevó adelante la gestión de nuestro primer cliente. En ese corto tiempo nacimos.
                </p>
                <p>
                  Nacimos en la <span className="text-white">Galería Gitana</span>. Fue nuestro primer rinconcito: ahí nos ayudaron a nacer, a crear y a pensar. Pero teníamos que salir a la calle para poder llegar a la gente. Un día la llamé y le dije: <em className="text-white/85">&quot;Hermana, levantá el piso, que nos mudamos&quot;</em>. Entre risas y llanto entendió que no era un chistecito. Y ahí nos vimos, sentadas en Cremolatti, mirando el pequeño localcito al que nos íbamos a mudar.
                </p>
                <p>
                  Así que fuimos: una mudanza fugaz, reinventarnos otra vez, y dejar atrás el primer rinconcito que fue nuestro. Todo lo que Atelier es hoy empezó ahí, en ese año que ella sostuvo cuando casi no tenía horas.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3">
              <div className="relative aspect-[3/4]">
                <Image src="/images/blog/ishtar/hermana-diploma.jpg" alt="Yani, mi hermana, el día de su graduación como Licenciada en Nutrición" fill sizes="33vw" className="object-cover grayscale" />
              </div>
              <div className="relative aspect-[3/4]">
                <Image src="/images/blog/ishtar/hermanas-diploma.jpg" alt="Ishtar y su hermana Yani el día de su graduación" fill sizes="33vw" className="object-cover grayscale" />
              </div>
              <div className="relative aspect-[3/4]">
                <Image src="/images/blog/ishtar/hermana-diploma-2.jpg" alt="Ishtar sosteniendo el diploma de su hermana Yani" fill sizes="33vw" className="object-cover grayscale" />
              </div>
            </div>
            <p className="text-center text-[11px] uppercase tracking-[0.25em] text-white/35 py-6 border-b border-white/10">
              Mi hermana. Metódica, apasionada, la que sostuvo el primer año.
            </p>
          </section>

          {/* PROCESOS */}
          <section className="px-6 lg:px-16 py-20 lg:py-28">
            <div className="max-w-3xl mx-auto mb-14">
              <SectionLabel n="03">El oficio</SectionLabel>
              <h2 className="text-3xl lg:text-5xl font-normal leading-tight mb-6">Más de cien procesos que no se ven</h2>
              <p className="text-white/55 text-[15px] lg:text-base leading-relaxed max-w-xl">
                Un anteojo bien hecho pasa por más de cien procesos productivos antes de llegar a tu cara. Estos son los que más me importan.
              </p>
            </div>
            <div className="max-w-5xl mx-auto grid sm:grid-cols-2 divide-y sm:divide-y-0 divide-white/10">
              {PROCESOS.map((p, i) => (
                <div key={p.titulo} className={`py-8 sm:p-10 ${i % 2 === 0 ? 'sm:border-r border-white/10' : ''} ${i < 2 ? 'sm:border-b border-white/10' : ''}`}>
                  <span className="text-[11px] font-mono text-white/30">{p.n}</span>
                  <h3 className="text-xl font-normal mt-3 mb-3">{p.titulo}</h3>
                  <p className="text-white/55 text-[14px] leading-relaxed">{p.texto}</p>
                </div>
              ))}
            </div>
          </section>

          {/* COSMOVISION + OBRAS */}
          <section className="border-t border-white/10">
            <div className="px-6 lg:px-16 pt-20 lg:pt-28 pb-14 max-w-3xl mx-auto">
              <SectionLabel n="04">Cosmovisión</SectionLabel>
              <h2 className="text-3xl lg:text-5xl font-normal leading-tight mb-8">Cada anteojo es una forma de ver el mundo</h2>
              <p className="text-white/65 text-[15px] lg:text-base leading-relaxed">
                Elegir un armazón es elegir cómo querés mirar el mundo y cómo querés que el mundo te mire. Volúmenes, materiales, un color de acetato, el peso de un metal fino: todo eso es una forma de ver. Por eso en Atelier no vendemos por tendencia. Elegimos cada pieza como se elige una obra: por el detalle. Porque el arte sin técnica es una intención.
              </p>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4">
              {OBRAS.map((o) => (
                <figure key={o.src} className="relative">
                  <div className="relative aspect-[4/5]">
                    <Image src={o.src} alt={o.alt} fill sizes="(max-width: 1024px) 50vw, 25vw" className="object-cover" />
                  </div>
                  <figcaption className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent pt-8 pb-3 px-3 text-center text-[10px] uppercase tracking-[0.2em] text-white/70">
                    {o.pie}
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>

          {/* CIERRE */}
          <section className="px-6 lg:px-16 py-24 lg:py-32 max-w-3xl mx-auto border-t border-white/10">
            <SectionLabel n="05">Cierre</SectionLabel>
            <h2 className="text-3xl lg:text-5xl font-normal leading-tight mb-8">Arte, comercio y salud visual</h2>
            <div className="space-y-6 text-white/65 text-[15px] lg:text-base leading-relaxed mb-14">
              <p>
                El arte me enseñó a mirar el detalle. El comercio me enseñó que una cosa hermosa que no llega a nadie no sirve. Y la salud visual me recordó que, al final, esto no es sobre objetos: es sobre personas que quieren ver bien y verse bien.
              </p>
              <p>
                Atelier es el lugar donde esas tres cosas dejan de pelearse. Un espacio en el Cerro de las Rosas, hecho de todo lo que vi en el mundo, pensado para que elijas tus anteojos como se elige una prenda de autor, con una garantía de adaptación que nos obliga a hacerlo bien.
              </p>
            </div>
            <blockquote className="border-t border-b border-white/15 py-10 my-10">
              <p className="text-2xl lg:text-4xl font-light leading-tight text-white">
                Somos ópticos creativos.<br />Tu visión es nuestra obra maestra.
              </p>
              <footer className="mt-6 text-[11px] uppercase tracking-[0.25em] text-white/40">Ishtar Pissano</footer>
            </blockquote>
            <p className="text-white/35 text-[13px] leading-relaxed italic">
              En la óptica no diagnosticamos ni recetamos: tu primer paso siempre es el médico oftalmólogo. Con la receta en mano, el resto es nuestro trabajo.
            </p>
          </section>

          {/* CTA */}
          <section className="px-6 lg:px-16 pb-24 lg:pb-32 max-w-3xl mx-auto text-center">
            <h3 className="text-2xl lg:text-3xl font-normal mb-4">Vení a ver las obras de cerca</h3>
            <p className="text-white/50 text-[14px] mb-10 max-w-md mx-auto">
              José Luis de Tejeda 4380, Cerro de las Rosas, Córdoba. O escribinos por WhatsApp y te asesoramos.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href={`https://wa.me/${WHATSAPP_PHONE}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-white text-black px-8 py-4 text-[11px] font-bold uppercase tracking-widest hover:bg-white/85 transition-colors"
              >
                Escribinos por WhatsApp
              </a>
              <Link
                href="/tienda"
                className="inline-block border border-white/30 px-8 py-4 text-[11px] font-bold uppercase tracking-widest hover:bg-white hover:text-black transition-colors"
              >
                Ver la colección
              </Link>
            </div>
          </section>
        </article>
      </main>

      <StorefrontFooter />
    </div>
  );
}
