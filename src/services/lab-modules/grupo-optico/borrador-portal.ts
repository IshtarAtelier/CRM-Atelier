import { prisma } from '../../../lib/db';
import { uploadFile } from '../../../lib/storage';
import { logAudit } from '../../../lib/audit';
import type { Actor } from '../../../lib/actor';
import { Borradores, type RastroPortal } from '../carga/borrador';
import { aplicarEstadoEnVenta } from '../estados';
import { conTurno } from '../portal/turno';
import { conSesionSmartLab, LAB_GRUPO_OPTICO, NOMBRE_GRUPO_OPTICO, ROBOT_GRUPO_OPTICO } from './portal';
import { payloadCreateUpdate, planDeCarga, type OpcionesCarga, type PlanDeCarga, type ResueltoEnPortal } from './carga';
import { bajarPdfDelPedido, buscarPedidoYaCreado, crearPedidoEnPortal, diferenciasConLoAprobado, leerPedido, puedeCrearPedidosReales, resolverEnPortal, type Etiquetas } from './robot';
import { leerVentaParaCargaGO } from './venta';

/**
 * LA CARGA ASISTIDA DE GRUPO ÓPTICO sobre el borrador del CRM (LabOrderDraft).
 *
 *   PREPARADO   → el robot entra al portal SOLO A LEER: traduce el producto
 *                 (catalogo.ts), verifica cada id contra su etiqueta y arma el
 *                 pedido exacto que va a mandar → EN_REVISION, con todo lo que
 *                 la persona tiene que mirar escrito como lo muestra el portal.
 *   APROBADO    → el robot comprueba que la venta no haya cambiado desde que se
 *                 preparó, CREA el pedido (en SmartLab no hay borrador: guardar
 *                 es crear, y la óptica no puede anular), lee de vuelta lo que el
 *                 portal guardó, baja el PDF del pedido, y el nº va a la venta
 *                 firmado por el robot y por quien aprobó → CARGADO.
 *   RECHAZADO   → nada que deshacer en el portal (nunca se mandó).
 *
 * Contra duplicados: el nº creado se anota en el borrador en el acto, y antes
 * de cualquier POST se busca en el portal un pedido con el mismo código creado
 * después de la aprobación. Un reintento nunca crea dos pedidos.
 * Toda entrada al portal toma el turno como pasada 'robot'.
 */
export const ROBOT_ACTOR_GRUPO_OPTICO: Actor = { id: null, name: ROBOT_GRUPO_OPTICO, role: null };

/** Lo que se guarda en el borrador: lo que se aprobó, tal cual. */
export interface PayloadBorradorGO {
    opciones: OpcionesCarga;
    /** Resumen legible del plan (lo que ve la persona). */
    plan: Pick<PlanDeCarga, 'par' | 'producto' | 'lensTypeId' | 'od' | 'oi' | 'tenido' | 'codigoOptica' | 'observacion' | 'armazon'>;
    avisos: string[];
}

export interface RastroGO extends RastroPortal {
    etiquetas?: Etiquetas;
    resuelto?: ResueltoEnPortal;
    /** El cuerpo EXACTO que se va a mandar (lo que la persona aprueba). */
    payloadPortal?: Record<string, unknown>;
    preparadoEl?: string;
    numeroCreado?: string;
    pdfUrl?: string;
    diferencias?: string[];
    /** La huella del producto vendido al preparar (huellaDelPlan). */
    huella?: string;
    adoptadoDelPortal?: boolean;
}

const ESPERA_TURNO_MS = 4 * 60_000;

async function enElPortal<T>(tarea: () => Promise<T>): Promise<T> {
    const r = await conTurno(LAB_GRUPO_OPTICO, 'robot', tarea, { esperar: true, esperaMaxMs: ESPERA_TURNO_MS });
    if (r && typeof r === 'object' && 'skipped' in (r as any) && (r as any).skipped) {
        throw new Error(`El portal de ${NOMBRE_GRUPO_OPTICO} está ocupado por otra pasada; volvé a intentar en unos minutos.`);
    }
    return r as T;
}

async function mezclar(id: string, datos: RastroGO) {
    const b = await prisma.labOrderDraft.findUnique({ where: { id }, select: { resumenPortal: true } });
    const previo = (b?.resumenPortal && typeof b.resumenPortal === 'object' ? b.resumenPortal : {}) as RastroGO;
    await prisma.labOrderDraft.update({ where: { id }, data: { resumenPortal: { ...previo, ...datos } as any }, select: { id: true } });
}

