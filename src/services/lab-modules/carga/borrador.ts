import { Prisma } from '@prisma/client';
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
// APROBADO → ERROR no está en la tabla a propósito: un APROBADO puede tener un
// pedido en el laboratorio (el POST salió y la respuesta se perdió). Las salidas
// que sí existen están declaradas en SALIDAS_A_ERROR_CON_PRUEBA, abajo.

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

/**
 * Las salidas a ERROR que NO pasan por `cambiarEstado` porque exigen una prueba
 * más que el estado: que en el portal NO haya quedado un pedido. Cada una la
 * escribe en el WHERE de su UPDATE (`salirAError`). Esta tabla es la lista
 * COMPLETA — el check la fija contra `Borradores` para que no aparezca una
 * cuarta salida "cruda" sin declararse (auditoría de arquitectura 3).
 */
export const SALIDAS_A_ERROR_CON_PRUEBA = {
    invalidarSinPedido: 'APROBADO: el robot comprobó en el portal que no hay pedido creado (sin nº, sin borrador en el portal y sin un envío sin respuesta)',
    anular: 'APROBADO con error o PREPARADO colgado: una persona, sin robot vivo, y el borrador nunca mandó nada (sin envío iniciado ni nº; un PREPARADO colgado puede haber dejado un borrador en el portal, que después se cancela desde la ficha)',
    invalidarPorBorradorDesaparecido: 'APROBADO (Vitolen): el borrador del portal ya no existe (404 con sesión viva), no hay nada que confirmar',
} as const;
export type SalidaAError = keyof typeof SALIDAS_A_ERROR_CON_PRUEBA;

/** La única escritura a ERROR fuera de `cambiarEstado`: atómica, con la prueba en el WHERE y el robot apagado. */
async function salirAError(id: string, salida: { via: SalidaAError; de: EstadoBorrador; error: string; rastro?: RastroPortal; prueba?: Prisma.Sql }): Promise<boolean> {
    const rastro = JSON.stringify({ robotDesde: null, robotLatidoEl: null, etapa: null, ...(salida.rastro ?? {}) });
    const n = await prisma.$executeRaw`UPDATE "LabOrderDraft" SET status = 'ERROR', error = ${salida.error},
        "resumenPortal" = COALESCE("resumenPortal", '{}'::jsonb) || ${rastro}::jsonb, "updatedAt" = NOW()
        WHERE id = ${id} AND status = ${salida.de} AND ${salida.prueba ?? Prisma.sql`TRUE`}`;
    return n === 1;
}
const SIN_ENVIO_NI_NUMERO = Prisma.sql`("resumenPortal"->>'envioIniciadoEl') IS NULL AND ("resumenPortal"->>'numeroCreado') IS NULL`;

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
    /** Desde cuándo hay un robot trabajando sobre este borrador (y SU identidad: solo él se apaga a sí mismo); null cuando terminó. Frena un segundo robot y el "anular" a destiempo. */
    robotDesde?: string | null;
    /** El último latido del robot (`conRobot`, cada 2 min): "robot en curso" se mide desde acá, no desde que arrancó. */
    robotLatidoEl?: string | null;
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
/**
 * Qué está haciendo el robot AHORA, para la ficha: la etapa que anota el robot
 * ("llenando el formulario de OVES desde 2026-10-21T15:43:35Z") sin la marca de
 * tiempo, con mayúscula. Null si no hay etapa. Puro.
 */
export function etapaParaLaFicha(etapa: unknown): string | null {
    const t = String(etapa ?? '').replace(/\s+desde\s+\d{4}-\d{2}-\d{2}T[^\s)]+/g, '').trim();
    return t ? t[0].toUpperCase() + t.slice(1) : null;
}

/** Lo elegido al preparar como lo entiende el formulario de la ficha: solo valores simples, como texto; nada vacío. Puro. */
export function elegidoDe(opciones: unknown): Record<string, string> {
    const out: Record<string, string> = {};
    if (!opciones || typeof opciones !== 'object') return out;
    for (const [k, v] of Object.entries(opciones as Record<string, unknown>)) {
        if (v === null || v === undefined || v === '' || typeof v === 'object' || typeof v === 'boolean') continue;
        out[k] = String(v);
    }
    return out;
}

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
// Un robot vivo late cada 2 min (`conRobot`, mueve `updatedAt`) también mientras
// Playwright espera (el setInterval corre en el event loop), así que "30 min
// sin novedades" es un robot muerto, no uno lento — aunque un paso del portal
// de Grupo Óptico pueda tardar hasta 30 min (techo ampliado el 15/10/2026).
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

