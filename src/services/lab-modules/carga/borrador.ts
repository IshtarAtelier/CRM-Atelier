import { prisma } from '../../../lib/db';
import { logAudit } from '../../../lib/audit';
import { ErrorDeCarga } from './errores';
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
// APROBADO → ERROR no está en la tabla a propósito: solo lo hacen `invalidarSinPedido`
// (el robot comprobó que no hay pedido) y `anular` (una persona, sin envío iniciado).

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
    /** Alguien lo confirmó a mano en el portal: el nº de trabajo que el robot encontró al ir a cancelar. */
    confirmadoAManoEl?: string;
    confirmadoAManoNumero?: string;
    /** Id de quien aprobó (el nombre va en `approvedBy`): para firmar la venta sin buscar por nombre. */
    aprobadoPorId?: string | null;
    /** Id de quien preparó (el nombre va en `preparedBy`): quien decidió lo que se carga (p. ej. un extra no cobrado). */
    preparadoPorId?: string | null;
    /** El resumen del portal ya recortado a lo que se compara al confirmar (resumenComparable). */
    textoComparable?: string;
    /** Grupo Óptico: el nº que el portal devolvió al crear (la barrera contra el pedido duplicado). */
    numeroCreado?: string;
    /** Grupo Óptico: cuándo salió el POST de creación (antes de saber la respuesta); null si el portal contestó. */
    envioIniciadoEl?: string | null;
    /** En qué anda el robot (mueve `updatedAt`); null cuando terminó. */
    etapa?: string | null;
    /** Desde cuándo hay un robot trabajando sobre este borrador; null cuando terminó. Frena un segundo robot y el "anular" a destiempo. */
    robotDesde?: string | null;
    /** El borrador del portal desapareció (lo cancelaron a mano). */
    desaparecioDelPortal?: boolean;
    /** Vitolen: el resumen cambió / se releyó después de aprobar. */
    cambiadoEl?: string;
    releidoEl?: string;
    /** Grupo Óptico: el nº se adoptó de un pedido ya existente en el portal. */
    adoptadoDelPortal?: boolean;
    /** Vitolen: cuándo "Crear" dejó el borrador en el portal. */
    creadoEnPortalEl?: string;
}


/**
 * ¿Este borrador dejó un pedido en el portal que nadie resolvió? Resuelto es
 * CARGADO (confirmado por el robot), cancelado por el robot, o confirmado a
 * mano en el portal (el robot lo vio con nº al ir a cancelar). Puro.
 */
export function portalSinResolver(b: { status: string; resumenPortal: unknown }): boolean {
    const r = b.resumenPortal as RastroPortal | null;
    if (!r || typeof r.portalDraftId !== 'string' || !r.portalDraftId) return false;
    if (b.status === 'CARGADO') return false;
    return !r.canceladoEl && !r.confirmadoAManoEl;
}

/**
 * Qué borradores vivos quedaron colgados (el robot corre fuera del request
 * pero en el mismo proceso: un redeploy o un OOM lo cortan sin pasar por ERROR). Puro.
 *  · PREPARADO viejo: el robot no terminó de llenar → ERROR.
 *  · APROBADO viejo: la confirmación no terminó → se anota para reintentar,
 *    nunca ERROR (el portal puede haberla tomado).
 */
// Por encima del peor caso legítimo del robot: 3 intentos de login de hasta 5 min
// + 4 min de espera de turno + esperas del portal (~22 min). GO además mueve
// `updatedAt` al entrar al portal (`etapa`), así que trabajando no se vence.
export const COLGADO_TRAS_MIN = 30;

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
    if (!actual) throw new ErrorDeCarga('El borrador no existe.', 'NO_EXISTE');
    if (!transicionValida(actual.status as EstadoBorrador, a)) {
        throw new ErrorDeCarga(`El borrador está ${actual.status}: no puede pasar a ${a}.`, 'ESTADO');
    }
    // Atómico: si otro request lo movió entre la lectura y acá, no se pisa.
    const r = await prisma.labOrderDraft.updateMany({ where: { id, status: actual.status }, data: { status: a, ...datos } });
    if (r.count !== 1) throw new ErrorDeCarga(`El borrador cambió de estado mientras tanto (ya no está ${actual.status}): volvé a cargar la ficha.`, 'ESTADO');
    const borrador = await prisma.labOrderDraft.findUniqueOrThrow({ where: { id } });
    await logAudit({
        userId: actor.id, userName: actor.name, action: 'STATUS_CHANGE', entityType: 'LAB_ORDER_DRAFT', entityId: id,
        details: { lab: actual.lab, orderId: actual.orderId, pair: actual.pair, de: actual.status, a, ...detalle },
    });
    return borrador;
}