/** Los campos del pedido que, si cambian entre preparar y aprobar, invalidan la aprobación. Puro. */
export const CAMPOS_QUE_SE_APRUEBAN = [
    'lensTypeId', 'materialId', 'colorId', 'brandId',
    'rightEyeArticle', 'rightEyeStockArticle', 'rightEyeFarSpherical', 'rightEyeFarCylindrical', 'rightEyeFarAxis', 'rightEyeNearSpherical', 'rightEyeAddition', 'rightEyeInterpupillaryDistance', 'rightEyePupillaryHeight',
    'leftEyeArticle', 'leftEyeStockArticle', 'leftEyeFarSpherical', 'leftEyeFarCylindrical', 'leftEyeFarAxis', 'leftEyeNearSpherical', 'leftEyeAddition', 'leftEyeInterpupillaryDistance', 'leftEyePupillaryHeight',
    'tintedId', 'tintedArticleId', 'tintedColor', 'tintedIntensity', 'frameType', 'typeRimId', 'typeRimArticleId', 'bridge', 'bridgeA', 'bridgeB', 'bridgeED', 'frameShape',
    'frameModel', 'opticsCode', 'opticsComment', 'warrantyPatientName',
] as const;

export function cambiosEntrePayloads(aprobado: Record<string, unknown>, actual: Record<string, unknown>): string[] {
    return CAMPOS_QUE_SE_APRUEBAN.filter(k => JSON.stringify(aprobado[k] ?? null) !== JSON.stringify(actual[k] ?? null));
}

/**
 * La HUELLA de lo que se vendió: el producto y cómo se traduce al portal.
 * Los ids del portal se leen al preparar; si la venta cambia de producto
 * después (otra familia, otro color, Essential, stock↔laboratorio, otro
 * teñido), rearmar el pedido con esos ids viejos daría "sin cambios" y se
 * cargaría lo de antes (auditoría del 3/10/2026, C1). La huella lo detecta. Puro.
 */
export function huellaDelPlan(plan: PlanDeCarga): string {
    const e = plan.especificacion;
    return JSON.stringify(e.clase === 'STOCK'
        ? { producto: plan.producto, clase: 'STOCK', material: e.material.materialId, ext: e.rangoExtendido, tenido: plan.tenido }
        : { producto: plan.producto, clase: 'LAB', familia: e.familia.nombre, material: e.material.materialId, color: e.colorId, essential: e.essential, tenido: plan.tenido });
}

/** Arma el plan desde la venta tal como está hoy. */
async function planActual(orderId: string, par: number, opciones: OpcionesCarga) {
    const venta = await leerVentaParaCargaGO(orderId);
    if (!venta) throw new Error('La venta no existe.');
    return planDeCarga(venta as any, par, opciones);
}

/** PREPARADO → EN_REVISION. Solo lee el portal. */
export async function prepararEnPortal(borradorId: string) {
    const b = await prisma.labOrderDraft.findUnique({ where: { id: borradorId }, select: { id: true, status: true, orderId: true, pair: true, payload: true } });
    if (!b) throw new Error('El borrador no existe.');
    if (b.status !== 'PREPARADO') throw new Error(`El borrador está ${b.status}: el robot solo prepara los PREPARADOS.`);
    const guardado = b.payload as unknown as PayloadBorradorGO;
    try {
        const r = await planActual(b.orderId, b.pair, guardado.opciones);
        if (!r.ok) throw new Error(`Faltan datos: ${r.faltantes.join(' · ')}`);
        const { resuelto, etiquetas } = await enElPortal(() => conSesionSmartLab(page => resolverEnPortal(page, r.plan)));
        const payloadPortal = payloadCreateUpdate(r.plan, resuelto);
        return await Borradores.enRevision(b.id, ROBOT_ACTOR_GRUPO_OPTICO, {
            screenshotUrl: '',
            resumenPortal: { etiquetas, resuelto, payloadPortal, huella: huellaDelPlan(r.plan), preparadoEl: new Date().toISOString() } as RastroGO,
        });
    } catch (err: any) {
        const motivo = err?.message || String(err);
        await Borradores.error(b.id, ROBOT_ACTOR_GRUPO_OPTICO, motivo).catch(e => console.error('[lab-modulos] no se pudo marcar el error del borrador GO:', e));
        throw err;
    }
}

async function guardarPdf(borradorId: string, numero: string, pdf: Buffer): Promise<string> {
    // Receta y datos del cliente: clave que /api/storage/view trata como sensible (exige sesión).
    const key = await uploadFile(pdf, `lab-modulos/grupo-optico/${borradorId}-pedido-${numero}.pdf`, 'application/pdf');
    return `/api/storage/view?key=${encodeURIComponent(key)}`;
}