/** Cambio de estado atómico. `datos` NUNCA trae `resumenPortal`: el rastro solo se mezcla (jsonb ||), nunca se reemplaza. */
async function cambiarEstado(id: string, a: EstadoBorrador, datos: Record<string, unknown> & { resumenPortal?: never }, actor: Actor, detalle?: Record<string, unknown>) {
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
): { aprobar: boolean; rechazar: boolean; reintentar: boolean; anular: boolean; retirarAprobacion: boolean; releer: boolean; cancelarPortal: boolean; robotEnCurso: boolean } {
    const r = (b.resumenPortal && typeof b.resumenPortal === 'object' ? b.resumenPortal : {}) as RastroPortal;
    const enRevision = b.status === 'EN_REVISION';
    const aprobado = b.status === 'APROBADO';
    const preparado = b.status === 'PREPARADO';
    const hace = (d: Date | string | null | undefined) => (d ? ahora.getTime() - new Date(d).getTime() : 0);
    // Un robot que latió hace poco está trabajando: ni aprobar, reintentar ni anular encima.
    const robotEnCurso = !!r.robotDesde && hace(r.robotLatidoEl ?? r.robotDesde) < ROBOT_EN_CURSO_MAX_MS;
    // "Demorado" se mide desde la última novedad (updatedAt), no desde la aprobación:
    // después de un reintento, el reloj arranca de nuevo.
    const demorado = aprobado && !b.error && hace(b.updatedAt ?? b.approvedAt) > APROBADO_DEMORADO_MS;
    // Un PREPARADO que lleva demasiado sin novedades: el robot murió (redeploy) y nadie lo anotó.
    const preparadoColgado = preparado && hace(b.updatedAt) > PREPARADO_COLGADO_MS;
    const sinNadaEnElPortal = !r.numeroCreado && !r.envioIniciadoEl && !r.portalDraftId;
    return {
        // Con un "releer" en vuelo no se aprueba: el confirm compararía contra el texto viejo.
        aprobar: enRevision && !contexto.bloqueadoPorExistente && !robotEnCurso,
        // Con un "releer" en vuelo no se rechaza: Vitolen tiene que poder cancelar el borrador del portal después.
        rechazar: enRevision && !robotEnCurso,
        reintentar: aprobado && !robotEnCurso && (!!b.error || demorado),
        // Solo un borrador que NUNCA mandó nada, y sin robot encima. Un PREPARADO
        // colgado puede haber dejado un borrador en el portal (Vitolen apretó
        // "Crear" y el robot murió): se anula igual y la ficha ofrece cancelarlo
        // allá; si no, el par quedaba bloqueado hasta el tick de la mañana.
        anular: !robotEnCurso && ((aprobado && !!b.error && sinNadaEnElPortal) || (preparadoColgado && !r.numeroCreado && !r.envioIniciadoEl)),
        // Un APROBADO que no pudo cargar y nunca mandó nada vuelve a revisión a
        // pedido de una persona: desde ahí se rechaza (y Vitolen cancela su
        // borrador). Sin esto, un APROBADO de Vitolen con el portal caído o la
        // credencial rechazada no tenía salida humana (auditoría 4).
        retirarAprobacion: aprobado && !robotEnCurso && !r.numeroCreado && !r.envioIniciadoEl,
        releer: enRevision && lab.puedeReleer && !!r.portalDraftId && !robotEnCurso,
        cancelarPortal: (b.status === 'RECHAZADO' || b.status === 'ERROR') && lab.conBorradorEnPortal && portalSinResolver(b) && !robotEnCurso,
        robotEnCurso: robotEnCurso || (preparado && !preparadoColgado) || (aprobado && !b.error && !demorado),
    };
}
/** Más de esto sin latir, el robot se da por muerto: se permite otro reintento / anular. */
export const ROBOT_EN_CURSO_MAX_MS = 25 * 60_000;
/** Cada cuánto late un robot vivo (`conRobot`). */
export const LATIDO_ROBOT_MS = 2 * 60_000;
/** SQL: cuándo fue la última señal de vida del robot (el latido, o el arranque si todavía no latió). */
const ULTIMA_SENAL_DEL_ROBOT = Prisma.sql`COALESCE("resumenPortal"->>'robotLatidoEl', "resumenPortal"->>'robotDesde')`;