/**
 * Mezcla datos en el rastro del borrador EN LA BASE (jsonb ||): nada de
 * leer-modificar-escribir. El robot anota varias veces por confirmación
 * (envío iniciado, nº creado, PDF…) y `numeroCreado` es la barrera contra el
 * pedido duplicado: dos escrituras cruzadas no pueden pisarse. Una clave con
 * valor `null` se guarda como null (así se borra `envioIniciadoEl`).
 */
// Genérico: cada lab guarda además lo suyo (Vitolen: el texto del resumen, los pasos…).
async function mezclarRastro<T extends RastroPortal>(id: string, datos: T) {
    const n = await prisma.$executeRaw`UPDATE "LabOrderDraft" SET "resumenPortal" = COALESCE("resumenPortal", '{}'::jsonb) || ${JSON.stringify(datos)}::jsonb, "updatedAt" = NOW() WHERE id = ${id}`;
    if (n !== 1) throw new ErrorDeCarga('El borrador no existe.', 'NO_EXISTE');
    return prisma.labOrderDraft.findUniqueOrThrow({ where: { id } });
}

/** Qué puede hacer una persona con un borrador, calculado UNA vez acá (la ficha no deduce nada de la prosa). Puro. */
export function accionesDe(
    b: { status: string; error: string | null; approvedAt: Date | string | null; updatedAt?: Date | string | null; resumenPortal: unknown },
    lab: { conBorradorEnPortal: boolean; puedeReleer: boolean },
    ahora = new Date(),
    contexto: { bloqueadoPorExistente?: boolean } = {},
): { aprobar: boolean; rechazar: boolean; reintentar: boolean; anular: boolean; releer: boolean; cancelarPortal: boolean; robotEnCurso: boolean } {
    const r = (b.resumenPortal && typeof b.resumenPortal === 'object' ? b.resumenPortal : {}) as RastroPortal;
    const enRevision = b.status === 'EN_REVISION';
    const aprobado = b.status === 'APROBADO';
    const preparado = b.status === 'PREPARADO';
    const hace = (d: Date | string | null | undefined) => (d ? ahora.getTime() - new Date(d).getTime() : 0);
    // Un robot con `robotDesde` reciente está trabajando: ni reintentar ni anular encima.
    const robotEnCurso = !!r.robotDesde && hace(r.robotDesde) < ROBOT_EN_CURSO_MAX_MS;
    // "Demorado" se mide desde la última novedad (updatedAt), no desde la aprobación:
    // después de un reintento, el reloj arranca de nuevo.
    const demorado = aprobado && !b.error && hace(b.updatedAt ?? b.approvedAt) > APROBADO_DEMORADO_MS;
    // Un PREPARADO que lleva demasiado sin novedades: el robot murió (redeploy) y nadie lo anotó.
    const preparadoColgado = preparado && hace(b.updatedAt) > PREPARADO_COLGADO_MS;
    const sinNadaEnElPortal = !r.numeroCreado && !r.envioIniciadoEl && !r.portalDraftId;
    return {
        aprobar: enRevision && !contexto.bloqueadoPorExistente,
        rechazar: enRevision,
        reintentar: aprobado && !robotEnCurso && (!!b.error || demorado),
        // Solo un borrador que NUNCA mandó nada, y sin robot encima.
        anular: !robotEnCurso && sinNadaEnElPortal && ((aprobado && !!b.error) || preparadoColgado),
        releer: enRevision && lab.puedeReleer && !!r.portalDraftId && !robotEnCurso,
        cancelarPortal: (b.status === 'RECHAZADO' || b.status === 'ERROR') && lab.conBorradorEnPortal && portalSinResolver(b) && !robotEnCurso,
        robotEnCurso: robotEnCurso || (preparado && !preparadoColgado) || (aprobado && !b.error && !demorado),
    };
}
/** Más de esto sin terminar, el robot se da por muerto: se permite otro reintento / anular. */
export const ROBOT_EN_CURSO_MAX_MS = 25 * 60_000;
/** Un PREPARADO sin novedades después de esto se puede anular desde la ficha (el tick lo vence a los 30). */
export const PREPARADO_COLGADO_MS = 10 * 60_000;
/** Un APROBADO sin novedades después de esto ya no está "cargando": se ofrece reintentar. */
export const APROBADO_DEMORADO_MS = 5 * 60_000;

