import { Metadata } from 'next';
import Link from 'next/link';
import { NotaStellest, H2, P, Destacado } from '@/components/blog/NotaStellest';
import { notaStellest } from '@/lib/constants/stellest-notas';

const nota = notaStellest('stellest-de-la-receta-al-anteojo');

/**
 * Los 25 días hábiles salen de `src/lib/business-days.ts`, que es lo que el
 * sistema le promete al cliente en cada venta de Stellest. Si ese plazo cambia
 * ahí, hay que cambiarlo acá también.
 */
const DIAS_HABILES_STELLEST = 25;

export const metadata: Metadata = {
  alternates: { canonical: `https://atelieroptica.com.ar/blog/${nota.slug}` },
  title: 'Cómo hacemos un Stellest en Atelier: de la receta al anteojo',
  description:
    'El paso a paso real de un pedido de lentes Stellest en una óptica certificada de Córdoba: medición, armazón, pedido a Essilor, control del cristal, montaje y entrega. Con los tiempos reales.',
  keywords: [
    'cómo se hace Stellest',
    'Stellest cuánto tarda',
    'pedir Stellest Córdoba',
    'Stellest Essilor óptica',
    'lentes Stellest Córdoba',
  ],
};

const PASOS: { titulo: string; texto: string }[] = [
  {
    titulo: 'Traés la receta',
    texto:
      'Con la receta del oftalmopediatra que indica Stellest (o control de miopía), por WhatsApp o en el local. La leemos, verificamos que la graduación entre en los rangos que fabrica Essilor y te cotizamos el cristal en el momento. Si venís con el chico, mejor: el paso siguiente lo necesita.',
  },
  {
    titulo: 'Elegimos el armazón, con el chico',
    texto:
      'Probamos armazones en su cara, no en una foto. Buscamos puente, ancho y altura que lo mantengan en su lugar doce horas por día, y de los que calzan bien elige él. Si su armazón actual sirve, lo aprovechamos.',
  },
  {
    titulo: 'Tomamos las medidas con el armazón puesto',
    texto:
      'Ajustamos el armazón a su cara y recién ahí medimos distancia entre pupilas y altura de pupila para cada ojo. Es la medida que decide dónde van a quedar los anillos de microlentes. Se mide como lo va a usar, no al ojo ni con otro armazón.',
  },
  {
    titulo: 'Pedimos el cristal a Essilor',
    texto:
      'Stellest se fabrica a pedido para cada receta. Enviamos graduación, medidas y datos del armazón, y Essilor fabrica el cristal con las 1.021 microlentes en su posición exacta. Es un proceso especial del laboratorio, y por eso tarda más que un monofocal común.',
  },
  {
    titulo: 'Controlamos el cristal al llegar',
    texto:
      'Cuando llega, lo verificamos antes de montarlo: que la graduación sea la de la receta y que el centrado coincida con las medidas que mandamos. Si algo no cierra, vuelve al laboratorio antes de tocar el armazón.',
  },
  {
    titulo: 'Montamos y ajustamos',
    texto:
      'El cristal se corta y se monta en el armazón elegido, y el anteojo terminado se ajusta en la cara del chico: patillas, plaquetas, inclinación. Es el ajuste que hace que las medidas del paso 3 se cumplan en la vida real.',
  },
  {
    titulo: 'Entregamos y explicamos',
    texto:
      'Te avisamos por WhatsApp cuando está listo. En la entrega le probamos el anteojo al chico, verificamos que vea bien y les explicamos a los dos lo importante: doce horas por día, cómo limpiarlo, cómo guardarlo y cómo darse cuenta si se está resbalando.',
  },
  {
    titulo: 'Volvés después del control',
    texto:
      'Cada vez que vuelvan del oftalmopediatra, pasen por el local. Reajustamos el armazón sin cargo, revisamos el centrado y, si hay receta nueva, la cotizamos ahí mismo.',
  },
];

export default function Page() {
  return (
    <NotaStellest
      slug={nota.slug}
      lead={
        <>
          Un <strong>Stellest</strong> no se saca de un cajón: se fabrica para la receta de tu
          hijo y se monta a su medida. Este es el recorrido completo en Atelier, paso por paso,
          con lo que hacemos en cada uno y cuánto tarda. Para que sepas qué esperar y por qué
          cada paso existe.
        </>
      }
    >
      <Destacado titulo="Cuánto tarda">
        <p className="m-0">
          Alrededor de <strong>{DIAS_HABILES_STELLEST} días hábiles</strong> desde que confirmás
          el pedido hasta que el anteojo está listo para retirar. Es el plazo real que le damos a
          cada familia, y es el que Essilor necesita para fabricar un cristal a pedido con proceso
          especial. Si tenés una fecha límite (vuelta a clases, viaje), decinoslo al pedirlo.
        </p>
      </Destacado>

      <ol className="list-none p-0 m-0 my-10 space-y-8">
        {PASOS.map((p, i) => (
          <li key={p.titulo} className="flex gap-5">
            <div className="shrink-0 w-10 h-10 rounded-full bg-stone-900 text-stone-50 flex items-center justify-center font-serif text-lg">
              {i + 1}
            </div>
            <div>
              <h2 className="text-xl font-serif text-stone-900 mt-1 mb-2">{p.titulo}</h2>
              <p className="text-stone-700 leading-relaxed m-0">{p.texto}</p>
            </div>
          </li>
        ))}
      </ol>

      <H2>Por qué tantos pasos para un anteojo</H2>
      <P>
        Porque es un anteojo que va a trabajar sobre el crecimiento del ojo de tu hijo durante un
        año o más, y su efecto depende de que los anillos queden donde tienen que quedar. Cada
        paso de arriba existe para eso: el armazón, las medidas con el armazón puesto, el control
        del cristal al llegar y el ajuste final son lo que convierte un cristal bien fabricado en
        un anteojo que funciona. Es también el motivo por el que Essilor exige que la óptica esté{' '}
        <Link href="/blog/optica-certificada-stellest-cordoba">certificada para trabajar Stellest</Link>.
      </P>

      <H2>Qué necesitás para empezar</H2>
      <P>
        Solo la receta del oftalmopediatra. Sacale una foto y mandala por WhatsApp, o vení al
        local con el chico. No hace falta turno. Si querés ir con el presupuesto en mente, leé{' '}
        <Link href="/blog/stellest-precio-argentina-y-formas-de-pago">de qué depende el precio de un Stellest y cómo se paga</Link>.
      </P>
    </NotaStellest>
  );
}
