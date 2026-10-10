import { Metadata } from 'next';
import Link from 'next/link';
import { NotaStellest, H2, P } from '@/components/blog/NotaStellest';
import { notaStellest } from '@/lib/constants/stellest-notas';

const nota = notaStellest('stellest-preguntas-frecuentes');

export const metadata: Metadata = {
  alternates: { canonical: `https://atelieroptica.com.ar/blog/${nota.slug}` },
  title: 'Lentes Stellest: 15 preguntas frecuentes de los padres',
  description:
    'A qué edad se usan, cuántas horas por día, si se notan, si sirven con astigmatismo, qué pasa si se rompen y cuánto tardan: las dudas sobre Stellest respondidas por una óptica certificada en Córdoba.',
  keywords: [
    'Stellest preguntas frecuentes',
    'Stellest edad',
    'Stellest cuántas horas',
    'Stellest astigmatismo',
    'Stellest se nota',
    'Stellest Córdoba',
    'control de miopía niños',
  ],
};

/**
 * Las preguntas viven en un array y no en JSX suelto porque de acá sale
 * también el JSON-LD de tipo FAQPage: es lo que hace que Google pueda mostrar
 * la pregunta y la respuesta directamente en el resultado de búsqueda. Una
 * sola fuente para lo que se lee y lo que se marca.
 */
const PREGUNTAS: { q: string; a: string }[] = [
  {
    q: '¿A qué edad puede usar Stellest un chico?',
    a: 'Stellest está pensado para chicos con miopía en progresión, en general en edad escolar. La edad exacta la define el oftalmopediatra según cada caso: no hay una edad mínima fija que decida la óptica. En el ensayo clínico de Essilor participaron chicos de 8 a 13 años.',
  },
  {
    q: '¿Cuántas horas por día tiene que usarlos?',
    a: 'Al menos 12 horas por día, todos los días. No es una recomendación: es la condición del ensayo clínico en el que Stellest mostró un 67 % menos de progresión en promedio. Es el anteojo de todos los días, desde que se levanta hasta que se acuesta.',
  },
  {
    q: '¿Se le notan los anillos?',
    a: 'No. Las 1.021 microlentes tienen acabado estético y a simple vista el cristal se ve transparente como cualquier otro. Los anillos solo se insinúan en ciertos reflejos o en la sombra del cristal. Nadie en el aula se da cuenta.',
  },
  {
    q: '¿Va a ver igual de bien que con un lente común?',
    a: 'Sí. La zona central del cristal es de visión única y corrige la miopía como un monofocal común. Las microlentes trabajan alrededor, sobre la visión periférica, sin afectar la nitidez central.',
  },
  {
    q: '¿Sirve si además tiene astigmatismo?',
    a: 'En general sí: Stellest se fabrica con la corrección de miopía y de astigmatismo de la receta, dentro de los rangos que fabrica Essilor. Con la receta en mano te confirmamos si entra en rango.',
  },
  {
    q: '¿Cura la miopía o la hace retroceder?',
    a: 'No. Stellest frena el avance de la miopía; no la revierte ni la cura. La graduación que ya tiene el chico se corrige con el mismo cristal, y el objetivo es que suba menos en los próximos años.',
  },
  {
    q: '¿Cuánto frena la miopía de verdad?',
    a: 'En el ensayo clínico de dos años de Essilor, los chicos que usaron Stellest al menos 12 horas por día progresaron en promedio un 67 % menos que los que usaron lentes monofocales comunes. Es un promedio de estudio, no una promesa individual: cada chico responde distinto.',
  },
  {
    q: '¿Cuánto tiempo hay que usarlo? ¿Un año? ¿Varios?',
    a: 'Mientras la miopía esté en progresión, que suele ser durante varios años de la infancia y la adolescencia. Lo va marcando el oftalmopediatra en cada control. Cuando cambia la graduación, se hace un Stellest nuevo con la receta nueva.',
  },
  {
    q: '¿Hace falta un armazón especial?',
    a: 'No uno especial, pero sí uno bien elegido. Los anillos tienen que quedar centrados en la pupila todo el día, así que el armazón no puede resbalarse ni quedar grande. En Atelier lo elegimos con el chico, probando el calce real.',
  },
  {
    q: '¿Qué pasa si se le rompe o se le raya?',
    a: 'Si se raya el cristal, se reemplaza con la misma receta. Si se rompe el armazón, muchas veces se puede reparar o cambiar manteniendo los cristales, siempre que el nuevo armazón tenga la misma forma y medidas. Por eso recomendamos un segundo par de respaldo: un chico que usa Stellest 12 horas por día no puede quedarse sin anteojos.',
  },
  {
    q: '¿Cuánto tardan en estar listos?',
    a: 'Alrededor de 25 días hábiles desde que confirmás el pedido. Stellest se fabrica a pedido para cada receta y Essilor lo trata como un proceso especial, por eso tarda más que un monofocal común.',
  },
  {
    q: '¿Lo puedo comprar en cualquier óptica?',
    a: 'No. Essilor fabrica Stellest solo para ópticas certificadas para trabajarlo. Atelier Óptica, en el Cerro de las Rosas, Córdoba, es óptica certificada y habilitada para Stellest.',
  },
  {
    q: '¿Necesito receta?',
    a: 'Sí, siempre. Stellest se fabrica para la receta del oftalmopediatra, y la decisión de hacer control de miopía es médica. Nosotros no medimos la vista ni diagnosticamos: hacemos el anteojo a partir de la receta.',
  },
  {
    q: '¿Lo cubre la obra social?',
    a: 'Depende de cada obra social y de su plan. Te damos el presupuesto y la factura para que lo presentes; con eso cada obra social define qué reintegra.',
  },
  {
    q: '¿Cómo se limpian?',
    a: 'Como cualquier cristal con tratamiento antirreflejo: con agua y jabón neutro, o con el paño de microfibra y el líquido limpiador. Nunca en seco con la remera, que raya. Los anillos no necesitan ningún cuidado especial.',
  },
];

export default function Page() {
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: PREGUNTAS.map((p) => ({
      '@type': 'Question',
      name: p.q,
      acceptedAnswer: { '@type': 'Answer', text: p.a },
    })),
  };

  return (
    <NotaStellest
      slug={nota.slug}
      lead={
        <>
          Estas son las preguntas que escuchamos todas las semanas en el mostrador cuando un papá
          o una mamá llega con una receta que dice <strong>Stellest</strong>. Las respondemos con
          lo que dice Essilor y con lo que vemos en el local, sin agregarle nada. Si tu duda no
          está, escribinos: la sumamos.
        </>
      }
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {PREGUNTAS.map((p) => (
        <section key={p.q}>
          <H2>{p.q}</H2>
          <P>{p.a}</P>
        </section>
      ))}

      <P>
        Si recién estás empezando, la nota madre es <Link href="/blog/stellest">Lentes Stellest: qué son y cómo funcionan</Link>.
        Y para entender por qué no se consigue en cualquier lado,{' '}
        <Link href="/blog/optica-certificada-stellest-cordoba">qué significa ser óptica certificada Stellest</Link>.
      </P>
    </NotaStellest>
  );
}
