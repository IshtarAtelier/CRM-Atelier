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
    'rightEyeArticle', 'rightEyeFarSpherical', 'rightEyeFarCylindrical', 'rightEyeFarAxis', 'rightEyeAddition', 'rightEyeInterpupillaryDistance', 'rightEyePupillaryHeight',
    'leftEyeArticle', 'leftEyeFarSpherical', 'leftEyeFarCylindrical', 'leftEyeFarAxis', 'leftEyeAddition', 'leftEyeInterpupillaryDistance', 'leftEyePupillaryHeight',
    'tintedId', 'tintedColor', 'tintedIntensity', 'frameType', 'typeRimArticleId', 'bridge', 'bridgeA', 'bridgeB', 'bridgeED', 'frameShape', 'opticsCode', 'opticsComment',
] as const;

export function cambiosEntrePayloads(aprobado: Record<string, unknown>, actual: Record<string, unknown>): string[] {
    return CAMPOS_QUE_SE_APRUEBAN.filter(k => JSON.stringify(aprobado[k] ?? null) !== JSON.stringify(actual[k] ?? null));
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
            resumenPortal: { etiquetas, resuelto, payloadPortal, preparadoEl: new Date().toISOString() } as RastroGO,
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

/**
 * APROBADO → CARGADO. Reintentable: desde APROBADO nunca va a ERROR (el portal
 * puede haber creado el pedido). Si la venta cambió desde que se preparó,
 * vuelve a revisión sin mandar nada.
 */
export async function confirmarBorradorAprobado(borradorId: string) {
    const b = await prisma.labOrderDraft.findUnique({ where: { id: borradorId }, select: { id: true, status: true, orderId: true, pair: true, payload: true, resumenPortal: true, approvedBy: true, approvedAt: true } });
    if (!b) throw new Error('El borrador no existe.');
    if (b.status !== 'APROBADO') throw new Error(`El borrador está ${b.status}: el robot solo carga los APROBADOS.`);
    const rastro = (b.resumenPortal || {}) as RastroGO;
    if (!rastro.payloadPortal || !rastro.resuelto) throw new Error('El borrador no tiene el pedido preparado: hay que volver a prepararlo.');
    const guardado = b.payload as unknown as PayloadBorradorGO;
    const aprobadoPor = b.approvedBy ? { id: rastro.aprobadoPorId ?? null, name: b.approvedBy } : null;
    const payloadAprobado = rastro.payloadPortal;

    try {
        let numero = rastro.numeroCreado ?? null;
        // Fuera de producción no se crea nada real: se corta antes de entrar al portal.
        if (!numero && !puedeCrearPedidosReales()) {
            throw new Error('Este servidor no es producción: no crea pedidos reales en el laboratorio (para probar a propósito: SMARTLAB_PERMITIR_CARGA=1). No se mandó nada');
        }
        if (!numero) {
            // La venta de hoy tiene que dar EXACTAMENTE lo que se aprobó.
            const r = await planActual(b.orderId, b.pair, guardado.opciones);
            const cambios = r.ok ? cambiosEntrePayloads(payloadAprobado, payloadCreateUpdate(r.plan, rastro.resuelto)) : ['la venta ya no arma el pedido'];
            if (cambios.length) {
                await Borradores.volverARevision(b.id, ROBOT_ACTOR_GRUPO_OPTICO, {
                    screenshotUrl: '',
                    resumenPortal: { ...rastro, ...(r.ok ? { payloadPortal: payloadCreateUpdate(r.plan, rastro.resuelto) } : {}) } as RastroGO,
                    motivo: `La venta cambió después de preparar el pedido (${cambios.join(', ')}): hay que volver a revisarlo.`,
                });
                throw new Error('La venta cambió después de preparar el pedido: volvió a "Para revisar" sin mandar nada.');
            }
        }

        const resultado = await enElPortal(() => conSesionSmartLab(async (page) => {
            if (!numero) {
                // ¿Ya lo creó un intento anterior que se cortó?
                const desde = b.approvedAt ?? new Date(Date.now() - 24 * 3600_000);
                numero = await buscarPedidoYaCreado(page, String(payloadAprobado.opticsCode), desde);
                if (!numero) {
                    numero = (await crearPedidoEnPortal(page, payloadAprobado)).numero;
                }
                // Anotado en el acto: de acá en más un reintento no vuelve a crear.
                await mezclar(b.id, { numeroCreado: numero, portalDraftId: numero });
            }
            const guardadoPortal = await leerPedido(page, numero).catch(() => null);
            const diferencias = guardadoPortal ? diferenciasConLoAprobado(guardadoPortal, payloadAprobado as any) : ['no se pudo leer el pedido guardado para comprobarlo'];
            const pdf = await bajarPdfDelPedido(page, numero);
            return { numero: numero!, diferencias, pdf };
        }));

        const pdfUrl = resultado.pdf ? await guardarPdf(b.id, resultado.numero, resultado.pdf).catch(() => null) : null;
        await mezclar(b.id, { pdfUrl: pdfUrl ?? undefined, diferencias: resultado.diferencias });
        if (resultado.diferencias.length) {
            // El pedido EXISTE en el laboratorio: no se deshace nada, se avisa.
            await logAudit({
                userId: null, userName: ROBOT_GRUPO_OPTICO, action: 'UPDATE', entityType: 'LAB_ORDER_DRAFT', entityId: b.id,
                details: { lab: LAB_GRUPO_OPTICO, numero: resultado.numero, diferencias: resultado.diferencias },
            }).catch(() => null);
        }

        // Primero la venta (nº, estado, aviso al cliente), después el borrador.
        await aplicarEstadoEnVenta({
            orderId: b.orderId, lab: LAB_GRUPO_OPTICO, nombreLab: NOMBRE_GRUPO_OPTICO, robot: ROBOT_GRUPO_OPTICO,
            pedidos: [{ portalNumber: resultado.numero, status: 'INGRESADO', statusRaw: 'Pedido en proceso de validación' }],
            aprobadoPor,
        });
        const cargado = await Borradores.cargado(b.id, ROBOT_ACTOR_GRUPO_OPTICO, { portalNumber: resultado.numero, screenshotFinalUrl: pdfUrl });
        if (resultado.diferencias.length) {
            await Borradores.anotarFalla(b.id, `Cargado con el nº ${resultado.numero}, pero el portal guardó algo distinto de lo aprobado: ${resultado.diferencias.join(' · ')}. Revisalo con el laboratorio.`);
        }
        return cargado;
    } catch (err: any) {
        const motivo = err?.message || String(err);
        if (!/volvió a "Para revisar"/.test(motivo)) {
            await Borradores.anotarFalla(b.id, `No se pudo cargar en el portal: ${motivo.replace(/\.+$/, '')}. Reintentar desde la ficha (nunca se duplica: el robot busca el pedido antes de crearlo).`)
                .catch(e => console.error('[lab-modulos] no se pudo anotar la falla del borrador GO:', e));
        }
        throw err;
    }
}
