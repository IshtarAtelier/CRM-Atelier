import { Metadata } from 'next';
import { StorefrontNavbar } from '@/components/Storefront/StorefrontNavbar';
import { StorefrontFooter } from '@/components/Storefront/StorefrontFooter';

export const metadata: Metadata = {
  title: 'Por qué los anteojos de farmacia o calle destruyen tu vista | Atelier Óptica',
  description: "Descubrí los peligros de usar lentes pregraduados de farmacia o kiosco. Conocé la importancia de los centros ópticos y la distancia pupilar para tu salud visual. Envíos a toda Argentina. Cuotas sin interés. Atención personalizada y asesoramiento estético.",
  keywords: ["óptica Argentina", "envíos a toda Argentina", "cuotas", "atención personalizada", "anteojos de receta", "peligros anteojos pregraduados farmacia"],
};

export default function PeligrosAnteojosFarmaciaPage() {
  return (
    <div className="min-h-screen bg-[#faf8f5] text-black font-sans selection:bg-black selection:text-white">
      <StorefrontNavbar theme="light" />
      
      <main className="max-w-3xl mx-auto px-6 pt-32 pb-20 lg:pt-40">
        <article>
          <header className="mb-12 lg:mb-16 text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#999] mb-4">
              Salud Visual y Prevención
            </p>
            <h1 className="text-3xl lg:text-5xl font-normal tracking-tight mb-6 lg:mb-8 leading-tight">
              Por qué los anteojos de farmacia o calle destruyen tu vista
            </h1>
            <p className="text-[14px] lg:text-[15px] text-[#666] leading-relaxed max-w-xl mx-auto">
              Seguro alguna vez te tentaste con esos lentes listos para usar que venden en la farmacia o en la calle. Parecen una solución rápida y barata, pero lo que estás comprando en realidad es un problema visual a futuro.
            </p>
          </header>

          <div className="prose prose-lg max-w-none text-[#333] space-y-8">
            <p className="text-[15px] leading-relaxed">
              Es súper común: estás apurado, perdiste tus lentes, entrás a una farmacia o a un kiosco y te probás unos anteojos genéricos hasta que sentís que "ves bien". Te los llevás puestos creyendo que salvaste el día. Sin embargo, como ópticos profesionales en Atelier Óptica, tenemos la responsabilidad de explicarte por qué esta práctica es tan perjudicial.
            </p>

            <h2 className="text-2xl font-medium mt-12 mb-6">El mito de la "solución rápida"</h2>
            <p className="text-[15px] leading-relaxed">
              Los anteojos pregraduados están fabricados en serie con medidas estándar que no se adaptan a la anatomía real de ninguna persona en particular. En la óptica, cuando armamos un par de anteojos, no solo nos guiamos estrictamente por la graduación que te indicó en la receta el médico oftalmólogo, sino que también tomamos medidas precisas y únicas de tu rostro.
            </p>

            <h2 className="text-2xl font-medium mt-12 mb-6">El peligro de los centros ópticos no controlados</h2>
            <p className="text-[15px] leading-relaxed">
              Cada lente tiene un "centro óptico", que es el punto exacto por donde deberías mirar para que la corrección sea perfecta. En los anteojos de farmacia, estos centros están ubicados de manera genérica. Si tus ojos no coinciden milimétricamente con esos centros, vas a estar mirando a través de una zona del cristal que genera aberraciones y distorsiones visuales.
            </p>
            <p className="text-[15px] leading-relaxed">
              Esto obliga a tus músculos oculares a hacer un esfuerzo antinatural para compensar esa mala alineación. ¿El resultado? Fatiga visual severa, dolores de cabeza, mareos y un desgaste innecesario en tu día a día.
            </p>

            <div className="bg-[#f9f9f9] border-l-4 border-black p-6 my-10">
              <h3 className="text-lg font-medium mb-2">La importancia de la Distancia Pupilar (DP)</h3>
              <p className="text-[14px] leading-relaxed text-[#555]">
                La distancia entre tus pupilas es única. Los lentes de calle asumen una DP promedio. Si tu DP es diferente, los lentes pregraduados te van a inducir un efecto prismático indeseado. Básicamente, estás forzando a tus ojos a desviar su eje visual todo el tiempo que los usás.
              </p>
            </div>

            <h2 className="text-2xl font-medium mt-12 mb-6">Cristales de mala calidad óptica</h2>
            <p className="text-[15px] leading-relaxed">
              Además de los problemas geométricos, los materiales con los que se fabrican estos anteojos suelen ser plásticos inyectados de baja calidad. No cuentan con tratamientos adecuados y terminan rayándose fácilmente, perdiendo su transparencia, lo que te obliga a forzar la vista todavía más para ver a través de ellos.
            </p>

            <h2 className="text-2xl font-medium mt-12 mb-6">No reemplazan el chequeo médico</h2>
            <p className="text-[15px] leading-relaxed">
              Comprar estos lentes muchas veces retrasa una visita fundamental. Creer que con esto solucionás tu problema visual es un error muy frecuente.
            </p>
            <p className="text-[15px] leading-relaxed font-medium">
              Nuestra recomendación número uno, siempre, es: visitá al médico oftalmólogo. Ellos son los únicos profesionales capacitados para evaluar tu salud ocular, realizar diagnósticos médicos y prescribir la receta correcta.
            </p>

            <div className="border border-black/10 p-8 mt-16 text-center">
              <h3 className="text-xl font-medium mb-4">Cuidemos tu visión como corresponde</h3>
              <p className="text-[15px] text-[#666] mb-8 max-w-lg mx-auto">
                No arriesgues tus ojos con soluciones temporales. Una vez que tengas tu receta oftalmológica actualizada en mano, te esperamos en Atelier Óptica. Te vamos a asesorar sobre los cristales y armazones adecuados para vos.
              </p>
              <a href="https://wa.me/5493518685644" target="_blank" rel="noopener noreferrer" 
                className="inline-block bg-black text-white px-8 py-4 text-[11px] font-bold uppercase tracking-widest hover:bg-[#333] transition-colors"
              >
                Escribinos
              </a>
            </div>
          </div>
        </article>
      </main>

      <StorefrontFooter />
    </div>
  );
}
