import { cantidadDeArmazones, cristalesPorArmazon } from '../../../lib/order-frames';
import { Borradores } from '../carga/borrador';
import type { BorradorParaVista, CampoDePreparacion, CargaAsistida, VistaDeBorrador } from '../carga/contrato';
import { planDeCarga, rolesDel2x1, type OpcionesCarga, type TipoArmazon, type TipoAro } from './carga';
import { numeroDelParConCargo } from './origen';
import { esCristalDeLab } from '../../../lib/laboratorios/identidad';
import { especificacionDe, tieneEssential, familiaDelNombre } from './catalogo';
import { itemsDeTenido } from '../../../lib/crystal-color';
import { TIPO_ARMAZON, TIPO_ARO } from './catalogo';
import { confirmarBorradorAprobado, prepararEnPortal, ROBOT_ACTOR_GRUPO_OPTICO, type PayloadBorradorGO } from './borrador-portal';
import { LAB_GRUPO_OPTICO, NOMBRE_GRUPO_OPTICO } from './portal';
import { leerVentaParaCargaGO } from './venta';
import { mensajeExistente, pedidoExistenteDelPar, type PedidoExistente } from './existentes';
import { leerFotoStockVirtual, lineaDeStockVirtual } from './stock-virtual';

/**
 * La carga asistida de Grupo Óptico detrás del contrato común.
 *
 * Lo que la persona elige al preparar es lo mínimo que la venta no sabe:
 * tipo de armazón (plástico o metálico) si la venta no lo dice, tipo de aro
 * (por defecto aro entero) y, opcional, la forma. Todo lo demás sale de la
 * venta. El 2º par de un 2x1 toma solo el nº del 1º ya cargado.
 */

const texto = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());
// Un cristal sin laboratorio cargado (ventas viejas) es de Grupo Óptico acá, como en planDeCarga.
const esCristalGO = (i: any) => esCristalDeLab(i, 'GRUPO_OPTICO', { sinLaboratorio: 'GRUPO_OPTICO' });


function opcionesDelBody(body: Record<string, unknown>): OpcionesCarga {
    const tipo = String(body.tipoArmazon || '').toUpperCase();
    const aro = String(body.tipoAro || '').toUpperCase();
    const forma = body.forma === undefined || body.forma === null || body.forma === '' ? null : Number(body.forma);
    const extrasCrudos = body.extras && typeof body.extras === 'object' ? (body.extras as Record<string, unknown>) : {};
    const extras: Record<string, string> = {};
    for (const [k, v] of Object.entries(extrasCrudos)) if (typeof v === 'string' && v.trim()) extras[k] = v.trim();
    return {
        tipoArmazon: (tipo in TIPO_ARMAZON ? tipo : null) as TipoArmazon | null,
        tipoAro: (aro in TIPO_ARO ? aro : null) as TipoAro | null,
        forma,
        extras: Object.keys(extras).length ? extras : null,
    };
}

