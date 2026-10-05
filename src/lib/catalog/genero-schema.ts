/**
 * Género de un armazón en el vocabulario de schema.org (`suggestedGender` del
 * JSON-LD de la ficha): 'female', 'male' o 'unisex'.
 *
 * Por qué (auditoría del 25/9/2026): la ficha pasaba el texto tal cual,
 * "femenino" o "femenino, masculino, unisex", y Google espera un solo valor
 * en inglés. ~38 fichas tienen varios géneros cargados juntos: cuentan como
 * unisex.
 *
 * OJO: el feed de Merchant (`feedGender` en src/lib/ads/product-feed.ts) tiene
 * su propia regla y NO se tocó a propósito: decide por la primera palabra, así
 * que "Masculino, Femenino, Unisex" sale como 'male'. Cambiarlo mueve lo que
 * reciben las campañas de catálogo; queda propuesto para revisarlo con quien
 * lleva la pauta.
 */
export type GeneroSchema = 'female' | 'male' | 'unisex';

export function generoSchemaOrg(gender: string | null | undefined): GeneroSchema | null {
  const g = (gender || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (!g.trim()) return null;
  const femenino = /fem|mujer/.test(g);
  const masculino = /masc|hombre|varon/.test(g);
  const unisex = /unisex|sin_genero|no_gender|sin genero/.test(g);
  if (unisex || (femenino && masculino)) return 'unisex';
  if (femenino) return 'female';
  if (masculino) return 'male';
  return null;
}
