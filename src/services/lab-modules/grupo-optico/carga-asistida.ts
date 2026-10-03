import { prisma } from '../../../lib/db';
import { parseLabNumbers } from '../../../lib/lab-order-numbers';
import { cantidadDeArmazones, cristalesPorArmazon } from '../../../lib/order-frames';
import { Borradores } from '../carga/borrador';
import type { CargaAsistida } from '../carga/contrato';
import { esVenta2x1, planDeCarga, type OpcionesCarga, type TipoArmazon, type TipoAro } from './carga';
import { TIPO_ARMAZON, TIPO_ARO } from './catalogo';
import { confirmarBorradorAprobado, prepararEnPortal, ROBOT_ACTOR_GRUPO_OPTICO, type PayloadBorradorGO } from './borrador-portal';
import { LAB_GRUPO_OPTICO, NOMBRE_GRUPO_OPTICO } from './portal';
import { leerVentaParaCargaGO } from './venta';

/**
 * La carga asistida de Grupo Óptico detrás del contrato común.
 *
 * Lo que la persona elige al preparar es lo mínimo que la venta no sabe:
 * tipo de armazón (plástico o metálico) si la venta no lo dice, tipo de aro
 * (por defecto aro entero) y, opcional, la forma. Todo lo demás sale de la
 * venta. El 2º par de un 2x1 toma solo el nº del 1º ya cargado.
 */

const esCristalGO = (i: any) => /cristal/i.test(i.productCategorySnapshot || i.product?.category || '')
    && /grupo/i.test(i.laboratorySnapshot || i.product?.laboratory || '');

/** El nº del 1er par ya cargado: del borrador CARGADO, si no del espejo, si no de la venta. */
async function numeroDelPrimerPar(orderId: string): Promise<string | null> {
    const cargado = await prisma.labOrderDraft.findFirst({ where: { orderId, lab: LAB_GRUPO_OPTICO, pair: 1, status: 'CARGADO' }, orderBy: { loadedAt: 'desc' }, select: { portalNumber: true } });
    if (cargado?.portalNumber) return cargado.portalNumber;
    const espejo = await prisma.labPortalOrder.findFirst({ where: { orderId, lab: LAB_GRUPO_OPTICO, pair: 1 }, select: { portalNumber: true } });
    if (espejo?.portalNumber) return espejo.portalNumber;
    const venta = await prisma.order.findUnique({ where: { id: orderId }, select: { labOrderNumber: true } });
    const nums = parseLabNumbers(venta?.labOrderNumber).filter(n => /^80\d{6}$/.test(n));
    return nums.length === 1 ? nums[0] : null;
}

function opcionesDelBody(body: Record<string, unknown>): OpcionesCarga {
    const tipo = String(body.tipoArmazon || '').toUpperCase();
    const aro = String(body.tipoAro || '').toUpperCase();
    const forma = body.forma === undefined || body.forma === null || body.forma === '' ? null : Number(body.forma);
    return {
        tipoArmazon: (tipo in TIPO_ARMAZON ? tipo : null) as TipoArmazon | null,
        tipoAro: (aro in TIPO_ARO ? aro : null) as TipoAro | null,
        forma,
    };
}

export const CARGA_GRUPO_OPTICO: CargaAsistida = {
    lab: LAB_GRUPO_OPTICO,
    nombre: NOMBRE_GRUPO_OPTICO,
    robot: ROBOT_ACTOR_GRUPO_OPTICO,

    async analizar(orderId) {
        const venta = await leerVentaParaCargaGO(orderId);
        if (!venta) return null;
        const porPar = cristalesPorArmazon(venta);
        const pares = [...porPar.entries()].filter(([, items]) => (items as any[]).some(esCristalGO)).map(([p]) => p).sort();
        const es2x1 = esVenta2x1(venta as any);
        const origen = es2x1 ? await numeroDelPrimerPar(orderId) : null;
        return {
            es2x1,
            pares: pares.map(pair => {
                // Se analiza con las opciones "por defecto" para mostrar lo que FALTA en la venta;
                // lo que elige quien prepara (tipo de armazón) no cuenta como faltante.
                const r = planDeCarga(venta as any, pair, { tipoArmazon: 'PLASTICO', pedidoOrigen: pair === 2 ? (origen ?? '80000000') : null });
                const items = (porPar.get(pair) || []) as any[];
                return {
                    pair,
                    producto: items[0]?.product?.name ?? items[0]?.productNameSnapshot ?? null,
                    faltantes: r.ok ? [] : r.faltantes,
                    avisos: r.ok ? r.avisos : r.avisos,
                    // El 2º par del 2x1 espera al 1º.
                    esperaPrimerPar: es2x1 && pair === 2 && !origen,
                    pedidoOrigen: pair === 2 ? origen : null,
                };
            }),
            tiposArmazon: [{ value: 'PLASTICO', label: 'Plástico' }, { value: 'METALICO', label: 'Metálico' }],
            tiposAro: Object.entries(TIPO_ARO).map(([value, v]) => ({ value, label: v.etiqueta })),
            pares2x1: es2x1 ? cantidadDeArmazones(venta as any) : null,
        };
    },

    async preparar(orderId, pair, body, actor) {
        const venta = await leerVentaParaCargaGO(orderId);
        if (!venta) return { ok: false, status: 404, error: 'Venta no encontrada.' };
        if (venta.labStatus !== 'SENT') {
            return { ok: false, status: 409, error: `La venta tiene que estar enviada a fábrica antes de cargarla en el portal (hoy está ${venta.labStatus || 'sin enviar'}).` };
        }
        const opciones = opcionesDelBody(body);
        if (opciones.forma !== null && opciones.forma !== undefined && !(Number.isInteger(opciones.forma) && opciones.forma >= 1 && opciones.forma <= 9)) {
            return { ok: false, status: 400, error: 'La forma del armazón va de 1 a 9.' };
        }
        if (pair === 2 && esVenta2x1(venta as any)) opciones.pedidoOrigen = await numeroDelPrimerPar(orderId);

        // Antes de crear nada: ¿la venta arma el pedido? (sin portal)
        const r = planDeCarga(venta as any, pair, opciones);
        if (!r.ok) return { ok: false, status: 422, error: 'Faltan datos para armar el pedido.', faltantes: r.faltantes, avisos: r.avisos };

        const { plan } = r;
        const payload: PayloadBorradorGO = {
            opciones,
            plan: { par: plan.par, producto: plan.producto, lensTypeId: plan.lensTypeId, od: plan.od, oi: plan.oi, tenido: plan.tenido, codigoOptica: plan.codigoOptica, observacion: plan.observacion, armazon: plan.armazon },
            avisos: r.avisos,
        };
        const preparado = await Borradores.preparar({ lab: LAB_GRUPO_OPTICO, orderId, pair, payload, actor });
        try {
            const borrador = await prepararEnPortal(preparado.id);
            return { ok: true, status: 200, borrador, avisos: r.avisos };
        } catch (err: any) {
            return { ok: false, status: 502, error: `El robot no pudo preparar el pedido: ${err?.message || err}`, borradorId: preparado.id };
        }
    },

    confirmar: confirmarBorradorAprobado,
    // En SmartLab no hay borrador en el portal: un rechazo no deja nada que deshacer.
    despuesDeRechazar: async () => ({ cancelado: true, motivo: 'no se había mandado nada al portal' }),
};
