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
