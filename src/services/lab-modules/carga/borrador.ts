import { prisma } from '../../../lib/db';
import { logAudit } from '../../../lib/audit';
import type { Actor } from '../../../lib/actor';

/**
 * EL BORRADOR DE CARGA: la máquina de estados de "el robot llena, una persona
 * aprueba, el robot confirma". Regla de Ishtar (30/9/2026): el OK final lo da
 * SIEMPRE una persona, y su trabajo es solo supervisar que esté bien.
 *
 *   PREPARADO ──(robot creó el borrador en el portal y sacó captura)──▶ EN_REVISION
 *   EN_REVISION ──(persona aprueba)──▶ APROBADO ──(robot confirmó)──▶ CARGADO
 *   EN_REVISION ──(persona rechaza)──▶ RECHAZADO
 *   APROBADO ──(el portal muestra otra cosa que lo aprobado)──▶ EN_REVISION
 *   PREPARADO / EN_REVISION ──(falla del robot)──▶ ERROR
 *
 * APROBADO NO va a ERROR: una falla después de "Confirmar" (portal lento, base
 * caída) dejaría un pedido confirmado en el laboratorio y un borrador
 * "terminal" que invita a preparar otro — dos pedidos (auditoría del
 * 3/10/2026, C1). Queda APROBADO con el motivo y se reintenta; `confirmar`
 * sabe leer el nº si el portal ya lo asignó.
 *
 * Lo que la persona aprueba es EXACTAMENTE `payload` + la captura del resumen
 * del portal. Si al confirmar el portal muestra otra cosa, el robot vuelve el
 * borrador a revisión. Todo cambio de estado es atómico (condicionado al
 * estado leído) y queda en el AuditLog.
 *
 * `resumenPortal` guarda el id del borrador en el portal (`portalDraftId`)
 * apenas "Crear" lo crea, y `canceladoEl` cuando el robot lo canceló: mientras
 * haya un borrador en el portal sin resolver, no se prepara otro para la
 * misma venta y par.
 */
export type EstadoBorrador = 'PREPARADO' | 'EN_REVISION' | 'APROBADO' | 'CARGADO' | 'RECHAZADO' | 'ERROR';

const TRANSICIONES: Record<EstadoBorrador, EstadoBorrador[]> = {
    PREPARADO: ['EN_REVISION', 'ERROR'],
    EN_REVISION: ['APROBADO', 'RECHAZADO', 'ERROR'],
    APROBADO: ['CARGADO', 'EN_REVISION'],
    CARGADO: [],
    RECHAZADO: [],
    ERROR: [],
};

export const ESTADOS_VIVOS: EstadoBorrador[] = ['PREPARADO', 'EN_REVISION', 'APROBADO'];

/** ¿Se puede pasar de `de` a `a`? Puro: `npm run check:lab-modulos`. */
export function transicionValida(de: EstadoBorrador, a: EstadoBorrador): boolean {
    return TRANSICIONES[de]?.includes(a) ?? false;
}

/** Un borrador vivo bloquea otro para la misma venta y par. Puro. */
export function borradorVivo(estado: EstadoBorrador): boolean {
    return ESTADOS_VIVOS.includes(estado);
}

/** Solo una persona con nombre aprueba; el robot y 'Sistema' no. Puro. */
export function puedeAprobar(actor: Actor | null | undefined): boolean {
    return !!actor?.id && !!actor.name && actor.name !== 'Sistema' && !/^Robot\b/i.test(actor.name);
}

export interface RastroPortal {
    portalDraftId?: string;
    url?: string;
    canceladoEl?: string;
    [k: string]: unknown;
}

/**
 * ¿Este borrador dejó un pedido en el portal que nadie resolvió? Resuelto es
 * CARGADO (confirmado) o cancelado por el robot. Puro.
 */
export function portalSinResolver(b: { status: string; resumenPortal: unknown }): boolean {
    const r = b.resumenPortal as RastroPortal | null;
    if (!r || typeof r.portalDraftId !== 'string' || !r.portalDraftId) return false;
    if (b.status === 'CARGADO') return false;
    return !r.canceladoEl;
}

/**
 * Qué borradores vivos quedaron colgados (el robot corre dentro del request:
 * un redeploy o un OOM lo cortan sin pasar por ERROR). Puro.
 *  · PREPARADO viejo: el robot no terminó de llenar → ERROR.
 *  · APROBADO viejo: la confirmación no terminó → se anota para reintentar,
 *    nunca ERROR (el portal puede haberla tomado).
 */
export const COLGADO_TRAS_MIN = 20;

