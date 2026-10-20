import { mensajeExistente, type PedidoExistente } from './existentes';

/**
 * QUÉ HACE EL ROBOT CON UN APROBADO, decidido en seco (10/10/2026). Nació en
 * Grupo Óptico; desde el 19/10/2026 la usa también Optovisión (los dos
 * portales crean el pedido al grabar, sin borrador propio).
 *
 * Es la única decisión de todo el módulo que puede fabricar un pedido
 * duplicado que la óptica no puede anular, y vivía adentro de un closure con
 * la página del portal y la base: cero tests. Acá está sola, pura, y
 * `npm run check:carga-go` la fija caso por caso. El robot
 * (`borrador-portal.ts: confirmarBorradorAprobado`) solo junta los datos y
 * ejecuta lo que esta función dice.
 *
 * El orden es el de la auditoría del 3/10/2026: primero lo que YA existe
 * (creado por este borrador, vinculado al par por otro camino, o en el portal
 * con el código de la venta), después la espera por un envío sin respuesta,
 * y recién al final crear. Buscar en el portal cuesta un login: por eso la
 * decisión se pide dos veces —sin `numeroEnPortal` dice BUSCAR_EN_PORTAL, y
 * con el resultado (aunque sea null) decide de verdad.
 */
export type DecisionConAprobado =
    /** Este borrador ya creó el pedido (la respuesta se perdió después): solo falta anotarlo. */
    | { accion: 'ANOTAR'; numero: string }
    /** Hay un nº de otro camino: se verifica en el portal que sea de esta venta antes de adoptarlo. */
    | { accion: 'VERIFICAR'; numero: string; adoptadoDe: 'venta' | 'portal' }
    /** La aprobación ya no vale (el par tiene otro pedido): se invalida sin mandar nada. */
    | { accion: 'INVALIDAR'; motivo: string }
    /** Falta mirar el listado del portal con el código de la venta. */
    | { accion: 'BUSCAR_EN_PORTAL' }
    /** Un envío anterior salió hace poco y no se sabe si el portal lo guardó: no se reenvía todavía. */
    | { accion: 'ESPERAR'; motivo: string }
    /** No hay nada: se compara la venta de hoy con lo aprobado y se crea. */
    | { accion: 'CREAR' };

export interface DatosParaDecidir {
    pair: number;
    /** El nº que el portal devolvió a ESTE borrador (rastro), si lo hay. */
    numeroCreado: string | null;
    /** El pedido que el par ya tiene por otro camino (carga a mano, seguimiento), si lo hay. */
    existente: PedidoExistente | null;
    /** Cuándo salió el último POST de creación sin respuesta conocida (rastro). */
    envioIniciadoEl: string | null;
    /** El pedido del listado del portal con el código de la venta: undefined = todavía no se buscó. */
    numeroEnPortal?: string | null;
    /** Cuánto se espera tras un envío sin respuesta antes de volver a crear. */
    esperaMs: number;
    ahora?: number;
}

export function decidirConAprobado(d: DatosParaDecidir): DecisionConAprobado {
    if (d.numeroCreado) return { accion: 'ANOTAR', numero: d.numeroCreado };
    const envioAnterior = !!d.envioIniciadoEl;
    if (d.existente && !envioAnterior) {
        // El par recibió un pedido por otro camino y este borrador no mandó nada:
        // la aprobación no vale, y "no se creó nada" es cierto.
        return { accion: 'INVALIDAR', motivo: `${mensajeExistente(d.existente, d.pair)} No se creó nada.` };
    }
    if (d.existente && !d.existente.ambiguo) {
        // Un envío de ESTE borrador cuya respuesta se perdió, que el seguimiento
        // vinculó al par antes del reintento: es el nuestro, se adopta (auditoría 4, M4).
        return { accion: 'VERIFICAR', numero: d.existente.numero, adoptadoDe: 'venta' };
    }
    // De acá en más puede haber un envío sin respuesta: nunca se afirma "no se
    // creó nada" sin mirar el portal (auditoría de robustez 4, M2).
    if (d.numeroEnPortal === undefined) return { accion: 'BUSCAR_EN_PORTAL' };
    if (d.numeroEnPortal) return { accion: 'VERIFICAR', numero: d.numeroEnPortal, adoptadoDe: 'portal' };
    if (d.existente) {
        // Ambiguo (un nº de la venta que no se sabe de qué par es) y un envío
        // nuestro sin respuesta: ni se adopta ni se invalida; el seguimiento lo
        // resuelve por el código "#XXXX N°par" y el reintento lo encuentra.
        return { accion: 'ESPERAR', motivo: `${mensajeExistente(d.existente, d.pair)} Además hay un envío de este borrador sin respuesta: no se crea otro. Aclará en la venta de qué par es ese nº y reintentá` };
    }
    const ahora = d.ahora ?? Date.now();
    if (d.envioIniciadoEl && ahora - Date.parse(d.envioIniciadoEl) < d.esperaMs) {
        const hora = new Date(d.envioIniciadoEl).toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
        return { accion: 'ESPERAR', motivo: `un envío anterior (${hora}) quedó sin respuesta; el robot no reenvía hasta comprobar que el portal no lo guardó. Reintentá en ${Math.round(d.esperaMs / 60_000)} minutos` };
    }
    return { accion: 'CREAR' };
}