/** La aprobación ya no vale y en el portal NO hay pedido: se invalida (ERROR) sin mandar nada. */
class AprobacionInvalidaError extends Error {
    constructor(motivo: string) { super(motivo); this.name = 'AprobacionInvalidaError'; }
}

/** Ya estaba CARGADO cuando el robot entró (otro intento lo terminó): no se hace nada. */
class YaCargadoError extends Error {
    constructor() { super('ya cargado'); this.name = 'YaCargadoError'; }
}

/** Los nº de pedido que ya son de OTRO par de esta venta (para no adoptarlos como de este). */
async function numerosDeOtrosPares(orderId: string, pair: number): Promise<Set<string>> {
    const otros = await prisma.labOrderDraft.findMany({ where: { orderId, lab: LAB_GRUPO_OPTICO, pair: { not: pair } }, select: { portalNumber: true, resumenPortal: true } });
    const set = new Set<string>();
    for (const o of otros) {
        if (o.portalNumber) set.add(o.portalNumber);
        const n = (o.resumenPortal as RastroGO | null)?.numeroCreado;
        if (n) set.add(n);
    }
    const espejo = await prisma.labPortalOrder.findMany({ where: { orderId, lab: LAB_GRUPO_OPTICO, pair: { not: pair, gt: 0 } }, select: { portalNumber: true } });
    for (const e of espejo) set.add(e.portalNumber);
    return set;
}

/**
 * APROBADO → CARGADO. Reintentable: desde APROBADO solo va a ERROR si el robot
 * comprobó en el portal que no hay pedido (la venta cambió). El orden importa
 * (auditoría del 3/10/2026):
 *  1. adentro del turno del portal, se relee el borrador: si otro intento ya
 *     lo cargó, no se hace nada (dos aprobaciones o un reintento a la vez);
 *  2. se BUSCA en el portal un pedido de este par con el código de la venta
 *     (una carga anterior cuya respuesta se perdió, o una carga a mano con el
 *     favorito): si está, se adopta y no se crea otro;
 *  3. recién ahí se compara la venta de hoy con lo aprobado (producto y
 *     pedido); si cambió, se invalida sin mandar nada y hay que volver a preparar;
 *  4. se crea, se anota el nº en el acto, se lee de vuelta, se baja el PDF.
 */
