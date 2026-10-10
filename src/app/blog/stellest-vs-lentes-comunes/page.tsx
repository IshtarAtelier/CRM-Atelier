import { Metadata } from 'next';
import Link from 'next/link';
import { NotaStellest, H2, P, Destacado } from '@/components/blog/NotaStellest';
import { notaStellest } from '@/lib/constants/stellest-notas';

const nota = notaStellest('stellest-vs-lentes-comunes');

export const metadata: Metadata = {
  alternates: { canonical: `https://atelieroptica.com.ar/blog/${nota.slug}` },
  title: 'Stellest vs. lentes comunes: diferencias reales',
  description:
    'Un monofocal común y un Stellest corrigen la miopía igual de bien. La diferencia está en lo que hacen con la miopía del año que viene. Comparación punto por punto, sin exagerar.',
  keywords: [
    'diferencia entre Stellest y lentes comunes',
    'Stellest vs monofocal',
    'Stellest o lentes comunes',
    'lentes para frenar la miopía',
    'control de miopía niños Córdoba',
    'Stellest Córdoba',
  ],
};

const FILAS: { que: string; comun: string; stellest: string }[] = [
  { que: 'Corrige la miopía (ve bien de lejos)', comun: 'Sí', stellest: 'Sí, igual' },
  { que: 'Actúa sobre el avance de la miopía', comun: 'No', stellest: 'Sí: 67 % menos de progresión en promedio (ensayo clínico de 2 años, uso ≥ 12 h/día)' },
  { que: 'Cómo lo hace', comun: 'Enfoca la imagen en el centro de la retina', stellest: '1.021 microlentes en 11 anillos generan una señal por delante de la retina que le indica al ojo que deje de alargarse' },
  { que: 'Se nota a simple vista', comun: 'No', stellest: 'No: acabado estético, se ve transparente' },
  { que: 'Horas de uso necesarias', comun: 'Las que quiera', stellest: 'Al menos 12 por día, todos los días' },
  { que: 'Tolerancia al armazón flojo', comun: 'Alta', stellest: 'Baja: los anillos tienen que quedar centrados en la pupila' },
  { que: 'Quién lo indica', comun: 'Cualquier receta de miopía', stellest: 'El oftalmopediatra, cuando la miopía está en progresión' },
  { que: 'Dónde se consigue', comun: 'En cualquier óptica', stellest: 'Solo en ópticas certificadas por Essilor' },
  { que: 'Tiempo de fabricación', comun: 'Días', stellest: 'Alrededor de 25 días hábiles (fabricado a pedido)' },
  { que: 'Precio', comun: 'Menor', stellest: 'Mayor: se cotiza con la receta' },
];

export default function Page() {
  return (
    <NotaStellest
      slug={nota.slug}
      lead={
        <>
          La pregunta que más confunde a los padres: si un lente común ya hace que mi hijo vea
          bien, <strong>¿qué agrega Stellest?</strong> La respuesta corta es que agrega lo que
          pasa con la miopía <em>después</em>. Acá va la comparación punto por punto, sin inflar
          nada.
        </>
      }
    >
      <Destacado titulo="La diferencia en una frase">
        <p className="m-0">
          Un lente común corrige la miopía que tu hijo tiene <strong>hoy</strong>. Stellest la
          corrige igual y, además, está diseñado para que la del <strong>año que viene</strong>{' '}
          sea menor de lo que habría sido.
        </p>
      </Destacado>

      <div className="overflow-x-auto my-10">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-stone-900 text-stone-50">
              <th className="text-left p-3 font-semibold"> </th>
              <th className="text-left p-3 font-semibold">Lente común (monofocal)</th>
              <th className="text-left p-3 font-semibold">Stellest</th>
            </tr>
          </thead>
          <tbody>
            {FILAS.map((f, i) => (
              <tr key={f.que} className={i % 2 ? 'bg-white' : 'bg-stone-100'}>
                <td className="p-3 font-semibold text-stone-800 align-top">{f.que}</td>
                <td className="p-3 text-stone-700 align-top">{f.comun}</td>
                <td className="p-3 text-stone-700 align-top">{f.stellest}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H2>Por qué un lente común no frena la miopía</H2>
      <P>
        En un chico miope el ojo crece más largo de lo que debería, y por eso la graduación sube
        control tras control. Un monofocal común enfoca la imagen nítida en el centro de la retina,
        pero en la periferia la imagen cae por detrás. El ojo interpreta ese desenfoque
        periférico como una orden de seguir creciendo. El lente corrige, pero no le dice nada a ese
        crecimiento. No es que &quot;le haga mal&quot;: es que no está diseñado para eso.
      </P>

      <H2>Qué hace distinto Stellest</H2>
      <P>
        Mantiene el centro igual que un monofocal (por eso ve igual de bien) y agrega, alrededor,
        1.021 microlentes asféricas en 11 anillos que crean un volumen de señal <em>por delante</em>{' '}
        de la retina. Esa señal es la que le indica al ojo que deje de alargarse. Es la tecnología
        H.A.L.T. de Essilor, y está explicada con más detalle en{' '}
        <Link href="/blog/stellest">la nota principal sobre Stellest</Link>.
      </P>

      <H2>Lo que Stellest NO hace mejor que un lente común</H2>
      <P>
        No ve mejor. No corrige más. No cura la miopía ni la revierte. Si tu hijo no lo usa las
        doce horas, no frena nada. Y si el armazón le queda flojo, pierde parte de su efecto sin
        que nadie lo note. Lo decimos porque un padre que espera más de lo que Stellest promete
        se va a decepcionar, y uno que entiende exactamente qué compra lo usa bien.
      </P>

      <H2>¿Entonces cuál le conviene a mi hijo?</H2>
      <P>
        Eso lo define el <strong>oftalmopediatra</strong>, no la óptica. En general, Stellest se
        indica cuando la miopía está en progresión: cuando la graduación sube de un control al
        siguiente. Si el médico lo indicó, en Atelier somos{' '}
        <Link href="/blog/optica-certificada-stellest-cordoba">óptica certificada para trabajarlo</Link>; si
        no lo indicó y tenés dudas, la mejor pregunta es para él en el próximo control.
      </P>
    </NotaStellest>
  );
}
