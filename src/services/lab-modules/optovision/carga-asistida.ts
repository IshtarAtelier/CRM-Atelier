import { cantidadDeArmazones } from '../../../lib/order-frames';
import { Borradores } from '../carga/borrador';
import type { BorradorParaVista, CampoDePreparacion, CargaAsistida, VistaDeBorrador } from '../carga/contrato';
import { CRIZALES } from '../../../lib/constants/crizal';
import { avisoDeRoles } from '../../../lib/laboratorios/roles-2x1';
import { precioConSigno } from '../../../lib/format-precio';
import { cristalesPorPar, planDeCarga, promoDeVenta, rolDe, rolesDeLaPromo, type OpcionesCargaOves, type PlanOves } from './carga';
import { eleccionQuePide, FORMAS_OVES, SERVICIO_CALIBRADO, TIPO_ARMAZON_OVES } from './catalogo';
import { leerVentaParaCargaOves } from './venta';
import { mensajeExistente, numeroDelPrimerPar, pedidoExistenteDelPar, type PedidoExistente } from './existentes';
import { confirmarBorradorAprobado, prepararEnPortal, ROBOT_ACTOR_OPTOVISION, type PayloadBorradorOves, type RastroOves } from './borrador-portal';
import { LAB_OPTOVISION, NOMBRE_OPTOVISION } from './portal';
import { cuponLimpio, pasosPendientes, ETIQUETA_DE_PASO, WEB_DE_PROMO } from './promo';

/**
 * La carga asistida de Optovisión detrás del contrato común (carga/contrato.ts).
 *
 * Lo que la persona elige al preparar es lo que la venta no guarda (visto en
 * producción, 19/10/2026): el Crizal, el calibrado, el tipo y la forma del
 * armazón, si se manda el armazón, lo que la familia exija (potencia del
 * Eyezen Boost, corredor del Kodak Precise) y, en una promo, el cupón del 1er
 * par. Todo lo demás sale de la venta. El 2º par de la promo toma solo el nº
 * del 1º ya cargado.
 */

const texto = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());
/** Un cupón de la web de la promo: 6 a 10 letras o números (VA7AGQWN, KOEUXPQC). */
const PATRON_CUPON = '^[A-Za-z0-9]{6,10}$';

function opcionesDelBody(body: Record<string, unknown>): OpcionesCargaOves {
    const forma = body.forma === undefined || body.forma === null || body.forma === '' ? null : Number(body.forma);
    return {
        tratamiento: texto(body.tratamiento) || null,
        calibrado: (texto(body.calibrado).toUpperCase() in SERVICIO_CALIBRADO ? texto(body.calibrado).toUpperCase() : null) as OpcionesCargaOves['calibrado'],
        tipoArmazon: texto(body.tipoArmazon) || null,
        forma,
        enviaArmazon: texto(body.enviaArmazon) === 'No' ? 'No' : texto(body.enviaArmazon) === 'Si' ? 'Si' : null,
        cupon: cuponLimpio(texto(body.cupon)) || null,
        potenciaBoost: texto(body.potenciaBoost) || null,
        corredorPrecise: texto(body.corredorPrecise) || null,
    };
}