/**
 * El candado del robot, tomado en el WHERE: solo si no hay otro robot vivo (o
 * si la identidad ya es la nuestra: la habilitó `reintentar`). Si no lo
 * consigue, 409 — dos clics de "releer" o "cancelar en el portal" ya no
 * arrancan dos Chromium (auditoría 4, M1). Devuelve la identidad.
 */
async function robotArranca(id: string, etapa: string, heredar: string | null, enEstado: EstadoBorrador[]): Promise<string> {
    const robotDesde = heredar ?? new Date().toISOString();
    const limite = new Date(Date.now() - ROBOT_EN_CURSO_MAX_MS).toISOString();
    // También el ESTADO en el WHERE: un confirm que arranca sobre un borrador que
    // alguien devolvió a revisión en el medio no toma el candado ni gasta un turno.
    const estados = Prisma.join(enEstado);
    const n = await prisma.$executeRaw`UPDATE "LabOrderDraft" SET "resumenPortal" = COALESCE("resumenPortal", '{}'::jsonb) || ${JSON.stringify({ robotDesde, robotLatidoEl: null, etapa })}::jsonb, "updatedAt" = NOW()
        WHERE id = ${id} AND status IN (${estados}) AND (${ULTIMA_SENAL_DEL_ROBOT} IS NULL OR ${ULTIMA_SENAL_DEL_ROBOT} < ${limite} OR ("resumenPortal"->>'robotDesde') = ${robotDesde})`;
    if (n !== 1) throw new ErrorDeCarga(`El robot ya está trabajando con este pedido, o el borrador ya no está ${enEstado.join('/')}: la ficha se actualiza sola.`, 'ESTADO');
    return robotDesde;
}