export const Borradores = {
    /** Mezcla datos en el rastro (jsonb ||, atómico). Es la ÚNICA forma de anotar en `resumenPortal`. */
    anotarRastro: mezclarRastro,

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
        if (vivo) throw new ErrorDeCarga(`Ya hay un borrador ${vivo.status} para esta venta (par ${input.pair}).`, 'ESTADO');
        const colgadoEnPortal = previos.find(portalSinResolver);
        if (colgadoEnPortal) {
            const r = colgadoEnPortal.resumenPortal as RastroPortal;
            throw new ErrorDeCarga(`Un borrador anterior (${colgadoEnPortal.status}) dejó el pedido ${r.portalDraftId} en el portal sin confirmar ni cancelar: cancelalo desde la ficha (o confirmalo) antes de preparar otro.`, 'ESTADO');
        }
        let borrador;
        try {
            borrador = await prisma.labOrderDraft.create({
                data: { lab: input.lab, orderId: input.orderId, pair: input.pair, payload: input.payload as any, preparedBy: input.actor.name, resumenPortal: { preparadoPorId: input.actor.id ?? null } as any },
            });
        } catch (err: any) {
            if (err?.code === 'P2002') throw new ErrorDeCarga(`Ya hay un borrador vivo para esta venta (par ${input.pair}).`, 'ESTADO');
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
    enRevision<T extends RastroPortal>(id: string, robot: Actor, datos: { screenshotUrl: string; resumenPortal: T }) {
        return cambiarEstado(id, 'EN_REVISION', { screenshotUrl: datos.screenshotUrl, resumenPortal: datos.resumenPortal as any, error: null }, robot);
    },

    /** Una persona miró la captura y aprobó. */
    async aprobar(id: string, actor: Actor) {
        if (!puedeAprobar(actor)) throw new ErrorDeCarga('La aprobación tiene que hacerla una persona identificada.', 'PERMISO');
        // Nombre, fecha e id de quien aprobó en UN solo UPDATE, con el rastro mezclado
        // en la base (jsonb ||): sin leer-modificar-escribir, un "Releer el portal"
        // que termine en el medio no se pisa, y una falla no deja la venta sin id.
        const actual = await prisma.labOrderDraft.findUnique({ where: { id }, select: { status: true, orderId: true, lab: true, pair: true } });
        if (!actual) throw new ErrorDeCarga('El borrador no existe.', 'NO_EXISTE');
        if (!transicionValida(actual.status as EstadoBorrador, 'APROBADO')) throw new ErrorDeCarga(`El borrador está ${actual.status}: no puede pasar a APROBADO.`, 'ESTADO');
        const n = await prisma.$executeRaw`UPDATE "LabOrderDraft" SET status = 'APROBADO', "approvedBy" = ${actor.name}, "approvedAt" = NOW(), error = NULL,
            "resumenPortal" = COALESCE("resumenPortal", '{}'::jsonb) || ${JSON.stringify({ aprobadoPorId: actor.id })}::jsonb, "updatedAt" = NOW()
            WHERE id = ${id} AND status = ${actual.status}`;
        if (n !== 1) throw new ErrorDeCarga(`El borrador cambió de estado mientras tanto (ya no está ${actual.status}): volvé a cargar la ficha.`, 'ESTADO');
        await logAudit({
            userId: actor.id, userName: actor.name, action: 'STATUS_CHANGE', entityType: 'LAB_ORDER_DRAFT', entityId: id,
            details: { lab: actual.lab, orderId: actual.orderId, pair: actual.pair, de: actual.status, a: 'APROBADO' },
        });
        return prisma.labOrderDraft.findUniqueOrThrow({ where: { id } });
    },

    async rechazar(id: string, actor: Actor, motivo: string) {
        if (!puedeAprobar(actor)) throw new ErrorDeCarga('El rechazo tiene que hacerlo una persona identificada.', 'PERMISO');
        if (!motivo?.trim()) throw new ErrorDeCarga('Decí por qué se rechaza: es lo que el vendedor va a leer.', 'DATOS');
        const texto = motivo.trim().slice(0, 500);
        return cambiarEstado(id, 'RECHAZADO', { error: texto }, actor, { motivo: texto });
    },

    /** El robot confirmó en el portal y obtuvo el nº de pedido. */
    cargado(id: string, robot: Actor, datos: { portalNumber: string; screenshotFinalUrl?: string | null }) {
        return cambiarEstado(id, 'CARGADO', { portalNumber: datos.portalNumber, screenshotFinalUrl: datos.screenshotFinalUrl ?? null, loadedAt: new Date(), error: null }, robot, { portalNumber: datos.portalNumber });
    },

    /** Al confirmar, el portal mostraba otra cosa que lo aprobado: vuelve a revisión con la captura nueva. */
    async volverARevision<T extends RastroPortal>(id: string, robot: Actor, datos: { screenshotUrl: string; resumenPortal: T; motivo: string }) {
        // Solo desde APROBADO, y el rastro se MEZCLA (jsonb ||): lo que otro anotó
        // mientras el robot estaba en el portal no se pisa.
        const b = await prisma.labOrderDraft.findUnique({ where: { id }, select: { status: true, orderId: true, lab: true, pair: true } });
        if (!b) throw new ErrorDeCarga('El borrador no existe.', 'NO_EXISTE');
        if (!transicionValida(b.status as EstadoBorrador, 'EN_REVISION')) throw new ErrorDeCarga(`El borrador está ${b.status}: no puede pasar a EN_REVISION.`, 'ESTADO');
        const n = await prisma.$executeRaw`UPDATE "LabOrderDraft" SET status = 'EN_REVISION', "screenshotUrl" = ${datos.screenshotUrl}, "approvedBy" = NULL, "approvedAt" = NULL, error = ${datos.motivo},
            "resumenPortal" = COALESCE("resumenPortal", '{}'::jsonb) || ${JSON.stringify({ ...datos.resumenPortal, robotDesde: null, etapa: null })}::jsonb, "updatedAt" = NOW()
            WHERE id = ${id} AND status = ${b.status}`;
        if (n !== 1) throw new ErrorDeCarga(`El borrador cambió de estado mientras tanto (ya no está ${b.status}): volvé a cargar la ficha.`, 'ESTADO');
        await logAudit({ userId: robot.id, userName: robot.name, action: 'STATUS_CHANGE', entityType: 'LAB_ORDER_DRAFT', entityId: id, details: { lab: b.lab, orderId: b.orderId, pair: b.pair, de: b.status, a: 'EN_REVISION', motivo: datos.motivo } });
        return prisma.labOrderDraft.findUniqueOrThrow({ where: { id } });
    },

    /** Falló el robot antes de que el portal tuviera nada confirmado (PREPARADO / EN_REVISION): queda el motivo. */
    error(id: string, robot: Actor, motivo: string) {
        return cambiarEstado(id, 'ERROR', { error: motivo }, robot, { motivo });
    },

    /**
     * La ÚNICA salida de APROBADO a ERROR: la aprobación ya no vale (la venta
     * cambió después de aprobar) y el robot COMPROBÓ en el portal que no hay
     * pedido creado. Sin esa comprobación no se llama: un APROBADO puede tener
     * un pedido en el laboratorio y por eso, en general, nunca va a ERROR.
     * Atómico: solo si sigue APROBADO y sin nº creado anotado.
     */
    async invalidarSinPedido(id: string, robot: Actor, motivo: string) {
        const b = await prisma.labOrderDraft.findUnique({ where: { id }, select: { status: true, resumenPortal: true, orderId: true, lab: true, pair: true } });
        if (!b) throw new ErrorDeCarga('El borrador no existe.', 'NO_EXISTE');
        const r = (b.resumenPortal || {}) as RastroPortal;
        if (b.status !== 'APROBADO' || r.numeroCreado || r.portalDraftId) throw new ErrorDeCarga(`El borrador está ${b.status}${r.numeroCreado ? ` con el pedido ${r.numeroCreado}` : ''}: no se puede invalidar.`, 'ESTADO');
        const u = await prisma.labOrderDraft.updateMany({ where: { id, status: 'APROBADO' }, data: { status: 'ERROR', error: motivo } });
        if (u.count !== 1) throw new Error('El borrador cambió de estado mientras tanto: volvé a cargar la ficha.');
        await logAudit({
            userId: robot.id, userName: robot.name, action: 'STATUS_CHANGE', entityType: 'LAB_ORDER_DRAFT', entityId: id,
            details: { lab: b.lab, orderId: b.orderId, pair: b.pair, de: 'APROBADO', a: 'ERROR', motivo, sinPedidoEnElPortal: true },
        });
        return prisma.labOrderDraft.findUniqueOrThrow({ where: { id } });
    },

    /** Falló algo sin cambiar de estado (la confirmación, el cancelado): se anota para reintentar. */
    /**
     * Anota el motivo de una falla. `soloSi`: solo si el borrador sigue en ese
     * estado — un intento que llega tarde no puede escribir "no se pudo cargar"
     * sobre un CARGADO. Siempre apaga `robotDesde`/`etapa`: el robot terminó.
     */
    async anotarFalla(id: string, motivo: string, opts: { soloSi?: EstadoBorrador } = {}) {
        const soloSi = opts.soloSi ?? null;
        const n = await prisma.$executeRaw`UPDATE "LabOrderDraft" SET error = ${motivo},
            "resumenPortal" = COALESCE("resumenPortal", '{}'::jsonb) || ${JSON.stringify({ robotDesde: null, etapa: null })}::jsonb, "updatedAt" = NOW()
            WHERE id = ${id} AND (${soloSi}::text IS NULL OR status = ${soloSi})`;
        return n === 1;
    },

    /**
     * Anota en el rastro SOLO si el borrador sigue en ese estado; devuelve si lo
     * hizo. Es la barrera del robot: "voy a mandar el pedido" (`envioIniciadoEl`)
     * no se anota sobre un borrador que una persona anuló mientras tanto
     * (auditoría de robustez 2, A1).
     */
    async anotarRastroSi(id: string, datos: RastroPortal, soloSi: EstadoBorrador): Promise<boolean> {
        const n = await prisma.$executeRaw`UPDATE "LabOrderDraft" SET "resumenPortal" = COALESCE("resumenPortal", '{}'::jsonb) || ${JSON.stringify(datos)}::jsonb, "updatedAt" = NOW() WHERE id = ${id} AND status = ${soloSi}`;
        return n === 1;
    },

    /**
     * Una persona pide reintentar la carga de un APROBADO: se limpia el error
     * viejo (si no, la ficha mostraba "no se cargó" con el robot ya en el
     * portal) y se marca `robotDesde`, que frena un segundo clic mientras el
     * primer robot trabaja (auditoría de arquitectura 2, A1). Atómico.
     */
    async reintentar(id: string, actor: Actor) {
        if (!puedeAprobar(actor)) throw new ErrorDeCarga('El reintento tiene que hacerlo una persona identificada.', 'PERMISO');
        const b = await prisma.labOrderDraft.findUnique({ where: { id }, select: { status: true, orderId: true, lab: true, pair: true } });
        if (!b) throw new ErrorDeCarga('El borrador no existe.', 'NO_EXISTE');
        if (b.status !== 'APROBADO') throw new ErrorDeCarga(`El borrador está ${b.status}: solo se reintenta un APROBADO.`, 'ESTADO');
        const limite = new Date(Date.now() - ROBOT_EN_CURSO_MAX_MS).toISOString();
        const n = await prisma.$executeRaw`UPDATE "LabOrderDraft" SET error = NULL,
            "resumenPortal" = COALESCE("resumenPortal", '{}'::jsonb) || ${JSON.stringify({ robotDesde: new Date().toISOString(), etapa: `reintento pedido por ${actor.name}` })}::jsonb, "updatedAt" = NOW()
            WHERE id = ${id} AND status = 'APROBADO' AND (("resumenPortal"->>'robotDesde') IS NULL OR ("resumenPortal"->>'robotDesde') < ${limite})`;
        if (n !== 1) throw new ErrorDeCarga('El robot ya está cargando este pedido: esperá a que termine (la ficha se actualiza sola).', 'ESTADO');
        await logAudit({ userId: actor.id, userName: actor.name, action: 'UPDATE', entityType: 'LAB_ORDER_DRAFT', entityId: id, details: { lab: b.lab, orderId: b.orderId, pair: b.pair, reintentoDeCarga: true } });
    },

    /** El robot arranca con este borrador (confirmar, cancelar, releer): desde ahora hay robot en curso. */
    robotArranca(id: string, etapa: string) {
        return mezclarRastro(id, { robotDesde: new Date().toISOString(), etapa }).catch(() => null);
    },

    /** El robot terminó (bien o mal) con este borrador: ya no hay robot en curso. */
    robotTermino(id: string) {
        return mezclarRastro(id, { robotDesde: null, etapa: null }).catch(() => null);
    },

    /**
     * Un APROBADO que no puede cargar y NUNCA mandó nada (sin envío iniciado ni
     * nº) se anula a mano, firmado: si no, el par quedaba bloqueado para siempre
     * con el portal caído o la credencial rechazada (auditoría total, 8/10/2026).
     * Con envío iniciado no se anula: primero el reintento busca el pedido.
     */
    async anular(id: string, actor: Actor, motivo: string) {
        if (!puedeAprobar(actor)) throw new ErrorDeCarga('La anulación tiene que hacerla una persona identificada.', 'PERMISO');
        if (!motivo?.trim()) throw new ErrorDeCarga('Decí por qué se anula: es lo que el vendedor va a leer.', 'DATOS');
        const b = await prisma.labOrderDraft.findUnique({ where: { id }, select: { status: true, resumenPortal: true, orderId: true, lab: true, pair: true } });
        if (!b) throw new ErrorDeCarga('El borrador no existe.', 'NO_EXISTE');
        const r = (b.resumenPortal || {}) as RastroPortal;
        if (b.status !== 'APROBADO' && b.status !== 'PREPARADO') throw new ErrorDeCarga(`El borrador está ${b.status}: solo se anula un APROBADO que no pudo cargar o un PREPARADO colgado.`, 'ESTADO');
        if (r.numeroCreado || r.envioIniciadoEl || r.portalDraftId) throw new ErrorDeCarga('Este borrador ya mandó algo al portal (o dejó un borrador ahí): no se anula a mano, se reintenta o se cancela en el portal.', 'ESTADO');
        if (r.robotDesde && Date.now() - Date.parse(r.robotDesde) < ROBOT_EN_CURSO_MAX_MS) throw new ErrorDeCarga('El robot está trabajando con este pedido ahora mismo: esperá a que termine antes de anularlo.', 'ESTADO');
        const texto = motivo.trim().slice(0, 500);
        // Condicionado al estado Y a que ningún robot haya marcado envío mientras tanto.
        const u = await prisma.$executeRaw`UPDATE "LabOrderDraft" SET status = 'ERROR', error = ${`Anulado por ${actor.name}: ${texto}`}, "updatedAt" = NOW()
            WHERE id = ${id} AND status = ${b.status} AND ("resumenPortal"->>'envioIniciadoEl') IS NULL AND ("resumenPortal"->>'numeroCreado') IS NULL`;
        const uCount = { count: u };
        if (uCount.count !== 1) throw new ErrorDeCarga('El borrador cambió mientras tanto (¿el robot empezó a cargarlo?): volvé a cargar la ficha.', 'ESTADO');
        await logAudit({
            userId: actor.id, userName: actor.name, action: 'STATUS_CHANGE', entityType: 'LAB_ORDER_DRAFT', entityId: id,
            details: { lab: b.lab, orderId: b.orderId, pair: b.pair, de: b.status, a: 'ERROR', motivo: texto, anuladoAMano: true },
        });
        return prisma.labOrderDraft.findUniqueOrThrow({ where: { id } });
    },

    /**
     * El borrador del PORTAL desapareció (lo cancelaron a mano) estando este
     * APROBADO: no hay nada que confirmar. Queda ERROR con el motivo y el
     * rastro dice que en el portal no quedó nada (`canceladoEl`), así el par se
     * puede preparar de nuevo.
     */
    async invalidarPorBorradorDesaparecido(id: string, robot: Actor, motivo: string) {
        const b = await prisma.labOrderDraft.findUnique({ where: { id }, select: { status: true, orderId: true, lab: true, pair: true } });
        if (!b) throw new ErrorDeCarga('El borrador no existe.', 'NO_EXISTE');
        if (b.status !== 'APROBADO') throw new ErrorDeCarga(`El borrador está ${b.status}: no se invalida.`, 'ESTADO');
        const n = await prisma.$executeRaw`UPDATE "LabOrderDraft" SET status = 'ERROR', error = ${motivo}, "resumenPortal" = COALESCE("resumenPortal", '{}'::jsonb) || ${JSON.stringify({ canceladoEl: new Date().toISOString(), desaparecioDelPortal: true })}::jsonb, "updatedAt" = NOW() WHERE id = ${id} AND status = 'APROBADO'`;
        if (n !== 1) throw new ErrorDeCarga('El borrador cambió de estado mientras tanto: volvé a cargar la ficha.', 'ESTADO');
        await logAudit({ userId: robot.id, userName: robot.name, action: 'STATUS_CHANGE', entityType: 'LAB_ORDER_DRAFT', entityId: id, details: { lab: b.lab, orderId: b.orderId, pair: b.pair, de: 'APROBADO', a: 'ERROR', motivo, desaparecioDelPortal: true } });
        return prisma.labOrderDraft.findUniqueOrThrow({ where: { id } });
    },

    /** El laboratorio del borrador (para que la ruta no toque Prisma). */
    async labDe(id: string): Promise<string | null> {
        const b = await prisma.labOrderDraft.findUnique({ where: { id }, select: { lab: true } });
        return b?.lab ?? null;
    },

    /** El robot volvió a mirar el portal (sin cambiar de estado): captura y resumen nuevos para revisar. */
    async vistaReleida<T extends RastroPortal>(id: string, actor: Actor, datos: { screenshotUrl: string; resumenPortal: T }) {
        const b = await prisma.labOrderDraft.findUnique({ where: { id }, select: { status: true, orderId: true, lab: true, pair: true } });
        if (!b) throw new ErrorDeCarga('El borrador no existe.', 'NO_EXISTE');
        if (b.status !== 'EN_REVISION') throw new ErrorDeCarga(`El borrador está ${b.status}: solo se relee uno para revisar.`, 'ESTADO');
        // Solo mientras siga EN_REVISION, y mezclando el rastro: si "Aprobar" ganó la
        // carrera, no se pisa su `aprobadoPorId`.
        const n = await prisma.$executeRaw`UPDATE "LabOrderDraft" SET "screenshotUrl" = ${datos.screenshotUrl},
            "resumenPortal" = COALESCE("resumenPortal", '{}'::jsonb) || ${JSON.stringify({ ...datos.resumenPortal, robotDesde: null, etapa: null })}::jsonb, "updatedAt" = NOW()
            WHERE id = ${id} AND status = 'EN_REVISION'`;
        if (n !== 1) throw new ErrorDeCarga('El borrador cambió de estado mientras se releía el portal: volvé a cargar la ficha.', 'ESTADO');
        const r = await prisma.labOrderDraft.findUniqueOrThrow({ where: { id } });
        await logAudit({ userId: actor.id, userName: actor.name, action: 'UPDATE', entityType: 'LAB_ORDER_DRAFT', entityId: id, details: { lab: b.lab, orderId: b.orderId, pair: b.pair, releido: true } }).catch(console.error);
        return r;
    },

    /** El robot canceló el borrador en el portal: ya no bloquea preparar otro. Firmado por quien lo pidió. */
    async canceladoEnPortal(id: string, actor?: Actor) {
        const b = await mezclarRastro(id, { canceladoEl: new Date().toISOString(), robotDesde: null, etapa: null });
        await logAudit({
            userId: actor?.id ?? null, userName: actor?.name ?? null, action: 'UPDATE', entityType: 'LAB_ORDER_DRAFT', entityId: id,
            details: { lab: b.lab, orderId: b.orderId, pair: b.pair, canceladoEnPortal: true },
        }).catch(console.error);
        return b;
    },

    /** Al ir a cancelar, el robot encontró el pedido confirmado a mano: queda resuelto con ese nº. */
    async confirmadoAManoEnPortal(id: string, portalNumber: string, actor?: Actor) {
        const b = await mezclarRastro(id, { confirmadoAManoEl: new Date().toISOString(), confirmadoAManoNumero: portalNumber, robotDesde: null, etapa: null });
        await logAudit({
            userId: actor?.id ?? null, userName: actor?.name ?? null, action: 'UPDATE', entityType: 'LAB_ORDER_DRAFT', entityId: id,
            details: { lab: b.lab, orderId: b.orderId, pair: b.pair, confirmadoAManoEnPortal: portalNumber },
        }).catch(console.error);
        return b;
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
