import { pedidoExistenteDelPar as existenteDe, type PedidoExistente } from '../carga/existentes';
import { LAB_VITOLEN } from './portal';

/**
 * El candado "este par ya tiene pedido" para Vitolen (la regla común vive en
 * carga/existentes.ts). El portal muestra el nº como "6981382L" y la venta lo
 * guarda sin la letra: se comparan solo los dígitos.
 */
export { mensajeExistente, type PedidoExistente } from '../carga/existentes';

export const soloDigitos = (n: string) => n.replace(/\D/g, '');

export function pedidoExistenteDelPar(orderId: string, pair: number, pares: number, excluir?: string | null): Promise<PedidoExistente | null> {
    return existenteDe(LAB_VITOLEN, orderId, pair, pares, { excluir, normalizar: soloDigitos });
}
