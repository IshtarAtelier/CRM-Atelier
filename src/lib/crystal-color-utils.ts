import { paletaDeFotocromatico } from '@/lib/constants/paletas-color';
import { isTeñidoAddon } from '@/lib/promo-utils';
/**
 * Crystal Color Utilities
 * 
 * Determines if a crystal product needs color selection (e.g., tinted or photochromic lenses).
 */

/**
 * Check if a crystal product needs a color selection.
 * Returns true for the dedicated "Teñido" addon and for photochromic lenses.
 */
export function needsColorSelection(product: any): boolean {
  if (!product) return false;

  const name = (product.name || '').toLowerCase();
  const category = (product.category || '').toLowerCase();

  // El teñido a pedido: su color lo elige el cliente.
  if (isTeñidoAddon(product)) return true;
  if (category === 'tratamiento' && (name === 'teñido' || name === 'tenido')) return true;

  // Para todo lo demás manda LA PALETA: si ese cristal tiene colores para
  // elegir, el selector se abre. Antes esto era una segunda lista de palabras
  // clave que había que mantener sincronizada a mano — y no lo estaba: los 15
  // cristales Xperio tenían su paleta cargada pero el botón no aparecía nunca,
  // así que el vendedor no podía llegar a ella.
  return paletaDeFotocromatico(product) !== null;
}

/**
 * Get a display label for the color type category
 */
function getColorCategoryLabel(category: string): string {
  switch (category) {
    case 'COMPACTO': return 'Color Compacto';
    case 'MUESTRA': return 'Color Según Muestra';
    case 'DEGRADE': return 'Color Degradé';
    default: return category;
  }
}

/**
 * Color categories available
 */
export const COLOR_CATEGORIES = [
  { key: 'COMPACTO', label: 'Color Compacto' },
  { key: 'MUESTRA', label: 'Color Según Muestra' },
  { key: 'DEGRADE', label: 'Color Degradé' },
] as const;
