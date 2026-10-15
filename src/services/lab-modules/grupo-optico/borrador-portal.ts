import { prisma } from '../../../lib/db';
import { uploadFile } from '../../../lib/storage';
import { logAudit } from '../../../lib/audit';
import type { Actor } from '../../../lib/actor';
import { Borradores, type RastroPortal } from '../carga/borrador';
import { aplicarEstadoEnVenta } from '../estados';
import { conTurno } from '../portal/turno';
import { conSesionSmartLab, LAB_GRUPO_OPTICO, NOMBRE_GRUPO_OPTICO, ROBOT_GRUPO_OPTICO } from './portal';
import { payloadCreateUpdate, planDeCarga, type OpcionesCarga, type PlanDeCarga, type ResueltoEnPortal } from './carga';
import { bajarPdfDelPedido, buscarPedidoYaCreado, crearPedidoEnPortal, diferenciasConLoAprobado, leerPedido, PedidoAmbiguoError, PedidoRechazadoError, pruebaDeQueNoSeCreo, puedeCrearPedidosReales, resolverEnPortal, type Etiquetas } from './robot';
import { leerVentaParaCargaGO } from './venta';
import { ADOPTAR_DEL_PORTAL, capturarPedidoCreado, capturarVistaEnPortal, diferenciasDeVista } from './vista';
import { esNumeroSmartLab, pedidoExistenteDelPar } from './existentes';
import { numerosDeLaVenta, numerosDeOtrosPares as numerosAjenosAlPar } from '../carga/numeros';
import { numeroDelParConCargo } from './origen';
import { decidirConAprobado } from './decision';
import { codigoCortoDeVenta } from '../../../lib/laboratorios/identidad';
import { registrarExtraNoCobrado } from '../carga/extras-no-cobrados';
import { rolesDel2x1 } from './carga';
import { cantidadDeArmazones } from '../../../lib/order-frames';
import type { EstadoEnPortal } from '../contrato';

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
    plan: Pick<PlanDeCarga, 'par' | 'producto' | 'lensTypeId' | 'od' | 'oi' | 'tenido' | 'codigoOptica' | 'observacion' | 'armazon' | 'rol2x1' | 'pedidoOrigen' | 'extrasNoCobrados' | 'pares'>;
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
    /** Cuándo salió el POST de creación (antes de saber la respuesta). Se borra si el portal contestó. */
    envioIniciadoEl?: string | null;
    /** En qué anda el robot (mueve `updatedAt`: así el cron de colgados no lo da por muerto mientras trabaja). */
    etapa?: string;
}

const ESPERA_TURNO_MS = 4 * 60_000;
/** Tras un POST sin respuesta, cuánto esperar antes de volver a crear (el portal puede guardarlo tarde). */
const ESPERA_TRAS_ENVIO_INCIERTO_MS = 15 * 60_000;

async function enElPortal<T>(tarea: () => Promise<T>): Promise<T> {
    const r = await conTurno(LAB_GRUPO_OPTICO, 'robot', tarea, { esperar: true, esperaMaxMs: ESPERA_TURNO_MS, obligatorio: true });
    if (r && typeof r === 'object' && 'skipped' in (r as any) && (r as any).skipped) {
        throw new Error(`El portal de ${NOMBRE_GRUPO_OPTICO} está ocupado por otra pasada; volvé a intentar en unos minutos.`);
    }
    return r as T;
}

