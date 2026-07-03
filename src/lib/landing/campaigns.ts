// ============================================================
// Sistema de landings por campaña (ads) — Atelier Óptica
// ------------------------------------------------------------
// Config 100% serializable (los iconos son claves string, no
// componentes) para poder viajar de Server → Client Component.
// Agregar una campaña = agregar una entrada a CAMPAIGNS.
// ============================================================

export type BenefitIcon =
  | "diamond"
  | "eye"
  | "shield"
  | "sun"
  | "glasses"
  | "sparkles"
  | "layers"
  | "clock";

export interface Benefit {
  icon: BenefitIcon;
  title: string;
  desc: string;
}

export interface Faq {
  question: string;
  answer: string;
}

export interface LandingProduct {
  name: string;
  price: string;
  img: string;
  slug: string;
}

export interface CampaignConfig {
  slug: string;
  seo: { title: string; description: string };
  hero: {
    badge: string;
    title: string;
    titleAccent: string;
    subtitle: string;
    images: string[];
  };
  /** Filtro de catálogo (patrón `category: { contains, mode: 'insensitive' }`).
   *  null = destacados sin filtrar por categoría (como el home). */
  productCategory: string | null;
  productsHeading: string;
  productsSubheading: string;
  /** Productos fijos (curados) para campañas sin catálogo web publicado (ej. clip-on).
   *  Si está presente, se usan en vez de traer de la DB por categoría. */
  products?: LandingProduct[];
  benefits: Benefit[];
  editorial: {
    badge: string;
    title: string;
    titleAccent: string;
    copy: string;
    image: string;
    cta: string;
  };
  faqs: Faq[];
  /** Mensaje base de WhatsApp; la atribución (campaña + UTM) se agrega en runtime. */
  waMessageBase: string;
  primaryCta: string;
  finalCtaTitle: string;
  finalCtaSubtitle: string;
  finalCta: string;
}

// Retratos editoriales del home (FilmmakerReel) — identidad visual compartida.
const EDITORIAL_FRAMES = [
  "/images/editorial/filmmaker-frida.webp",
  "/images/editorial/monalisa.webp",
  "/images/editorial/filmmaker-venus.webp",
  "/images/editorial/filmmaker-dali.webp",
  "/images/editorial/filmmaker-pearl.webp",
];

// Pasos "armá tus lentes" y trust bar son iguales en todas las campañas
// (se definen directamente en LandingClient). Acá sólo lo que varía por campaña.

const DEFAULT_FAQS: Faq[] = [
  {
    question: "¿Puedo hacer el pedido si estoy en otra provincia?",
    answer:
      "Sí. Hacemos envíos a todo el país. Coordinamos tu receta y graduación por WhatsApp y te llegan tus lentes a domicilio.",
  },
  {
    question: "¿Cómo pago? ¿Hay cuotas?",
    answer:
      "Trabajamos con cuotas sin interés y todos los medios de pago. En el presupuesto te detallamos el plan que más te convenga.",
  },
  {
    question: "¿Qué es un cristal multifocal y para quién se recomienda?",
    answer:
      "Los multifocales integran visión de lejos, intermedia y cerca en un solo cristal sin líneas visibles. Ideales para presbicia.",
  },
  {
    question: "Tengo mucha graduación, ¿quedarán gruesos?",
    answer:
      "Trabajamos con cristales de alto índice (súper delgados) que reducen el espesor. Te asesoramos para elegir el armazón ideal.",
  },
];

