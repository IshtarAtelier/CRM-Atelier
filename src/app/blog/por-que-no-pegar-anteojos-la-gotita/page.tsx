import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { StorefrontFooter } from "@/components/Storefront/StorefrontFooter";
import { Metadata } from "next";
import { WHATSAPP_PHONE } from "@/lib/constants";

export const metadata: Metadata = {
  alternates: { canonical: '/blog/por-que-no-pegar-anteojos-la-gotita' },
  title: "Por qué NUNCA debés pegar tus anteojos rotos con La Gotita | Óptica en Córdoba",
  description: "Descubrí por qué pegar tus anteojos con cianoacrilato o La Gotita puede arruinarlos. Desde nuestro taller en Córdoba (cerca de Cerro de las Rosas y Nueva Córdoba) te contamos cómo solucionarlo. Envíos a toda Argentina y cuotas sin interés.",
  keywords: ["óptica en Córdoba", "reparación de anteojos Córdoba", "Nueva Córdoba", "Cerro de las Rosas", "no pegar anteojos con la gotita", "arreglar lentes rotos", "taller óptico Córdoba", "armazones rotos", "soldadura de anteojos", "cianoacrilato lentes"],
};

export default function BlogPegamentoAnteojos() {
  return (
    <main className="min-h-screen bg-[#faf8f5]">
      <StorefrontNavbar theme="light" />
      
      <article className="max-w-3xl mx-auto px-5 py-24 md:py-32">
        <header className="mb-12 text-center">
          <p className="text-[#c8a55c] text-xs font-black uppercase tracking-widest mb-4">
            Laboratorio Óptico y Urgencias
          </p>
          <h1 className=" font-serif">
            Por qué NUNCA debés pegar tus anteojos rotos con &quot;La Gotita&quot;
          </h1>
          <p className="text-stone-500 text-sm">
            Taller óptico • Lectura: 3 min
          </p>
        </header>

        <div className="max-w-none text-[#433831] leading-relaxed space-y-6">
          <p className="text-lg">
            A todos nos pasó: un mal movimiento, te sentás arriba de tus lentes, o simplemente resbalan al piso y... ¡crack! Se rompe el armazón. En medio de la desesperación por volver a ver bien, la primera reacción suele ser correr a buscar &quot;La Gotita&quot; u otro pegamento de cianoacrilato. <strong className="font-semibold">¡Frená ahí mismo!</strong> Es el peor error que podés cometer para la vida útil de tus anteojos.
          </p>

          <p>
            En nuestro laboratorio óptico en <strong>Córdoba</strong> recibimos a diario los desastres que causan estos adhesivos. Ya sea que vengas desde <strong>Nueva Córdoba</strong>, el <strong>Cerro de las Rosas</strong> o el interior de la provincia, la historia siempre es la misma: lo que parece una solución rápida de cinco minutos, termina arruinando definitivamente tus gafas y lentes de receta.
          </p>

          <h2 className=" font-serif">
            ¿Qué le hace realmente el pegamento a tus anteojos?
          </h2>

          <ul className="list-disc pl-6 space-y-3">
            <li>
              <strong className="font-semibold">Arruina los cristales (sin vuelta atrás):</strong> Cuando el cianoacrilato se seca, libera vapores que se adhieren a las superficies cercanas. Si esos vapores tocan tus lentes, <em>queman</em> los tratamientos antirreflejo y los filtros de protección. Esas manchas blancas no salen con nada; el cristal queda arruinado para siempre.
            </li>
            <li>
              <strong className="font-semibold">Derrite los armazones:</strong> Muchos marcos modernos y estéticos están hechos de acetato, inyección u otros polímeros. El pegamento genera una reacción química exotérmica (libera calor) que puede derretir o deformar el material del armazón, dejándolo completamente inservible.
            </li>
            <li>
              <strong className="font-semibold">Imposibilita una reparación profesional:</strong> Si tu armazón es de metal y lo pegás, el residuo del pegamento impide que luego podamos realizar una soldadura limpia en nuestro taller. Para intentar soldarlo, tenemos que quemar el pegamento, lo que daña aún más el metal, el baño de color y la estructura original.
            </li>
          </ul>

          <h2 className=" font-serif">
            Tengo una urgencia: ¿qué hago para salir del paso?
          </h2>

          <p>
            Entendemos que necesitás tus anteojos graduados para tu rutina diaria, para trabajar o estudiar. Si no podés acercarte de inmediato a nuestra óptica, la solución casera más segura y menos destructiva es usar <strong className="font-semibold">cinta adhesiva</strong> (como cinta de papel o cinta transparente). Sí, estéticamente no es lo ideal, pero no genera reacciones químicas ni mancha los cristales de forma permanente.
          </p>
          <p>
            Además, si se salió un tornillo o se desprendió una pequeña pieza, <strong className="font-semibold">guardá absolutamente todo en una bolsita o cajita</strong>. Hasta el pedacito más diminuto nos sirve a los profesionales ópticos para entender cómo reconstruir la estructura de manera impecable.
          </p>

          <h2 className=" font-serif">
            La solución definitiva en nuestro Laboratorio Óptico
          </h2>

          <p>
            En el taller de Atelier Óptica contamos con la tecnología, repuestos y herramientas específicas para darle una segunda oportunidad a tus anteojos. Dependiendo del tipo de rotura, podemos:
          </p>

          <ul className="list-disc pl-6 space-y-3">
            <li>Realizar <strong className="font-semibold">soldaduras de precisión</strong> en marcos de metal.</li>
            <li><strong className="font-semibold">Reemplazar piezas</strong> dañadas como patillas, bisagras, plaquetas y tornillos con repuestos de alta calidad.</li>
            <li>Si el armazón original no tiene salvación, pero tus cristales están intactos, muchas veces podemos <strong className="font-semibold">calibrar tus lentes</strong> en un armazón nuevo, ajustando la forma y medidas milimétricamente en nuestras biseladoras computarizadas.</li>
          </ul>

          <div className="bg-white border border-stone-200 p-6 md:p-8 rounded-xl my-10 shadow-[0_2px_10px_rgba(0,0,0,0.02)] relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-[#c8a55c]"></div>
            <h3 className="font-medium tracking-tight text-lg text-[#433831] mb-3">Un recordatorio importante para tu salud visual</h3>
            <p className="text-stone-600 text-sm md:text-base leading-relaxed">
              Recordá que en la óptica nos especializamos en el armado, reparación estética y calibración de tus anteojos basándonos en tu receta. <strong className="font-semibold">Es fundamental que visités a tu médico oftalmólogo de confianza al menos una vez al año</strong>. El oftalmólogo es el único profesional capacitado para evaluar la salud integral de tus ojos, diagnosticar condiciones visuales y emitir la receta. Una vez que tengas tu graduación actualizada, ¡te esperamos para brindarte la mejor asesoría estética y técnica!
            </p>
          </div>

          <p>
            Así que ya sabés: la próxima vez que escuches el temido &quot;crack&quot;, mantené la calma, alejá los pegamentos peligrosos y contactanos. Desde nuestro espacio en <strong>Córdoba capital</strong>, estamos listos para asesorarte, reparar tus lentes o encontrar el marco perfecto que reemplace al dañado, siempre con el respaldo de un equipo experto.
          </p>

          <div className="mt-14 flex justify-center">
            <a href={`https://wa.me/${WHATSAPP_PHONE}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center justify-center bg-[#433831] text-white px-8 py-4 text-sm font-medium hover:bg-[#c8a55c] transition-colors rounded-full shadow-md"
            >
              Consultar por la reparación de mis anteojos
            </a>
          </div>
        </div>
      </article>

      <StorefrontFooter />
    </main>
  );
}