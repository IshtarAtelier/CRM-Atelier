import type { Metadata } from "next";

/**
 * LAS NOTAS DE MARCAS DE CRISTALES, en un solo lugar.
 *
 * Ishtar, 16/10/2026: contenido en el blog de TODAS las marcas de cristales
 * que hay en el sistema. Las marcas salen de `Product.brand` (categoría
 * Cristal) en producción: Hoya, Pentax, Kodak, Essilor, Sygnus, Optovisión y
 * Smart Lens (Varilux, Stellest, MyoFix y MyoLens ya tenían sus notas).
 *
 * Esta lista es la ÚNICA fuente: la leen el listado del blog
 * (static-blog-posts), el sitemap y el bloque "Las otras marcas" que cierra
 * cada nota (NotaMarcaCristal). Agregar una marca acá la enlaza sola.
 *
 * Regla de contenido: solo datos con fuente del fabricante (las fuentes van en
 * `fuentes`, no se muestran). Lo que no se pudo verificar NO se escribe; las
 * cifras de marketing se atribuyen a la marca ("según Hoya").
 */
export interface NotaMarcaCristal {
  slug: string;
  marca: string;
  title: string;
  excerpt: string;
  /** Línea corta para el bloque "Las otras marcas". */
  linkText: string;
  metaDescription: string;
  keywords: string[];
  date: string;
  imageUrl: string;
  imageAlt: string;
  /**
   * Respuesta directa de 2-3 oraciones arriba de todo: es lo que citan los
   * buscadores con IA (Google AI Overviews, ChatGPT, Perplexity) y el snippet.
   */
  resumen: string;
  intro: string[];
  secciones: {
    titulo: string;
    parrafos?: string[];
    imagen?: { src: string; alt: string };
    /** `imagen`: foto oficial del producto (1200×1200) si la tenemos. */
    items?: { nombre: string; texto: string; imagen?: string }[];
  }[];
  faqs: { pregunta: string; respuesta: string }[];
  /** Ficha en /cristales-opticos, si existe. */
  cristalesHref?: string;
  fuentes: string[];
}

export const CATEGORIA_MARCAS_CRISTALES = 'Marcas de cristales';

