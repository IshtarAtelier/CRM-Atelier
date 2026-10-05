import { prisma } from '../../../lib/db';
import { parseLabNumbers } from '../../../lib/lab-order-numbers';
import { cantidadDeArmazones, cristalesPorArmazon } from '../../../lib/order-frames';
import { Borradores } from '../carga/borrador';
import type { BorradorParaVista, CampoDePreparacion, CargaAsistida, VistaDeBorrador } from '../carga/contrato';
import { esVenta2x1, planDeCarga, type OpcionesCarga, type TipoArmazon, type TipoAro } from './carga';
import { TIPO_ARMAZON, TIPO_ARO } from './catalogo';
import { confirmarBorradorAprobado, prepararEnPortal, ROBOT_ACTOR_GRUPO_OPTICO, type PayloadBorradorGO } from './borrador-portal';
import { LAB_GRUPO_OPTICO, NOMBRE_GRUPO_OPTICO } from './portal';
import { leerVentaParaCargaGO } from './venta';
import { mensajeExistente, pedidoExistenteDelPar, type PedidoExistente } from './existentes';

/**
 * La carga asistida de Grupo Óptico detrás del contrato común.
 *
 * Lo que la persona elige al preparar es lo mínimo que la venta no sabe:
 * tipo de armazón (plástico o metálico) si la venta no lo dice, tipo de aro
 * (por defecto aro entero) y, opcional, la forma. Todo lo demás sale de la
 * venta. El 2º par de un 2x1 toma solo el nº del 1º ya cargado.
 */

const texto = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());
const esCristalGO = (i: any) => /cristal/i.test(i.productCategorySnapshot || i.product?.category || '')
    && /grupo/i.test(i.laboratorySnapshot || i.product?.laboratory || '');

