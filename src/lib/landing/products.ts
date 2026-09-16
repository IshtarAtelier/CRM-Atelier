import { getTiendaCatalogo } from "@/lib/catalog/sources";
import { seleccionarProductosLanding, type FilaCatalogoLanding } from "./products-map";
import type { LandingProduct } from "./campaigns";

/**
 * Productos destacados para una landing de campaña.
 *
 * Lee el MISMO catálogo resiliente que /tienda (vivo → última lectura buena →
 * snapshot del build), así que nunca lanza y nunca vuelve vacío. Antes hacía su
 * propia consulta y, si fallaba, mostraba una lista inventada sin precios; ver
 * products-map.ts para la historia. La selección y el precio están en la
 * función pura para poder testearlos sin base.
 */
export async function getCampaignProducts(category: string | null): Promise<LandingProduct[]> {
  const { data, origin } = await getTiendaCatalogo();
  if (origin !== "live") {
    console.warn(`[Landing] productos servidos desde ${origin} (la base no respondió).`);
  }
  return seleccionarProductosLanding(data as FilaCatalogoLanding[], category);
}
