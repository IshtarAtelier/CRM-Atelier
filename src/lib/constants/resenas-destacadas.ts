/**
 * Reseñas destacadas que muestra el sitio (home, tienda, fichas y Quiénes somos).
 *
 * POR QUÉ EXISTE: la API de Google Places solo devuelve 5 reseñas "más
 * relevantes", elegidas por Google, y no permite pedir las más nuevas (la
 * versión que ordenaba por fecha está desactivada en el proyecto y Google ya no
 * la habilita). El 15/9/2026 la más nueva que devolvía era de junio. Ishtar
 * pidió mostrar comentarios de la semana.
 *
 * DE DÓNDE SALEN: copiadas TAL CUAL del Administrador del Perfil de Negocio
 * (business.google.com → Opiniones, que las lista de la más nueva a la más
 * vieja). Nada se resume, se corrige ni se retoca: el texto es el del cliente,
 * con sus faltas. Solo 5 estrellas. La fecha es el día en que Google la
 * publicó, deducido de "hace N días" el día de la lectura.
 *
 * Para actualizar: volver a leerlas del mismo lugar y reemplazar la lista. El
 * promedio y la cantidad de reseñas NO viven acá: siguen saliendo de la API,
 * que en eso sí es exacta.
 *
 * Nunca automatizar el PEDIDO de reseñas ni responderlas desde el sistema
 * (regla de Ishtar). Esto solo las muestra.
 */

export interface ResenaDestacada {
  autor: string;
  texto: string;
  /** Día de publicación en Google, AAAA-MM-DD. */
  fecha: string;
  estrellas: 5;
}

/** Día en que se copiaron del Perfil de Negocio. */
export const RESENAS_LEIDAS_EL = '2026-09-15';

/** En el orden en que se muestran. Las dos primeras las eligió Ishtar. */
export const RESENAS_DESTACADAS: ResenaDestacada[] = [
  {
    autor: 'Axel Bruni',
    fecha: '2026-09-11',
    estrellas: 5,
    texto:
      'Muy buena atención, tuvieron mucha paciencia y mucha dedicación, desde que consulté por whatsapp hasta la visita al local y el posterior proceso de compra. Respondieron todas mis consultas, que eran muchas, con amabilidad y de forma super detallada. La calidad de los lentes que llevé es impresionante. El local es muy lindo y tienen gran variedad de armazones.',
  },
  {
    autor: 'Adry Ragagnin',
    fecha: '2026-09-11',
    estrellas: 5,
    texto:
      'Como siempre muy buena atencion y disposición para asesorar a los clientes. Es mi segunda compra de lentes multifocales y son todo lo que esta bien. Gracias 🙂',
  },
  {
    autor: 'María Victoria SMIDT',
    fecha: '2026-09-09',
    estrellas: 5,
    texto:
      'Fui a tres ópticas diferentes, en ninguna me atendieron tan bien como en Optica Atelier, además de darme también el mejor precio!! Super recomendable!!!',
  },
  {
    autor: 'Pablo Boldrini',
    fecha: '2026-09-15',
    estrellas: 5,
    texto:
      'Una de las opticas mas completas que vi! muy buena la web todo intuitivo, ver lo que me gusta, comprar y a disfrutar! 10 de 10 .',
  },
  {
    autor: 'Damaris Dominguez',
    fecha: '2026-09-09',
    estrellas: 5,
    texto:
      'Agradecida con la atención que recibí desde un principio y por la paciencia ☺️, encontré lo que buscaba ! Volvería sin dudas .. !!!',
  },
  {
    autor: 'Valeria Ramirez',
    fecha: '2026-09-08',
    estrellas: 5,
    texto: 'Excelente atención Me sacaron todas las dudas en multifocales Quedaron buenísimos!!!',
  },
  {
    autor: 'Camilo Mottola',
    fecha: '2026-09-08',
    estrellas: 5,
    texto: 'Excelente atención! Saben asesorarte muy muy bien, opciones de sobra. Buen precio.',
  },
  {
    autor: 'FLORENCIA AGUSTINA BRIZUELA',
    fecha: '2026-09-09',
    estrellas: 5,
    texto: 'Hermosa la atención, y mucha variedad de lentes, hermosos todos, me encantó! ♥️',
  },
  {
    autor: 'Nora Arroyo',
    fecha: '2026-09-09',
    estrellas: 5,
    texto: 'Muy buena atención, mejores precios y muy buena calidad de productos',
  },
];

/**
 * "Hace 4 días", "Hace 2 semanas"… calculado contra HOY, para que el texto no
 * quede congelado en la fecha en que se copió la reseña.
 */
export function haceCuanto(fechaIso: string, hoy: Date = new Date()): string {
  const [a, m, d] = fechaIso.split('-').map(Number);
  const publicada = new Date(a, m - 1, d);
  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const dias = Math.max(0, Math.round((inicioHoy.getTime() - publicada.getTime()) / 86_400_000));
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Ayer';
  if (dias < 7) return `Hace ${dias} días`;
  const semanas = Math.floor(dias / 7);
  if (semanas < 5) return semanas === 1 ? 'Hace 1 semana' : `Hace ${semanas} semanas`;
  const meses = Math.floor(dias / 30);
  return meses <= 1 ? 'Hace 1 mes' : `Hace ${meses} meses`;
}
