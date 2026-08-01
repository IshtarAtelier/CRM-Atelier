/**
 * Color, material y forma de un armazón, sacados del texto alternativo de la foto.
 *
 * Por qué de ahí: el catálogo no tiene columnas para estos datos, pero los alts
 * se escribieron con una estructura fija y los traen los 113 de 114 productos
 * publicados:
 *
 *   "Helena C5 — armazón de receta negro con patillas lila, en acetato, forma cat-eye, visto de tres cuartos"
 *                └──────── color ────────┘  └ material ┘  └── forma ──┘
 *
 * Para qué sirven: Merchant Center los pide para la categoría Gafas —sin `color`
 * y `material` los avisos de Shopping no matchean búsquedas del tipo "anteojos
 * de acetato negro"— y son los mismos datos que el cliente busca en la ficha.
 *
 * Se extrae, no se inventa: si el alt no tiene la forma esperada devuelve null
 * en ese campo y quien lo use decide qué mostrar. Mejor un dato ausente que uno
 * equivocado en el feed, que es motivo de desaprobación del producto.
 */

export interface FrameSpecs {
  color: string | null;
  material: string | null;
  shape: string | null;
}

const VACIO: FrameSpecs = { color: null, material: null, shape: null };

/** Normaliza el material a la forma en que se escribe de cara al cliente. */
function normalizarMaterial(raw: string): string | null {
  const m = raw.trim().toLowerCase();
  if (!m) return null;
  if (m.startsWith("acetato")) return "Acetato";
  if (m.startsWith("metal")) return "Metal";
  if (m.startsWith("tr90")) return "TR90";
  if (m.startsWith("titanio")) return "Titanio";
  if (m.startsWith("aluminio")) return "Aluminio";
  // Desconocido pero presente: se devuelve capitalizado en vez de descartarlo.
  return raw.trim().charAt(0).toUpperCase() + raw.trim().slice(1);
}

/**
 * Parsea el alt de una foto de armazón.
 * Devuelve los campos que pudo reconocer; el resto queda en null.
 */
export function parseFrameSpecs(alt?: string | null): FrameSpecs {
  if (!alt || typeof alt !== "string") return VACIO;
  const texto = alt.trim();
  if (texto.length < 20) return VACIO;

  // El color va entre el tipo de producto y ", en <material>".
  // Se corta en la primera coma para quedarse con el color principal y no
  // arrastrar los detalles ("negro con patillas lila" → "negro").
  let color: string | null = null;
  const tramoColor = texto.match(
    /—\s*(?:armaz[oó]n(?:\s+de\s+receta)?(?:\s+con\s+clip\s+de\s+sol)?|anteojos\s+de\s+sol|clip[- ]?on)\s+([^,]+?)(?:,\s*en\s|,)/i,
  );
  if (tramoColor) {
    color = tramoColor[1].replace(/\s+con\s+.*$/i, "").trim();
    if (color.length > 40 || color.length < 2) color = null;
  }

  const mMaterial = texto.match(/,\s*en\s+([^,]+)/i);
  const material = mMaterial ? normalizarMaterial(mMaterial[1]) : null;

  const mForma = texto.match(/forma\s+([^,]+)/i);
  const shape = mForma ? mForma[1].trim() : null;

  return {
    color: color || null,
    material,
    shape: shape && shape.length < 30 ? shape : null,
  };
}

/** El primer alt que tenga forma de descripción; los cortos no sirven. */
export function pickDescriptiveAlt(alts?: string[] | null): string | null {
  if (!Array.isArray(alts)) return null;
  return alts.find((a) => typeof a === "string" && a.length > 20) || null;
}