export const NOTAS_MARCAS_CRISTALES: NotaMarcaCristal[] = [
  {
    slug: 'cristales-hoya',
    marca: 'Hoya',
    title: 'Cristales Hoya: la línea japonesa de progresivos y monofocales, modelo por modelo',
    excerpt:
      'iD LifeStyle 4, Summit, Array 2, Argos, Nulux, Sync III y Tact: qué es cada cristal Hoya, para quién conviene y cómo funciona la promo del segundo par.',
    linkText: 'Progresivos japoneses: LifeStyle 4, Summit, Array 2',
    metaDescription:
      'Guía de los cristales Hoya en Córdoba: progresivos iD LifeStyle 4, Summit, Array 2 y Argos, monofocales Nulux iDentity V+ y Sync III, y el ocupacional Tact. Promo segundo par con 80% de descuento.',
    keywords: ['Hoya', 'cristales Hoya', 'iD LifeStyle 4', 'Hoya Array 2', 'Hoya Summit', 'Sync III', 'Nulux', 'Hoya Tact', 'multifocales Hoya Córdoba'],
    date: '2026-10-16',
    imageUrl: '/images/cristales/hoya/hoya-id-lifestyle-4.jpg',
    imageAlt: 'Mujer con anteojos progresivos Hoya iD LifeStyle 4 (imagen: Hoya Vision)',
    resumen:
      'Hoya es un fabricante japonés de cristales oftálmicos fundado en 1941. Su progresivo más completo es el iD LifeStyle 4; Summit, Array 2 y Argos son las opciones intermedias y de entrada, y Mi Primer Hoya está pensado para quien estrena multifocales. En Atelier Óptica (Córdoba) los hacemos con el laboratorio Vitolen, con 80% de descuento en el segundo par de progresivos seleccionados.',
    intro: [
      'Hoya nació en noviembre de 1941 en la ciudad de Hoya, Tokio, como una planta de vidrio óptico. En 1962 empezó a fabricar cristales para anteojos y en 1967 lanzó sus primeros progresivos. Hoy es una empresa global de tecnología médica que, además de cristales, hace endoscopios y lentes intraoculares.',
      'En Atelier trabajamos la línea Hoya a través del laboratorio Vitolen. Acá te contamos cada modelo que ofrecemos, en orden, y para quién lo recomendamos.',
    ],
    secciones: [
      {
        titulo: 'Las tecnologías detrás de Hoya',
        imagen: { src: '/images/equipo/paleta-cristales-entrega.jpg', alt: 'Cristales listos para entregar en Atelier Óptica' },
        items: [
          { nombre: 'Binocular Harmonization Technology (BHT)', texto: 'casi nadie tiene la misma graduación en los dos ojos. BHT calcula cada cristal según la graduación de su ojo para que los dos queden equilibrados y el cerebro no tenga que compensar.' },
          { nombre: 'Integrated Dual Surface', texto: 'reparte el diseño progresivo entre las dos caras del cristal. Es la base de la línea iD LifeStyle.' },
          { nombre: 'BKS', texto: 'tallado free-form en la cara interna, con curvas asféricas y atóricas: la tecnología de Hoya llevada a un precio más accesible.' },
        ],
      },
      {
        titulo: 'Progresivos (multifocales) Hoya',
        parrafos: ['De mayor a menor tecnología:'],
        items: [
          { nombre: 'iD LifeStyle 4', texto: 'el progresivo más completo de Hoya. Suma 3D Binocular Vision, Integrated Dual Surface y BHT; viene en seis largos de corredor, tres diseños según cómo vivís (más en la ciudad, más adentro o más al aire libre) y se personaliza con las medidas de cómo te calza el armazón. Para quien ya usa progresivos y quiere la mejor adaptación.' },
          { nombre: 'Summit', texto: 'un clásico de Hoya, con tallado BKS. Una opción intermedia con campos amplios.' },
          { nombre: 'Array 2', texto: 'segunda generación de Array, con BKS y BHT. Es el más versátil: se hace en casi cualquier material y tratamiento, y entra en armazones bajos (altura mínima de 14 mm). Muy buena opción para quien empieza con la presbicia.' },
          { nombre: 'Argos', texto: 'progresivo de la familia Hoya con tallado BKS, la puerta de entrada a la marca.' },
          { nombre: 'Mi Primer Hoya', texto: 'versiones de Array y Summit pensadas para quien estrena progresivos.' },
        ],
      },
      {
        titulo: 'Monofocales y ocupacionales',
        imagen: { src: '/images/cristales/hoya/hoya-monofocal-pantallas.jpg', alt: 'Monofocal Hoya para el uso del celular (imagen: Hoya Vision)' },
        items: [
          { nombre: 'Nulux iDentity V+', texto: 'el monofocal más personalizado de Hoya: free-form, bi-asférico, calculado según tu armazón y tus medidas de uso. Visión nítida también en los bordes del cristal.' },
          { nombre: 'Sync III', texto: 'monofocal para aliviar la fatiga por pantallas. Hoya lo recomienda de los 13 a los 45 años, para quien pasa dos horas o más por día frente a una pantalla.' },
          { nombre: 'Tact', texto: 'ocupacional para présbitas que trabajan en escritorio: visión intermedia y de cerca con zonas muy anchas. No reemplaza al progresivo: es el segundo par para la compu.' },
          { nombre: 'Visión Simple Digital', texto: 'el monofocal digital de la línea, para el uso de todos los días.' },
        ],
      },
      {
        titulo: 'Promo: segundo par con 80% de descuento',
        parrafos: [
          'Comprando un progresivo Hoya iD LifeStyle 4, Array 2, Summit o Argos (o un Pentax Allfocus), el segundo par del mismo diseño, de igual o menor valor, o un ocupacional Tact, lleva 80% de descuento. Ideal para tener un par de sol graduado o uno para la oficina. Mi Primer Hoya no participa. Consultanos las condiciones vigentes.',
        ],
      },
    ],
    faqs: [
      { pregunta: '¿Hoya o Varilux?', respuesta: 'Las dos son marcas de primera línea con progresivos de alta gama. La elección depende de tu receta, del armazón y de lo que hacés en el día; en el local te mostramos las dos y te recomendamos según tu caso, no según la marca.' },
      { pregunta: '¿Qué Hoya me conviene si es mi primer multifocal?', respuesta: 'Array 2 o Mi Primer Hoya suelen ser el mejor punto de partida. Si buscás lo máximo en adaptación, iD LifeStyle 4.' },
      { pregunta: '¿Cuánto tarda un Hoya?', respuesta: 'Son cristales de laboratorio, tallados para tu receta y tu armazón. Te decimos el plazo exacto al hacer el pedido.' },
    ],
    cristalesHref: '/cristales-opticos/hoya',
    fuentes: [
      'https://www.hoya.com/en/company/history/',
      'https://www.hoyavision.com/en-us/vision-products/progressive-lenses/',
      'https://hoyavision.com/en-us/blog/blogs-and-article/a-closer-look-at-the-core-technologies-behind-id-lifestyle-4',
      'https://www.hoyavision.com/en-us/technology-reference-guide',
      'https://hoyavision.com/za/vision-products/single-vision/nulux-identity-v',
      'https://hoyavision.com/vision-products/single-vision-lenses',
      'docs/vitolen-pedidos-y-promos.md',
    ],
  },
  {
    slug: 'cristales-pentax-allfocus',
    marca: 'Pentax',
    title: 'Cristales Pentax Allfocus: progresivos de la familia Hoya',
    excerpt:
      'Pentax no es solo cámaras: sus cristales oftálmicos son parte de Hoya desde 2008. Allfocus Flex, Allfocus Pro y Pentax Office, explicados.',
    linkText: 'Allfocus Flex, Allfocus Pro y Office',
    metaDescription:
      'Cristales Pentax en Córdoba: progresivos Allfocus Flex y Allfocus Pro y el ocupacional Pentax Office. Qué son, para quién conviene cada uno y la promo del segundo par.',
    keywords: ['Pentax', 'Pentax Allfocus', 'Allfocus Pro', 'Allfocus Flex', 'Pentax Office', 'multifocales Pentax', 'Córdoba'],
    date: '2026-10-16',
    imageUrl: '/images/cristales/hoya/pentax-allfocus-vision.jpg',
    imageAlt: 'Visión nítida a través de un cristal Pentax (imagen: Pentax Optical)',
    resumen:
      'Pentax es una marca de cristales de Hoya Vision Care desde 2008, sin relación con las cámaras. Su línea de progresivos Allfocus tiene dos versiones: Flex, para empezar o ganar comodidad, y Pro, la de mayor gama; Pentax Office es su ocupacional para la oficina. Participa de la promo de 80% en el segundo par.',
    intro: [
      'Cuando decimos Pentax, mucha gente piensa en cámaras. Los cristales Pentax no tienen nada que ver con eso: son una marca de HOYA Vision Care desde 2008, y se fabrican con la misma ingeniería japonesa.',
      'Pentax diseña sus progresivos con un software que simula las condiciones reales de uso. En Atelier los trabajamos con el laboratorio Vitolen.',
    ],
    secciones: [
      {
        titulo: 'Los progresivos Allfocus',
        items: [
          { nombre: 'Allfocus Flex', texto: 'para quien usa progresivos por primera vez o ya los usa y busca más comodidad y claridad. Un muy buen equilibrio entre adaptación y precio.' },
          { nombre: 'Allfocus Pro', texto: 'el más alto de la línea, para usuarios que buscan la máxima comodidad en todas las distancias: lejos, intermedia y cerca.' },
        ],
      },
      {
        titulo: 'Pentax Office',
        imagen: { src: '/images/equipo/equipo-mostrador.jpg', alt: 'Asesoramiento en el mostrador de Atelier Óptica' },
        parrafos: [
          'Un ocupacional para présbitas que pasan muchas horas en la oficina: zonas de visión intermedia y de cerca bastante más anchas que un progresivo común. Es el par para la compu y los papeles, como complemento del multifocal.',
        ],
      },
      {
        titulo: 'Entra en la promo del segundo par',
        parrafos: [
          'Pentax Allfocus participa de la promo de Hoya: comprando un par, el segundo del mismo diseño (igual o menor valor) o un ocupacional Tact lleva 80% de descuento.',
        ],
      },
    ],
    faqs: [
      { pregunta: '¿Pentax es lo mismo que Hoya?', respuesta: 'Pentax es una marca de Hoya Vision Care: mismo grupo, diseños propios. Por eso comparten promo y laboratorio.' },
      { pregunta: '¿Flex o Pro?', respuesta: 'Si es tu primer progresivo o buscás cuidar el presupuesto, Flex. Si ya usás multifocales y querés campos más amplios, Pro.' },
    ],
    cristalesHref: '/cristales-opticos/hoya',
    fuentes: [
      'https://www.hoyavision.com/en-us/newsroom/hoya-in-the-news/news-folder/press-release-hoya-announces-expansion-of-pentax-optical-lenses-to-u.s.-retailers',
      'https://www.pentaxoptical.com/pentax-vision/pentax-allfocus/',
      'https://www.pentaxoptical.com/en-us',
    ],
  },
  {
    slug: 'cristales-smart-lens',
    marca: 'Smart Lens',
    title: 'Smart Lens: la línea argentina de multifocales digitales, de Smart New a Smart Exclusive',
    excerpt:
      'Smart One, New, Free, Pro y Exclusive, el ocupacional Office, monofocales digitales, bifocal invisible y filtros Blue: toda la línea Smart Lens explicada.',
    linkText: 'Multifocales digitales argentinos',
    metaDescription:
      'Cristales Smart Lens en Córdoba: multifocales digitales Smart One, New, Free, Pro y Exclusive, ocupacional Smart Office, monofocales personalizados, bifocal invisible y filtros Blue y Super Blue.',
    keywords: ['Smart Lens', 'Smart Pro', 'Smart Exclusive', 'Smart New', 'multifocales digitales', 'Super Blue', 'bifocal invisible', 'Córdoba'],
    date: '2026-10-16',
    imageUrl: '/images/blog/muestrario-smart-lens.webp',
    imageAlt: 'Muestrario de cristales Smart Lens en Atelier Óptica',
    resumen:
      'Smart Lens es una marca argentina de cristales digitales free-form que se vende solo en ópticas habilitadas. Sus multifocales van de Smart New (primer progresivo) y Smart One a Smart Free, Smart Pro (premium) y Smart Exclusive (para pantallas), y tiene ocupacional, monofocales, bifocal invisible y filtros Blue y Super Blue.',
    intro: [
      'Smart Lens es una marca argentina de cristales digitales que se vende solo en ópticas habilitadas, con certificado de autenticidad. Es la marca con la que más trabajamos en Atelier: cubre desde el primer multifocal hasta el control de miopía infantil.',
      'Acá repasamos cada línea y para quién la recomendamos. Las notas de control de miopía (MyoFix) y del monofocal para miopes (MyoLens) tienen su propio artículo.',
    ],
    secciones: [
      {
        titulo: 'Multifocales digitales',
        items: [
          { nombre: 'Smart New', texto: 'pensado para la primera adaptación. Su proceso Distant Clarity amplía la visión de lejos; Smart Lens lo indica para quien empieza con la presbicia, entre los 40 y los 45 años.' },
          { nombre: 'Smart One', texto: 'progresivo digital de corredor regular, con buena calidad visual a un precio accesible. El proceso Soft Molding mejora los campos durante la adaptación.' },
          { nombre: 'Smart Free', texto: 'multiuso, con las zonas de lejos, intermedia y cerca equilibradas (Balanced Process). Para quien quiere un solo anteojo para todo el día.' },
          { nombre: 'Smart Pro', texto: 'el progresivo premium de la marca. Con Continuum Design Technology lleva las zonas de distorsión hacia la parte baja del cristal para ampliar los campos útiles.' },
          { nombre: 'Smart Exclusive', texto: 'con Adaptative Focus, que ajusta la apertura de las zonas intermedia y de cerca a la lectura en pantallas. El elegido de quien vive con el celular y la compu.' },
        ],
        parrafos: ['Según Smart Lens, sus multifocales traen garantía de fábrica de cambio de receta y adaptación por 90 días. También trabajamos los diseños Smart AI Lens y Smart Drive: consultanos cuál conviene para tu receta.'],
      },
      {
        titulo: 'Ocupacional: Smart Office',
        imagen: { src: '/images/smartlens/myolens-myofix-y-myolens.webp', alt: 'Lámina oficial de la familia Smart Lens' },
        parrafos: ['Un multifocal degresivo optimizado para la distancia de cerca e intermedia: escritorio, compu y papeles. Ideal como segundo par para el trabajo, o para quien no tiene grandes problemas de lejos.'],
      },
      {
        titulo: 'Monofocales y bifocales',
        imagen: { src: '/images/smartlens/myolens-mas-finas.webp', alt: 'Lámina Smart Lens: cristales más finos' },
        items: [
          { nombre: 'Monofocal digital personalizado', texto: 'asférico y atórico, reduce las aberraciones en todas las direcciones de mirada y afina los bordes del cristal.' },
          { nombre: 'Bifocal Digital Invisible', texto: 'para quienes ya usan bifocales y no quieren la línea marcada: la división es invisible y se fabrica en freeform.' },
        ],
      },
      {
        titulo: 'Filtros de luz azul',
        items: [
          { nombre: 'Blue', texto: 'filtra la luz azul de pantallas y luces LED y el 100% de los rayos UV.' },
          { nombre: 'Super Blue', texto: 'el mismo filtro sobre material MR8 de índice 1.60, más liviano y resistente, con diseño asférico y antirreflejo súper hidrofóbico.' },
        ],
        parrafos: ['En el área de cristales tenés la ficha del Super Blue con precio.'],
      },
    ],
    faqs: [
      { pregunta: '¿Smart Lens es una buena marca?', respuesta: 'Es una marca argentina de cristales digitales (free-form), con certificado de autenticidad. Te da tecnología de tallado personalizado a precios más accesibles que las marcas importadas.' },
      { pregunta: '¿Qué Smart Lens elijo para mi primer multifocal?', respuesta: 'Smart New está pensado para eso. Si pasás muchas horas con pantallas, mirá Smart Exclusive.' },
    ],
    cristalesHref: '/cristales-opticos/super-blue',
    fuentes: [
      'https://www.smartlens.com.ar',
      'https://www.smartlens.com.ar/producto/smart-one/',
      'https://www.smartlens.com.ar/producto/smart-new/',
      'https://www.smartlens.com.ar/producto/smart-free/',
      'https://www.smartlens.com.ar/producto/smart-pro/',
      'https://www.smartlens.com.ar/producto/smart-exclusive/',
      'https://www.smartlens.com.ar/producto/smart-ultra/',
      'https://www.smartlens.com.ar/producto/bifocal-digital-invisible/',
      'https://www.smartlens.com.ar/producto/super-blue/',
    ],
  },
  {
    slug: 'cristales-kodak',
    marca: 'Kodak',
    title: 'Cristales Kodak: qué hay detrás de la marca y cómo es el progresivo Unique DRO',
    excerpt:
      'Kodak no fabrica sus cristales: los hace Signet Armorlite, del grupo Essilor, bajo licencia. Qué es Kodak Unique, por qué el DRO es el progresivo "del celular" y qué es Mi Primer Kodak.',
    linkText: 'Unique DRO, el progresivo para el celular',
    metaDescription:
      'Cristales Kodak en Córdoba: quién los fabrica, progresivos Kodak Unique, Unique DRO y HD, Mi Primer Kodak y monofocales. Para quién conviene cada uno.',
    keywords: ['Kodak', 'cristales Kodak', 'Kodak Unique DRO', 'Kodak Unique HD', 'Mi Primer Kodak', 'multifocales Kodak', 'Córdoba'],
    date: '2026-10-16',
    imageUrl: '/images/blog/pareja-multifocales-exterior.webp',
    imageAlt: 'Pareja con anteojos multifocales al aire libre',
    resumen:
      'Los cristales Kodak los fabrica Signet Armorlite, del grupo Essilor, bajo licencia exclusiva de la marca desde 2013. Su progresivo Kodak Unique DRO está optimizado para leer en el celular, la versión HD se personaliza con las medidas del armazón y Mi Primer Kodak es la opción de entrada.',
    intro: [
      'Kodak es una marca que todos conocemos por la fotografía, pero sus cristales para anteojos los fabrica Signet Armorlite, con una licencia exclusiva y mundial de la marca firmada en 2013. Signet Armorlite es parte del grupo Essilor desde 2010: detrás de cada Kodak está la misma industria que hace Varilux.',
      'En Atelier trabajamos Kodak con el laboratorio Optovisión. Esta es la línea, explicada.',
    ],
    secciones: [
      {
        titulo: 'Progresivos Kodak Unique',
        items: [
          { nombre: 'Kodak Unique', texto: 'progresivo pensado para que el paso entre lejos, intermedia y cerca sea suave y natural.' },
          { imagen: '/images/cristales/marcas/kodak-unique-dro.jpg', nombre: 'Kodak Unique DRO', texto: 'DRO quiere decir Dynamic Reading Optimization. Está pensado para quien usa mucho el celular: mejora la zona de lectura y la distancia a la que se lee. Viene en seis largos de corredor y, según el fabricante, reduce en promedio un 54% el astigmatismo oblicuo y mejora un 17% el rendimiento de lectura frente al Unique común.' },
          { nombre: 'Kodak Unique HD', texto: 'la versión personalizada: se calcula con las medidas de cómo te calza el armazón.' },
          { imagen: '/images/cristales/marcas/mi-primer-kodak.jpg', nombre: 'Mi Primer Kodak', texto: 'la versión de entrada de la línea, para quien estrena progresivos.' },
        ],
      },
      {
        titulo: 'Monofocales Kodak',
        parrafos: ['Kodak también tiene monofocales, con el lema de la marca: mejores colores, mejor contraste, mejor visión. Se combinan con antirreflejo, filtro azul o Transitions.'],
      },
    ],
    faqs: [
      { pregunta: '¿Kodak o Varilux?', respuesta: 'Los dos salen del grupo Essilor. Varilux es la línea insignia, con más tecnología en la gama alta; Kodak suele ser una opción de muy buena calidad a un precio menor. Te mostramos los dos con tu receta.' },
      { pregunta: '¿El DRO sirve si uso mucho la compu?', respuesta: 'Está optimizado para la lectura y el celular. Si trabajás muchas horas frente a la compu, también vale pensar en un ocupacional como segundo par.' },
    ],
    cristalesHref: '/cristales-opticos/kodak',
    fuentes: [
      'https://www.sec.gov/Archives/edgar/data/0000031235/000003123513000007/signetlicense8k_022713.htm',
      'https://www.opticianonline.net/content/news/business-as-usual-for-signets-kodak-lenses',
      'https://www.reviewofoptometry.com/news/article/a-phonefriendly-progressive-lens',
      'https://info.icarelabs.com/hubfs/Kodak%20Unique%20HD%20Lens%20ECP%20Sales%20Aid.pdf',
      'https://lenteskodak.com.ar/',
    ],
  },
  {
    slug: 'cristales-essilor',
    marca: 'Essilor',
    title: 'Cristales Essilor más allá de Varilux: Eyezen, Espace, Interview, Stellest y sus materiales',
    excerpt:
      'Essilor es mucho más que Varilux. Monofocales Eyezen, progresivo Espace, ocupacional Interview, control de miopía, y qué significan Orma, Airwear y Stylis en tu presupuesto.',
    linkText: 'Eyezen, Espace, Interview y materiales',
    metaDescription:
      'Guía de cristales Essilor en Córdoba: Eyezen, Espace Plus Digital, Interview, Stellest y Myopilux, materiales Orma, Airwear y Stylis, Crizal, Transitions GEN S y Xperio.',
    keywords: ['Essilor', 'Eyezen', 'Espace', 'Interview Essilor', 'Orma', 'Airwear', 'Stylis', 'Transitions GEN S', 'Crizal', 'Córdoba'],
    date: '2026-10-16',
    imageUrl: '/images/blog/local-varilux.webp',
    imageAlt: 'Exhibidor Essilor y Varilux en Atelier Óptica',
    resumen:
      'Essilor es el fabricante francés de Varilux, Crizal, Eyezen y Stellest, presente en Argentina desde 1988. Además de Varilux tiene el progresivo Espace Plus Digital, el ocupacional Interview, monofocales Eyezen y los materiales Orma 1.5, Airwear 1.59 (policarbonato) y Stylis 1.67 (alto índice).',
    intro: [
      'Essilor es el fabricante francés detrás de Varilux, Crizal, Eyezen y Stellest, y está en Argentina desde 1988. Hoy es parte de EssilorLuxottica, el grupo que también hace Transitions y, bajo licencia, los cristales Kodak.',
      'Varilux y Stellest tienen sus propias notas en el blog. Acá repasamos el resto de la línea Essilor que trabajamos en Atelier.',
    ],
    secciones: [
      {
        titulo: 'Monofocales y control de miopía',
        items: [
          { imagen: '/images/cristales/marcas/eyezen-boost.jpg', nombre: 'Eyezen (Start, Boost y Kids)', texto: 'monofocales para la vida con pantallas. Boost suma un pequeño refuerzo de enfoque en la zona de lectura calibrado por edad.' },
          { nombre: 'Monofocal de laboratorio Essilor', texto: 'tallado a tu receta, en Orma, Airwear o Stylis y con Crizal.' },
          { imagen: '/images/cristales/marcas/stellest.jpg', nombre: 'Stellest', texto: 'el cristal de Essilor para frenar la miopía infantil. Somos óptica certificada Stellest.' },
          { imagen: '/images/cristales/marcas/myopilux.jpg', nombre: 'Myopilux Kids', texto: 'la línea anterior de Essilor para miopía infantil. Hoy, para control de miopía, la recomendación de la marca es Stellest.' },
        ],
      },
      {
        titulo: 'Progresivos y ocupacionales',
        items: [
          { imagen: '/images/cristales/marcas/espace-plus.jpg', nombre: 'Espace Plus Digital', texto: 'progresivo digital de entrada para la vida diaria: manejar, compu y tareas comunes, con diseño asimétrico para menos distorsión.' },
          { imagen: '/images/cristales/marcas/interview.jpg', nombre: 'Interview', texto: 'ocupacional para présbitas: donde un lente de cerca da foco hasta unos 60 cm, Interview lo extiende hasta 2 metros. Ideal para escritorio y reuniones.' },
          { imagen: '/images/cristales/marcas/varilux-xr-design.jpg', nombre: 'Varilux', texto: 'la línea progresiva insignia de Essilor, con su propia nota y ficha.' },
        ],
      },
      {
        titulo: 'Materiales: qué es Orma, Airwear y Stylis',
        items: [
          { nombre: 'Orma 1.5', texto: 'el orgánico clásico, con muy buena calidad óptica. Para graduaciones bajas y medias.' },
          { nombre: 'Airwear 1.59', texto: 'policarbonato: liviano y resistente a los golpes. El que recomendamos para chicos, deporte y armazones al aire.' },
          { nombre: 'Stylis 1.67', texto: 'alto índice: el cristal más fino, para graduaciones altas.' },
        ],
      },
      {
        titulo: 'Tratamientos',
        items: [
          { imagen: '/images/cristales/marcas/crizal.jpg', nombre: 'Crizal', texto: 'el antirreflejo de Essilor, con su nota propia.' },
          { imagen: '/images/cristales/marcas/transitions-gen-s.jpg', nombre: 'Transitions GEN S', texto: 'el fotocromático: transparente adentro, se oscurece en segundos al salir.' },
          { imagen: '/images/cristales/marcas/xperio.jpg', nombre: 'Xperio', texto: 'el polarizado graduado de Essilor, para sol.' },
          { imagen: '/images/cristales/marcas/blue-uv.jpg', nombre: 'Blue UV Filter System', texto: 'filtro de luz azul incorporado al material.' },
        ],
      },
    ],
    faqs: [
      { pregunta: '¿Qué material me conviene?', respuesta: 'Depende de tu graduación y del armazón. A más graduación, más índice (Stylis) para que el cristal quede fino; para chicos y armazones al aire, Airwear.' },
      { pregunta: '¿Essilor y Varilux son lo mismo?', respuesta: 'Varilux es la marca de progresivos de Essilor. Essilor además tiene monofocales, ocupacionales y tratamientos.' },
    ],
    cristalesHref: '/cristales-opticos/eyezen',
    fuentes: [
      'https://optiknow.ca/2019/02/12/essilor-international-expands-its-footprint-in-europe-and-latin-america',
      'https://visionplusmag.com/?p=18497',
      'https://mivision.com.au/2009/09/essilor-s-interview-near-vision-lenses/',
      'https://myopiaprofile.com/sponsors/essilor',
      'https://en.wikipedia.org/wiki/Essilor',
    ],
  },
  {
    slug: 'cristales-sygnus',
    marca: 'Sygnus',
    title: 'Cristales Sygnus: monofocal, bifocal y lente para manejar, con materiales Essilor',
    excerpt:
      'Sygnus Monofocal One, Sygnus Driver, Sygnus Bifocal y los progresivos Essilor New Editions: una línea de laboratorio sobre materiales Essilor con antirreflejo NUMAX.',
    linkText: 'Monofocal One, Driver y Bifocal',
    metaDescription:
      'Cristales Sygnus en Córdoba: Monofocal One, Sygnus Driver para manejar, Sygnus Bifocal y Essilor New Editions, en Orma, Airwear y Stylis con antirreflejo NUMAX.',
    keywords: ['Sygnus', 'Sygnus Driver', 'Sygnus Monofocal One', 'Sygnus Bifocal', 'Essilor New Editions', 'Córdoba'],
    date: '2026-10-16',
    imageUrl: '/images/blog/medicion-pupilar-optica.webp',
    imageAlt: 'Medición pupilar en la óptica',
    resumen:
      'Sygnus es una línea de cristales de laboratorio que trabajamos con Optovisión, fabricada sobre materiales Essilor (Orma, Airwear y Stylis) y con antirreflejo NUMAX en casi todas sus versiones. Incluye Monofocal One, Sygnus Driver para manejar, Sygnus Bifocal y los progresivos Essilor New Editions.',
    intro: [
      'Sygnus es una línea de cristales que trabajamos con el laboratorio Optovisión. Su particularidad: se fabrica sobre materiales Essilor (Orma, Airwear y Stylis) y casi todas sus versiones llevan antirreflejo NUMAX incluido.',
      'Es una opción que suele quedar a mitad de camino entre los cristales de stock y las marcas premium.',
    ],
    secciones: [
      {
        titulo: 'La línea Sygnus',
        items: [
          { imagen: '/images/cristales/marcas/sygnus-monofocal-one.jpg', nombre: 'Sygnus Monofocal One', texto: 'monofocal de laboratorio tallado a tu receta. Se puede pedir con filtro Blue UV, fotosensible o Transitions GEN S.' },
          { imagen: '/images/cristales/marcas/sygnus-driver.jpg', nombre: 'Sygnus Driver', texto: 'pensado para manejar, con versión polarizada Xperio para reducir el encandilamiento del sol.' },
          { imagen: '/images/cristales/marcas/sygnus-bifocal.jpg', nombre: 'Sygnus Bifocal', texto: 'bifocal con materiales Essilor, también con Blue UV y Transitions.' },
          { imagen: '/images/cristales/marcas/sygnus-new-editions.jpg', nombre: 'Essilor New Editions', texto: 'progresivos de Essilor en esta misma línea, con opciones espejadas, polarizadas y fotosensibles.' },
        ],
      },
      {
        titulo: 'Materiales y tratamientos',
        parrafos: [
          'Orma (orgánico 1.5), Airwear (policarbonato liviano y resistente) y Stylis (alto índice 1.67, el más fino). Sobre esa base, antirreflejo NUMAX, filtro Blue UV, Orma Acclimates fotosensible, Transitions GEN S o polarizado Xperio.',
        ],
      },
    ],
    faqs: [
      { pregunta: '¿Para quién es Sygnus Driver?', respuesta: 'Para quien maneja mucho, de día o de noche. Contanos cuántas horas manejás y te decimos si conviene polarizado o Transitions.' },
    ],
    fuentes: ['Catálogo de cristales del sistema (laboratorio Optovisión), octubre 2026'],
  },
  {
    slug: 'laboratorio-optovision',
    marca: 'Optovisión',
    title: 'Optovisión: el laboratorio argentino detrás de muchos de nuestros cristales',
    excerpt:
      'Con Optovisión hacemos Varilux, Kodak, Essilor y Sygnus, y además su línea propia: cristales de stock, monofocales de laboratorio, bifocales y el progresivo Pro-Line Digital.',
    linkText: 'Stock, laboratorio y Pro-Line Digital',
    metaDescription:
      'Optovisión, laboratorio óptico argentino: qué cristales hacemos con ellos en Atelier Óptica Córdoba. Stock, monofocales de laboratorio, bifocales Flat Top y Kriptock, y progresivo Pro-Line Digital TDI.',
    keywords: ['Optovisión', 'laboratorio óptico', 'Pro-Line Digital', 'bifocal Flat Top', 'cristales de stock', 'Córdoba'],
    date: '2026-10-16',
    imageUrl: '/images/blog/mostrador-marmol.webp',
    imageAlt: 'Mostrador de Atelier Óptica',
    resumen:
      'Optovisión es un laboratorio óptico argentino que trabaja con Essilor, Varilux, Transitions y Kodak, y que además tiene línea propia: cristales de stock, monofocales tallados a medida, bifocales Flat Top y Kriptock, y el progresivo Pro-Line Digital. Es uno de los tres laboratorios de Atelier Óptica.',
    intro: [
      'Optovisión es un laboratorio óptico argentino que trabaja con las grandes marcas: Essilor, Varilux, Transitions y Kodak, entre otras. En Atelier es uno de nuestros tres laboratorios, junto con Grupo Óptico (Smart Lens) y Vitolen (Hoya y Pentax).',
      'Además de las marcas, Optovisión tiene su línea propia, que es la que te contamos acá.',
    ],
    secciones: [
      {
        titulo: 'Cristales de stock',
        parrafos: [
          'Son cristales ya fabricados, para graduaciones comunes sin astigmatismo alto: salen más rápido y más económicos. Hay en orgánico, policarbonato y alto índice, con antirreflejo, filtro de luz azul o fotocromáticos.',
        ],
      },
      {
        titulo: 'Monofocales de laboratorio',
        imagen: { src: '/images/equipo/paleta-cristales-entrega.jpg', alt: 'Cristales tallados a medida' },
        parrafos: [
          'Cuando la graduación no se consigue en stock, el cristal se talla a medida: orgánico, alto índice, policarbonato (Policast), fotosensible, espejado o polarizado, y con filtro de luz azul.',
        ],
      },
      {
        titulo: 'Bifocales',
        items: [
          { nombre: 'Flat Top', texto: 'el bifocal clásico con la ventana de lectura visible, en blanco, fotosensible, con filtro azul, policarbonato o Transitions.' },
          { nombre: 'Kriptock', texto: 'bifocal de segmento redondo, más disimulado.' },
        ],
      },
      {
        titulo: 'Progresivo Pro-Line Digital',
        imagen: { src: '/images/blog/lentes-progresivos-zonas.webp', alt: 'Zonas de visión de un cristal progresivo' },
        parrafos: [
          'El multifocal digital de Optovisión, sobre materiales Essilor (Orma, Airwear o Stylis) y con opciones de filtro Blue UV, Orma Acclimates o Transitions GEN S. Una alternativa accesible a las marcas premium.',
        ],
      },
    ],
    faqs: [
      { pregunta: '¿Stock o laboratorio?', respuesta: 'Si tu graduación entra en stock, es la opción más rápida y económica. Si tenés astigmatismo alto, o querés un tratamiento especial, va de laboratorio. Lo vemos con tu receta.' },
    ],
    cristalesHref: '/cristales-opticos/tienda-online',
    fuentes: [
      'https://trade.nosis.com/es/OPTOVISION-SA/Sitios/33680761049/1/p/s',
      'Catálogo de cristales del sistema (laboratorio Optovisión), octubre 2026',
    ],
  },
];

export function notaMarcaPorSlug(slug: string): NotaMarcaCristal | undefined {
  return NOTAS_MARCAS_CRISTALES.find((n) => n.slug === slug);
}

/** Metadata de cada nota (canonical, título, descripción), armada desde la lista. */
export function metadataDeNotaMarca(slug: string): Metadata {
  const n = notaMarcaPorSlug(slug);
  if (!n) return {};
  return {
    alternates: { canonical: `https://atelieroptica.com.ar/blog/${n.slug}` },
    title: n.title,
    description: n.metaDescription,
    keywords: n.keywords,
    openGraph: { title: n.title, description: n.metaDescription, images: [n.imageUrl] },
  };
}