export function colgados(
    vivos: { id: string; status: string; updatedAt: Date }[],
    ahora: Date,
    minutos = COLGADO_TRAS_MIN,
): { aError: string[]; aReintentar: string[] } {
    const viejo = (b: { updatedAt: Date }) => ahora.getTime() - b.updatedAt.getTime() >= minutos * 60_000;
    return {
        aError: vivos.filter(b => b.status === 'PREPARADO' && viejo(b)).map(b => b.id),
        aReintentar: vivos.filter(b => b.status === 'APROBADO' && viejo(b)).map(b => b.id),
    };
}

async function cambiarEstado(id: string, a: EstadoBorrador, datos: Record<string, unknown>, actor: Actor, detalle?: Record<string, unknown>) {
    const actual = await prisma.labOrderDraft.findUnique({ where: { id }, select: { status: true, orderId: true, lab: true, pair: true } });
    if (!actual) throw new Error('El borrador no existe.');
    if (!transicionValida(actual.status as EstadoBorrador, a)) {
        throw new Error(`El borrador está ${actual.status}: no puede pasar a ${a}.`);
    }
    // Atómico: si otro request lo movió entre la lectura y acá, no se pisa.
    const r = await prisma.labOrderDraft.updateMany({ where: { id, status: actual.status }, data: { status: a, ...datos } });
    if (r.count !== 1) throw new Error(`El borrador cambió de estado mientras tanto (ya no está ${actual.status}): volvé a cargar la ficha.`);
    const borrador = await prisma.labOrderDraft.findUniqueOrThrow({ where: { id } });
    await logAudit({
        userId: actor.id, userName: actor.name, action: 'STATUS_CHANGE', entityType: 'LAB_ORDER_DRAFT', entityId: id,
        details: { lab: actual.lab, orderId: actual.orderId, pair: actual.pair, de: actual.status, a, ...detalle },
    });
    return borrador;
}

async function mezclarRastro(id: string, datos: RastroPortal) {
    const b = await prisma.labOrderDraft.findUnique({ where: { id }, select: { resumenPortal: true } });
    if (!b) throw new Error('El borrador no existe.');
    const previo = (b.resumenPortal && typeof b.resumenPortal === 'object' ? b.resumenPortal : {}) as RastroPortal;
    return prisma.labOrderDraft.update({ where: { id }, data: { resumenPortal: { ...previo, ...datos } as any } });
}

