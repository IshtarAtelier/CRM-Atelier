/**
 * Normaliza texto para comparar sin distinguir mayúsculas, tildes ni espacios
 * de borde: "Andrómeda", "andromeda" y " ANDRÓMEDA " matchean entre sí.
 *
 * Antes vivía copiada dentro de `producto/[slug]/page.tsx` para el motor de
 * recomendados. La búsqueda de `/api/store/products` no la tenía, así que
 * alguien que tipeaba "andromeda" sin tilde recibía CERO resultados de un
 * producto que sí existe — se lee como "no tienen", no como "escribiste mal".
 */
export function normalizarTexto(valor?: string | null): string {
  const RANGO_TILDES = new RegExp('[̀-ͯ]', 'g');
  return (valor || '').toLowerCase().normalize('NFD').replace(RANGO_TILDES, '').trim();
}
