import { Borradores } from '../carga/borrador';
import type { BorradorParaVista, CampoDePreparacion, CargaAsistida, VistaDeBorrador } from '../carga/contrato';
import { armarFormulario, cristalesPorPar, esSegundoParDePromo, leerVentaParaCarga, TIPOS_ARMAZON } from './carga';
import { lineasDeCambios } from './cambios-a-mano';
import { prisma } from '../../../lib/db';
import { ErrorDeCarga } from '../carga/errores';
import { cristalVitolenPorNombre } from '../../../lib/laboratorios/vitolen-catalogo';
import { cancelarEnPortal, confirmarBorradorAprobado, llenarBorradorEnPortal, releerBorradorEnPortal, ROBOT_ACTOR_VITOLEN } from './borrador-portal';
import { LAB_VITOLEN, NOMBRE_VITOLEN } from './portal';
import { BASE_VITOLEN } from './pedidos';
import { mensajeExistente, pedidoExistenteDelPar } from './existentes';
import { pedidoOrigenDeVitolen } from './origen';
import { avisoDeRoles, type RolesDePares } from '../../../lib/laboratorios/roles-2x1';
import { rolDeLaPromo, rolesDeLaPromoHoya } from '../../../lib/laboratorios/vitolen-promo';
import { precioConSigno } from '../../../lib/format-precio';
import { cantidadDeArmazones } from '../../../lib/order-frames';
import { esCristalDeLab } from '../../../lib/laboratorios/identidad';

/**
 * La carga asistida de Vitolen detrás del contrato común (carga/contrato.ts).
 * Es la lógica que hasta el 3/10/2026 vivía dentro de la ruta
 * /api/lab-modulos/borradores, sin cambios de comportamiento.
 */

// Las 12 tarjetas "Forma OD - N" del formulario del portal (docs/vitolen-portal.md).
export const FORMAS_PORTAL_VITOLEN = Array.from({ length: 12 }, (_, i) => `Forma ${i + 1}`);

const esCristalVitolen = (i: { laboratorySnapshot: string | null; productCategorySnapshot: string | null }) => esCristalDeLab(i, 'VITOLEN');

/** Los roles de la promo del 2º par, con la regla del CRM (promo.ts). */
const rolesDeLaPromo = (venta: { items: any[] }): RolesDePares | null => rolesDeLaPromoHoya(venta.items);
const rolDe = rolDeLaPromo;

