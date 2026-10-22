import { Metadata } from 'next';
import Link from 'next/link';
import { NotaStellest, H2, P, Destacado, Lista } from '@/components/blog/NotaStellest';
import { notaStellest } from '@/lib/constants/stellest-notas';

const nota = notaStellest('stellest-precio-argentina-y-formas-de-pago');

/**
 * OJO: esta nota NO lleva un importe escrito. El precio de Stellest vive en el
 * sistema (PricingService); un número tipeado acá quedaría viejo en semanas y
 * es exactamente lo que la regla R6 de redes prohíbe.
 * Stellest tiene PRECIO ÚNICO: no depende de la receta (Ishtar, 10/10/2026).
 * Es el único cristal así; no escribir "depende de la graduación".
 */
export const metadata: Metadata = {
  alternates: { canonical: `https://atelieroptica.com.ar/blog/${nota.slug}` },
  title: 'Precio de lentes Stellest en Argentina: qué incluye y cómo se paga',
  description:
    'Los lentes Stellest de Essilor tienen precio único: no depende de la receta. Qué viene incluido, qué cambia el total y las formas de pago en Atelier Óptica, Córdoba.',
  keywords: [
    'precio lentes Stellest',
    'precio Stellest Argentina',
    'cuánto cuesta Stellest',
    'Stellest cuotas',
    'lentes Stellest Essilor precio',
    'Stellest Córdoba',
  ],
};

export default function Page() {
  return (
    <NotaStellest
      slug={nota.slug}
      mensajeWhatsApp="Hola! Quiero un presupuesto de lentes Stellest. Tengo la receta."
      lead={
        <>
          &quot;¿Cuánto sale Stellest?&quot; es la segunda pregunta de todos los padres, después de
          &quot;¿qué es?&quot;. La respuesta corta: Stellest tiene <strong>precio único</strong>, el mismo para
          cualquier graduación de miopía y astigmatismo. <strong>No depende de la receta.</strong>{' '}
          Lo que cambia el total es lo que elijas alrededor del cristal. Acá te contamos qué viene
          incluido y cómo lo podés pagar.
        </>
      }
    >
      <Destacado titulo="Por qué no ponemos un número acá">
        <p className="m-0">
          Un precio publicado en una nota queda viejo en semanas, y un padre que lo lee después
          se lleva una sorpresa en el mostrador. Como el cristal tiene precio único, te lo pasamos{' '}
          <strong>en el momento</strong>, por WhatsApp o en el local, junto con las opciones de
          armazón. Es gratis y no te compromete.
        </p>
      </Destacado>

      <H2>Qué cambia el total (y qué no)</H2>
      <Lista
        items={[
          <><strong>La graduación NO.</strong> Stellest se fabrica a pedido para cada receta, pero el precio del cristal es el mismo para cualquier miopía y astigmatismo dentro de los rangos que fabrica Essilor.</>,
          <><strong>El antirreflejo viene incluido.</strong> Stellest se pide con tratamiento Crizal, que protege el cristal, facilita la limpieza y reduce reflejos.</>,
          <><strong>El armazón.</strong> Es la parte más variable. En control de miopía el armazón tiene que calzar bien y aguantar el uso diario de un chico, pero hay opciones para todos los presupuestos.</>,
          <><strong>Cuántos pares.</strong> Muchas familias piden un segundo par como respaldo, porque un chico que usa Stellest 12 horas por día no puede quedarse sin anteojos una semana.</>,
        ]}
      />

      <H2>Qué viene incluido en Atelier</H2>
      <P>
        Cuando te cotizamos un Stellest, el precio incluye el cristal Essilor fabricado para la
        receta de tu hijo, la toma de medidas con el armazón puesto, el control del cristal al
        llegar del laboratorio, el montaje, el ajuste final en la cara del chico y la explicación
        a la familia de cómo usarlo y cuidarlo. También el reajuste del armazón sin cargo cuando
        vuelven del control. Nada de eso aparece como renglón aparte.
      </P>

      <H2>Formas de pago</H2>
      <P>
        Podés pagar por transferencia, con tarjeta de débito o de crédito. Con
        tarjeta de crédito tenés <strong>3 y 6 cuotas sin interés, y hasta 12 cuotas fijas</strong>.
        Pagando por transferencia hay un descuento sobre el precio de lista, que te indicamos en el
        presupuesto. Cuando lo pidas por WhatsApp, decinos cómo pensás pagarlo y
        te mandamos el total de cada opción.
      </P>

      <H2>¿Es caro para lo que es?</H2>
      <P>
        Es más caro que un monofocal común, y es razonable que lo sea: es un cristal con 1.021
        microlentes fabricado a medida, que además de corregir la visión está diseñado para que
        la miopía avance menos. Lo que conviene comparar no es Stellest contra un cristal común
        de hoy, sino Stellest contra la graduación que tu hijo podría tener dentro de cinco años
        sin control. Esa comparación la hace el oftalmopediatra con vos; nosotros solo podemos
        decirte que en el ensayo clínico de dos años de Essilor, usados al menos 12 horas por día,
        los chicos con Stellest progresaron en promedio un 67 % menos que con lentes comunes.
      </P>

      <H2>Cómo pedir el presupuesto</H2>
      <Lista
        items={[
          'Sacale una foto a la receta del oftalmopediatra (que diga Stellest o control de miopía).',
          'Mandala por WhatsApp con la edad de tu hijo y si ya usa anteojos.',
          'Te respondemos con el precio del cristal (es único) y las formas de pago. El armazón lo elegimos juntos en el local.',
        ]}
      />
      <P>
        Si todavía no sabés qué es Stellest o cómo funciona, empezá por{' '}
        <Link href="/blog/stellest">la nota principal</Link>. Y si querés saber por qué no se consigue
        en cualquier óptica, leé{' '}
        <Link href="/blog/optica-certificada-stellest-cordoba">qué significa ser óptica certificada Stellest</Link>.
      </P>
    </NotaStellest>
  );
}