export const CAMPAIGNS: Record<string, CampaignConfig> = {
  // ── Landing genérica (/landing) ───────────────────────────
  default: {
    slug: "default",
    seo: {
      title: "Atelier Óptica | Anteojos de Autor con Cristales Premium en Cuotas",
      description:
        "Anteojos de diseño con cristales premium y multifocales Varilux. Asesoramiento personalizado por WhatsApp, cuotas sin interés y envíos a todo el país. Presupuesto en el acto.",
    },
    hero: {
      badge: "Óptica de autor · Córdoba",
      title: "Anteojos que",
      titleAccent: "destacan tu mirada",
      subtitle:
        "Diseño exclusivo y cristales premium con asesoramiento personalizado. Cuotas sin interés y envíos a todo el país.",
      images: EDITORIAL_FRAMES,
    },
    productCategory: null,
    productsHeading: "Algunos de nuestros modelos",
    productsSubheading: "Diseño exclusivo en cuotas sin interés. Y muchísimos más en el salón.",
    benefits: [
      { icon: "diamond", title: "Diseño de autor", desc: "Colección curada en acetato italiano y metales nobles. Piezas pensadas para destacar tu mirada." },
      { icon: "eye", title: "Cristales premium", desc: "Multifocales Varilux, antirreflex y filtro azul. Tallado digital de laboratorio de primera línea." },
      { icon: "shield", title: "Garantía de adaptación", desc: "Si no te adaptás a tus multifocales, cambiamos los cristales sin costo. Comprás con respaldo." },
    ],
    editorial: {
      badge: "Colección editorial",
      title: "Inspirados en las",
      titleAccent: "grandes obras",
      copy: "Cada montura es una pieza de diseño. Curamos una colección de acetato italiano y metales nobles pensada para acompañar tu estilo, no para pasar desapercibida. Contanos qué buscás y te ayudamos a encontrar la tuya.",
      image: "/images/editorial/filmmaker-frida.webp",
      cta: "Quiero que me asesoren",
    },
    faqs: DEFAULT_FAQS,
    waMessageBase:
      "Hola Atelier! 👋 Vi sus anteojos en la web y quiero recibir asesoramiento y un presupuesto.",
    primaryCta: "Pedí tu presupuesto por WhatsApp",
    finalCtaTitle: "Tu próxima mirada empieza acá",
    finalCtaSubtitle: "Escribinos y en minutos te armamos un presupuesto sin compromiso.",
    finalCta: "Pedir presupuesto por WhatsApp",
  },

  // ── Clip-on (/landing/clipon) ─────────────────────────────
  clipon: {
    slug: "clipon",
    seo: {
      title: "Anteojos Clip-On | Atelier Óptica — Recetados + Sol Magnético (2 en 1)",
      description:
        "Anteojos recetados con suplemento solar magnético Clip-On: dos anteojos en uno. Ves con tu graduación y te protegés del sol sin cambiar de armazón. Cuotas sin interés y envíos a todo el país.",
    },
    hero: {
      badge: "Clip-On · 2 anteojos en 1",
      title: "Tu graduado y tu de sol,",
      titleAccent: "en un solo anteojo",
      subtitle:
        "Armazón recetado + suplemento solar magnético que ponés y sacás en un segundo. Ves con tu graduación y te protegés del sol. Cuotas sin interés y envíos a todo el país.",
      images: EDITORIAL_FRAMES,
    },
    productCategory: null,
    productsHeading: "Modelos Clip-On",
    productsSubheading: "Armazón de receta con clip solar imantado. Algunos de los modelos disponibles.",
    products: [
      { name: "Clip-On 7018", price: "", img: "/images/products/clipon-7018-c5.avif", slug: "" },
      { name: "Clip-On 7036", price: "", img: "/images/products/clipon-7036-c2.webp", slug: "" },
      { name: "Clip-On 7103", price: "", img: "/images/products/clipon-7103-c2.webp", slug: "" },
      { name: "Clip-On G5929", price: "", img: "/images/products/clipon-g5929-c1.webp", slug: "" },
    ],
    benefits: [
      { icon: "glasses", title: "Dos anteojos en uno", desc: "Tu armazón recetado + un suplemento solar que se coloca y se saca en un segundo. Ahorrás comprar dos pares." },
      { icon: "sun", title: "Sol con tu graduación", desc: "El clip solar trae protección UV. Ves con tu receta y te protegés del sol sin cambiar de anteojo." },
      { icon: "sparkles", title: "Imantado y preciso", desc: "Se coloca por imán, firme y al ras. Práctico para manejar, la calle y la oficina." },
    ],
    editorial: {
      badge: "Practicidad",
      title: "Uno para adentro,",
      titleAccent: "uno para el sol",
      copy: "El Clip-On resuelve el problema de siempre: entrás a un lugar y ves con tu graduación, salís al sol y le sumás el clip imantado. Sin andar cambiando de anteojo ni cargando dos estuches. Contanos tu receta y te mostramos los modelos.",
      image: "/images/editorial/filmmaker-dali.webp",
      cta: "Ver modelos Clip-On",
    },
    faqs: [
      { question: "¿Cómo funciona el clip solar?", answer: "El suplemento de sol se sujeta al armazón por imán: lo colocás cuando salís al sol y lo sacás cuando entrás. Firme, al ras y sin marcar el armazón." },
      { question: "¿Se puede hacer con mi graduación?", answer: "Sí. El armazón lleva tus cristales recetados (monofocales o multifocales) y el clip solar va por encima. Te asesoramos según tu receta." },
      { question: "¿El clip protege del sol de verdad?", answer: "Sí, el suplemento cuenta con protección UV. Sumás protección solar sobre tu anteojo graduado, sin resignar tu visión." },
      { question: "¿Hacen envíos a todo el país?", answer: "Sí, enviamos a todo el país y coordinamos todo por WhatsApp. Podés pagar en cuotas sin interés." },
    ],
    waMessageBase:
      "Hola Atelier! 👋 Me interesan los anteojos Clip-On (recetados + sol magnético). ¿Me pasan modelos y precios?",
    primaryCta: "Ver modelos Clip-On por WhatsApp",
    finalCtaTitle: "Un anteojo, dos usos",
    finalCtaSubtitle: "Contanos tu receta y te mostramos los Clip-On disponibles.",
    finalCta: "Consultar Clip-On por WhatsApp",
  },

  // ── Multifocales (/landing/multifocales) ──────────────────
  multifocales: {
    slug: "multifocales",
    seo: {
      title: "Anteojos Multifocales Varilux | Atelier Óptica — Ver de Lejos y de Cerca",
      description:
        "Multifocales premium con tallado digital y garantía de adaptación. Ver de lejos, intermedio y cerca sin cambiar de anteojos. Cuotas sin interés, envíos a todo el país y asesoramiento por WhatsApp.",
    },
    hero: {
      badge: "Multifocales · Tecnología premium",
      title: "Ver de lejos y de cerca,",
      titleAccent: "sin cambiar de anteojos",
      subtitle:
        "Cristales multifocales con tallado digital y garantía de adaptación. Un solo anteojo para toda tu vida diaria. Cuotas sin interés y envíos a todo el país.",
      images: EDITORIAL_FRAMES,
    },
    productCategory: "Receta",
    productsHeading: "Armazones para tus multifocales",
    productsSubheading: "Elegí tu armazón de diseño y lo equipamos con tus cristales multifocales.",
    benefits: [
      { icon: "layers", title: "Tres visiones, un cristal", desc: "Lejos, intermedia y cerca en una transición invisible. Sin líneas, sin saltos, sin cambiar de anteojos." },
      { icon: "sparkles", title: "Tallado digital premium", desc: "Cristales Varilux y de primeras marcas, calculados a tu medida exacta para máxima nitidez." },
      { icon: "shield", title: "Garantía de adaptación", desc: "Si no te adaptás, ajustamos o cambiamos los cristales sin costo. Comprás con total respaldo." },
    ],
    editorial: {
      badge: "Tecnología óptica",
      title: "La libertad de",
      titleAccent: "ver todo con nitidez",
      copy: "Un multifocal bien hecho cambia tu día a día: leés el celular, mirás la compu y manejás con el mismo anteojo. La clave está en el tallado y en un buen asesoramiento. Eso es lo que hacemos.",
      image: "/images/editorial/monalisa.webp",
      cta: "Quiero asesorarme con un experto",
    },
    faqs: [
      { question: "¿Cuánto tarda la adaptación a los multifocales?", answer: "Suele ser de unos días a un par de semanas. Nuestros cristales premium cuentan con garantía de adaptación: si no te adaptás, lo resolvemos sin costo." },
      { question: "Es mi primer multifocal, ¿me va a costar?", answer: "Te acompañamos en todo el proceso. Con un buen tallado digital y el armazón correcto, la adaptación es mucho más simple. Te asesoramos paso a paso." },
      { question: "¿Qué marcas de cristales usan?", answer: "Trabajamos con Varilux (Essilor) y otras primeras marcas, con tratamientos antirreflex, filtro azul y fotocromáticos según lo que necesites." },
      { question: "¿Puedo hacerlo desde otra provincia?", answer: "Sí. Coordinamos tu receta por WhatsApp y enviamos a todo el país, en cuotas sin interés." },
    ],
    waMessageBase:
      "Hola Atelier! 👋 Quiero asesoramiento y un presupuesto para anteojos multifocales.",
    primaryCta: "Consultar multifocales por WhatsApp",
    finalCtaTitle: "Volvé a ver bien, de lejos y de cerca",
    finalCtaSubtitle: "Escribinos y un asesor te arma un presupuesto sin compromiso.",
    finalCta: "Pedir presupuesto por WhatsApp",
  },

  // ── Anteojos recetados (/landing/recetados) ───────────────
  recetados: {
    slug: "recetados",
    seo: {
      title: "Anteojos Recetados a Medida | Atelier Óptica — Armazones de Diseño",
      description:
        "Armá tus anteojos graduados: armazones de diseño + cristales a tu medida. Asesoramiento por WhatsApp, cuotas sin interés y envíos a todo el país. Presupuesto en el acto.",
    },
    hero: {
      badge: "Anteojos recetados · A tu medida",
      title: "Armá tus anteojos",
      titleAccent: "graduados a tu medida",
      subtitle:
        "Armazones de diseño y cristales premium calculados para tu receta. Te asesoramos por WhatsApp. Cuotas sin interés y envíos a todo el país.",
      images: EDITORIAL_FRAMES,
    },
    productCategory: "Receta",
    productsHeading: "Armazones de receta",
    productsSubheading: "Elegí tu armazón de diseño y lo equipamos con tus cristales a medida.",
    benefits: [
      { icon: "diamond", title: "Armazones de diseño", desc: "Colección curada en acetato italiano y metales nobles. Encontrá el que va con vos." },
      { icon: "eye", title: "Cristales a tu medida", desc: "Monofocales o multifocales con antirreflex, filtro azul y fotocromáticos. Tallado de primera línea." },
      { icon: "clock", title: "Rápido y sin vueltas", desc: "Nos pasás tu receta por WhatsApp y te armamos el presupuesto en minutos. Retirás en el local o te lo enviamos." },
    ],
    editorial: {
      badge: "Colección editorial",
      title: "Un anteojo que",
      titleAccent: "habla de vos",
      copy: "Tus lentes se usan todos los días: que sean cómodos, livianos y con tu estilo. Curamos una colección de armazones de diseño y te ayudamos a elegir el ideal para tu cara y tu graduación.",
      image: "/images/editorial/filmmaker-pearl.webp",
      cta: "Quiero que me asesoren",
    },
    faqs: DEFAULT_FAQS,
    waMessageBase:
      "Hola Atelier! 👋 Quiero armar mis anteojos recetados. ¿Me pueden asesorar y pasar un presupuesto?",
    primaryCta: "Armá tus lentes por WhatsApp",
    finalCtaTitle: "Tus anteojos, a tu medida",
    finalCtaSubtitle: "Pasanos tu receta por WhatsApp y te armamos el presupuesto en minutos.",
    finalCta: "Enviar mi receta por WhatsApp",
  },
};

/** Devuelve la config de una campaña, o null si el slug no existe. */
export function getCampaign(slug: string): CampaignConfig | null {
  return CAMPAIGNS[slug] ?? null;
}

/** Slugs de campaña reales (excluye la genérica `default`, que vive en /landing). */
export function campaignSlugs(): string[] {
  return Object.keys(CAMPAIGNS).filter((s) => s !== "default");
}
