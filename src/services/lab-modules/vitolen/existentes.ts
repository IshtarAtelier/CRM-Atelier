import { pedidoExistenteDelPar as existenteDe, type PedidoExistente } from '../carga/existentes';
import { esNumeroDeLab, soloDigitos } from '../../../lib/laboratorios/identidad';
import { LAB_VITOLEN } from './portal';

/**
 * El candado "este par ya tiene pedido" para Vitolen (la regla común vive en
 * carga/existentes.ts). El portal muestra el nº como "6981382L" y la venta lo
 * guarda sin la letra: se comparan solo los dígitos. Un nº de otro laboratorio
 * tipeado en una venta mixta no es de acá (lib/laboratorios/identidad.ts).
 */
export { mensajeExistente, type PedidoExistente } from '../carga/existentes';
export { soloDigitos };

export const esNumeroVitolen = (n: string) => esNumeroDeLab(n, 'VITOLEN');

export function pedidoExistenteDelPar(orderId: string, pair: number, pares: number, excluir?: string | null): Promise<PedidoExistente | null> {
    return existenteDe(LAB_VITOLEN, orderId, pair, pares, { excluir, normalizar: soloDigitos, esNumeroDelLab: esNumeroVitolen });
}
