import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { StorefrontFooter } from "@/components/Storefront/StorefrontFooter";
import { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: '/blog/por-que-no-pegar-anteojos-la-gotita' },
  title: "Por qué NUNCA debés pegar tus anteojos rotos con La Gotita",
  description: "Pegar tus anteojos con cianoacrilato puede arruinarlos para siempre. Enterate de por qué debés evitarlo y cómo lo solucionamos en el laboratorio óptico. Envíos a toda Argentina. Cuotas sin interés. Atención personalizada y asesoramiento estético.",
  keywords: ["óptica Argentina", "envíos a toda Argentina", "cuotas", "atención personalizada", "anteojos de receta", "por que no pegar anteojos la gotita"],
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
            Por qué NUNCA debés pegar tus anteojos rotos con "La Gotita"
          </h1>
          <p className="text-stone-500 text-sm">
            Taller óptico • Lectura: 3 min
          </p>
        </header>

        <div className="max-w-none text-[#433831] leading-relaxed space-y-6">
          <p className="text-lg">
            A todos nos pasó: un mal movimiento, te sentás arriba de los anteojos, o simplemente se caen y... ¡crack! Se rompe el armazón. En medio de la urgencia por volver a ver bien, la primera reacción suele ser correr a buscar "La Gotita" u otro pegamento de cianoacrilato. <strong className="font-semibold">Frená ahí mismo.</strong> Es el peor error que podés cometer.
          </p>

          <p>
            Como ópticos, en nuestro laboratorio vemos a diario los desastres que causan estos pegamentos. Lo que parece una solución rápida de cinco minutos, a menudo termina arruinando definitivamente tus lentes.
          </p>

          <h2 className=" font-serif">
            ¿Qué le hace el pegamento a tus anteojos?
          </h2>

          <ul className="list-disc pl-6 space-y-3">
            <li>
              <strong className="font-semibold">Arruina los cristales (y no tiene vuelta atrás):</strong> Cuando el cianoacrilato se seca, libera vapores que se adhieren a las superficies cercanas. Si esos vapores tocan tus lentes, <em>queman</em> los tratamientos antirreflex y los filtros. Esas manchas blancas no salen con nada; el cristal queda arruinado.
            </li>
            <li>
              <strong className="font-semibold">Derrite los armazones:</strong> Muchos marcos modernos están hechos de acetato, inyección u otros polímeros. El pegamento genera una reacción química exotérmica (libera calor) que puede derretir o deformar el material del armazón, dejándolo inservible.
            </li>
            <li>
              <strong className="font-semibold">Imposibilita una reparación profesional:</strong> Si tu armazón es de metal y lo pegás, el residuo del pegamento impide que luego podamos realizar una soldadura limpia en el taller. Para intentar soldarlo, tenemos que quemar el pegamento, lo que daña aún más el metal y la pintura.
            </li>
          </ul>

          <h2 className=" font-serif">
            Tengo una urgencia: ¿qué hago para salir del paso?
          </h2>

          <p>
            Entendemos que necesitás tus anteojos de receta para funcionar en el día a día. Si no podés acercarte de inmediato a la óptica, la solución casera más segura es usar <strong className="font-semibold">cinta adhesiva</strong> (como cinta de papel o cinta transparente). Sí, estéticamente no es lo mejor, pero no genera reacciones químicas ni mancha los cristales. 
          </p>
          <p>
            Además, si se salió un tornillo o se desprendió una pieza, <strong className="font-semibold">guardá todo en una bolsita o cajita</strong>. Hasta el pedacito más pequeño nos sirve en el laboratorio para entender cómo reconstruir la estructura.
          </p>

          <h2 className=" font-serif">
            La solución definitiva en el Laboratorio Óptico
          </h2>

          <p>
            En el taller de Atelier Óptica contamos con herramientas específicas para darle una segunda vida a tus anteojos. Dependiendo de la rotura, podemos:
          </p>

          <ul className="list-disc pl-6 space-y-3">
            <li>Realizar <strong className="font-semibold">soldaduras</strong> en marcos de metal.</li>
            <li><strong className="font-semibold">Reemplazar piezas</strong> dañadas como patillas, bisagras, plaquetas y tornillos.</li>
            <li>Si el armazón original no tiene salvación pero los cristales están intactos, muchas veces podemos <strong className="font-semibold">calibrar tus lentes</strong> en un armazón nuevo, ajustando la forma en nuestras biseladoras.</li>
          </ul>

          <div className="bg-white border border-stone-200 p-6 md:p-8 rounded-xl my-10 shadow-[0_2px_10px_rgba(0,0,0,0.02)] relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-[#c8a55c]"></div>
            <h3 className="font-medium tracking-tight text-lg text-[#433831] mb-3">Un recordatorio importante para tu salud visual</h3>
            <p className="text-stone-600 text-sm md:text-base leading-relaxed">
              Recordá que en la óptica nos especializamos en el armado, reparación y calibración de tus anteojos basándonos en tu receta. <strong className="font-semibold">Es fundamental que visites a tu médico oftalmólogo al menos una vez al año</strong>. El médico es el único profesional capacitado para evaluar la salud de tus ojos, diagnosticar cualquier condición y emitir la receta. Una vez que tengas tu receta actualizada, ¡te esperamos para asesorarte con el mejor equipamiento óptico para tus necesidades!
            </p>
          </div>

          <p>
            Así que ya sabés: la próxima vez que escuches el temido "crack", mantené la calma, alejá los pegamentos y traenos tus anteojos. Estamos en Córdoba listos para asesorarte y encontrar la mejor solución técnica.
          </p>

          <div className="mt-14 flex justify-center">
            <a href="https://wa.me/5493518685644" target="_blank" rel="noopener noreferrer" 
              className="inline-flex items-center justify-center bg-[#433831] text-white px-8 py-4 text-sm font-medium hover:bg-[#c8a55c] transition-colors rounded-full shadow-md"
            >
              Consultar por una reparación
            </a>
          </div>
        </div>
      </article>

      <StorefrontFooter />
    </main>
  );
}
