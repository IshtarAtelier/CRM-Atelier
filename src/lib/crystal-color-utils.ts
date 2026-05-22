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
  const type = (product.type || '').toUpperCase();

  // Dedicated Teñido addon product
  if (type === 'ADDON' && name === 'teñido') return true;
  
  // Must be a crystal for other checks
  const category = (product.category || '').toLowerCase();
  if (category !== 'cristal') return false;

  return (
    name.includes('teñido') ||
    name.includes('tenido') ||
    name.includes('tintado') ||
    name.includes('fotocromatico') ||
    name.includes('fotocromático') ||
    name.includes('transitions') ||
    name.includes('acclimates') ||
    name.includes('smart color')
  );
}

/**
 * Get a display label for the color type category
 */
export function getColorCategoryLabel(category: string): string {
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
