/**
 * La forma del armazón, en las tres versiones gramaticales en que se escribe.
 *
 * Por qué existe: el catálogo guarda la forma en masculino ("Cuadrado") porque
 * ahí califica al armazón, pero cada pantalla la usa distinto y la concordancia
 * cambia la palabra:
 *
 *   masc        →  "armazón CUADRADO de acetato"        (título del feed)
 *   mascPlural  →  "anteojos de sol REDONDOS"           (título del feed)
 *   fem         →  "forma CUADRADA"                     (alt de la grilla, descripción)
 *
 * Vivía a medias dentro de TiendaClient (un mapa de dos entradas: Cuadrado y
 * Redondo) y el feed la necesitaba completa. Un solo lugar para que la tienda y
 * el aviso de Shopping no digan formas distintas del mismo armazón.
 *
 * Es una tabla explícita y no una regla de pluralización: una forma que no esté
 * acá se omite del título en vez de salir mal concordada, porque un adjetivo mal
 * conjugado en el título de Shopping se lee como error de la tienda.
 */

interface Gramatica {
  masc: string;
  mascPlural: string;
  fem: string;
}

const FORMAS: Record<string, Gramatica> = {
  cuadrado: { masc: 'cuadrado', mascPlural: 'cuadrados', fem: 'cuadrada' },
  redondo: { masc: 'redondo', mascPlural: 'redondos', fem: 'redonda' },
  ovalado: { masc: 'ovalado', mascPlural: 'ovalados', fem: 'ovalada' },
  rectangular: { masc: 'rectangular', mascPlural: 'rectangulares', fem: 'rectangular' },
  hexagonal: { masc: 'hexagonal', mascPlural: 'hexagonales', fem: 'hexagonal' },
  'cat-eye': { masc: 'cat-eye', mascPlural: 'cat-eye', fem: 'cat-eye' },
  aviador: { masc: 'aviador', mascPlural: 'aviador', fem: 'aviador' },
  xl: { masc: 'XL', mascPlural: 'XL', fem: 'XL' },
};

/** Sin tildes y en minúscula: para buscar en la tabla, nunca para mostrar. */
const clave = (s: string) =>
  (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/**
 * La forma tal como se nombra de cara al cliente ("Cat-Eye", "XL", "Cuadrado"),
 * o null si no hay dato. "Otros" es el valor de descarte del catálogo: no es una
 * forma, así que tampoco se publica como tal.
 */
export function formaVisible(shape: string | null | undefined): string | null {
  const s = (shape || '').trim();
  if (!s || clave(s) === 'otros') return null;
  return s;
}

/**
 * La forma como adjetivo del armazón: "armazón cuadrado", "anteojos redondos".
 * Devuelve null si la forma no está en la tabla — quien llama la omite.
 */
export function formaAdjetivo(shape: string | null | undefined, plural = false): string | null {
  const g = FORMAS[clave(formaVisible(shape) || '')];
  if (!g) return null;
  return plural ? g.mascPlural : g.masc;
}

/**
 * La forma concordando con la palabra "forma": "forma cuadrada".
 * Una forma desconocida cae a minúsculas, que detrás de "forma" nunca queda mal.
 */
export function formaFemenina(shape: string | null | undefined): string | null {
  const visible = formaVisible(shape);
  if (!visible) return null;
  return FORMAS[clave(visible)]?.fem ?? visible.toLowerCase();
}
