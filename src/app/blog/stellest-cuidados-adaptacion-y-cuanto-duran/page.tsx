import { Metadata } from 'next';
import Link from 'next/link';
import { NotaStellest, H2, P, Destacado, Lista } from '@/components/blog/NotaStellest';
import { notaStellest } from '@/lib/constants/stellest-notas';

const nota = notaStellest('stellest-cuidados-adaptacion-y-cuanto-duran');

export const metadata: Metadata = {
  alternates: { canonical: `https://atelieroptica.com.ar/blog/${nota.slug}` },
  title: 'Stellest: adaptación, cuidados y cuándo renovarlos',
  description:
    'Cómo son los primeros días con lentes Stellest, cómo se limpian, qué hacer si cambia la graduación y cada cuánto se controlan. Guía práctica de una óptica certificada en Córdoba.',
  keywords: [
    'Stellest adaptación',
    'Stellest cuidados',
    'cuánto duran los lentes Stellest',
    'Stellest limpieza',
    'Stellest cambio de graduación',
    'Stellest Córdoba',
  ],
};

export default function Page() {
  return (
    <NotaStellest
      slug={nota.slug}
      lead={
        <>
          Ya tenés el <strong>Stellest</strong> en la mano, o estás por retirarlo. Esta nota es
          la que te damos en el mostrador, escrita: qué esperar los primeros días, cómo cuidarlo
          para que dure, y cuándo hay que hacer uno nuevo.
        </>
      }
    >
      <H2>Los primeros días</H2>
      <P>
        La mayoría de los chicos se adaptan a Stellest <strong>de inmediato</strong>, porque la
        zona central es un monofocal común: ve nítido igual que antes. Algunos, los primeros
        días, notan los anillos al mirar de reojo o una sensación distinta en la visión
        periférica. Es normal y desaparece en pocos días, cuando el cerebro deja de prestarle
        atención. Si después de una semana sigue molesto, o si ve borroso de frente, traelo:
        puede ser un tema de centrado o de ajuste del armazón, y se corrige.
      </P>

      <Destacado titulo="Lo único que no se negocia">
        <p className="m-0">
          <strong>Doce horas por día, todos los días.</strong> Es la condición con la que Stellest
          mostró su efecto en el ensayo clínico de Essilor. Desde que se levanta hasta que se
          acuesta: en la escuela, en casa, jugando, mirando pantallas. Un Stellest en la mochila
          no frena nada.
        </p>
      </Destacado>

      <H2>Cómo se limpian</H2>
      <Lista
        items={[
          'Con agua tibia y una gota de jabón neutro, frotando con los dedos y secando con el paño de microfibra. Es lo más efectivo y lo más barato.',
          'Con el líquido limpiador y el paño, cuando no hay agua a mano.',
          'Nunca en seco con la remera, el guardapolvo o papel: el polvo que hay sobre el cristal raya el tratamiento antirreflejo.',
          'Los anillos de microlentes no necesitan ningún cuidado especial. Se limpian como cualquier cristal.',
        ]}
      />

      <H2>Cómo se guardan y cómo se cuidan en la escuela</H2>
      <Lista
        items={[
          'En el estuche rígido cuando no los tiene puestos (educación física, pileta, dormir). El bolsillo de la mochila es donde más se rompen.',
          'Que se los saque con las dos manos. Con una sola se abre el armazón y empieza a resbalarse, y con Stellest el calce importa.',
          'No apoyarlos con los cristales hacia abajo.',
          'Si practica deportes de contacto, consultanos: a veces conviene un segundo par o una protección deportiva.',
        ]}
      />

      <H2>Cuándo hay que hacer un Stellest nuevo</H2>
      <P>
        Un Stellest dura lo que dura la receta. Cuando el oftalmopediatra, en el control, ve que
        la graduación cambió, se hace un cristal nuevo con la receta nueva. Eso es esperable y, de
        hecho, <strong>que el cambio sea chico es la señal de que está funcionando</strong>. Si el
        cristal se raya mucho o el armazón se deforma y ya no centra bien, también se renueva,
        aunque la receta no haya cambiado. Lo revisamos en el local y te decimos qué conviene.
      </P>

      <H2>Cada cuánto se controla</H2>
      <P>
        La frecuencia de los controles la define el oftalmopediatra; en control de miopía suele
        ser más seguido que en un chico sin miopía. Lo que te pedimos nosotros es simple:{' '}
        <strong>cada vez que vuelvan del control, pasen por el local</strong>. Reajustamos el
        armazón sin cargo, revisamos el centrado y, si hay receta nueva, la cotizamos en el
        momento.
      </P>

      <H2>Señales de que algo no está bien</H2>
      <Lista
        items={[
          'El anteojo se le baja por la nariz y se lo acomoda a cada rato.',
          'Tuerce la cabeza o mira por arriba del armazón.',
          'Se queja de que ve borroso de frente (no de reojo).',
          'El armazón quedó torcido después de un golpe.',
        ]}
      />
      <P>
        Cualquiera de esas es motivo para traerlo. No hace falta turno. Y si querés entender por
        qué el armazón pesa tanto en todo esto, leé{' '}
        <Link href="/blog/stellest-que-armazon-elegir">qué armazón elegir para Stellest</Link>.
      </P>
    </NotaStellest>
  );
}
