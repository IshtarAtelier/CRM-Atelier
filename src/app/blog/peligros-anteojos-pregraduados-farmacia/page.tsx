import { Metadata } from 'next';
import { StorefrontNavbar } from '@/components/Storefront/StorefrontNavbar';
import { StorefrontFooter } from '@/components/Storefront/StorefrontFooter';

export const metadata: Metadata = {
  alternates: { canonical: '/blog/peligros-anteojos-pregraduados-farmacia' },
  title: "Peligros de los Anteojos de Farmacia o Calle | Atelier Óptica Córdoba",
  description: "Descubrí por qué usar anteojos pregraduados de farmacia daña tu salud visual. Evitá mareos y fatiga. Visitá nuestra óptica en Cerro de las Rosas, Córdoba.",
  keywords: [
    "peligros anteojos farmacia",
    "lentes pregraduados",
    "óptica en Córdoba",
    "Cerro de las Rosas",
    "Nueva Córdoba",
    "salud visual",
    "anteojos de receta",
    "distancia pupilar",
    "fatiga visual",
    "óptica Argentina"
  ],
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
              Por qué los anteojos de farmacia o calle están arruinando tu vista
            </h1>
            <p className="text-[14px] lg:text-[15px] text-[#666] leading-relaxed max-w-xl mx-auto">
              Seguro alguna vez te tentaste con esos lentes de lectura listos para usar que venden en cualquier farmacia. Parecen una solución rápida y barata, pero lo que estás comprando en realidad es un pasaje directo hacia la fatiga visual.
            </p>
          </header>

          <div className="prose prose-lg max-w-none text-[#333] space-y-8">
            <p className="text-[15px] leading-relaxed">
              Es una historia súper común: estás apurado por el centro o dando un paseo por Nueva Córdoba, te olvidaste tus lentes, entrás a una farmacia o a un kiosco y te probás unos anteojos genéricos hasta que sentís que &quot;ves bien&quot;. Te los llevás puestos creyendo que salvaste el día. Sin embargo, como profesionales de la salud visual en Atelier Óptica, tenemos la responsabilidad de explicarte por qué esta costumbre es tan perjudicial.
            </p>

            <h2 className="text-2xl font-medium mt-12 mb-6">El engaño de la &quot;solución rápida&quot;</h2>
            <p className="text-[15px] leading-relaxed">
              Los anteojos pregraduados, también conocidos como lentes de lectura de venta libre, están fabricados en serie con medidas estándar que no se adaptan a la anatomía real de nadie. En nuestra óptica, cuando calibramos y armamos un par de anteojos, no solo nos guiamos estrictamente por la graduación exacta que te indicó el oftalmólogo, sino que tomamos medidas precisas y únicas de tu rostro.
            </p>

            <h2 className="text-2xl font-medium mt-12 mb-6">El peligro oculto de los centros ópticos no controlados</h2>
            <p className="text-[15px] leading-relaxed">
              Cada cristal graduado tiene un &quot;centro óptico&quot;, que es el punto exacto por donde tu pupila debería mirar para que la corrección sea perfecta. En los anteojos de farmacia, estos centros están ubicados de manera genérica. Si tus ojos no coinciden milimétricamente con esos puntos, vas a estar mirando a través de una zona del cristal que genera aberraciones y molestas distorsiones visuales.
            </p>
            <p className="text-[15px] leading-relaxed">
              Esto obliga a tus músculos oculares a hacer un esfuerzo antinatural y constante para compensar esa mala alineación. ¿El resultado directo? Fatiga visual severa, dolores de cabeza punzantes, mareos e incluso problemas de postura. Un desgaste totalmente innecesario para tu día a día.
            </p>

            <div className="bg-[#f9f9f9] border-l-4 border-black p-6 my-10">
              <h3 className="text-lg font-medium mb-2">La importancia crítica de la Distancia Pupilar (DP)</h3>
              <p className="text-[14px] leading-relaxed text-[#555]">
                La distancia exacta entre tus pupilas es única, como tu huella dactilar. Los lentes de calle asumen una DP promedio, que casi nunca es la tuya. Cuando tu DP es diferente, los lentes pregraduados te inducen un <em>efecto prismático</em> indeseado. Básicamente, estás forzando a tus ojos a desviar su eje visual todo el tiempo que los llevás puestos.
              </p>
            </div>

            <h2 className="text-2xl font-medium mt-12 mb-6">Cristales de pésima calidad óptica</h2>
            <p className="text-[15px] leading-relaxed">
              Además de los graves problemas geométricos, los materiales con los que se fabrican estos anteojos suelen ser plásticos inyectados de muy baja calidad. No cuentan con tratamientos antirreflex ni protección UV adecuada, y terminan rayándose fácilmente. Al perder su transparencia, te obligan a forzar la vista todavía más, cerrando un círculo vicioso perjudicial.
            </p>

            <h2 className="text-2xl font-medium mt-12 mb-6">Un parche que no reemplaza el chequeo médico</h2>
            <p className="text-[15px] leading-relaxed">
              Comprar estos lentes por impulso muchas veces retrasa una visita fundamental. Creer que con esto solucionás de raíz tu problema de presbicia o visión borrosa es un error muy frecuente que puede ocultar patologías subyacentes más graves.
            </p>
            <p className="text-[15px] leading-relaxed font-medium">
              Nuestra recomendación número uno, siempre, es: ¡visitá al médico oftalmólogo anualmente! Ellos son los únicos profesionales capacitados para evaluar el fondo de ojo, tomar la presión ocular, realizar diagnósticos médicos completos y prescribir la receta correcta.
            </p>

            <div className="border border-black/10 p-8 mt-16 text-center">
              <h3 className="text-xl font-medium mb-4">Cuidemos tu visión como te merecés</h3>
              <p className="text-[15px] text-[#666] mb-8 max-w-lg mx-auto">
                No arriesgues tus ojos con soluciones temporales que cuestan caro a largo plazo. Una vez que tengas tu receta oftalmológica actualizada en mano, te esperamos en Atelier Óptica, en el Cerro de las Rosas, Córdoba. Te vamos a asesorar sobre los cristales de alta precisión y los armazones estéticos ideales para vos. Además, realizamos envíos a toda Argentina.
              </p>
              <a href="https://wa.me/5493518685644" target="_blank" rel="noopener noreferrer" 
                className="inline-block bg-black text-white px-8 py-4 text-[11px] font-bold uppercase tracking-widest hover:bg-[#333] transition-colors"
              >
                Asesorate hoy
              </a>
            </div>
          </div>
        </article>
      </main>

      <StorefrontFooter />
    </div>
  );
}