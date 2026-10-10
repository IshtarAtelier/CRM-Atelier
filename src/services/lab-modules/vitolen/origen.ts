import { numeroDelParConCargo as origenDe } from '../carga/origen';
import { LAB_VITOLEN } from './portal';
import { esNumeroVitolen, soloDigitos } from './existentes';

/**
 * El nº del 1er par de la promo de Vitolen ("pedido origen" del 2º), con la
 * regla común (carga/origen.ts): nunca un pedido anulado ni un reproceso.
 * El portal lo quiere con la L ("6981382L"); el CRM lo guarda en dígitos.
 */
export async function pedidoOrigenDeVitolen(orderId: string, parConCargo: number): Promise<string | null> {
    const n = await origenDe(LAB_VITOLEN, orderId, parConCargo, { esNumeroDelLab: esNumeroVitolen, normalizar: soloDigitos });
    return n ? `${n}L` : null;
}