export const Borradores = {
    /**
     * Crea el borrador con lo que se va a cargar. Falla si ya hay uno vivo para
     * la venta y el par (lo garantiza el índice único parcial de la base) o si
     * un borrador anterior dejó un pedido en el portal sin confirmar ni cancelar.
     */
    async preparar(input: { lab: string; orderId: string; pair: number; payload: unknown; actor: Actor }) {
        const previos = await prisma.labOrderDraft.findMany({
            where: { orderId: input.orderId, pair: input.pair },
            select: { id: true, status: true, resumenPortal: true },
            orderBy: { createdAt: 'desc' },
        });
        const vivo = previos.find(p => borradorVivo(p.status as EstadoBorrador));
        if (vivo) throw new Error(`Ya hay un borrador ${vivo.status} para esta venta (par ${input.pair}).`);
        const colgadoEnPortal = previos.find(portalSinResolver);
        if (colgadoEnPortal) {
            const r = colgadoEnPortal.resumenPortal as RastroPortal;
            throw new Error(`Un borrador anterior (${colgadoEnPortal.status}) dejó el pedido ${r.portalDraftId} en el portal sin confirmar ni cancelar: cancelalo desde la ficha (o confirmalo) antes de preparar otro.`);
        }
        let borrador;
        try {
            borrador = await prisma.labOrderDraft.create({
                data: { lab: input.lab, orderId: input.orderId, pair: input.pair, payload: input.payload as any, preparedBy: input.actor.name },
            });
        } catch (err: any) {
            if (err?.code === 'P2002') throw new Error(`Ya hay un borrador vivo para esta venta (par ${input.pair}).`);
            throw err;
        }
        await logAudit({
            userId: input.actor.id, userName: input.actor.name, action: 'CREATE', entityType: 'LAB_ORDER_DRAFT', entityId: borrador.id,
            details: { lab: input.lab, orderId: input.orderId, pair: input.pair },
        });
        return borrador;
    },

    /** "Crear" ya creó el borrador en el portal: el id se guarda en el acto, antes que nada más. */
    anotarPortal(id: string, datos: { portalDraftId: string; url: string }) {
        return mezclarRastro(id, { ...datos, creadoEnPortalEl: new Date().toISOString() });
    },

    /** El robot sacó la captura del resumen del portal: queda para revisar. */
    enRevision(id: string, robot: Actor, datos: { screenshotUrl: string; resumenPortal: RastroPortal }) {
        return cambiarEstado(id, 'EN_REVISION', { screenshotUrl: datos.screenshotUrl, resumenPortal: datos.resumenPortal as any, error: null }, robot);
    },

    /** Una persona miró la captura y aprobó. */
    async aprobar(id: string, actor: Actor) {
        if (!puedeAprobar(actor)) throw new Error('La aprobación tiene que hacerla una persona identificada.');
        return cambiarEstado(id, 'APROBADO', { approvedBy: actor.name, approvedAt: new Date(), error: null }, actor);
    },

    async rechazar(id: string, actor: Actor, motivo: string) {
        if (!puedeAprobar(actor)) throw new Error('El rechazo tiene que hacerlo una persona identificada.');
        if (!motivo?.trim()) throw new Error('Decí por qué se rechaza: es lo que el vendedor va a leer.');
        return cambiarEstado(id, 'RECHAZADO', { error: motivo.trim() }, actor, { motivo: motivo.trim() });
    },

    /** El robot confirmó en el portal y obtuvo el nº de pedido. */
    cargado(id: string, robot: Actor, datos: { portalNumber: string; screenshotFinalUrl?: string | null }) {
        return cambiarEstado(id, 'CARGADO', { portalNumber: datos.portalNumber, screenshotFinalUrl: datos.screenshotFinalUrl ?? null, loadedAt: new Date(), error: null }, robot, { portalNumber: datos.portalNumber });
    },

    /** Al confirmar, el portal mostraba otra cosa que lo aprobado: vuelve a revisión con la captura nueva. */
    volverARevision(id: string, robot: Actor, datos: { screenshotUrl: string; resumenPortal: RastroPortal; motivo: string }) {
        return cambiarEstado(id, 'EN_REVISION', { screenshotUrl: datos.screenshotUrl, resumenPortal: datos.resumenPortal as any, approvedBy: null, approvedAt: null, error: datos.motivo }, robot, { motivo: datos.motivo });
    },

    /** Falló el robot antes de que el portal tuviera nada confirmado (PREPARADO / EN_REVISION): queda el motivo. */
    error(id: string, robot: Actor, motivo: string) {
        return cambiarEstado(id, 'ERROR', { error: motivo }, robot, { motivo });
    },

    /** Falló algo sin cambiar de estado (la confirmación, el cancelado): se anota para reintentar. */
    anotarFalla(id: string, motivo: string) {
        return prisma.labOrderDraft.update({ where: { id }, data: { error: motivo } });
    },

    /** El robot canceló el borrador en el portal: ya no bloquea preparar otro. */
    canceladoEnPortal(id: string) {
        return mezclarRastro(id, { canceladoEl: new Date().toISOString() });
    },

    deVenta(orderId: string) {
        return prisma.labOrderDraft.findMany({ where: { orderId }, orderBy: [{ pair: 'asc' }, { createdAt: 'desc' }] });
    },

    /** Barrido del tick: lo que quedó colgado (ver `colgados`). */
    async vencerColgados(robot: Actor, ahora = new Date()) {
        const vivos = await prisma.labOrderDraft.findMany({
            where: { status: { in: ['PREPARADO', 'APROBADO'] } },
            select: { id: true, status: true, updatedAt: true, error: true },
        });
        const { aError, aReintentar } = colgados(vivos, ahora);
        for (const id of aError) {
            await cambiarEstado(id, 'ERROR', { error: `El robot no terminó de cargar en ${COLGADO_TRAS_MIN} min (¿se reinició el servidor?). Si dejó el pedido en el portal, cancelalo desde la ficha.` }, robot, { motivo: 'colgado' })
                .catch(err => console.error('[lab-modulos] no se pudo vencer el borrador colgado', id, err));
        }
        for (const id of aReintentar) {
            const b = vivos.find(v => v.id === id)!;
            if (b.error) continue; // ya anotado
            await prisma.labOrderDraft.update({ where: { id }, data: { error: `La confirmación en el portal no terminó en ${COLGADO_TRAS_MIN} min: reintentar desde la ficha (si el portal ya la tomó, el robot lee el nº).` } })
                .catch(err => console.error('[lab-modulos] no se pudo anotar el borrador colgado', id, err));
        }
        return { aError, aReintentar };
    },
};
