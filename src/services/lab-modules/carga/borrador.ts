import { prisma } from '../../../lib/db';
import { logAudit } from '../../../lib/audit';
import type { Actor } from '../../../lib/actor';

/**
 * EL BORRADOR DE CARGA: la máquina de estados de "el robot llena, una persona
 * aprueba, el robot confirma". Regla de Ishtar (30/9/2026): el OK final lo da
 * SIEMPRE una persona, y su trabajo es solo supervisar que esté bien.
 *
 *   PREPARADO ──(robot llenó y sacó captura)──▶ EN_REVISION
 *   EN_REVISION ──(persona aprueba)──▶ APROBADO ──(robot confirmó)──▶ CARGADO
 *   EN_REVISION ──(persona rechaza)──▶ RECHAZADO
 *   cualquiera ──(falla del robot)──▶ ERROR (se puede volver a preparar)
 *
 * Lo que la persona aprueba es EXACTAMENTE `payload` + la captura del resumen
 * del portal. Si al confirmar el portal muestra otra cosa, el robot aborta.
 */
export type EstadoBorrador = 'PREPARADO' | 'EN_REVISION' | 'APROBADO' | 'CARGADO' | 'RECHAZADO' | 'ERROR';

const TRANSICIONES: Record<EstadoBorrador, EstadoBorrador[]> = {
    PREPARADO: ['EN_REVISION', 'ERROR'],
    EN_REVISION: ['APROBADO', 'RECHAZADO', 'ERROR'],
    APROBADO: ['CARGADO', 'ERROR'],
    CARGADO: [],
    RECHAZADO: [],
    ERROR: [],
};

/** ¿Se puede pasar de `de` a `a`? Puro: `npm run check:lab-modulos`. */
export function transicionValida(de: EstadoBorrador, a: EstadoBorrador): boolean {
    return TRANSICIONES[de]?.includes(a) ?? false;
}

/** Un borrador vivo bloquea otro para la misma venta y par. Puro. */
export function borradorVivo(estado: EstadoBorrador): boolean {
    return estado === 'PREPARADO' || estado === 'EN_REVISION' || estado === 'APROBADO';
}

/** Solo una persona con nombre aprueba; el robot y 'Sistema' no. Puro. */
export function puedeAprobar(actor: Actor | null | undefined): boolean {
    return !!actor?.id && !!actor.name && actor.name !== 'Sistema' && !/^Robot\b/i.test(actor.name);
}

async function cambiarEstado(id: string, a: EstadoBorrador, datos: Record<string, unknown>, actor: Actor, detalle?: Record<string, unknown>) {
    const actual = await prisma.labOrderDraft.findUnique({ where: { id }, select: { status: true, orderId: true, lab: true, pair: true } });
    if (!actual) throw new Error('El borrador no existe.');
    if (!transicionValida(actual.status as EstadoBorrador, a)) {
        throw new Error(`El borrador está ${actual.status}: no puede pasar a ${a}.`);
    }
    const borrador = await prisma.labOrderDraft.update({ where: { id }, data: { status: a, ...datos } });
    await logAudit({
        userId: actor.id, userName: actor.name, action: 'STATUS_CHANGE', entityType: 'LAB_ORDER_DRAFT', entityId: id,
        details: { lab: actual.lab, orderId: actual.orderId, pair: actual.pair, de: actual.status, a, ...detalle },
    });
    return borrador;
}

export const Borradores = {
    /** Crea el borrador con lo que se va a cargar. Falla si ya hay uno vivo para la venta y el par. */
    async preparar(input: { lab: string; orderId: string; pair: number; payload: unknown; actor: Actor }) {
        const vivo = await prisma.labOrderDraft.findFirst({
            where: { orderId: input.orderId, pair: input.pair, status: { in: ['PREPARADO', 'EN_REVISION', 'APROBADO'] } },
            select: { id: true, status: true },
        });
        if (vivo) throw new Error(`Ya hay un borrador ${vivo.status} para esta venta (par ${input.pair}).`);
        const borrador = await prisma.labOrderDraft.create({
            data: { lab: input.lab, orderId: input.orderId, pair: input.pair, payload: input.payload as any, preparedBy: input.actor.name },
        });
        await logAudit({
            userId: input.actor.id, userName: input.actor.name, action: 'CREATE', entityType: 'LAB_ORDER_DRAFT', entityId: borrador.id,
            details: { lab: input.lab, orderId: input.orderId, pair: input.pair },
        });
        return borrador;
    },

    /** El robot llenó el formulario y sacó la captura del resumen: queda para revisar. */
    enRevision(id: string, robot: Actor, datos: { screenshotUrl: string; resumenPortal: unknown }) {
        return cambiarEstado(id, 'EN_REVISION', { screenshotUrl: datos.screenshotUrl, resumenPortal: datos.resumenPortal as any }, robot);
    },

    /** Una persona miró la captura y aprobó. */
    async aprobar(id: string, actor: Actor) {
        if (!puedeAprobar(actor)) throw new Error('La aprobación tiene que hacerla una persona identificada.');
        return cambiarEstado(id, 'APROBADO', { approvedBy: actor.name, approvedAt: new Date() }, actor);
    },

    async rechazar(id: string, actor: Actor, motivo: string) {
        if (!puedeAprobar(actor)) throw new Error('El rechazo tiene que hacerlo una persona identificada.');
        if (!motivo?.trim()) throw new Error('Decí por qué se rechaza: es lo que el vendedor va a leer.');
        return cambiarEstado(id, 'RECHAZADO', { error: motivo.trim() }, actor, { motivo: motivo.trim() });
    },

    /** El robot confirmó en el portal y obtuvo el nº de pedido. */
    cargado(id: string, robot: Actor, datos: { portalNumber: string; screenshotFinalUrl?: string | null }) {
        return cambiarEstado(id, 'CARGADO', { portalNumber: datos.portalNumber, screenshotFinalUrl: datos.screenshotFinalUrl ?? null, loadedAt: new Date() }, robot, { portalNumber: datos.portalNumber });
    },

    /** Falló el robot en cualquier paso: queda el motivo y se puede volver a preparar. */
    error(id: string, robot: Actor, motivo: string) {
        return cambiarEstado(id, 'ERROR', { error: motivo }, robot, { motivo });
    },

    deVenta(orderId: string) {
        return prisma.labOrderDraft.findMany({ where: { orderId }, orderBy: [{ pair: 'asc' }, { createdAt: 'desc' }] });
    },
};