export const CARGA_VITOLEN: CargaAsistida = {
    lab: LAB_VITOLEN,
    nombre: NOMBRE_VITOLEN,
    robot: ROBOT_ACTOR_VITOLEN,
    portal: { url: `${BASE_VITOLEN}/ventas/pedidos_laboratorio/new`, etiqueta: 'Abrir el portal de Vitolen para cargarlo a mano' },

    async analizar(orderId) {
        const venta = await leerVentaParaCarga(orderId);
        if (!venta) return null;
        // Qué pares de Vitolen tiene la venta y qué le falta a cada uno para armarse
        // (sin forma ni variante elegidas todavía: eso lo decide quien prepara).
        // Los pares con cristales de Vitolen, agrupados como el resto del CRM; la carga asistida va hasta 2.
        // Los pares los arma `cristalesPorPar` (por armazón asignado, o en el orden del carrito); la carga asistida va hasta 2.
        const porPar = cristalesPorPar(venta);
        const pares = [...porPar.keys()].filter(p => p <= 2).sort((a, b) => a - b);
        // ¿Algún par ya tiene pedido (robot, seguimiento o nº tipeado)? La ficha
        // no ofrece preparar y deshabilita "Aprobar" (misma regla que Grupo Óptico).
        const yaCargados = new Map<number, string | null>();
        // Los pares de la VENTA (un par de otro lab también cuenta para repartir los nº tipeados).
        const totalPares = Math.max(cantidadDeArmazones(venta as any), pares.length);
        for (const p of pares) { const e = await pedidoExistenteDelPar(orderId, p, totalPares); yaCargados.set(p, e ? mensajeExistente(e, p) : null); }
        const roles = rolesDeLaPromo(venta);
        const avisoRoles = roles ? avisoDeRoles(roles, precioConSigno) : null;
        // El 2º par de la promo lleva el nº del 1º como "pedido origen": hasta que
        // el 1º esté cargado, el 2º espera (como el par sin cargo del 2x1 en GO).
        // Antes se dejaba preparar sin origen y al confirmar el re-armado lo
        // acusaba como "la venta cambió" (auditoría 5, M2).
        const origenDelSegundo = roles ? await pedidoOrigenDeVitolen(orderId, roles.conCargo) : null;
        return {
            pares: pares.map(pair => {
                const r = armarFormulario(venta, { pair, forma: 'Forma 1', ejeDiagonal: 0, tipoArmazon: TIPOS_ARMAZON[0], rolPromo: rolDe(roles, pair) });
                const cristal = cristalVitolenPorNombre(porPar.get(pair)?.[0]?.productNameSnapshot);
                const variantes = cristal?.variantes ?? [];
                const campos: CampoDePreparacion[] = [
                    ...(variantes.length > 1 ? [{ clave: 'variante', etiqueta: 'Variante', tipo: 'select' as const, opciones: variantes.map(v => ({ value: v, label: v })), obligatorio: true }] : []),
                    // Con el dibujo de cada tarjeta del portal (public/laboratorios/vitolen/formas, capturadas el
                    // 15/10/2026): "Forma 1…12" a secas no dice nada (Ishtar).
                    { clave: 'forma', etiqueta: 'Forma del armazón (portal)', tipo: 'select', opciones: FORMAS_PORTAL_VITOLEN.map((f, i) => ({ value: f, label: f, imagen: `/laboratorios/vitolen/formas/forma-${i + 1}.png` })), obligatorio: true },
                    // La venta casi nunca trae el tipo (vacío en las 152 ventas de 60 días): lo elige quien prepara.
                    { clave: 'tipoArmazon', etiqueta: 'Tipo de armazón', tipo: 'select', opciones: TIPOS_ARMAZON.map(t => ({ value: t, label: t })), obligatorio: true },
                    { clave: 'ejeDiagonal', etiqueta: 'Eje de la diagonal (0‑180)', tipo: 'numero', obligatorio: true, min: 0, max: 180, ayuda: 'Ángulo de la diagonal mayor del aro, como lo pide el portal (botón "¿Cómo tomar las medidas?")' },
                ];
                return {
                    pair,
                    titulo: cristal?.diseno ?? null,
                    faltantes: r.faltantes.filter(f => !/variante|forma del armazón|eje de la diagonal|tipo de armazón/.test(f)),
                    avisos: avisoRoles ? [...r.avisos, avisoRoles] : r.avisos,
                    campos,
                    yaCargado: yaCargados.get(pair) ?? null,
                    espera: rolDe(roles, pair) === 'SEGUNDO_PAR' && !origenDelSegundo ? `Es el 2º par de la promo: se prepara cuando el 1er par (par ${roles!.conCargo}) esté cargado, porque lleva su nº como "pedido origen" (sin él Vitolen factura el par entero).` : null,
                    rol: rolDe(roles, pair) === 'SEGUNDO_PAR' ? { tipo: 'SIN_CARGO' as const, etiqueta: '2º par · promo' } : rolDe(roles, pair) === 'PRIMER_PAR' ? { tipo: 'CON_CARGO' as const, etiqueta: '1er par · promo' } : null,
                };
            }),
        };
    },

    vistaDeBorrador(b: BorradorParaVista): VistaDeBorrador {
        const p = (b.payload || {}) as any;
        const r = (b.resumenPortal || {}) as any;
        const ojo = (g: any) => g ? `${g.esferico > 0 ? '+' : ''}${g.esferico}${g.cilindrico != null ? ` ${g.cilindrico > 0 ? '+' : ''}${g.cilindrico} × ${g.eje ?? '—'}` : ''}${g.adicion != null ? ` add ${g.adicion}` : ''} · DNP ${g.dnp ?? '—'} · alt ${g.altura ?? '—'} · ${g.material} (${g.codigo})` : '—';
        return {
            textoRevision: 'El pedido ya está en el portal de Vitolen como borrador sin confirmar. Aprobar lo confirma, trae el nº de pedido y le avisa al cliente que su pedido fue procesado; Rechazar lo cancela en el portal.',
            filas: [
                { titulo: 'Caso', valor: `${p.nroCasoInterno ?? ''} · ${p.paciente ?? ''}`, fuerte: true },
                { titulo: 'Diseño', valor: `${p.tipoReceta ?? ''} · ${p.diseno ?? ''}${p.variante ? ` ${p.variante}` : ''}` },
                { titulo: 'OD', valor: ojo(p.od) },
                { titulo: 'OI', valor: ojo(p.oi) },
                { titulo: 'Armazón', valor: `${p.armazon?.forma ?? ''} · ${p.armazon?.tipo || 'sin tipo'} · A ${p.armazon?.largo ?? '—'} B ${p.armazon?.alto ?? '—'} DBL ${p.armazon?.puente ?? '—'} ED ${p.armazon?.diagonalMayor ?? '—'} eje ${p.armazon?.ejeDiagonal ?? '—'}° · ${p.armazon?.caracteristicas ?? ''}` },
                { titulo: 'Trabajos', valor: `${p.tratamientos?.antirreflejo ? 'AR' : 'sin AR'} · ${p.montajes?.calibrado ? 'calibrado' : 'sin calibrar'}${p.pedidoOrigen ? ` · 2º par de ${p.pedidoOrigen}` : ''}` },
            ],
            avisos: Array.isArray(r.pendientes) ? r.pendientes : [],
            tituloAvisos: 'Quedó para hacer a mano en el portal antes de aprobar:',
            cambiosAMano: r.cambiosAMano?.cambios?.length ? { lineas: lineasDeCambios(r.cambiosAMano.cambios), costoExtra: r.cambiosAMano.costoExtra, aConfirmar: !!r.cambiosAMano.aConfirmar, motivo: r.cambiosAManoMotivo ?? null } : null,
            confirmarAntesDeAprobar: esSegundoParDePromo(p) ? {
                titulo: 'Es el 2º par de la promo de Vitolen',
                texto: `Antes de aprobar, fijate en la pantalla del portal que el pedido tenga "Pedido origen" con el nº del 1er par (${p.pedidoOrigen ?? 'la venta todavía no lo tiene'}) y la promo del segundo par asociada con "Modificar". Sin eso Vitolen factura el par entero, no el 20 % de lista.`,
            } : p.rolPromo === 'PRIMER_PAR' ? {
                titulo: 'Es el 1er par de la promo de Vitolen',
                texto: 'Cuando quede confirmado, su nº de trabajo es el "pedido origen" del 2º par. Asegurate de que ese nº quede en la venta (el robot lo anota solo al terminar) antes de preparar el otro par: sin él, el 2º par no entra en la promo.',
            } : null,
            enlacePortal: r.url ?? null,
            documento: null,
            pendienteEnPortal: r.portalDraftId && !r.canceladoEl && !r.confirmadoAManoEl && (b.status === 'RECHAZADO' || b.status === 'ERROR') ? { id: String(r.portalDraftId), url: r.url ?? null } : null,
        };
    },

    async preparar(orderId, pair, body, actor) {
        const forma = body.forma ? String(body.forma) : null;
        if (forma && !FORMAS_PORTAL_VITOLEN.includes(forma)) return { ok: false, status: 400, error: 'La forma tiene que ser Forma 1 a Forma 12.' };
        const tipoArmazon = body.tipoArmazon ? String(body.tipoArmazon) : null;
        if (tipoArmazon && !TIPOS_ARMAZON.includes(tipoArmazon)) return { ok: false, status: 400, error: `El tipo de armazón tiene que ser ${TIPOS_ARMAZON.join(', ')}.` };
        const venta = await leerVentaParaCarga(orderId);
        if (!venta) return { ok: false, status: 404, error: 'Venta no encontrada.' };
        // Al laboratorio va solo una venta ENVIADA a fábrica: así queda quién la
        // envió (vendedor = labSentBy), la fecha, y el seguimiento la vincula.
        // SENT, o IN_PROGRESS: al confirmar el 1er par la venta ya pasa a "en
        // proceso" y el 2º par tiene que poder prepararse igual (como Grupo Óptico).
        if (venta.labStatus !== 'SENT' && venta.labStatus !== 'IN_PROGRESS') {
            return { ok: false, status: 409, error: `La venta tiene que estar enviada a fábrica antes de cargarla en el portal (hoy está ${venta.labStatus || 'sin enviar'}).` };
        }
        const paresDeLaVenta = new Set(cristalesPorPar(venta).keys());
        if (!paresDeLaVenta.has(pair)) return { ok: false, status: 400, error: `La venta no tiene cristales de Vitolen para el par ${pair}.` };
        const existente = await pedidoExistenteDelPar(orderId, pair, Math.max(cantidadDeArmazones(venta as any), paresDeLaVenta.size));
        if (existente) return { ok: false, status: 409, error: mensajeExistente(existente, pair) };

        const ejeDiagonal = body.ejeDiagonal === undefined || body.ejeDiagonal === null || body.ejeDiagonal === '' ? null : Number(body.ejeDiagonal);
        if (ejeDiagonal !== null && !(Number.isFinite(ejeDiagonal) && ejeDiagonal >= 0 && ejeDiagonal <= 180)) {
            return { ok: false, status: 400, error: 'El eje de la diagonal mayor va de 0 a 180.' };
        }
        // El 2º par lleva el nº del 1º como "pedido origen" de la promo: lo que
        // mandó la ficha o, si no, lo que ya sabe el CRM (espejo del portal o el
        // nº cargado en la venta). Sin él, igual queda como pendiente a mano.
        const roles = rolesDeLaPromo(venta);
        const rolPromo = rolDe(roles, pair);
        // El pedido origen lo deduce el CRM con la regla común (nunca un anulado ni un reproceso): no se acepta del navegador.
        const pedidoOrigen = rolPromo === 'SEGUNDO_PAR' ? await pedidoOrigenDeVitolen(orderId, roles!.conCargo) : null;
        if (rolPromo === 'SEGUNDO_PAR' && !pedidoOrigen) {
            return { ok: false, status: 409, error: `Es el 2º par de la promo: primero cargá el 1er par (par ${roles!.conCargo}); su nº va como "pedido origen" y sin él Vitolen factura el par entero.` };
        }
        const r = armarFormulario(venta, { pair, forma, ejeDiagonal, tipoArmazon, variante: body.variante ? String(body.variante) : null, pedidoOrigen, rolPromo });
        if (!r.ok) return { ok: false, status: 422, error: 'Faltan datos para armar el pedido.', faltantes: r.faltantes, avisos: r.avisos };

        const preparado = await Borradores.preparar({ lab: LAB_VITOLEN, orderId, pair, payload: r.payload, actor });
        // El robot entra al portal, llena, aprieta "Crear" (borrador en el
        // portal) y deja la captura del resumen para revisar. Tarda unos
        // segundos; si falla, el borrador queda en ERROR con el motivo.
        // El robot trabaja FUERA del request: la ficha sondea el estado del borrador.
        void llenarBorradorEnPortal(preparado.id).catch(err => console.error('[lab-modulos] llenar en el portal de Vitolen:', err?.message || err));
        return { ok: true, status: 202, borrador: preparado, avisos: r.avisos };
    },

    confirmar: confirmarBorradorAprobado,
    /** Con cambios a mano en el portal, aprobar exige el motivo (10 letras); queda en el rastro y viaja en el aviso al cargar. Nunca bloquea por costo. */
    async antesDeAprobar(borradorId, body, actor) {
        const b = await prisma.labOrderDraft.findUnique({ where: { id: borradorId }, select: { resumenPortal: true } });
        const r = (b?.resumenPortal || {}) as { cambiosAMano?: { cambios?: unknown[] } | null };
        if (!r.cambiosAMano?.cambios?.length) return;
        const motivo = String(body.motivo || '').trim();
        if (motivo.length < 10) throw new ErrorDeCarga('El pedido se cambió a mano en el portal: escribí el motivo (al menos 10 letras) para aprobarlo. Le llega a la dueña con el cambio y su costo.', 'DATOS');
        await Borradores.anotarRastro(borradorId, { cambiosAManoMotivo: motivo.slice(0, 500), cambiosAManoPor: actor.name } as any);
    },
    despuesDeRechazar: cancelarEnPortal,
    cancelarEnPortal,
    releerPortal: releerBorradorEnPortal,
};
