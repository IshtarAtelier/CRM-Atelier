import { pedidoExistenteDelPar as existenteDe, type PedidoExistente } from '../carga/existentes';
import { numeroDelParConCargo as origenDe } from '../carga/origen';
import { esNumeroDeLab, soloDigitos } from '../../../lib/laboratorios/identidad';
import { LAB_OPTOVISION } from './portal';

/**
 * El candado "este par ya tiene pedido" y el nº del 1er par de la promo, para
 * Optovisión (las reglas comunes viven en carga/existentes.ts y carga/origen.ts).
 * Un nº web de OVES son 6 dígitos (lib/laboratorios/identidad.ts); en la venta
 * el equipo los escribe con separadores sueltos ("626134 -  626139"), que
 * `parseLabNumbers` ya separa.
 */
export { mensajeExistente, type PedidoExistente } from '../carga/existentes';

export const esNumeroOves = (n: string) => esNumeroDeLab(n, 'OPTOVISION');

export function pedidoExistenteDelPar(orderId: string, pair: number, pares: number, excluir?: string | null): Promise<PedidoExistente | null> {
    return existenteDe(LAB_OPTOVISION, orderId, pair, pares, { excluir, normalizar: soloDigitos, esNumeroDelLab: esNumeroOves });
}

/** El nº del 1er par de la promo (va en la observación del 2º): nunca un anulado ni un reproceso. */
export function numeroDelPrimerPar(orderId: string, parConCargo: number): Promise<string | null> {
    return origenDe(LAB_OPTOVISION, orderId, parConCargo, { esNumeroDelLab: esNumeroOves, normalizar: soloDigitos });
}
