// ────────────────────────────────────────────────────────────────────────────
// Color de armazón: de texto libre a familias filtrables.
//
// DE DÓNDE SALE EL DATO
// `frame-specs.ts` ya extrae un color del alt de la foto ("negro con patillas
// plateadas", "azul petróleo", "carey multicolor azul y ámbar"). Es un dato
// REAL escrito a mano por una persona mirando la foto — nunca inventado.
//
// POR QUÉ NO ALCANZA PARA FILTRAR TAL CUAL
// Auditado contra producción el 5/9/26 (`scripts/checks/audit-colores-alt.mjs`):
// 110 de 115 productos tienen color parseado, pero en **40 valores distintos**,
// la mayoría con un solo producto detrás ("jaspeado violeta y rosa", "carey
// multicolor azul y ámbar"). Un filtro con 40 opciones, la mitad diciendo "(1)",
// no filtra: abruma. Hace falta agruparlos en familias — "Negro", "Carey",
// "Dorado" — sin perder el detalle real, que sigue completo en la ficha.
//
// LA REGLA: SE AGRUPA, NUNCA SE INVENTA
// Cada familia se detecta por palabras que están LITERALMENTE en el texto
// original. Si el texto no menciona ninguna palabra reconocida, el producto
// no entra en NINGÚN filtro de color — nunca se le asigna una familia al azar
// ni una por descarte. Mismo criterio que ya usa `frame-specs.ts`: un dato
// ausente es mejor que uno equivocado.
//
// UN ARMAZÓN PUEDE TENER MÁS DE UNA FAMILIA
// "Negro y dorado" es válido bajo Negro Y bajo Dorado — es lo que espera quien
// busca "un armazón negro" y no quiere perderse uno que también lo es, solo
// porque el detalle dice "con patillas doradas". Tope de 2 familias por
// producto: a partir de la tercera, el texto ya describe un jaspeado
// multicolor y sumar más no ayuda a filtrar, solo agrega ruido.
//
// SIN TILDES DE LOS DOS LADOS
// El texto de entrada se pasa por `sinTildes()` antes de comparar, así que
// cada regex de acá abajo se escribe en ASCII plano ("marron", no "marrón") —
// una sola normalización, no dos. La primera versión de este archivo intentaba
// sacarle las tildes también a la REGEX (normalizando el `.source` del patrón),
// que es frágil y fue justo donde se coló un fragmento roto sin darme cuenta.
// ────────────────────────────────────────────────────────────────────────────

export interface FamiliaColor {
  /** Slug estable — es lo que viaja en la URL (?color=negro) y en la API. */
  id: string;
  /** Lo que ve la persona en el chip. */
  etiqueta: string;
  /** Color de referencia para el puntito del chip. Decorativo: no es el color
   *  exacto de cada armazón, es el tono representativo de la familia. */
  swatch: string;
}

function sinTildes(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, ''); // quita los diacríticos combinantes
}

// El orden importa para dos cosas: define qué familia gana cuando dos palabras
// caen en el mismo tramo de texto (la primera de la lista que matchea), y es
// el orden en que se muestran cuando los conteos empatan. De más frecuente a
// menos frecuente en el catálogo real (ver la auditoría), así lo típico
// encabeza la lista. Las regex van en ASCII plano — el texto ya llega sin
// tildes por `sinTildes()`.
const FAMILIAS: { id: string; etiqueta: string; swatch: string; palabras: RegExp }[] = [
  { id: 'negro', etiqueta: 'Negro', swatch: '#1c1917', palabras: /\bnegr[oa]s?\b/ },
  { id: 'dorado', etiqueta: 'Dorado', swatch: '#c8a55c', palabras: /\bdorad[oa]s?\b|\boro\b/ },
  { id: 'plateado', etiqueta: 'Plateado', swatch: '#b4b8bd', palabras: /\bplatead[oa]s?\b/ },
  { id: 'carey', etiqueta: 'Carey', swatch: '#8a5a2b', palabras: /\bcarey\b/ },
  { id: 'marron', etiqueta: 'Marrón', swatch: '#5c4433', palabras: /\bmarron(?:es)?\b|\bcafe\b|\btopo\b|\bhabano\b/ },
  { id: 'gris', etiqueta: 'Gris', swatch: '#8b8f94', palabras: /\bgris(?:es)?\b/ },
  { id: 'azul', etiqueta: 'Azul', swatch: '#2b4a6f', palabras: /\bazul(?:es)?\b/ },
  { id: 'bordo', etiqueta: 'Bordó', swatch: '#6e1f2a', palabras: /\bbordo\b|\bvino\b/ },
  { id: 'rosa', etiqueta: 'Rosa', swatch: '#d98ca0', palabras: /\brosa(?:s|do|da)?\b/ },
  { id: 'violeta', etiqueta: 'Violeta', swatch: '#6b4d8c', palabras: /\bviolet[ao]\b|\bmorad[oa]\b|\blila\b/ },
  { id: 'verde', etiqueta: 'Verde', swatch: '#3f6b4a', palabras: /\bverdes?\b/ },
  { id: 'blanco', etiqueta: 'Blanco', swatch: '#f4f2ee', palabras: /\bblanc[oa]s?\b/ },
  { id: 'ambar', etiqueta: 'Ámbar', swatch: '#b5722e', palabras: /\bambar(?:es)?\b/ },
];

const FAMILIAS_POR_ID = new Map(FAMILIAS.map(f => [f.id, f]));

export function familiaColorPorId(id: string): FamiliaColor | undefined {
  const f = FAMILIAS_POR_ID.get(id);
  return f ? { id: f.id, etiqueta: f.etiqueta, swatch: f.swatch } : undefined;
}

/** Todas las familias declaradas, en su orden canónico. Para armar el listado
 *  completo de chips (aunque hoy nadie tenga un color de esa familia). */
export function todasLasFamilias(): FamiliaColor[] {
  return FAMILIAS.map(f => ({ id: f.id, etiqueta: f.etiqueta, swatch: f.swatch }));
}

/**
 * De un color en texto libre a las familias que reconoce, en el orden en que
 * están declaradas las familias (no en el orden en que aparecen las palabras
 * en el texto). Vacío si no reconoce ninguna — nunca inventa una por descarte.
 */
export function familiasDeColor(colorLibre: string | null | undefined): FamiliaColor[] {
  if (!colorLibre) return [];
  const texto = sinTildes(colorLibre);

  const encontradas: FamiliaColor[] = [];
  for (const f of FAMILIAS) {
    if (f.palabras.test(texto)) {
      encontradas.push({ id: f.id, etiqueta: f.etiqueta, swatch: f.swatch });
      // Tope de 2: a partir de la tercera palabra de color, el texto ya
      // describe un jaspeado y sumar más familias agrega ruido, no precisión.
      if (encontradas.length >= 2) break;
    }
  }
  return encontradas;
}

/** Solo los ids — lo que se guarda/compara en filtros y conteos. */
export function idsDeColor(colorLibre: string | null | undefined): string[] {
  return familiasDeColor(colorLibre).map(f => f.id);
}