export async function confirmarBorradorAprobado(borradorId: string) {
    const b = await prisma.labOrderDraft.findUnique({ where: { id: borradorId }, select: { id: true, status: true, orderId: true, pair: true, payload: true, resumenPortal: true, approvedBy: true } });
    if (!b) throw new Error('El borrador no existe.');
    if (b.status === 'CARGADO') return b;
    if (b.status !== 'APROBADO') throw new Error(`El borrador está ${b.status}: el robot solo carga los APROBADOS.`);
    const rastro0 = (b.resumenPortal || {}) as RastroGO;
    if (!rastro0.payloadPortal || !rastro0.resuelto) throw new Error('El borrador no tiene el pedido preparado: hay que volver a prepararlo.');
    const guardado = b.payload as unknown as PayloadBorradorGO;
    const payloadAprobado = rastro0.payloadPortal;
    const codigoVenta = `#${b.orderId.slice(-4).toUpperCase()}`;

    // Fuera de producción no se crea nada real: se corta antes de entrar al portal.
    if (!rastro0.numeroCreado && !puedeCrearPedidosReales()) {
        const motivo = 'Este servidor no es producción: no crea pedidos reales en el laboratorio (para probar a propósito: SMARTLAB_PERMITIR_CARGA=1). No se mandó nada';
        await Borradores.anotarFalla(b.id, `${motivo}.`).catch(() => null);
        throw new Error(motivo);
    }

    try {
        const resultado = await enElPortal(() => conSesionSmartLab(async (page) => {
            // 1. Releer adentro del turno.
            const actual = await prisma.labOrderDraft.findUnique({ where: { id: b.id }, select: { status: true, resumenPortal: true } });
            if (actual?.status === 'CARGADO') throw new YaCargadoError();
            if (actual?.status !== 'APROBADO') throw new Error(`El borrador pasó a ${actual?.status} mientras tanto.`);
            let numero = ((actual.resumenPortal || {}) as RastroGO).numeroCreado ?? null;
            let adoptado = false;

            if (!numero) {
                // 2. ¿Ya existe ese pedido en el portal?
                const pares = (guardado.plan?.codigoOptica || '').match(/\b([12])°par\b/) ? b.pair : null;
                numero = await buscarPedidoYaCreado(page, codigoVenta, pares, await numerosDeOtrosPares(b.orderId, b.pair));
                adoptado = !!numero;
            }
            if (!numero) {
                // 3. ¿La venta de hoy sigue dando EXACTAMENTE lo aprobado?
                const r = await planActual(b.orderId, b.pair, guardado.opciones);
                if (!r.ok) throw new AprobacionInvalidaError(`La venta ya no arma el pedido (${r.faltantes.join(' · ')}): volvé a prepararlo.`);
                if (rastro0.huella && huellaDelPlan(r.plan) !== rastro0.huella) {
                    throw new AprobacionInvalidaError(`Cambió el producto de la venta después de aprobar (ahora: ${r.plan.producto}): volvé a prepararlo para revisar el pedido nuevo. No se mandó nada.`);
                }
                const cambios = cambiosEntrePayloads(payloadAprobado, payloadCreateUpdate(r.plan, rastro0.resuelto!));
                if (cambios.length) throw new AprobacionInvalidaError(`La venta cambió después de aprobar (${cambios.join(', ')}): volvé a prepararlo para revisar el pedido nuevo. No se mandó nada.`);
                // 4. Crear.
                numero = (await crearPedidoEnPortal(page, payloadAprobado)).numero;
            }
            // Anotado en el acto: de acá en más un reintento no vuelve a crear.
            await mezclar(b.id, { numeroCreado: numero, portalDraftId: numero, ...(adoptado ? { adoptadoDelPortal: true } : {}) } as RastroGO);
            const guardadoPortal = await leerPedido(page, numero).catch(() => null);
            const diferencias = adoptado
                ? ['el pedido ya estaba en el portal (cargado antes, a mano o por un intento anterior): se tomó ese nº sin crear otro; revisá que coincida con la venta']
                : guardadoPortal ? diferenciasConLoAprobado(guardadoPortal, payloadAprobado as any) : ['no se pudo leer el pedido guardado para comprobarlo'];
            const pdf = await bajarPdfDelPedido(page, numero);
            return { numero, diferencias, pdf };
        }));

        const pdfUrl = resultado.pdf ? await guardarPdf(b.id, resultado.numero, resultado.pdf).catch(() => null) : null;
        await mezclar(b.id, { pdfUrl: pdfUrl ?? undefined, diferencias: resultado.diferencias });
        if (resultado.diferencias.length) {
            await logAudit({
                userId: null, userName: ROBOT_GRUPO_OPTICO, action: 'UPDATE', entityType: 'LAB_ORDER_DRAFT', entityId: b.id,
                details: { lab: LAB_GRUPO_OPTICO, numero: resultado.numero, diferencias: resultado.diferencias },
            }).catch(() => null);
        }

        // Primero la venta (nº, estado, aviso al cliente), después el borrador.
        const aprobadoPor = b.approvedBy ? { id: rastro0.aprobadoPorId ?? null, name: b.approvedBy } : null;
        await aplicarEstadoEnVenta({
            orderId: b.orderId, lab: LAB_GRUPO_OPTICO, nombreLab: NOMBRE_GRUPO_OPTICO, robot: ROBOT_GRUPO_OPTICO,
            pedidos: [{ portalNumber: resultado.numero, status: 'INGRESADO', statusRaw: 'Pedido en proceso de validación' }],
            aprobadoPor,
        });
        const cargado = await Borradores.cargado(b.id, ROBOT_ACTOR_GRUPO_OPTICO, { portalNumber: resultado.numero, screenshotFinalUrl: pdfUrl });
        if (resultado.diferencias.length) {
            await Borradores.anotarFalla(b.id, `Cargado con el nº ${resultado.numero}, pero: ${resultado.diferencias.join(' · ')}.`);
        }
        return cargado;
    } catch (err: any) {
        if (err instanceof YaCargadoError) return prisma.labOrderDraft.findUniqueOrThrow({ where: { id: b.id } });
        if (err instanceof AprobacionInvalidaError) {
            await Borradores.invalidarSinPedido(b.id, ROBOT_ACTOR_GRUPO_OPTICO, err.message);
            throw err;
        }
        const motivo = (err?.message || String(err)).replace(/\.+$/, '');
        // Solo si sigue APROBADO: un error después de cargar no puede pisar el CARGADO.
        await prisma.labOrderDraft.updateMany({
            where: { id: b.id, status: 'APROBADO' },
            data: { error: `No se pudo cargar en el portal: ${motivo}. Reintentar desde la ficha (nunca se duplica: el robot busca el pedido antes de crearlo).` },
        }).catch(e => console.error('[lab-modulos] no se pudo anotar la falla del borrador GO:', e));
        throw err;
    }
}