export const CARGA_OPTOVISION: CargaAsistida = {
    lab: LAB_OPTOVISION,
    nombre: NOMBRE_OPTOVISION,
    robot: ROBOT_ACTOR_OPTOVISION,

    async analizar(orderId) {
        const venta = await leerVentaParaCargaOves(orderId);
        if (!venta) return null;
        const porPar = cristalesPorPar(venta);
        // La carga asistida va hasta 2 pares (un 3º se carga a mano).
        const pares = [...porPar.keys()].filter(p => p <= 2).sort((a, b) => a - b);
        const totalPares = Math.max(cantidadDeArmazones(venta as any), pares.length);
        const yaCargados = new Map<number, PedidoExistente | null>();
        for (const p of pares) yaCargados.set(p, await pedidoExistenteDelPar(orderId, p, totalPares));
        const promo = promoDeVenta(venta);
        const roles = rolesDeLaPromo(venta);
        const avisoRoles = roles ? avisoDeRoles(roles, precioConSigno) : null;
        const origen = roles ? await numeroDelPrimerPar(orderId, roles.conCargo) : null;
        return {
            pares: pares.map(pair => {
                const rol = promo?.tipo === 'MI_PRIMER' ? 'PRIMER_PAR' : rolDe(roles, pair);
                const esSegundo = rol === 'SEGUNDO_PAR';
                // Se analiza con opciones "por defecto" para mostrar lo que FALTA en la venta; lo que elige quien prepara no cuenta como faltante.
                const r = planDeCarga(venta, pair, { tratamiento: 'CRIZAL_FORTE_UV', calibrado: 'COMUN', tipoArmazon: '2', cupon: rol === 'PRIMER_PAR' ? 'XXXXXX' : null, pedidoOrigen: esSegundo ? (origen ?? '000000') : null, potenciaBoost: '0.4', corredorPrecise: 'LARGE' });
                const items = porPar.get(pair) || [];
                const nombreProducto = texto(items[0]?.product?.name ?? items[0]?.productNameSnapshot);
                const eleccion = eleccionQuePide(nombreProducto);
                const campos: CampoDePreparacion[] = [
                    ...(eleccion ? [{ clave: eleccion.clave, etiqueta: eleccion.etiqueta, tipo: 'select' as const, obligatorio: true, opciones: eleccion.opciones }] : []),
                    ...(/\+ crizal/i.test(nombreProducto) ? [{ clave: 'tratamiento', etiqueta: 'Crizal', tipo: 'select' as const, obligatorio: true, porDefecto: venta.labCrizal && CRIZALES.some(c => c.code === venta.labCrizal) ? venta.labCrizal : undefined, opciones: CRIZALES.map(c => ({ value: c.code, label: c.nombre })), ayuda: 'El que lleva el par (la venta no lo guarda: elegilo mirando lo que se cobró)' }] : []),
                    { clave: 'calibrado', etiqueta: 'Calibrado', tipo: 'select', obligatorio: true, porDefecto: venta.labEdgeInStore ? 'SIN' : 'COMUN', opciones: Object.entries(SERVICIO_CALIBRADO).map(([value, label]) => ({ value, label })) },
                    { clave: 'tipoArmazon', etiqueta: 'Tipo de armazón', tipo: 'select', obligatorio: true, opciones: TIPO_ARMAZON_OVES.map(t => ({ value: t.value, label: t.label })) },
                    { clave: 'forma', etiqueta: 'Forma del armazón (dibujo del portal, opcional)', tipo: 'select', obligatorio: false, opciones: FORMAS_OVES.map(f => ({ value: String(f), label: `Forma ${String(f).padStart(2, '0')}` })) },
                    { clave: 'enviaArmazon', etiqueta: '¿Se manda el armazón?', tipo: 'select', obligatorio: true, porDefecto: venta.userFrameBrand || venta.userFrameModel ? 'Si' : 'No', opciones: [{ value: 'Si', label: 'Sí (va al laboratorio)' }, { value: 'No', label: 'No' }] },
                    ...(rol === 'PRIMER_PAR' ? [{ clave: 'cupon', etiqueta: `Cupón de la promo (${promo?.marca === 'KODAK' ? WEB_DE_PROMO.KODAK : WEB_DE_PROMO.VARILUX})`, tipo: 'texto' as const, obligatorio: true, maxLength: 10, patron: PATRON_CUPON, ayuda: 'Se genera en la web de la promo y va en la observación del 1er par. Sin él, Optovisión cobra los dos pares.' }] : []),
                ];
                const existente = yaCargados.get(pair);
                const avisos = [...r.avisos, ...(avisoRoles && roles ? [avisoRoles] : [])];
                if (promo?.tipo === 'MI_PRIMER') avisos.push('Promo Mi Primer: el cupón va en la observación; si Optovisión pide además el mail, hoy se manda a mano.');
                return {
                    pair,
                    titulo: nombreProducto || null,
                    faltantes: r.ok || r.aMano ? [] : r.faltantes.filter(f => !/^(el cristal lleva Crizal|calibrado|tipo de armazón|es el 1er par de la promo)/.test(f)),
                    avisos,
                    aMano: r.ok ? null : (r.aMano ?? null),
                    campos,
                    espera: esSegundo && !origen ? `Es el 2º par de la promo: se prepara cuando el 1er par (par ${roles!.conCargo}) esté cargado, porque lleva su nº en la observación (sin él Optovisión cobra los dos pares).` : null,
                    yaCargado: existente ? mensajeExistente(existente, pair) : null,
                    rol: rol === 'SEGUNDO_PAR' ? { tipo: 'SIN_CARGO' as const, etiqueta: '2º par · promo' } : rol === 'PRIMER_PAR' ? { tipo: 'CON_CARGO' as const, etiqueta: promo?.tipo === 'MI_PRIMER' ? 'Mi Primer · cupón' : '1er par · promo' } : null,
                };
            }),
        };
    },

    vistaDeBorrador(b: BorradorParaVista): VistaDeBorrador {
        const plan = ((b.payload || {}) as PayloadBorradorOves).plan as PlanOves | undefined;
        const r = (b.resumenPortal || {}) as RastroOves;
        const grad = (o: PlanOves['od']) => o ? `${o.esf}${o.cil ? ` ${o.cil} × ${o.eje}°` : ''}${o.adic ? ` · add +${o.adic}` : ''} · DNP ${o.dnp ?? '—'} · altura ${o.altura ?? '—'}` : '—';
        const pasos = plan?.promo ? pasosPendientes({ cupon: plan.cupon ?? (plan.rolPromo === 'SEGUNDO_PAR' ? 'ok' : null), numeroPrimerPar: plan.rolPromo === 'PRIMER_PAR' ? (b.portalNumber ?? null) : plan.pedidoOrigen, numeroSegundoPar: plan.rolPromo === 'SEGUNDO_PAR' ? (b.portalNumber ?? null) : (plan.promo.tipo === 'MI_PRIMER' ? 'n/a' : null), mailEnviado: !!r.mailPromoEnviadoEl || plan.promo.tipo === 'MI_PRIMER' }) : [];
        const avisos = [
            ...(((b.payload || {}) as PayloadBorradorOves).avisos || []),
            ...(r.noAplican?.length ? [`el portal no toma para este producto: ${r.noAplican.join(', ')} (quedan sin cargar)`] : []),
            ...(r.mailPromoPendiente ? [`Mail a Optovisión pendiente: ${r.mailPromoPendiente}`] : []),
            ...(pasos.length && b.status === 'CARGADO' ? [`Promo: falta ${pasos.map(p => ETIQUETA_DE_PASO[p].toLowerCase()).join(' y ')}`] : []),
        ];
        return {
            textoRevision: 'Así queda el pedido en OVES (es el formulario real del portal, todavía sin grabar). Aprobar lo graba en Optovisión, trae el nº y le avisa al cliente; después solo se puede PEDIR la anulación desde el portal. Rechazar no manda nada.',
            filas: plan ? [
                { titulo: 'Vendido', valor: plan.productoCRM },
                { titulo: 'Producto OVES', valor: plan.producto.label, fuerte: true },
                { titulo: 'Servicios', valor: `${plan.servicios.tratamiento} · ${plan.servicios.calibrado} · ${plan.servicios.coloracion}` },
                { titulo: 'Lentes', valor: plan.lentes === 'AO' ? 'Ambos ojos' : plan.lentes },
                { titulo: 'Graduación OD', valor: grad(plan.od) },
                { titulo: 'Graduación OI', valor: grad(plan.oi) },
                { titulo: 'Armazón', valor: `${plan.armazon.tipoEtiqueta ?? '—'}${plan.armazon.forma ? ` · forma ${plan.armazon.forma}` : ''} · A ${plan.armazon.a ?? '—'} B ${plan.armazon.b ?? '—'} ED ${plan.armazon.ed ?? '—'} Pte ${plan.armazon.puente ?? '—'} · ${plan.armazon.envia === 'Si' ? `se manda (${plan.armazon.marca || 'sin marca'})` : 'no se manda'}` },
                { titulo: 'Referencia', valor: plan.pedinterno },
                { titulo: 'Paciente', valor: plan.paciente },
                { titulo: 'Observación', valor: plan.observacion || '—', fuerte: !!plan.promo },
            ] : [],
            avisos,
            confirmarAntesDeAprobar: plan?.rolPromo === 'SEGUNDO_PAR' ? {
                titulo: 'Es el 2º par de la promo de Optovisión',
                texto: `Antes de aprobar, fijate en la pantalla del portal que la observación diga "Segundo par promo compañero/asociado al num ${plan.pedidoOrigen ?? '—'}" (el nº del 1er par). Sin eso Optovisión cobra los dos pares. Cuando quede cargado, el robot manda el mail a promociones@ y cordoba@ con los dos números.`,
            } : plan?.rolPromo === 'PRIMER_PAR' ? {
                titulo: plan.promo?.tipo === 'MI_PRIMER' ? 'Es una promo Mi Primer' : 'Es el 1er par de la promo de Optovisión',
                texto: `Fijate en la pantalla del portal que la observación diga "Primer par de Promo num cupón ${plan.cupon ?? '—'}". ${plan.promo?.tipo === 'MI_PRIMER' ? '' : 'Cuando quede cargado, su nº va en la observación del 2º par: el robot lo anota solo al terminar.'}`.trim(),
            } : null,
            enlacePortal: null,
            documento: null,
            pendienteEnPortal: null,
        };
    },

    async preparar(orderId, pair, body, actor) {
        const venta = await leerVentaParaCargaOves(orderId);
        if (!venta) return { ok: false, status: 404, error: 'Venta no encontrada.' };
        if (venta.labStatus !== 'SENT' && venta.labStatus !== 'IN_PROGRESS') {
            return { ok: false, status: 409, error: `La venta tiene que estar enviada a fábrica antes de cargarla en el portal (hoy está ${venta.labStatus || 'sin enviar'}).` };
        }
        if (!cristalesPorPar(venta).has(pair)) return { ok: false, status: 400, error: `La venta no tiene cristales de ${NOMBRE_OPTOVISION} para el par ${pair}.` };
        const existente = await pedidoExistenteDelPar(orderId, pair, cantidadDeArmazones(venta as any));
        if (existente) return { ok: false, status: 409, error: mensajeExistente(existente, pair) };
        const opciones = opcionesDelBody(body);
        if (opciones.forma !== null && opciones.forma !== undefined && !(FORMAS_OVES as readonly number[]).includes(opciones.forma)) return { ok: false, status: 400, error: `La forma del armazón tiene que ser una de las del portal (${FORMAS_OVES.join(', ')}).` };
        if (opciones.tipoArmazon && !TIPO_ARMAZON_OVES.some(t => t.value === opciones.tipoArmazon)) return { ok: false, status: 400, error: 'El tipo de armazón tiene que ser uno de los del portal.' };
        if (texto(body.cupon) && !opciones.cupon) return { ok: false, status: 400, error: 'El cupón tiene que ser el código de la web de la promo (letras y números, 6 a 10).' };
        if (opciones.cupon && !new RegExp(PATRON_CUPON).test(opciones.cupon)) return { ok: false, status: 400, error: 'El cupón tiene que ser el código de la web de la promo (letras y números, 6 a 10).' };
        // El nº del 1er par lo deduce el CRM con la regla común (nunca un anulado ni un reproceso): no se acepta del navegador.
        const roles = rolesDeLaPromo(venta);
        if (roles && pair === roles.sinCargo) {
            opciones.pedidoOrigen = await numeroDelPrimerPar(orderId, roles.conCargo);
            if (!opciones.pedidoOrigen) return { ok: false, status: 409, error: `Es el 2º par de la promo: primero cargá el 1er par (par ${roles.conCargo}); su nº va en la observación y sin él Optovisión cobra los dos pares.` };
        }
        const r = planDeCarga(venta, pair, opciones);
        if (!r.ok) return { ok: false, status: 422, error: r.aMano ? `Este pedido va a mano: ${r.aMano}.` : 'Faltan datos para armar el pedido.', faltantes: r.faltantes, avisos: r.avisos };
        const payload: PayloadBorradorOves = { opciones, plan: r.plan, avisos: r.avisos };
        const preparado = await Borradores.preparar({ lab: LAB_OPTOVISION, orderId, pair, payload, actor });
        // El robot trabaja FUERA del request (turno, login, formulario: minutos): la ficha sondea el estado.
        void prepararEnPortal(preparado.id).catch(err => console.error('[lab-modulos] preparar en OVES:', err?.message || err));
        return { ok: true, status: 202, borrador: preparado, avisos: r.avisos };
    },

    confirmar: confirmarBorradorAprobado,
    // En OVES no hay borrador en el portal: un rechazo no deja nada que deshacer.
    despuesDeRechazar: async () => ({ cancelado: true, motivo: 'no se había mandado nada al portal' }),
};
