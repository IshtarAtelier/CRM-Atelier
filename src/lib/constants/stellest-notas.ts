/**
 * LAS NOTAS DE STELLEST, en un solo lugar.
 *
 * Ishtar, 10/10/2026: "que la persona ponga la palabra Stellest y le
 * aparezcamos sí o sí". Una sola nota no alcanza para eso: Google rankea una
 * página por una intención (qué es, precio, armazón, cuidados…), no por una
 * marca. Por eso hay un GRUPO de notas, cada una con su intención, y todas
 * enlazadas entre sí y a la nota madre (/blog/stellest).
 *
 * Esta lista es la ÚNICA fuente de ese grupo: la leen el listado del blog
 * (static-blog-posts), el sitemap, y el bloque "Más sobre Stellest" que cierra
 * cada nota. Agregar una nota acá la enlaza desde todas las demás sola.
 */
export interface NotaStellest {
  slug: string;
  /** Título de la tarjeta y del H1. */
  title: string;
  /** Lo que se ve en la tarjeta y en los links cruzados. */
  excerpt: string;
  /** Texto corto para el bloque "Más sobre Stellest" (una línea). */
  linkText: string;
  date: string;
  imageUrl: string;
}

export const CATEGORIA_STELLEST = 'Control de miopía';

export const NOTAS_STELLEST: NotaStellest[] = [
  {
    slug: 'stellest',
    title: 'Lentes Stellest: qué son, cómo funcionan y qué esperar de verdad',
    excerpt:
      'Si el oftalmopediatra te nombró Stellest y saliste con la palabra anotada en un papel: qué tiene adentro ese cristal, de dónde sale el 67% y qué necesita para funcionar.',
    linkText: 'Qué es Stellest y cómo funciona',
    date: '2026-09-09',
    imageUrl: '/images/stellest/stellest-2.jpeg',
  },
  {
    slug: 'optica-certificada-stellest-cordoba',
    title: 'Óptica certificada Stellest en Córdoba: qué significa y por qué importa',
    excerpt:
      'Essilor no vende Stellest en cualquier óptica. Qué implica la certificación, por qué existe y cómo saber si la óptica a la que vas está habilitada para hacerlo.',
    linkText: 'Somos óptica certificada: qué significa',
    date: '2026-10-10',
    imageUrl: '/images/stellest/stellest-3.jpeg',
  },
  {
    slug: 'stellest-precio-argentina-y-formas-de-pago',
    title: 'Stellest: precio en Argentina, qué incluye y cómo se paga',
    excerpt:
      'De qué depende el precio de un Stellest, qué viene incluido, por qué conviene pedir el presupuesto con la receta en mano y las formas de pago en Atelier.',
    linkText: 'Precio, qué incluye y formas de pago',
    date: '2026-10-10',
    imageUrl: '/images/stellest/stellest-1.jpeg',
  },
  {
    slug: 'stellest-preguntas-frecuentes',
    title: 'Stellest: las 15 preguntas que más nos hacen los padres',
    excerpt:
      'Edad, horas de uso, si se nota, si sirve con astigmatismo, qué pasa si se rompen, cuánto tardan: todas las dudas respondidas con lo que dice Essilor y lo que vemos en el local.',
    linkText: 'Preguntas frecuentes de los padres',
    date: '2026-10-10',
    imageUrl: '/images/stellest/stellest-2.jpeg',
  },
  {
    slug: 'stellest-que-armazon-elegir',
    title: 'Qué armazón elegir para Stellest: la parte que casi nadie te explica',
    excerpt:
      'Los anillos de microlentes tienen que quedar centrados en la pupila todo el día. Por qué el armazón pesa más que en un anteojo común y cómo lo elegimos con tu hijo.',
    linkText: 'Qué armazón elegir para Stellest',
    date: '2026-10-10',
    imageUrl: '/images/stellest/stellest-3.jpeg',
  },
  {
    slug: 'stellest-cuidados-adaptacion-y-cuanto-duran',
    title: 'Stellest: primeros días, cuidados y cuándo hay que renovarlos',
    excerpt:
      'Cómo son los primeros días con Stellest, cómo se limpian, qué pasa si cambia la graduación y cada cuánto se revisan. Lo que conviene saber antes de retirarlos.',
    linkText: 'Adaptación, cuidados y renovación',
    date: '2026-10-10',
    imageUrl: '/images/stellest/stellest-1.jpeg',
  },
  {
    slug: 'stellest-de-la-receta-al-anteojo',
    title: 'Stellest en Atelier: qué pasa desde que traés la receta hasta que te lo llevás',
    excerpt:
      'Medición, elección del armazón, pedido a Essilor, control del cristal al llegar, montaje y entrega: el paso a paso real, con los tiempos reales.',
    linkText: 'De la receta al anteojo: el paso a paso',
    date: '2026-10-10',
    imageUrl: '/images/stellest/stellest-2.jpeg',
  },
  {
    slug: 'stellest-vs-lentes-comunes',
    title: 'Stellest vs. lentes comunes: en qué se diferencian de verdad',
    excerpt:
      'Los dos corrigen igual de bien. La diferencia está en lo que hacen con la miopía del año que viene. Comparación punto por punto, sin exagerar.',
    linkText: 'Stellest vs. lentes comunes',
    date: '2026-10-10',
    imageUrl: '/images/stellest/stellest-3.jpeg',
  },
];

export function notaStellest(slug: string): NotaStellest {
  const n = NOTAS_STELLEST.find((x) => x.slug === slug);
  if (!n) throw new Error(`No existe la nota Stellest "${slug}" en stellest-notas.ts`);
  return n;
}