/** Anota en el rastro del borrador, atómico en la base (Borradores.anotarRastro). */
async function mezclar(id: string, datos: RastroGO) {
    await Borradores.anotarRastro(id, datos);
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

/**
 * Ficha del cliente, AuditLog y aviso a la dueña por lo que se cargó SIN estar
 * cobrado (Essential), firmado por quien lo pidió y quien lo aprobó (regla de
 * Ishtar, 8/10/2026). Idempotente: si ya está en la ficha, no repite.
 */
async function avisarExtrasNoCobrados(b: { id: string; orderId: string; pair: number; payload: unknown; preparedBy: string | null; approvedBy: string | null }, rastro: RastroGO, numero: string | null) {
    const guardado = b.payload as unknown as PayloadBorradorGO;
    for (const extra of guardado.plan?.extrasNoCobrados || []) {
        const firma = { id: rastro.preparadoPorId ?? rastro.aprobadoPorId ?? null, name: b.preparedBy || b.approvedBy || 'Equipo', role: null };
        const quien = b.preparedBy && b.approvedBy && b.preparedBy !== b.approvedBy ? `${b.preparedBy} (aprobó ${b.approvedBy})` : (b.preparedBy || b.approvedBy || 'Equipo');
        await registrarExtraNoCobrado({ orderId: b.orderId, nombreLab: NOMBRE_GRUPO_OPTICO, pair: b.pair, pares: guardado.plan.pares ?? 1, extra, actor: firma, quien, loQueSeCarga: `${guardado.plan.producto} + ${extra.nombre}${numero ? ` · pedido nº ${numero}` : ''}` })
            .catch(err => console.error('[lab-modulos] no se pudo registrar el extra no cobrado:', err));
    }
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
    // Como robot del borrador (late cada 2 min): mientras prepara no se puede
    // anular "colgado" encima (auditoría de arquitectura 3).
    return Borradores.conRobot(b.id, `preparando desde ${new Date().toISOString()}`, async () => {
    try {
        const r = await planActual(b.orderId, b.pair, guardado.opciones);
        if (!r.ok) throw new Error(`Faltan datos: ${r.faltantes.join(' · ')}`);
        // Una sola entrada al portal: leer sus listas, armar el pedido y abrirlo
        // en SU formulario para sacar la captura que la persona va a revisar.
        await mezclar(b.id, { etapa: `esperando turno y entrando al portal desde ${new Date().toISOString()}` }).catch(() => null);
        const { resuelto, etiquetas, payloadPortal, captura } = await enElPortal(() => conSesionSmartLab(async (page) => {
            await mezclar(b.id, { etapa: `en el portal desde ${new Date().toISOString()}` }).catch(() => null);
            const { resuelto, etiquetas } = await resolverEnPortal(page, r.plan);
            const payloadPortal = payloadCreateUpdate(r.plan, resuelto);
            const vista = await capturarVistaEnPortal(page, payloadPortal, etiquetas);
            // Lo que el formulario decide solo (la base) se manda como lo muestra.
            for (const k of ADOPTAR_DEL_PORTAL) payloadPortal[k] = vista.payloadDelPortal[k] ?? null;
            const dif = diferenciasDeVista(payloadPortal, vista.payloadDelPortal);
            // Lo que se muestra tiene que ser lo que se manda: si el formulario del
            // portal armaría otra cosa, no hay nada para aprobar.
            if (dif.length) throw new Error(`el formulario del portal no coincide con el pedido armado (${dif.join(' · ')}). No se creó nada.`);
            return { resuelto, etiquetas, payloadPortal, captura: vista.captura };
        }));
        const screenshotUrl = await guardarCaptura(b.id, 'revision', captura);
        return await Borradores.enRevision(b.id, ROBOT_ACTOR_GRUPO_OPTICO, {
            screenshotUrl,
            resumenPortal: { etiquetas, resuelto, payloadPortal, huella: huellaDelPlan(r.plan), preparadoEl: new Date().toISOString() } as RastroGO,
        });
    } catch (err: any) {
        const motivo = err?.message || String(err);
        await Borradores.error(b.id, ROBOT_ACTOR_GRUPO_OPTICO, motivo).catch(e => console.error('[lab-modulos] no se pudo marcar el error del borrador GO:', e));
        throw err;
    }
    }, { enEstado: ['PREPARADO'] });
}

async function guardarCaptura(borradorId: string, sufijo: string, png: Buffer): Promise<string> {
    // Receta y datos del cliente: clave que /api/storage/view trata como sensible (exige sesión).
    const key = await uploadFile(png, `lab-modulos/grupo-optico/${borradorId}-${sufijo}-${Date.now()}.png`, 'image/png');
    return `/api/storage/view?key=${encodeURIComponent(key)}`;
}

async function guardarPdf(borradorId: string, numero: string, pdf: Buffer): Promise<string> {
    // Receta y datos del cliente: clave que /api/storage/view trata como sensible (exige sesión).
    const key = await uploadFile(pdf, `lab-modulos/grupo-optico/${borradorId}-pedido-${numero}.pdf`, 'application/pdf');
    return `/api/storage/view?key=${encodeURIComponent(key)}`;
}

/** La aprobación ya no vale y en el portal NO hay pedido: se invalida (ERROR) sin mandar nada. */
class AdopcionNoVerificadaError extends Error { constructor(m: string) { super(m); this.name = 'AdopcionNoVerificadaError'; } }
class AprobacionInvalidaError extends Error {
    constructor(motivo: string) { super(motivo); this.name = 'AprobacionInvalidaError'; }
}

/** Ya estaba CARGADO cuando el robot entró (otro intento lo terminó): no se hace nada. */
class YaCargadoError extends Error {
    constructor() { super('ya cargado'); this.name = 'YaCargadoError'; }
}

/** Los nº de pedido que ya son de OTRO par de esta venta (para no adoptarlos como de este): el lector único de números. */
async function numerosDeOtrosPares(orderId: string, pair: number): Promise<Set<string>> {
    return numerosAjenosAlPar(await numerosDeLaVenta(LAB_GRUPO_OPTICO, orderId, { esNumeroDelLab: esNumeroSmartLab }), pair);
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
export async function confirmarBorradorAprobado(borradorId: string, opts: { robot?: string | null } = {}) {
    const b = await prisma.labOrderDraft.findUnique({ where: { id: borradorId }, select: { id: true, status: true, orderId: true, pair: true, payload: true, resumenPortal: true, approvedBy: true, preparedBy: true, portalNumber: true } });
    if (!b) throw new Error('El borrador no existe.');
    if (b.status === 'CARGADO') {
        // Un reintento sobre un CARGADO: si el aviso del extra no cobrado se había
        // perdido (la mensajería falló), se vuelve a intentar; es idempotente.
        await avisarExtrasNoCobrados(b, (b.resumenPortal || {}) as RastroGO, b.portalNumber ?? null);
        return prisma.labOrderDraft.findUniqueOrThrow({ where: { id: b.id } });
    }
    if (b.status !== 'APROBADO') throw new Error(`El borrador está ${b.status}: el robot solo carga los APROBADOS.`);
    const rastro0 = (b.resumenPortal || {}) as RastroGO;
    if (!rastro0.payloadPortal || !rastro0.resuelto) {
        const motivo = 'El borrador no tiene el pedido preparado: hay que volver a prepararlo (anulalo y preparalo de nuevo).';
        await Borradores.anotarFalla(b.id, motivo, { soloSi: 'APROBADO' }).catch(() => null);
        throw new Error(motivo);
    }
    const guardado = b.payload as unknown as PayloadBorradorGO;
    const payloadAprobado = rastro0.payloadPortal;
    const codigoVenta = codigoCortoDeVenta(b.orderId);

    // Como robot del borrador: late mientras trabaja y solo se apaga a sí mismo.
    return Borradores.conRobot(b.id, `cargando en el portal desde ${new Date().toISOString()}`, async (robot) => {
    // Fuera de producción no se crea nada real: se corta antes de entrar al portal.
    if (!rastro0.numeroCreado && !puedeCrearPedidosReales()) {
        const motivo = 'Este servidor no es producción: no crea pedidos reales en el laboratorio (para probar a propósito: SMARTLAB_PERMITIR_CARGA=1). No se mandó nada';
        await Borradores.anotarFalla(b.id, `${motivo}.`, { robot }).catch(() => null);
        throw new Error(motivo);
    }

    try {
        const resultado = await enElPortal(() => conSesionSmartLab(async (page) => {
            // 1. Releer adentro del turno.
            const actual = await prisma.labOrderDraft.findUnique({ where: { id: b.id }, select: { status: true, resumenPortal: true } });
            if (actual?.status === 'CARGADO') throw new YaCargadoError();
            if (actual?.status !== 'APROBADO') throw new Error(`El borrador pasó a ${actual?.status} mientras tanto.`);
            const rastroActual = (actual.resumenPortal || {}) as RastroGO;

            // 2. Qué hacer con lo que YA hay (decisión pura, `decision.ts`): el nº que
            //    este borrador creó, el pedido que el par recibió por otro camino
            //    (carga a mano, seguimiento) o el que está en el portal con el
            //    código de la venta; un envío reciente sin respuesta espera.
            const ventaHoy = await leerVentaParaCargaGO(b.orderId);
            const pares = cantidadDeArmazones(ventaHoy as any);
            const existente = rastroActual.numeroCreado ? null : await pedidoExistenteDelPar(b.orderId, b.pair, pares);
            const datos = { pair: b.pair, numeroCreado: rastroActual.numeroCreado ?? null, existente, envioIniciadoEl: rastroActual.envioIniciadoEl ?? null, esperaMs: ESPERA_TRAS_ENVIO_INCIERTO_MS };
            let decision = decidirConAprobado(datos);
            if (decision.accion === 'BUSCAR_EN_PORTAL') {
                const numeroEnPortal = await buscarPedidoYaCreado(page, codigoVenta, pares > 1 ? b.pair : null, await numerosDeOtrosPares(b.orderId, b.pair), ventaHoy?.client?.name ?? null);
                decision = decidirConAprobado({ ...datos, numeroEnPortal });
            }
            if (decision.accion === 'INVALIDAR') throw new AprobacionInvalidaError(decision.motivo);
            if (decision.accion === 'ESPERAR') throw new Error(decision.motivo);
            if (decision.accion === 'BUSCAR_EN_PORTAL') throw new Error('la decisión pidió buscar en el portal dos veces (no debería pasar)');
            const adoptado = decision.accion === 'VERIFICAR';
            const adoptadoDe = decision.accion === 'VERIFICAR' ? decision.adoptadoDe : null;
            let numero: string;
            if (decision.accion !== 'CREAR') {
                numero = decision.numero;
            } else {
                // 3. ¿La venta de hoy sigue dando EXACTAMENTE lo aprobado?
                const r = await planActual(b.orderId, b.pair, guardado.opciones);
                if (!r.ok) throw new AprobacionInvalidaError(`La venta ya no arma el pedido (${r.faltantes.join(' · ')}): volvé a prepararlo.`);
                if (rastro0.huella && huellaDelPlan(r.plan) !== rastro0.huella) {
                    throw new AprobacionInvalidaError(`Cambió el producto de la venta después de aprobar (ahora: ${r.plan.producto}): volvé a prepararlo para revisar el pedido nuevo. No se mandó nada.`);
                }
                const cambios = cambiosEntrePayloads(payloadAprobado, payloadCreateUpdate(r.plan, rastro0.resuelto!));
                if (cambios.length) throw new AprobacionInvalidaError(`La venta cambió después de aprobar (${cambios.join(', ')}): volvé a prepararlo para revisar el pedido nuevo. No se mandó nada.`);
                // Y el PORTAL tiene que seguir resolviendo los mismos ids (artículos,
                // material, color, aro): un borrador de días con listas que rotaron
                // fabricaría otra cosa con el nº correcto (auditoría de robustez, M5).
                const hoyEnPortal = await resolverEnPortal(page, r.plan);
                const idsCambiados = (['materialId', 'colorId', 'brandId', 'articuloOD', 'articuloOI', 'typeRimArticleId'] as const).filter(k => String((hoyEnPortal.resuelto as any)[k] ?? '') !== String((rastro0.resuelto as any)?.[k] ?? ''));
                if (idsCambiados.length || JSON.stringify(hoyEnPortal.resuelto.tinted ?? null) !== JSON.stringify(rastro0.resuelto?.tinted ?? null)) {
                    throw new AprobacionInvalidaError(`El portal ya no ofrece los mismos artículos que se aprobaron (${[...idsCambiados, ...(idsCambiados.length ? [] : ['teñido'])].join(', ')}): volvé a prepararlo. No se mandó nada.`);
                }
                // Par sin cargo: el nº del par con cargo que va en la observación tiene
                // que ser el de HOY (el 1er par pudo anularse y recargarse mientras
                // este borrador esperaba; auditoría 5, 8/10/2026).
                if (r.plan.rol2x1 === 'SIN_CARGO') {
                    const roles = rolesDel2x1((await leerVentaParaCargaGO(b.orderId)) as any);
                    const hoy = roles ? await numeroDelParConCargo(b.orderId, roles.conCargo) : null;
                    if (hoy !== r.plan.pedidoOrigen) throw new AprobacionInvalidaError(`El nº del par con cargo cambió (el borrador decía ${r.plan.pedidoOrigen ?? '—'}; hoy ${hoy ?? 'no hay ninguno válido'}): volvé a prepararlo. No se mandó nada.`);
                }
                // 4. Crear: se anota ANTES que salió el envío, y el nº apenas vuelve.
                // La barrera (atómica en la base): "voy a mandar" solo se anota si el
                // borrador SIGUE aprobado, sin nº y sin otro envío reciente. Si una
                // persona lo anuló mientras el robot buscaba en el portal, o si otro
                // robot ya mandó, acá se frena y no se crea nada (auditorías de
                // robustez 2 y 3, A1).
                const sigueAprobado = await Borradores.marcarEnvio(b.id, { esperaMs: ESPERA_TRAS_ENVIO_INCIERTO_MS });
                if (!sigueAprobado) throw new YaCargadoError();
                let creado: string;
                try {
                    creado = (await crearPedidoEnPortal(page, payloadAprobado)).numero;
                } catch (e) {
                    // Solo lo que PRUEBA que no se creó nada limpia el envío iniciado
                    // (`pruebaDeQueNoSeCreo`): con un 5xx o un timeout el envío sigue
                    // incierto y el reintento mira el listado antes de crear otro.
                    if (pruebaDeQueNoSeCreo(e)) await mezclar(b.id, { envioIniciadoEl: null }).catch(() => null);
                    throw e;
                }
                numero = creado;
            }
            // Un nº ADOPTADO (no creado por este envío) se verifica contra el portal
            // antes de anotarlo: tiene que ser un pedido de ESTA venta (código de
            // venta en su código interno). Un dedazo en la venta no se adopta.
            if (adoptado) {
                const fila = await leerPedido(page, numero).catch(() => null);
                const anulado = String((fila as any)?.Anulado ?? (fila as any)?.anulado ?? '0') === '1';
                const codigoDeLaFila = String((fila as any)?.CodigoOptica ?? (fila as any)?.opticsCode ?? '').toUpperCase();
                // Desde la venta (el nº lo tipeó una persona o lo vinculó el seguimiento):
                // alcanza con que exista y no esté anulado — lo cargado a mano no suele
                // llevar "#XXXX". Desde el listado del portal: además el código de la venta.
                if (!fila || anulado) throw new AdopcionNoVerificadaError(`el nº ${numero} que la venta tiene para este par ${!fila ? 'no existe' : 'está ANULADO'} en el portal: corregí el nº en la venta y reintentá. No se creó nada`);
                if (adoptadoDe === 'portal' && !codigoDeLaFila.includes(codigoVenta.toUpperCase())) throw new AdopcionNoVerificadaError(`el pedido ${numero} del portal no lleva el código ${codigoVenta}: no se adopta ni se crea otro. Revisalo en el portal`);
            }
            // Anotado en el acto: de acá en más un reintento no vuelve a crear.
            await mezclar(b.id, { numeroCreado: numero, portalDraftId: numero, ...(adoptado ? { adoptadoDelPortal: true } : {}) } as RastroGO);
            const guardadoPortal = await leerPedido(page, numero).catch(() => null);
            const comparado = guardadoPortal ? diferenciasConLoAprobado(guardadoPortal, payloadAprobado as any) : ['no se pudo leer el pedido guardado para comprobarlo'];
            const diferencias = adoptado
                ? [`el pedido ya estaba en el portal (cargado antes, a mano o por un intento anterior): se tomó ese nº sin crear otro${comparado.length ? `, y NO coincide con lo aprobado (${comparado.join('; ')}): hablá con Grupo Óptico` : ''}`]
                : comparado;
            const pdf = await bajarPdfDelPedido(page, numero);
            // La pantalla real del pedido YA creado, para verlo como quedó en el laboratorio.
            const capturaFinal = await capturarPedidoCreado(page, numero);
            return { numero, diferencias, pdf, capturaFinal };
        }));

        const pdfUrl = resultado.pdf ? await guardarPdf(b.id, resultado.numero, resultado.pdf).catch(() => null) : null;
        const capturaFinalUrl = resultado.capturaFinal ? await guardarCaptura(b.id, 'cargado', resultado.capturaFinal).catch(() => null) : null;
        await mezclar(b.id, { pdfUrl: pdfUrl ?? undefined, diferencias: resultado.diferencias });
        if (resultado.diferencias.length) {
            await logAudit({
                userId: null, userName: ROBOT_GRUPO_OPTICO, action: 'UPDATE', entityType: 'LAB_ORDER_DRAFT', entityId: b.id,
                details: { lab: LAB_GRUPO_OPTICO, numero: resultado.numero, diferencias: resultado.diferencias },
            }).catch(() => null);
        }

        // Primero la venta (nº, estado, aviso al cliente), después el borrador.
        const aprobadoPor = b.approvedBy ? { id: rastro0.aprobadoPorId ?? null, name: b.approvedBy } : null;
        // Con TODOS los pedidos de la venta (el del otro par incluido): si no, al
        // cargar el 2º par el historial diría "falta el pedido del otro par".
        const [espejo, otros] = await Promise.all([
            prisma.labPortalOrder.findMany({ where: { orderId: b.orderId, lab: LAB_GRUPO_OPTICO }, select: { portalNumber: true, status: true, statusRaw: true } }),
            prisma.labOrderDraft.findMany({ where: { orderId: b.orderId, lab: LAB_GRUPO_OPTICO, status: 'CARGADO', id: { not: b.id } }, select: { portalNumber: true } }),
        ]);
        const pedidos = new Map<string, { portalNumber: string; status: EstadoEnPortal; statusRaw: string }>();
        for (const e of espejo) pedidos.set(e.portalNumber, { portalNumber: e.portalNumber, status: e.status as EstadoEnPortal, statusRaw: e.statusRaw ?? '' });
        for (const o of otros) if (o.portalNumber && !pedidos.has(o.portalNumber)) pedidos.set(o.portalNumber, { portalNumber: o.portalNumber, status: 'INGRESADO', statusRaw: 'Pedido en proceso de validación' });
        if (!pedidos.has(resultado.numero)) pedidos.set(resultado.numero, { portalNumber: resultado.numero, status: 'INGRESADO', statusRaw: 'Pedido en proceso de validación' });
        await aplicarEstadoEnVenta({
            orderId: b.orderId, lab: LAB_GRUPO_OPTICO, nombreLab: NOMBRE_GRUPO_OPTICO, robot: ROBOT_GRUPO_OPTICO,
            pedidos: [...pedidos.values()],
            aprobadoPor,
        });
        const cargado = await Borradores.cargado(b.id, ROBOT_ACTOR_GRUPO_OPTICO, { portalNumber: resultado.numero, screenshotFinalUrl: capturaFinalUrl ?? pdfUrl });
        if (resultado.diferencias.length) {
            await Borradores.anotarFalla(b.id, `Cargado con el nº ${resultado.numero}, pero: ${resultado.diferencias.join(' · ')}.`, { soloSi: 'CARGADO' });
        }
        // Lo que se cargó SIN estar cobrado (Essential), ahora que existe de verdad.
        await avisarExtrasNoCobrados(b, rastro0, resultado.numero);
        return cargado;
    } catch (err: any) {
        if (err instanceof YaCargadoError) return prisma.labOrderDraft.findUniqueOrThrow({ where: { id: b.id } });
        if (err instanceof PedidoRechazadoError) {
            // El portal dijo que NO crea ese pedido (datos que no acepta): reintentar
            // mandaría lo mismo y daría lo mismo. La aprobación se invalida para que
            // se pueda corregir y preparar de nuevo (auditoría 4, I1).
            await Borradores.invalidarSinPedido(b.id, ROBOT_ACTOR_GRUPO_OPTICO, `El laboratorio no aceptó el pedido (${err.message}). No se creó nada: corregí la venta y volvé a prepararlo.`)
                .catch(e => console.error('[lab-modulos] no se pudo invalidar el borrador GO rechazado (queda APROBADO):', e));
            throw err;
        }
        const motivo = (err?.message || String(err)).replace(/\.+$/, '');
        const rastroAhora = await prisma.labOrderDraft.findUnique({ where: { id: b.id }, select: { resumenPortal: true } }).then(x => (x?.resumenPortal || {}) as RastroGO).catch(() => ({} as RastroGO));
        if ((err instanceof AprobacionInvalidaError || err instanceof PedidoAmbiguoError) && !rastroAhora.envioIniciadoEl && !rastroAhora.numeroCreado) {
            // No se creó nada (y ningún envío quedó sin respuesta): la aprobación ya
            // no vale y hay que mirar la venta de nuevo. Con un envío sin respuesta
            // no se afirma eso: queda APROBADO con el motivo y se reintenta.
            await Borradores.invalidarSinPedido(b.id, ROBOT_ACTOR_GRUPO_OPTICO, err.message)
                .catch(e => console.error('[lab-modulos] no se pudo invalidar el borrador GO (queda APROBADO):', e));
            throw err;
        }
        // Si el pedido YA existe (falló lo de después: anotar la venta, el PDF), decirlo
        // con todas las letras: "no se pudo cargar" invitaba a cargarlo a mano = duplicado.
        const texto = err instanceof AdopcionNoVerificadaError
            ? `${motivo}.`
            : rastroAhora.numeroCreado
            ? `El pedido YA está creado en el laboratorio con el nº ${rastroAhora.numeroCreado}; falta anotarlo en la venta (${motivo}). Reintentar desde la ficha: NO se crea otro, solo se termina de anotar. No lo cargues a mano.`
            : rastroAhora.envioIniciadoEl
                ? `El envío al portal quedó sin respuesta (${motivo}). Reintentar desde la ficha en unos minutos: el robot busca el pedido en el portal antes de crear otro. No lo cargues a mano.`
                : `No se pudo cargar en el portal: ${motivo}. Reintentar desde la ficha (nunca se duplica: el robot busca el pedido antes de crearlo).`;
        // Solo si sigue APROBADO y este sigue siendo SU robot: un error después de
        // cargar no puede pisar el CARGADO, ni un robot viejo al que lo reemplazó.
        await Borradores.anotarFalla(b.id, texto, { soloSi: 'APROBADO', robot })
            .catch(e => console.error('[lab-modulos] no se pudo anotar la falla del borrador GO:', e));
        throw err;
    }
    }, { heredar: opts.robot ?? null, enEstado: ['APROBADO'] });
}