/** El nº del 1er par ya cargado: del borrador CARGADO, si no del espejo, si no de la venta. */
async function numeroDelPrimerPar(orderId: string): Promise<string | null> {
    const cargado = await prisma.labOrderDraft.findFirst({ where: { orderId, lab: LAB_GRUPO_OPTICO, pair: 1, status: 'CARGADO' }, orderBy: { loadedAt: 'desc' }, select: { portalNumber: true } });
    if (cargado?.portalNumber) return cargado.portalNumber;
    const espejo = await prisma.labPortalOrder.findMany({ where: { orderId, lab: LAB_GRUPO_OPTICO, pair: 1, status: { not: 'ANULADO' } }, orderBy: { enteredAt: 'asc' }, select: { portalNumber: true } });
    if (espejo.length === 1) return espejo[0].portalNumber;
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
        // La carga asistida va hasta 2 pares (un 3º se carga a mano).
        const pares = [...porPar.entries()].filter(([p, items]) => p <= 2 && (items as any[]).some(esCristalGO)).map(([p]) => p).sort();
        const totalPares = cantidadDeArmazones(venta as any);
        const yaCargados = new Map<number, PedidoExistente | null>();
        for (const p of pares) yaCargados.set(p, await pedidoExistenteDelPar(orderId, p, totalPares));
        const es2x1 = esVenta2x1(venta as any);
        const origen = es2x1 ? await numeroDelPrimerPar(orderId) : null;
        const campos: CampoDePreparacion[] = [
            { clave: 'tipoArmazon', etiqueta: 'Tipo de armazón', tipo: 'select', obligatorio: true, opciones: [{ value: 'PLASTICO', label: 'Plástico' }, { value: 'METALICO', label: 'Metálico' }] },
            { clave: 'tipoAro', etiqueta: 'Tipo de aro', tipo: 'select', obligatorio: true, porDefecto: 'ENTERO', opciones: Object.entries(TIPO_ARO).map(([value, v]) => ({ value, label: v.etiqueta })) },
            { clave: 'forma', etiqueta: 'Forma (opcional)', tipo: 'select', obligatorio: false, opciones: Array.from({ length: 9 }, (_, i) => ({ value: String(i + 1), label: `Forma ${i + 1}` })) },
        ];
        return {
            pares: pares.map(pair => {
                // Se analiza con opciones "por defecto" para mostrar lo que FALTA en la venta;
                // lo que elige quien prepara (tipo de armazón) no cuenta como faltante.
                const r = planDeCarga(venta as any, pair, { tipoArmazon: 'PLASTICO', pedidoOrigen: pair === 2 ? (origen ?? '80000000') : null });
                const items = (porPar.get(pair) || []) as any[];
                const existente = yaCargados.get(pair);
                const esStock = /^stock\b/i.test(texto(items[0]?.product?.name ?? items[0]?.productNameSnapshot).split('·')[0]);
                return {
                    pair,
                    titulo: items[0]?.product?.name ?? items[0]?.productNameSnapshot ?? null,
                    faltantes: r.ok ? [] : r.faltantes,
                    avisos: r.avisos,
                    // Stock: el portal no lleva forma del armazón; no se ofrece.
                    campos: esStock ? campos.filter(c => c.clave !== 'forma') : campos,
                    espera: es2x1 && pair === 2 && !origen ? 'Es el 2º par del 2x1: se prepara cuando el 1er par esté cargado (lleva su nº en la observación, para que el laboratorio no lo cobre).' : null,
                    yaCargado: existente ? mensajeExistente(existente, pair) : null,
                };
            }),
        };
    },

    vistaDeBorrador(b: BorradorParaVista): VistaDeBorrador {
        const plan = ((b.payload || {}) as PayloadBorradorGO).plan;
        const r = (b.resumenPortal || {}) as any;
        const e = r.etiquetas || {};
        const grad = (o: any) => o ? `${o.esferico}${o.cilindrico ? ` ${o.cilindrico} × ${o.eje}°` : ''}${o.adicion ? ` · add +${Number(o.adicion).toFixed(2)}` : ''} · DNP ${o.dnp ?? '—'} · altura ${o.altura ?? '—'}` : '—';
        return {
            textoRevision: 'Así queda el pedido en SmartLab (es la pantalla del portal, todavía sin guardar). Aprobar lo crea en el laboratorio, trae el nº y le avisa al cliente; después no se puede anular desde la óptica, solo pidiéndoselo a Grupo Óptico. Rechazar no manda nada.',
            filas: plan ? [
                { titulo: 'Vendido', valor: plan.producto },
                { titulo: 'Artículo OD', valor: e.articuloOD ?? '—', fuerte: true },
                { titulo: 'Artículo OI', valor: e.articuloOI ?? '—', fuerte: true },
                { titulo: 'Tipo · material', valor: `${e.tipoLente ?? '—'} · ${e.material ?? '—'} · ${e.color ?? '—'}` },
                ...(e.tenido ? [{ titulo: 'Teñido', valor: String(e.tenido), fuerte: true }] : []),
                { titulo: 'Graduación OD', valor: grad(plan.od) },
                { titulo: 'Graduación OI', valor: grad(plan.oi) },
                { titulo: 'Armazón', valor: `${plan.armazon.tipo === 'METALICO' ? 'Metálico' : 'Plástico'} · ${e.aro ?? ''}${plan.armazon.a ? ` · A ${plan.armazon.a} B ${plan.armazon.b ?? '—'} ED ${plan.armazon.ed ?? '—'} Pte ${plan.armazon.puente ?? '—'}` : ''}${plan.armazon.forma ? ` · forma ${plan.armazon.forma}` : ''}` },
                { titulo: 'Modelo', valor: plan.armazon.modelo || '—' },
                { titulo: 'Código interno', valor: plan.codigoOptica },
                { titulo: 'Observación', valor: plan.observacion || '—' },
            ] : [],
            avisos: ((b.payload || {}) as PayloadBorradorGO).avisos || [],
            enlacePortal: null,
            documento: r.pdfUrl ? { url: String(r.pdfUrl), etiqueta: 'Ver el pedido del laboratorio (PDF)' } : null,
            pendienteEnPortal: null,
        };
    },

    async preparar(orderId, pair, body, actor) {
        const venta = await leerVentaParaCargaGO(orderId);
        if (!venta) return { ok: false, status: 404, error: 'Venta no encontrada.' };
        // SENT, o IN_PROGRESS: al cargar el 1er par de un 2x1 la venta ya pasa a
        // "en proceso" y el 2º par tiene que poder prepararse igual (C4).
        if (venta.labStatus !== 'SENT' && venta.labStatus !== 'IN_PROGRESS') {
            return { ok: false, status: 409, error: `La venta tiene que estar enviada a fábrica antes de cargarla en el portal (hoy está ${venta.labStatus || 'sin enviar'}).` };
        }
        const cristalesDelPar = ((cristalesPorArmazon(venta).get(pair) || []) as any[]).filter(esCristalGO);
        if (cristalesDelPar.length === 0) return { ok: false, status: 400, error: `La venta no tiene cristales de Grupo Óptico para el par ${pair}.` };
        const existente = await pedidoExistenteDelPar(orderId, pair, cantidadDeArmazones(venta as any));
        if (existente) return { ok: false, status: 409, error: mensajeExistente(existente, pair) };
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
