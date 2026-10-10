import { mensajeExistente, type PedidoExistente } from '../carga/existentes';

/**
 * QUÉ HACE EL ROBOT CON UN APROBADO, decidido en seco (10/10/2026).
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
    if (d.existente) {
        // Un envío de ESTE borrador cuya respuesta se perdió, que el seguimiento
        // vinculó al par antes del reintento: es el nuestro, se adopta (auditoría 4, M4).
        if (!d.existente.ambiguo && envioAnterior) return { accion: 'VERIFICAR', numero: d.existente.numero, adoptadoDe: 'venta' };
        return { accion: 'INVALIDAR', motivo: `${mensajeExistente(d.existente, d.pair)} No se creó nada.` };
    }
    if (d.numeroEnPortal === undefined) return { accion: 'BUSCAR_EN_PORTAL' };
    if (d.numeroEnPortal) return { accion: 'VERIFICAR', numero: d.numeroEnPortal, adoptadoDe: 'portal' };
    const ahora = d.ahora ?? Date.now();
    if (d.envioIniciadoEl && ahora - Date.parse(d.envioIniciadoEl) < d.esperaMs) {
        const hora = new Date(d.envioIniciadoEl).toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
        return { accion: 'ESPERAR', motivo: `un envío anterior (${hora}) quedó sin respuesta; el robot no reenvía hasta comprobar que el portal no lo guardó. Reintentá en ${Math.round(d.esperaMs / 60_000)} minutos` };
    }
    return { accion: 'CREAR' };
}