/** El robot terminó (bien o mal): ya no hay robot en curso — solo si sigue siendo ese robot (no apaga al que lo reemplazó). */
async function robotTermino(id: string, robot: string) {
    await prisma.$executeRaw`UPDATE "LabOrderDraft" SET "resumenPortal" = COALESCE("resumenPortal", '{}'::jsonb) || ${JSON.stringify({ robotDesde: null, robotLatidoEl: null, etapa: null })}::jsonb, "updatedAt" = NOW()
        WHERE id = ${id} AND ("resumenPortal"->>'robotDesde') = ${robot}`
        .catch(err => console.error('[lab-modulos] no se pudo anotar que el robot terminó', id, err));
}
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

    /**
     * El robot sacó la captura del resumen del portal: queda para revisar. El
     * rastro se MEZCLA (jsonb ||), como toda escritura a `resumenPortal`: antes
     * se reemplazaba entero y se perdía `preparadoPorId` (quien pidió un extra
     * no cobrado quedaba firmado con el id del aprobador; auditoría 4, A1).
     */
    async enRevision<T extends RastroPortal>(id: string, robot: Actor, datos: { screenshotUrl: string; resumenPortal: T }) {
        const b = await prisma.labOrderDraft.findUnique({ where: { id }, select: { status: true, orderId: true, lab: true, pair: true } });
        if (!b) throw new ErrorDeCarga('El borrador no existe.', 'NO_EXISTE');
        if (!transicionValida(b.status as EstadoBorrador, 'EN_REVISION')) throw new ErrorDeCarga(`El borrador está ${b.status}: no puede pasar a EN_REVISION.`, 'ESTADO');
        const n = await prisma.$executeRaw`UPDATE "LabOrderDraft" SET status = 'EN_REVISION', "screenshotUrl" = ${datos.screenshotUrl}, error = NULL,
            "resumenPortal" = COALESCE("resumenPortal", '{}'::jsonb) || ${JSON.stringify({ ...datos.resumenPortal, robotDesde: null, robotLatidoEl: null, etapa: null })}::jsonb, "updatedAt" = NOW()
            WHERE id = ${id} AND status = ${b.status}`;
        if (n !== 1) throw new ErrorDeCarga(`El borrador cambió de estado mientras tanto (ya no está ${b.status}): volvé a cargar la ficha.`, 'ESTADO');
        await logAudit({ userId: robot.id, userName: robot.name, action: 'STATUS_CHANGE', entityType: 'LAB_ORDER_DRAFT', entityId: id, details: { lab: b.lab, orderId: b.orderId, pair: b.pair, de: b.status, a: 'EN_REVISION' } });
        return prisma.labOrderDraft.findUniqueOrThrow({ where: { id } });
    },

    /**
     * Una persona retira su aprobación: APROBADO → EN_REVISION, firmado, solo si
     * el borrador nunca mandó nada (sin envío iniciado ni nº) y no hay robot
     * vivo. Desde revisión se rechaza (y Vitolen cancela su borrador del
     * portal) o se vuelve a aprobar. Es la salida humana de un APROBADO que el
     * robot no puede confirmar (portal caído, credencial rechazada).
     */
    async retirarAprobacion(id: string, actor: Actor, motivo: string) {
        if (!puedeAprobar(actor)) throw new ErrorDeCarga('Retirar la aprobación tiene que hacerlo una persona identificada.', 'PERMISO');
        const b = await prisma.labOrderDraft.findUnique({ where: { id }, select: { status: true, resumenPortal: true, orderId: true, lab: true, pair: true, approvedBy: true } });
        if (!b) throw new ErrorDeCarga('El borrador no existe.', 'NO_EXISTE');
        if (b.status !== 'APROBADO') throw new ErrorDeCarga(`El borrador está ${b.status}: solo se retira la aprobación de un APROBADO.`, 'ESTADO');
        const r = (b.resumenPortal || {}) as RastroPortal;
        if (r.numeroCreado || r.envioIniciadoEl) throw new ErrorDeCarga('Este borrador ya mandó el pedido al portal: no se retira la aprobación, se reintenta (el robot busca el pedido antes de crear otro).', 'ESTADO');
        const texto = motivo.trim().slice(0, 500);
        const limite = new Date(Date.now() - ROBOT_EN_CURSO_MAX_MS).toISOString();
        const n = await prisma.$executeRaw`UPDATE "LabOrderDraft" SET status = 'EN_REVISION', "approvedBy" = NULL, "approvedAt" = NULL,
            error = ${`Aprobación retirada por ${actor.name}${texto ? `: ${texto}` : ''}.`},
            "resumenPortal" = COALESCE("resumenPortal", '{}'::jsonb) || ${JSON.stringify({ robotDesde: null, robotLatidoEl: null, etapa: null })}::jsonb, "updatedAt" = NOW()
            WHERE id = ${id} AND status = 'APROBADO' AND ${SIN_ENVIO_NI_NUMERO} AND (${ULTIMA_SENAL_DEL_ROBOT} IS NULL OR ${ULTIMA_SENAL_DEL_ROBOT} < ${limite})`;
        if (n !== 1) throw new ErrorDeCarga('El borrador cambió mientras tanto (¿el robot empezó a cargarlo?): volvé a cargar la ficha.', 'ESTADO');
        await logAudit({
            userId: actor.id, userName: actor.name, action: 'STATUS_CHANGE', entityType: 'LAB_ORDER_DRAFT', entityId: id,
            details: { lab: b.lab, orderId: b.orderId, pair: b.pair, de: 'APROBADO', a: 'EN_REVISION', motivo: texto, aprobacionRetirada: true, aprobadoPor: b.approvedBy },
        });
        return prisma.labOrderDraft.findUniqueOrThrow({ where: { id } });
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
        // Sin robot encima (un "releer" en vuelo): lo que se aprueba es lo que se ve.
        const limite = new Date(Date.now() - ROBOT_EN_CURSO_MAX_MS).toISOString();
        const n = await prisma.$executeRaw`UPDATE "LabOrderDraft" SET status = 'APROBADO', "approvedBy" = ${actor.name}, "approvedAt" = NOW(), error = NULL,
            "resumenPortal" = COALESCE("resumenPortal", '{}'::jsonb) || ${JSON.stringify({ aprobadoPorId: actor.id })}::jsonb, "updatedAt" = NOW()
            WHERE id = ${id} AND status = ${actual.status} AND (${ULTIMA_SENAL_DEL_ROBOT} IS NULL OR ${ULTIMA_SENAL_DEL_ROBOT} < ${limite})`;
        if (n !== 1) throw new ErrorDeCarga(`El borrador cambió mientras tanto (ya no está ${actual.status}, o el robot lo está releyendo): volvé a cargar la ficha.`, 'ESTADO');
        await logAudit({
            userId: actor.id, userName: actor.name, action: 'STATUS_CHANGE', entityType: 'LAB_ORDER_DRAFT', entityId: id,
            details: { lab: actual.lab, orderId: actual.orderId, pair: actual.pair, de: actual.status, a: 'APROBADO' },
        });
        return prisma.labOrderDraft.findUniqueOrThrow({ where: { id } });
    },

    async rechazar(id: string, actor: Actor, motivo: string) {
        if (!puedeAprobar(actor)) throw new ErrorDeCarga('El rechazo tiene que hacerlo una persona identificada.', 'PERMISO');
        if (!motivo?.trim()) throw new ErrorDeCarga('Decí por qué se rechaza: es lo que el vendedor va a leer.', 'DATOS');
        const r = ((await prisma.labOrderDraft.findUnique({ where: { id }, select: { resumenPortal: true } }))?.resumenPortal || {}) as RastroPortal;
        if (r.robotDesde && Date.now() - Date.parse(r.robotLatidoEl ?? r.robotDesde) < ROBOT_EN_CURSO_MAX_MS) throw new ErrorDeCarga('El robot está trabajando con este pedido ahora mismo: esperá a que termine antes de rechazarlo.', 'ESTADO');
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
            "resumenPortal" = COALESCE("resumenPortal", '{}'::jsonb) || ${JSON.stringify({ ...datos.resumenPortal, robotDesde: null, robotLatidoEl: null, etapa: null })}::jsonb, "updatedAt" = NOW()
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
        // Con un envío sin respuesta no se afirma "no se creó nada": el POST pudo
        // haber creado el pedido (auditoría de robustez 4, M2).
        if (r.envioIniciadoEl) throw new ErrorDeCarga('Este borrador tiene un envío al portal sin respuesta: no se invalida, se reintenta cuando pase la espera.', 'ESTADO');
        const salio = await salirAError(id, { via: 'invalidarSinPedido', de: 'APROBADO', error: motivo, prueba: Prisma.sql`("resumenPortal"->>'numeroCreado') IS NULL AND ("resumenPortal"->>'portalDraftId') IS NULL AND ("resumenPortal"->>'envioIniciadoEl') IS NULL` });
        if (!salio) throw new ErrorDeCarga('El borrador cambió mientras tanto (¿el portal devolvió un nº?): volvé a cargar la ficha.', 'ESTADO');
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
     * sobre un CARGADO. `robot`: solo si el robot que falla sigue siendo el
     * dueño del borrador (`conRobot`) — la falla de un robot viejo no pisa el
     * estado del que lo reemplazó. Apaga `robotDesde`/`etapa`: el robot terminó.
     */
    async anotarFalla(id: string, motivo: string, opts: { soloSi?: EstadoBorrador; robot?: string } = {}) {
        const soloSi = opts.soloSi ?? null;
        const robot = opts.robot ?? null;
        const n = await prisma.$executeRaw`UPDATE "LabOrderDraft" SET error = ${motivo},
            "resumenPortal" = COALESCE("resumenPortal", '{}'::jsonb) || ${JSON.stringify({ robotDesde: null, robotLatidoEl: null, etapa: null })}::jsonb, "updatedAt" = NOW()
            WHERE id = ${id} AND (${soloSi}::text IS NULL OR status = ${soloSi}) AND (${robot}::text IS NULL OR ("resumenPortal"->>'robotDesde') = ${robot})`;
        return n === 1;
    },

    /**
     * La barrera antes del ÚNICO envío irreversible (crear en Grupo Óptico,
     * confirmar en Vitolen): "voy a mandar" se anota solo si el borrador sigue
     * APROBADO, sin nº creado y sin otro envío reciente sin respuesta (uno de
     * hace menos de `esperaMs` todavía puede estar guardándose en el portal).
     * Atómica en la base: dos robots sobre el mismo borrador —un reintento que
     * entró con el primero vivo— no pueden pasar los dos (auditoría de
     * robustez 3, A1). Devuelve si pasó.
     */
    async marcarEnvio(id: string, opts: { esperaMs: number }): Promise<boolean> {
        const limite = new Date(Date.now() - opts.esperaMs).toISOString();
        const n = await prisma.$executeRaw`UPDATE "LabOrderDraft" SET "resumenPortal" = COALESCE("resumenPortal", '{}'::jsonb) || ${JSON.stringify({ envioIniciadoEl: new Date().toISOString() })}::jsonb, "updatedAt" = NOW()
            WHERE id = ${id} AND status = 'APROBADO' AND ("resumenPortal"->>'numeroCreado') IS NULL
            AND (("resumenPortal"->>'envioIniciadoEl') IS NULL OR ("resumenPortal"->>'envioIniciadoEl') < ${limite})`;
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
        const robotDesde = new Date().toISOString();
        const n = await prisma.$executeRaw`UPDATE "LabOrderDraft" SET error = NULL,
            "resumenPortal" = COALESCE("resumenPortal", '{}'::jsonb) || ${JSON.stringify({ robotDesde, robotLatidoEl: null, etapa: `reintento pedido por ${actor.name}` })}::jsonb, "updatedAt" = NOW()
            WHERE id = ${id} AND status = 'APROBADO' AND (${ULTIMA_SENAL_DEL_ROBOT} IS NULL OR ${ULTIMA_SENAL_DEL_ROBOT} < ${limite})`;
        if (n !== 1) throw new ErrorDeCarga('El robot ya está cargando este pedido: esperá a que termine (la ficha se actualiza sola).', 'ESTADO');
        await logAudit({ userId: actor.id, userName: actor.name, action: 'UPDATE', entityType: 'LAB_ORDER_DRAFT', entityId: id, details: { lab: b.lab, orderId: b.orderId, pair: b.pair, reintentoDeCarga: true } });
        // La identidad del robot que este reintento habilita: `conRobot` la hereda
        // en vez de pedir el candado de nuevo (que ya es suyo).
        return robotDesde;
    },

    /**
     * Corre `tarea` como EL robot de este borrador: `robotDesde` (que es también
     * su identidad) se anota al entrar, late cada 2 min mientras corre
     * (`robotLatidoEl`, mueve `updatedAt`) y se apaga al salir SOLO si sigue
     * siendo el nuestro. "Robot en curso" se mide desde el último latido: un
     * portal pésimo (login de hasta 15 min por intento) ya no deja que un
     * reintento entre con el primer robot vivo, y la falla de un robot viejo no
     * pisa el estado del nuevo (auditoría de robustez 3, A1 y M3). La tarea
     * recibe su identidad para pasársela a `anotarFalla`.
     */
    async conRobot<T>(id: string, etapa: string, tarea: (robot: string) => Promise<T>, opts: { heredar?: string | null; enEstado: EstadoBorrador[] }): Promise<T> {
        const robot = await robotArranca(id, etapa, opts.heredar ?? null, opts.enEstado);
        const latido = setInterval(() => {
            prisma.$executeRaw`UPDATE "LabOrderDraft" SET "resumenPortal" = COALESCE("resumenPortal", '{}'::jsonb) || ${JSON.stringify({ robotLatidoEl: new Date().toISOString() })}::jsonb, "updatedAt" = NOW()
                WHERE id = ${id} AND ("resumenPortal"->>'robotDesde') = ${robot}`
                .catch(err => console.error('[lab-modulos] el latido del robot falló', id, err));
        }, LATIDO_ROBOT_MS);
        try {
            return await tarea(robot);
        } finally {
            clearInterval(latido);
            await robotTermino(id, robot);
        }
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
        if (r.numeroCreado || r.envioIniciadoEl) throw new ErrorDeCarga('Este borrador ya mandó el pedido al portal: no se anula a mano, se reintenta (el robot busca el pedido antes de crear otro).', 'ESTADO');
        // Un APROBADO con borrador en el portal (Vitolen) se rechaza/cancela, no se
        // anula. Un PREPARADO colgado sí puede tener uno: el robot apretó "Crear" y
        // murió; se anula y el borrador del portal se cancela desde la ficha.
        if (r.portalDraftId && b.status === 'APROBADO') throw new ErrorDeCarga('Este borrador dejó un pedido en el portal: no se anula a mano, se cancela en el portal.', 'ESTADO');
        if (r.robotDesde && Date.now() - Date.parse(r.robotLatidoEl ?? r.robotDesde) < ROBOT_EN_CURSO_MAX_MS) throw new ErrorDeCarga('El robot está trabajando con este pedido ahora mismo: esperá a que termine antes de anularlo.', 'ESTADO');
        const texto = motivo.trim().slice(0, 500);
        const enElPortal = r.portalDraftId ? ` Quedó el borrador ${r.portalDraftId} en el portal: cancelalo desde la ficha.` : '';
        // Condicionado al estado Y a que ningún robot haya marcado envío mientras tanto.
        const limite = new Date(Date.now() - ROBOT_EN_CURSO_MAX_MS).toISOString();
        const salio = await salirAError(id, { via: 'anular', de: b.status, error: `Anulado por ${actor.name}: ${texto}.${enElPortal}`, prueba: Prisma.sql`${SIN_ENVIO_NI_NUMERO} AND (${ULTIMA_SENAL_DEL_ROBOT} IS NULL OR ${ULTIMA_SENAL_DEL_ROBOT} < ${limite})` });
        if (!salio) throw new ErrorDeCarga('El borrador cambió mientras tanto (¿el robot empezó a cargarlo?): volvé a cargar la ficha.', 'ESTADO');
        await logAudit({
            userId: actor.id, userName: actor.name, action: 'STATUS_CHANGE', entityType: 'LAB_ORDER_DRAFT', entityId: id,
            details: { lab: b.lab, orderId: b.orderId, pair: b.pair, de: b.status, a: 'ERROR', motivo: texto, anuladoAMano: true, ...(r.portalDraftId ? { portalDraftId: r.portalDraftId } : {}) },
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
        const salio = await salirAError(id, { via: 'invalidarPorBorradorDesaparecido', de: 'APROBADO', error: motivo, rastro: { canceladoEl: new Date().toISOString(), desaparecioDelPortal: true } });
        if (!salio) throw new ErrorDeCarga('El borrador cambió de estado mientras tanto: volvé a cargar la ficha.', 'ESTADO');
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
            "resumenPortal" = COALESCE("resumenPortal", '{}'::jsonb) || ${JSON.stringify({ ...datos.resumenPortal, robotDesde: null, robotLatidoEl: null, etapa: null })}::jsonb, "updatedAt" = NOW()
            WHERE id = ${id} AND status = 'EN_REVISION'`;
        if (n !== 1) throw new ErrorDeCarga('El borrador cambió de estado mientras se releía el portal: volvé a cargar la ficha.', 'ESTADO');
        const r = await prisma.labOrderDraft.findUniqueOrThrow({ where: { id } });
        await logAudit({ userId: actor.id, userName: actor.name, action: 'UPDATE', entityType: 'LAB_ORDER_DRAFT', entityId: id, details: { lab: b.lab, orderId: b.orderId, pair: b.pair, releido: true } }).catch(console.error);
        return r;
    },

    /** El robot canceló el borrador en el portal: ya no bloquea preparar otro. Firmado por quien lo pidió. */
    async canceladoEnPortal(id: string, actor?: Actor) {
        const b = await mezclarRastro(id, { canceladoEl: new Date().toISOString(), robotDesde: null, robotLatidoEl: null, etapa: null });
        await logAudit({
            userId: actor?.id ?? null, userName: actor?.name ?? null, action: 'UPDATE', entityType: 'LAB_ORDER_DRAFT', entityId: id,
            details: { lab: b.lab, orderId: b.orderId, pair: b.pair, canceladoEnPortal: true },
        }).catch(console.error);
        return b;
    },

    /** Al ir a cancelar, el robot encontró el pedido confirmado a mano: queda resuelto con ese nº. */
    async confirmadoAManoEnPortal(id: string, portalNumber: string, actor?: Actor) {
        const b = await mezclarRastro(id, { confirmadoAManoEl: new Date().toISOString(), confirmadoAManoNumero: portalNumber, robotDesde: null, robotLatidoEl: null, etapa: null });
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
            // Solo si SIGUE aprobado: entre el findMany y acá el robot pudo terminar
            // (CARGADO) y este texto quedaría pegado a un pedido cargado.
            await Borradores.anotarFalla(id, `La confirmación en el portal no terminó en ${COLGADO_TRAS_MIN} min: reintentar desde la ficha (si el portal ya la tomó, el robot lee el nº).`, { soloSi: 'APROBADO' })
                .catch(err => console.error('[lab-modulos] no se pudo anotar el borrador colgado', id, err));
        }
        return { aError, aReintentar };
    },
};
