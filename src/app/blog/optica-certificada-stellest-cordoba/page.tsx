import { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { NotaStellest, H2, P, Destacado, Lista } from '@/components/blog/NotaStellest';
import { notaStellest } from '@/lib/constants/stellest-notas';

const nota = notaStellest('optica-certificada-stellest-cordoba');

export const metadata: Metadata = {
  alternates: { canonical: `https://atelieroptica.com.ar/blog/${nota.slug}` },
  title: 'Óptica certificada Stellest en Córdoba',
  description:
    'Atelier Óptica es óptica certificada y habilitada por Essilor para trabajar lentes Stellest en Córdoba. Qué significa la certificación, por qué existe y cómo reconocer una óptica habilitada.',
  keywords: [
    'óptica certificada Stellest',
    'Stellest Córdoba',
    'dónde comprar Stellest en Córdoba',
    'óptica habilitada Stellest',
    'lentes Stellest Essilor Córdoba',
    'control de miopía infantil Córdoba',
    'Atelier Óptica',
  ],
};

export default function Page() {
  return (
    <NotaStellest
      slug={nota.slug}
      lead={
        <>
          Cuando el oftalmopediatra receta <strong>Stellest</strong>, la primera pregunta de muchos
          padres es dónde conseguirlo. Y la respuesta sorprende: <strong>no en cualquier óptica</strong>.
          Essilor fabrica Stellest únicamente para ópticas que certificó para trabajarlo.{' '}
          <strong>Atelier Óptica, en el Cerro de las Rosas, Córdoba, es una de ellas.</strong> Esta
          nota explica qué quiere decir eso y por qué te conviene saberlo antes de encargar el anteojo.
        </>
      }
    >
      <Destacado titulo="En una línea">
        <p className="m-0">
          Atelier Óptica está <strong>certificada y habilitada por Essilor</strong> para vender,
          medir y montar lentes Stellest. Si te lo recetaron, podés traernos la receta directamente.
        </p>
      </Destacado>

      <figure className="my-10">
        <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto">
          <Image src="/images/stellest/stellest-3.jpeg" alt="Anteojo con cristales Stellest en tres cuartos, con la sombra de los anillos concéntricos de microlentes." width={900} height={1600} className="w-full rounded-lg shadow-md" />
          <Image src="/images/stellest/stellest-1.jpeg" alt="Corte del cristal Stellest con la zona de corrección central y la zona de control de la miopía alrededor." width={900} height={1600} className="w-full rounded-lg shadow-md" />
        </div>
        <figcaption className="text-xs text-stone-500 text-center mt-3">Gráficas oficiales de Essilor para Stellest.</figcaption>
      </figure>

      <H2>Por qué Stellest no se vende en cualquier lado</H2>
      <P>
        Un cristal monofocal común se puede montar en casi cualquier armazón y con una tolerancia
        de centrado bastante amplia: si el centro óptico queda un milímetro corrido, el chico
        sigue viendo bien. Con Stellest no es así. Las <strong>1.021 microlentes</strong> que
        frenan el crecimiento del ojo están distribuidas en <strong>11 anillos concéntricos</strong>{' '}
        alrededor de una zona central libre, y esa constelación tiene que quedar{' '}
        <strong>centrada en la pupila</strong> del chico durante todo el día. Si se monta mal, el
        cristal corrige la visión igual, pero pierde parte de su efecto de control, que es
        justamente lo que se está pagando.
      </P>
      <P>
        Por eso Essilor no lo libera al canal general. Exige que la óptica esté{' '}
        <strong>capacitada en el producto, en la toma de medidas y en el montaje</strong>, y recién
        entonces la habilita. Es una de las pocas lentes del catálogo de Essilor que funciona así.
      </P>

      <H2>Qué significa que una óptica esté certificada</H2>
      <Lista
        items={[
          <><strong>Puede pedirle Stellest a Essilor.</strong> Parece obvio, pero es el punto: una óptica no certificada directamente no puede encargar el cristal.</>,
          <><strong>Sabe tomar las medidas que Stellest necesita.</strong> No alcanza con la distancia entre pupilas: hay que medir altura de pupila con el armazón puesto y verificar el calce real, en la cara del chico.</>,
          <><strong>Sabe elegir y ajustar el armazón.</strong> En control de miopía el armazón es parte del tratamiento, no un accesorio. <Link href="/blog/stellest-que-armazon-elegir">Lo contamos aparte</Link>.</>,
          <><strong>Sabe qué explicarle a la familia.</strong> Las 12 horas diarias de uso del estudio clínico, qué esperar y qué no, cuándo volver a control. Un Stellest en la mochila no frena nada.</>,
        ]}
      />

      <H2>Cómo reconocer una óptica habilitada</H2>
      <P>
        Lo más simple es preguntar directamente si la óptica está certificada por Essilor para
        Stellest y si lo pide bajo ese nombre. Una óptica que lo trabaja te va a hablar de la
        tecnología H.A.L.T., te va a pedir la receta del oftalmopediatra, te va a medir con el
        armazón puesto y te va a dar un plazo de entrega concreto. Si te ofrecen &quot;un cristal
        parecido&quot; o &quot;uno de control de miopía genérico&quot; sin nombrarlo, no es Stellest.
      </P>

      <H2>Qué hacemos distinto en Atelier con un Stellest</H2>
      <P>
        Tratamos cada Stellest como lo que es: un pedido de precisión para un chico que va a usar
        ese anteojo doce horas por día durante un año o más. Eso se traduce en cosas concretas:
      </P>
      <Lista
        items={[
          'Elegimos el armazón con el chico, probando calce real, no en una foto.',
          'Tomamos las medidas con el armazón ya ajustado a su cara, que es como lo va a usar.',
          'Al llegar el cristal de Essilor, lo controlamos antes de montarlo.',
          'Entregamos explicando a la familia cómo cuidar el anteojo y cómo ajustarlo en casa.',
          'Revisamos el calce sin cargo cuando vuelven del control con el oftalmólogo.',
        ]}
      />
      <P>
        El paso a paso completo, con los tiempos reales, está en{' '}
        <Link href="/blog/stellest-de-la-receta-al-anteojo">Stellest: de la receta al anteojo</Link>.
      </P>

      <H2>Lo que la certificación no cambia</H2>
      <P>
        Nosotros no diagnosticamos miopía ni decidimos si tu hijo necesita control. Eso es del{' '}
        <strong>oftalmopediatra</strong>. Lo que hace la certificación es garantizar que, una vez
        tomada esa decisión médica, el cristal se fabrique, se mida y se monte como Essilor lo
        diseñó. Si todavía no tenés receta, el primer paso es el control con el médico; después,
        venís con la receta y hacemos el resto.
      </P>
    </NotaStellest>
  );
}