/** Essential se ofrece como extra NO cobrado solo a un cristal de laboratorio que no lo trae. */
function campoEssential(nombreProducto: string, conTenido: boolean): CampoDePreparacion | null {
    if (tieneEssential(nombreProducto)) return null;
    const r = especificacionDe(nombreProducto, { conTenido });
    if (!r.ok || r.especificacion.clase !== 'LAB' || r.especificacion.pasoATenible || r.especificacion.material.arIncluido) return null;
    return {
        clave: 'essential', etiqueta: 'Agregar Essential (NO está en la venta)', tipo: 'extra', obligatorio: false,
        advertencia: 'El Essential NO está cobrado en esta venta: el laboratorio lo va a facturar y el cliente no lo pagó. Si corresponde cobrarlo, cambiá el cristal en la venta por la versión Essential. Si igual querés agregarlo, explicá por qué: queda en la ficha del cliente y le llega a Ishtar con los datos de la venta.',
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
        // 2x1: el par de mayor valor va con cargo; el otro, con su nº (roles-2x1.ts).
        const roles = rolesDel2x1(venta as any);
        // El saldo de stock virtual que el robot leyó en su última pasada (no toca el portal).
        // En un 2x1 no aplica (Ishtar, 16/10/2026).
        const fotoVirtual = roles ? null : await leerFotoStockVirtual();
        const origen = roles ? await numeroDelParConCargo(orderId, roles.conCargo) : null;
        const campos: CampoDePreparacion[] = [
            { clave: 'tipoArmazon', etiqueta: 'Tipo de armazón', tipo: 'select', obligatorio: true, opciones: [{ value: 'PLASTICO', label: 'Plástico' }, { value: 'METALICO', label: 'Metálico' }] },
            { clave: 'tipoAro', etiqueta: 'Tipo de aro', tipo: 'select', obligatorio: true, porDefecto: 'ENTERO', opciones: Object.entries(TIPO_ARO).map(([value, v]) => ({ value, label: v.etiqueta })) },
            { clave: 'forma', etiqueta: 'Forma (opcional)', tipo: 'select', obligatorio: false, opciones: Array.from({ length: 9 }, (_, i) => ({ value: String(i + 1), label: `Forma ${i + 1}` })) },
        ];
        return {
            pares: pares.map(pair => {
                // Se analiza con opciones "por defecto" para mostrar lo que FALTA en la venta;
                // lo que elige quien prepara (tipo de armazón) no cuenta como faltante.
                const esSinCargo = !!roles && pair === roles.sinCargo;
                const r = planDeCarga(venta as any, pair, { tipoArmazon: 'PLASTICO', pedidoOrigen: esSinCargo ? (origen ?? '80000000') : null });
                const items = (porPar.get(pair) || []) as any[];
                const existente = yaCargados.get(pair);
                const nombreProducto = texto(items[0]?.product?.name ?? items[0]?.productNameSnapshot);
                const esStock = /^stock\b/i.test(familiaDelNombre(nombreProducto));
                const extraEssential = campoEssential(nombreProducto, itemsDeTenido(venta.items as any[]).some((t: any) => (pares.length > 1 ? t.framePosition : (t.framePosition ?? 1)) === pair));
                return {
                    pair,
                    titulo: items[0]?.product?.name ?? items[0]?.productNameSnapshot ?? null,
                    faltantes: r.ok || r.aMano ? [] : r.faltantes,
                    avisos: [...r.avisos, ...(roles ? [] : [lineaDeStockVirtual(fotoVirtual, nombreProducto)].filter((l): l is string => !!l))],
                    aMano: r.ok ? null : (r.aMano ?? null),
                    // Stock: el portal no lleva forma del armazón; no se ofrece.
                    campos: [...(esStock ? campos.filter(c => c.clave !== 'forma') : campos), ...(extraEssential ? [extraEssential] : [])],
                    espera: esSinCargo && !origen ? `Es el par SIN CARGO del 2x1: se prepara cuando el par con cargo (par ${roles!.conCargo}) esté cargado (lleva su nº de operación en la observación, para que el laboratorio no lo cobre).` : null,
                    yaCargado: existente ? mensajeExistente(existente, pair) : null,
                    rol: roles ? (esSinCargo ? { tipo: 'SIN_CARGO' as const, etiqueta: 'SIN CARGO · 2x1' } : { tipo: 'CON_CARGO' as const, etiqueta: 'con cargo · 2x1' }) : null,
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
            confirmarAntesDeAprobar: plan?.rol2x1 === 'SIN_CARGO' ? {
                titulo: 'Es el par SIN CARGO del 2x1',
                texto: `Antes de aprobar, fijate en la pantalla del portal que la observación diga "SIN CARGO" y tenga el nº de operación del par con cargo (n° ${plan.pedidoOrigen ?? '—'}). Sin ese número Grupo Óptico cobra el par: es lo que hace el descuento.`,
            } : plan?.rol2x1 === 'CON_CARGO' ? {
                titulo: 'Es el par CON CARGO del 2x1',
                texto: 'Cuando quede cargado, su nº de operación es el que va en la observación del par sin cargo. Asegurate de que ese nº quede en la venta (el robot lo anota solo al terminar) antes de preparar el otro par: sin él, el laboratorio no hace el descuento.',
            } : null,
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
        const roles = rolesDel2x1(venta as any);
        if (roles && pair === roles.sinCargo) opciones.pedidoOrigen = await numeroDelParConCargo(orderId, roles.conCargo);

        // Antes de crear nada: ¿la venta arma el pedido? (sin portal)
        const r = planDeCarga(venta as any, pair, opciones);
        if (!r.ok) return { ok: false, status: 422, error: 'Faltan datos para armar el pedido.', faltantes: r.faltantes, avisos: r.avisos };

        const { plan } = r;
        // Un extra NO cobrado se puede, pero firmado: ficha, AuditLog y aviso a la dueña.
        if (plan.extrasNoCobrados.length && !actor?.id) return { ok: false, status: 403, error: 'Para agregar algo que no está cobrado tenés que estar identificado.' };
        const payload: PayloadBorradorGO = {
            opciones,
            plan: { par: plan.par, pares: plan.pares, rol2x1: plan.rol2x1, pedidoOrigen: plan.pedidoOrigen, extrasNoCobrados: plan.extrasNoCobrados, producto: plan.producto, lensTypeId: plan.lensTypeId, od: plan.od, oi: plan.oi, tenido: plan.tenido, codigoOptica: plan.codigoOptica, observacion: plan.observacion, armazon: plan.armazon },
            avisos: r.avisos,
        };
        const preparado = await Borradores.preparar({ lab: LAB_GRUPO_OPTICO, orderId, pair, payload, actor });
        // El robot trabaja FUERA del request (puede tardar minutos: turno, login,
        // formulario): la ficha sondea el estado del borrador. Si falla, el borrador
        // queda en ERROR con el motivo. El extra NO cobrado se registra recién al CARGAR.
        void prepararEnPortal(preparado.id).catch(err => console.error('[lab-modulos] preparar en el portal de Grupo Óptico:', err?.message || err));
        return { ok: true, status: 202, borrador: preparado, avisos: r.avisos };
    },

    confirmar: confirmarBorradorAprobado,
    // En SmartLab no hay borrador en el portal: un rechazo no deja nada que deshacer.
    despuesDeRechazar: async () => ({ cancelado: true, motivo: 'no se había mandado nada al portal' }),
};
