/**
 * Fuente única de las Preguntas Frecuentes de /faq.
 *
 * La MISMA data alimenta el contenido visible (FaqClient) y el JSON-LD
 * FAQPage del server component. No duplicar las preguntas en otro lado:
 * si se editan acá, se actualizan la página y el structured data juntos.
 *
 * Reglas de contenido (SEO/GEO):
 * - Respuestas autónomas: cada una debe entenderse sin leer las demás
 *   (los motores de IA citan respuestas sueltas).
 * - Datos comerciales concretos salen de BUSINESS_INFO cuando se puede.
 * - `links` agrega enlaces internos contextuales (contexto para buscadores e IA).
 */

import { BUSINESS_INFO } from "@/lib/business-info";

export type FaqLink = { label: string; href: string };
export type FaqItem = { q: string; a: string; links?: FaqLink[] };
export type FaqCategory = { category: string; items: FaqItem[] };

export const FAQ_CATEGORIES: FaqCategory[] = [
  {
    category: "Envíos y entregas",
    items: [
      {
        q: "¿Hacen envíos a todo el país?",
        a: "Sí, enviamos a toda la Argentina a través de Correo Argentino y Andreani. Los envíos que superan cierto monto son bonificados. Al despachar tu pedido te compartimos el código de seguimiento para que sigas el envío hasta tu domicilio.",
      },
      {
        q: "¿Puedo retirar mi pedido en el local?",
        a: `Sí. Podés retirar sin cargo en nuestro local de ${BUSINESS_INFO.address}. Atendemos ${BUSINESS_INFO.hours}. Te avisamos por WhatsApp apenas tu pedido está listo para retirar.`,
        links: [{ label: "Cómo llegar a nuestro local", href: "/nuestro-local" }],
      },
      {
        q: "¿Cuánto demora la entrega de mis anteojos?",
        a: "Depende del tipo de trabajo. Los anteojos con cristales recetados (monofocales o multifocales) requieren tallado en laboratorio, por eso llevan unos días más que un armazón sin graduación o los lentes de sol. Cuando confirmás la compra te damos un plazo estimado según tu receta, y te avisamos cada vez que tu pedido avanza de etapa.",
        links: [{ label: "Cómo comprar paso a paso", href: "/como-comprar" }],
      },
    ],
  },
  {
    category: "Obras sociales y facturación",
    items: [
      {
        q: "¿Trabajan con obras sociales?",
        a: "Trabajamos con el sistema de reintegro. Te entregamos la factura oficial y todos los comprobantes que tu obra social o prepaga necesita para devolverte la parte que cubre tu plan. Vos presentás la documentación en tu cobertura y ellos te reintegran según tu convenio.",
      },
      {
        q: "¿Qué necesito para pedir el reintegro?",
        a: "Con la factura oficial y el comprobante de compra que te damos, más la receta de tu oftalmólogo, ya podés iniciar el trámite de reintegro en tu obra social o prepaga. Si tu cobertura te pide algún dato adicional de la óptica, escribinos y te lo pasamos.",
      },
    ],
  },
  {
    category: "Cristales y multifocales",
    items: [
      {
        q: "¿Qué tipos de cristales ofrecen?",
        a: "Trabajamos cristales monofocales y multifocales (progresivos) Varilux, con tratamientos de antirreflejo, filtro de luz azul y fotocromáticos que se oscurecen al sol. Según tu receta y tu uso diario te recomendamos la combinación de material y tratamiento que mejor se adapta.",
        links: [{ label: "Ver cristales ópticos", href: "/cristales-opticos" }],
      },
      {
        q: "¿Tienen garantía los cristales multifocales?",
        a: "Sí. Todos nuestros cristales multifocales Varilux, y los cristales Super Blue de monofocales, tienen garantía de adaptación. Si no te adaptás dentro de los primeros 30 días, te cambiamos los cristales sin costo. Es requisito presentar una nueva receta emitida por tu oftalmólogo, y entre ambas recetas no deben pasar más de 90 días. Los demás cristales monofocales no tienen garantía de adaptación.",
      },
      {
        q: "¿Qué es un cristal con filtro de luz azul y para qué sirve?",
        a: "Es un tratamiento que reduce la exposición a la luz azul-violeta que emiten las pantallas de celulares, computadoras y tablets. Ayuda a bajar la fatiga visual en jornadas largas frente a dispositivos y mejora el confort al final del día. Se puede sumar tanto a cristales con graduación como sin graduación.",
      },
      {
        q: "¿Cómo sé si necesito multifocales? (presbicia)",
        a: "La presbicia aparece habitualmente después de los 40 años: cuesta enfocar de cerca, alejás el celular o el menú para leer, y necesitás más luz para textos chicos. Si además usás anteojos para ver de lejos, los multifocales te permiten ver bien de lejos, en distancia intermedia y de cerca con un solo par. Lo confirma tu oftalmólogo en el control.",
      },
    ],
  },
  {
    category: "Control de miopía infantil",
    items: [
      {
        q: "¿Hacen lentes para el control de la miopía en chicos?",
        a: "Sí. Trabajamos lentes diseñados para frenar el avance de la miopía en niños y adolescentes, indicados por el oftalmólogo. A diferencia de un cristal común que solo corrige, estas lentes buscan que la miopía progrese más lento con el tiempo. Traé la receta y te asesoramos sobre la opción indicada para tu hijo/a.",
      },
      {
        q: "¿A qué edad conviene empezar el control de miopía?",
        a: "Cuanto antes se detecta la miopía en la infancia, mejor, porque los años de mayor crecimiento son los de avance más rápido. Por eso es clave el control oftalmológico periódico: si el profesional indica una lente de control de miopía, cuanto antes se empieza más se aprovecha la etapa en la que la graduación cambia más.",
      },
    ],
  },
  {
    category: "Compra online y probado",
    items: [
      {
        q: "¿Puedo probarme los anteojos antes de comprarlos?",
        a: "Si estás en Córdoba, te esperamos en nuestro local de Cerro de las Rosas para que pruebes todo el catálogo con asesoramiento. Si estás en otra provincia, podés usar nuestra herramienta de prueba virtual (Virtual Try-On) en la tienda online para ver cómo te quedan los armazones desde la cámara del celular.",
        links: [{ label: "Ir a la tienda", href: "/tienda" }],
      },
      {
        q: "Tengo la receta del oftalmólogo, ¿cómo compro mis lentes?",
        a: "Elegís el armazón que te gusta (en la web o en el local), nos pasás tu receta y te armamos el presupuesto con los cristales indicados. Podés enviarnos la receta por WhatsApp y coordinamos todo desde ahí, incluido el medio de pago y el envío o retiro.",
        links: [
          { label: "Enviar mi receta", href: "/receta" },
          { label: "Cómo comprar", href: "/como-comprar" },
        ],
      },
      {
        q: "¿Puedo llevar mi propio armazón para ponerle cristales?",
        a: "Sí, en la mayoría de los casos podemos colocar cristales nuevos en un armazón que ya tenés, siempre que esté en buen estado y sea apto para tu graduación. Acercalo al local o escribinos con una foto y te confirmamos si es viable y el presupuesto.",
      },
    ],
  },
  {
    category: "Precios, pagos y posventa",
    items: [
      {
        q: "¿Qué medios de pago aceptan? ¿Hay cuotas y descuentos?",
        a: "Aceptamos tarjetas de crédito y débito, efectivo y transferencia. Ofrecemos cuotas sin interés con tarjeta y descuentos por pago en efectivo o transferencia. Las promociones vigentes —cantidad de cuotas y porcentaje de descuento— las ves siempre actualizadas en la barra superior de la web y en la tienda, porque cambian según el período.",
      },
      {
        q: "¿Puedo cambiar o devolver un producto?",
        a: "Sí, dentro de las condiciones y plazos de nuestra política de cambios. Los productos con graduación se fabrican a medida según tu receta, por eso tienen condiciones particulares. Antes de comprar, revisá la política para conocer los detalles según cada caso.",
        links: [{ label: "Política de cambios y devoluciones", href: "/politicas-de-cambio" }],
      },
      {
        q: "Tengo otra duda que no está acá, ¿cómo los contacto?",
        a: "Escribinos por WhatsApp y te respondemos personalmente para ayudarte con tu receta, un presupuesto o cualquier consulta sobre tus lentes.",
        links: [{ label: "Contacto", href: "/contacto" }],
      },
    ],
  },
];

/** Aplana todas las categorías a la lista de Q&A para el JSON-LD FAQPage. */
export const FAQ_FLAT: FaqItem[] = FAQ_CATEGORIES.flatMap((c) => c.items);
