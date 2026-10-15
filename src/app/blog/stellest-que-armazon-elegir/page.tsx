import { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { NotaStellest, H2, P, Destacado, Lista } from '@/components/blog/NotaStellest';
import { notaStellest } from '@/lib/constants/stellest-notas';

const nota = notaStellest('stellest-que-armazon-elegir');

export const metadata: Metadata = {
  alternates: { canonical: `https://atelieroptica.com.ar/blog/${nota.slug}` },
  title: 'Qué armazón elegir para lentes Stellest',
  description:
    'Con Stellest el armazón es parte del tratamiento: los anillos de microlentes tienen que quedar centrados en la pupila todo el día. Qué mirar, qué evitar y cómo lo elegimos con tu hijo.',
  keywords: [
    'armazón para Stellest',
    'anteojos Stellest niños',
    'armazón control de miopía',
    'Stellest armazón',
    'lentes Stellest Córdoba',
  ],
};

export default function Page() {
  return (
    <NotaStellest
      slug={nota.slug}
      lead={
        <>
          En un anteojo común, el armazón es gusto y comodidad. En un <strong>Stellest</strong>, es
          parte del tratamiento. Los 11 anillos de microlentes que frenan el crecimiento del ojo
          tienen que quedar <strong>centrados en la pupila de tu hijo durante doce horas por día</strong>,
          y eso lo decide el armazón tanto como el cristal. Esta nota es la parte que casi nadie
          explica.
        </>
      }
    >
      <figure className="my-10 max-w-md mx-auto">
        <Image src="/images/stellest/stellest-2.jpeg" alt="Anteojo con cristales Stellest visto de frente: los anillos concéntricos se ven en la sombra proyectada." width={900} height={1600} className="w-full rounded-lg shadow-md" />
        <figcaption className="text-xs text-stone-500 text-center mt-3">Los anillos se ven en la sombra. Para que trabajen, tienen que quedar donde mira el chico. Imagen: Essilor.</figcaption>
      </figure>

      <H2>Por qué el centrado importa más que en cualquier otro anteojo</H2>
      <P>
        El centro del cristal Stellest es una zona de visión única por donde el chico mira. Las
        microlentes están alrededor y actúan sobre la visión periférica, que es la que le da al ojo
        la señal de crecer. Si el armazón se resbala por la nariz, esa zona central baja y los
        anillos quedan corridos respecto de la pupila. El chico sigue viendo bien, así que{' '}
        <strong>nadie lo nota</strong>, pero el cristal pierde parte de su efecto de control. Es
        un problema silencioso, y por eso el armazón se elige con más cuidado que de costumbre.
      </P>

      <Destacado titulo="La regla corta">
        <p className="m-0">
          Un armazón para Stellest tiene que <strong>quedarse en su lugar</strong>. Ni grande, ni
          pesado, ni con el puente abierto. Si se lo tiene que acomodar cada rato, no sirve, por
          lindo que sea.
        </p>
      </Destacado>

      <H2>Qué miramos cuando lo elegimos</H2>
      <Lista
        items={[
          <><strong>El puente.</strong> Es lo que sostiene el anteojo en la cara de un chico. Los chicos tienen el puente de la nariz bajo y poco desarrollado; un armazón de adulto en chico se desliza. Buscamos puentes diseñados para rostros infantiles o plaquetas ajustables.</>,
          <><strong>El ancho.</strong> El armazón tiene que ir de sien a sien sin sobresalir ni apretar. Si sobra ancho, las pupilas quedan muy hacia adentro del cristal y las microlentes trabajan descentradas.</>,
          <><strong>La altura del aro.</strong> Un aro muy bajo deja poco cristal por arriba de la pupila; uno muy alto es pesado y se cae. Medimos la altura de pupila con el armazón puesto y ajustado, no al ojo.</>,
          <><strong>Las patillas.</strong> Tienen que llegar bien atrás de la oreja y curvarse ahí, para que el anteojo no se vaya hacia adelante cuando el chico mira para abajo (que es casi todo el día en la escuela).</>,
          <><strong>El peso y el material.</strong> Acetato y TR90 funcionan bien; lo que evitamos es el metal fino sin plaquetas y los armazones &quot;de moda&quot; grandes que no están pensados para un rostro chico.</>,
        ]}
      />

      <H2>¿Puede usar el armazón que ya tiene?</H2>
      <P>
        A veces sí. Si el armazón actual le calza bien, está en buen estado y tiene una forma y
        tamaño que permiten centrar bien el Stellest, lo aprovechamos. Lo revisamos en el local:
        vemos cómo le queda puesto y si el aro tiene altura suficiente. Si no sirve, te lo decimos
        y te mostramos opciones, pero no vamos a montar un Stellest en un armazón que sabemos que
        va a trabajar corrido.
      </P>

      <H2>¿Y si al chico no le gusta el que le recomendamos?</H2>
      <P>
        Es una pregunta real, y la tomamos en serio: un anteojo que el chico no quiere usar
        tampoco frena nada. Por eso elegimos <strong>con él</strong>, no por él. Entre los
        armazones que calzan bien siempre hay varios, y de esos elige el chico. Lo que no
        negociamos es el calce.
      </P>

      <H2>El ajuste no termina el día de la entrega</H2>
      <P>
        Los chicos crecen, los armazones se abren y las patillas se aflojan. Por eso al entregar
        te explicamos cómo ver si se está resbalando, y cada vez que vuelvan del control con el
        oftalmopediatra <strong>reajustamos el armazón sin cargo</strong>. Es parte de hacer bien
        un Stellest, no un favor.
      </P>
      <P>
        Cómo sigue todo después de elegir el armazón, con los tiempos reales, está en{' '}
        <Link href="/blog/stellest-de-la-receta-al-anteojo">Stellest: de la receta al anteojo</Link>.
      </P>
    </NotaStellest>
  );
}
