import { pedidoExistenteDelPar as existenteDe, type PedidoExistente } from '../carga/existentes';
import { LAB_GRUPO_OPTICO } from './portal';

/**
 * El candado "este par ya tiene pedido" para Grupo Óptico (la regla común vive
 * en carga/existentes.ts). Solo los nº con la forma de SmartLab (80xxxxxx)
 * cuentan como tipeados en la venta: un nº de otro laboratorio no es de acá.
 */
export { decidirExistente, mensajeExistente, type PedidoExistente } from '../carga/existentes';

export const esNumeroSmartLab = (n: string) => /^80\d{6}$/.test(n);

export function pedidoExistenteDelPar(orderId: string, pair: number, pares: number, excluir?: string | null): Promise<PedidoExistente | null> {
    return existenteDe(LAB_GRUPO_OPTICO, orderId, pair, pares, { excluir, esNumeroDelLab: esNumeroSmartLab });
}
