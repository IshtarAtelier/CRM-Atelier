export const seoKeywords = [
  'anteojos-para-ver-en-cordoba',
  'anteojos-de-lectura',
  'anteojos-de-lectura-en-cordoba',
  'anteojos-multifocales',
  'anteojos-multifocales-en-cordoba',
  'optica-en-cordoba',
  'anteojos-recetados-en-cordoba',
  'donde-comprar-anteojos-en-cordoba',
  'optica-cordoba',
  'opticas-cordoba',
  'optica-cerca-de-mi',
  'optica-en-cerro-de-las-rosas',
  'comprar-anteojos-cordoba',
  'anteojos-cordoba',
  'lentes-cordoba',
  'lentes-de-sol-cordoba',
  'anteojos-de-sol-cordoba',
  'lentes-recetados-cordoba',
  'que-anteojos-me-quedan-bien',
  'como-elegir-anteojos-segun-mi-cara',
  'lentes-para-computadora',
  'lentes-con-filtro-azul-sirven',
  'cuando-cambiar-los-anteojos',
  'como-saber-si-necesito-anteojos',
  
  // Blue Block / Filtro Azul
  'que-son-los-anteojos-blue-block',
  'anteojos-blue-block-para-que-sirven',
  'diferencia-entre-blue-block-y-antirreflex',
  'anteojos-para-computadora-blue-block',
  'lentes-filtro-azul-precio-argentina',
  'es-bueno-usar-lentes-blue-block-todo-el-dia',
  
  // Meta Ray Ban
  'anteojos-inteligentes-ray-ban-meta',
  'ray-ban-meta-precio-argentina',
  'donde-comprar-ray-ban-meta-en-cordoba',
  'ray-ban-con-camara-y-musica',
  'ray-ban-meta-wayfarer-cordoba',
  'ray-ban-meta-smart-glasses-caracteristicas',
  
  // Miopía Infantil, Stellest & Myopilux
  'como-frenar-la-miopia-en-ninos',
  'miopia-infantil-avanza-muy-rapido',
  'anteojos-irrompibles-para-ninos-con-miopia',
  'a-que-edad-se-estabiliza-la-miopia',
  'lentes-stellest-para-control-de-miopia',
  'diferencia-entre-stellest-y-lentes-comunes',
  'precio-lentes-stellest-essilor-argentina',
  'lentes-myopilux-para-ninos',
  'lentes-myopilux-plus-essilor-ninos',
  'tratamiento-para-frenar-miopia-infantil'
];

export function formatQueryToTitle(query: string): string {
  // Convert "anteojos-para-ver-en-cordoba" to "Anteojos Para Ver En Cordoba"
  return query
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * A qué página REAL corresponde cada búsqueda.
 *
 * Por qué existe: `/blog/busquedas/<keyword>` era una página por keyword, todas
 * con el mismo molde ("Si estás buscando X, llegaste al lugar indicado") y el
 * mismo par de botones. Eso es la definición de doorway en las guías de spam de
 * Google —páginas hechas para rankear que empujan a todos al mismo lado— y son
 * causa de acción manual. En vez de borrarlas y perder lo que ya rankean, cada
 * una redirige 301 al contenido real que responde esa búsqueda.
 *
 * El mismo mapa lo usan la redirección y el acordeón del blog, así ninguna parte
 * del sitio queda enlazando a una URL que redirige.
 */
const DESTINOS: Array<[RegExp, string]> = [
  // ORDEN = PRIORIDAD: gana la primera que matchea, así que lo específico va
  // arriba. Los tokens cortos llevan guiones a los lados a propósito: sin eso
  // `cara` matcheaba "…smart-glasses-caracteristicas" y mandaba una búsqueda de
  // Ray-Ban a la guía de rostros.

  // Producto puntual (antes que "precio", o "ray-ban-meta-precio-argentina"
  // terminaba en la guía de multifocales)
  [/ray-ban|wayfarer|smart-glasses|camara/, '/tienda'],
  // Control de miopía infantil — hay nota propia y es el tema de la campaña
  [/stellest|myopilux|miopia|ninos/, '/blog/control-miopia-infantil-lentes'],
  // Filtro azul / pantallas
  [/blue-block|filtro-azul|computadora|(^|-)azul(-|$)/, '/cristales-opticos/blue-uv'],
  // Multifocales y precios
  [/multifocal|progresiv|precio/, '/blog/guia-precios-multifocales-argentina'],
  // Elección de armazón por rostro
  [/(^|-)cara(-|$)|rostro|quedan-bien/, '/blog/guia-armazones-segun-rostro'],
  // Receta / síntomas / cuándo cambiar
  [/receta|necesito-anteojos|cambiar-los-anteojos|lectura/, '/cristales-opticos'],
  // Sol
  [/(^|-)sol(-|$)/, '/lentes-de-sol'],
  // Local / marca / geo
  [/optica|cordoba|cerca-de-mi|cerro-de-las-rosas|comprar-anteojos/, '/optica-cordoba'],
];

/** Destino 301 de una búsqueda vieja. Default: el índice del blog. */
export function destinoDeBusqueda(query: string): string {
  for (const [patron, destino] of DESTINOS) {
    if (patron.test(query)) return destino;
  }
  return '/blog';
}
