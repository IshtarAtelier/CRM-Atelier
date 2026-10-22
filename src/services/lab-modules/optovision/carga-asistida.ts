import { cantidadDeArmazones } from '../../../lib/order-frames';
import { Borradores, elegidoDe } from '../carga/borrador';
import type { BorradorParaVista, CampoDePreparacion, CargaAsistida, VistaDeBorrador } from '../carga/contrato';
import { CRIZALES } from '../../../lib/constants/crizal';
import { avisoDeRoles } from '../../../lib/laboratorios/roles-2x1';
import { precioConSigno } from '../../../lib/format-precio';
import { cristalDelSegundoPar, cristalesPorPar, planDeCarga, promoDeVenta, rolDe, rolesDeLaPromo, type OpcionesCargaOves, type PlanOves } from './carga';
import { eleccionQuePide, FORMAS_OVES, SERVICIO_CALIBRADO, TIPO_ARMAZON_OVES } from './catalogo';
import { leerVentaParaCargaOves } from './venta';
import { mensajeExistente, numeroDelPrimerPar, pedidoExistenteDelPar, type PedidoExistente } from './existentes';
import { confirmarBorradorAprobado, prepararEnPortal, ROBOT_ACTOR_OPTOVISION, type PayloadBorradorOves, type RastroOves } from './borrador-portal';
import { avisarMailDePromo } from './promo-mail';
import { prisma } from '../../../lib/db';
import { LAB_OPTOVISION, NOMBRE_OPTOVISION, PORTAL_BASE } from './portal';
import { conCuponReal, cuponLimpio, PATRON_CUPON, PATRON_CUPON_HTML, providerDePromo, WEB_DE_PROMO } from './promo';
import { formatDate } from '../../../lib/format-date';
import { pedidoDeCupon, rasgosDelCristalCRM, rasgosDeProductoWeb } from './cupon-web';

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

function opcionesDelBody(body: Record<string, unknown>): OpcionesCargaOves {
    const forma = body.forma === undefined || body.forma === null || body.forma === '' ? null : Number(body.forma);
    return {
        tratamiento: texto(body.tratamiento) || null,
        calibrado: (texto(body.calibrado).toUpperCase() in SERVICIO_CALIBRADO ? texto(body.calibrado).toUpperCase() : null) as OpcionesCargaOves['calibrado'],
        tipoArmazon: texto(body.tipoArmazon) || null,
        forma,
        enviaArmazon: texto(body.enviaArmazon) === 'No' ? 'No' : texto(body.enviaArmazon) === 'Si' ? 'Si' : null,
        cupon: cuponLimpio(texto(body.cupon)) || null,
        // Sin cupón tipeado, el robot lo genera en la web de la promo al aprobar (cupon-robot.ts).
        cuponAutomatico: !cuponLimpio(texto(body.cupon)),
        genero: (texto(body.genero).toUpperCase() === 'F' ? 'F' : texto(body.genero).toUpperCase() === 'M' ? 'M' : null) as OpcionesCargaOves['genero'],
        potenciaBoost: texto(body.potenciaBoost) || null,
        corredorPrecise: texto(body.corredorPrecise) || null,
    };
}

/**
 * Al preparar el 2º par: el cupón del 1º se generó con un producto para el
 * 2º (mismo Crizal que el 1º). Si este par va con otro Crizal o tecnología, el
 * cupón no coincide y Optovisión puede cobrar la diferencia: se AVISA fuerte
 * (es una decisión de negocio legítima, no se frena).
 */
async function avisoDeCuponDelSegundoPar(orderId: string, parConCargo: number, plan: PlanOves): Promise<string | null> {
    const primero = await prisma.labOrderDraft.findFirst({ where: { orderId, lab: LAB_OPTOVISION, pair: parConCargo, status: 'CARGADO' }, orderBy: { updatedAt: 'desc' }, select: { resumenPortal: true } }).catch(() => null);
    const r = (primero?.resumenPortal || {}) as RastroOves;
    if (!r.cuponResuelto?.segundo || !r.cuponWeb?.codigo || !plan.promo?.marca) return null;
    // Si el cupón se reutilizó y se hizo con otro 2º par, el que vale es el del cupón: se avisó al preparar el 1º y acá se compara contra lo resuelto hoy igual.
    const enCupon = rasgosDeProductoWeb(r.cuponResuelto.segundo.name);
    const este = rasgosDelCristalCRM(plan.productoCRM, plan.opciones.tratamiento, plan.promo.marca);
    if (!este.ok) return null;
    const igual = este.rasgos.material === enCupon.material && este.rasgos.tecnologia === enCupon.tecnologia && este.rasgos.tratamiento === enCupon.tratamiento;
    return igual ? null : `OJO: el cupón ${r.cuponWeb.codigo} se generó con el 2º par "${r.cuponResuelto.segundo.name}" y este pedido va como ${plan.producto.label} con ${plan.servicios.tratamiento}: no coinciden, Optovisión puede cobrar la diferencia. Si corresponde, corregí el cupón a mano en la web de la promo antes de aprobar.`;
}

export const CARGA_OPTOVISION: CargaAsistida = {
    lab: LAB_OPTOVISION,
    nombre: NOMBRE_OPTOVISION,
    robot: ROBOT_ACTOR_OPTOVISION,
    // OVES es una app de una sola pantalla, solo http y sin URL de alta: se abre la portada (entrar → "Nuevo Pedido").
    portal: { url: PORTAL_BASE, etiqueta: 'Abrir OVES para cargarlo a mano (entrar → Nuevo Pedido)' },

    async analizar(orderId) {
        const venta = await leerVentaParaCargaOves(orderId);
        if (!venta) return null;
        // Un mail de promo que quedó pendiente (faltaba el código del vendedor, no
        // era producción) se reintenta cada vez que alguien abre la ficha: es
        // idempotente y con reclamo atómico, y un CARGADO no tiene otro botón.
        const cargados = await prisma.labOrderDraft.findMany({ where: { orderId, lab: LAB_OPTOVISION, status: 'CARGADO' }, select: { resumenPortal: true } }).catch(() => []);
        const pendiente = cargados.some(c => !!((c.resumenPortal || {}) as RastroOves).mailPromoPendiente);
        if (pendiente) void avisarMailDePromo(orderId, ROBOT_ACTOR_OPTOVISION).catch(err => console.error('[lab-modulos] reintento del mail de promo Optovisión:', err?.message || err));
        const porPar = cristalesPorPar(venta);
        // La carga asistida va hasta 2 pares (un 3º se carga a mano).
        const pares = [...porPar.keys()].filter(p => p <= 2).sort((a, b) => a - b);
        const totalPares = Math.max(cantidadDeArmazones(venta as any), pares.length);
        const yaCargados = new Map<number, PedidoExistente | null>();
        for (const p of pares) yaCargados.set(p, await pedidoExistenteDelPar(orderId, p, totalPares));
        const roles = rolesDeLaPromo(venta);
        const avisoRoles = roles ? avisoDeRoles(roles, precioConSigno) : null;
        const origen = roles ? await numeroDelPrimerPar(orderId, roles.conCargo) : null;
        return {
            pares: pares.map(pair => {
                // La promo es de CADA par ("Mi Primer" es del cristal del par; la doble, de la venta).
                const promo = promoDeVenta(venta, pair);
                const rol = promo?.tipo === 'MI_PRIMER' ? 'PRIMER_PAR' : rolDe(roles, pair);
                const esSegundo = rol === 'SEGUNDO_PAR';
                // Se analiza con opciones "por defecto" para mostrar lo que FALTA en la venta; lo que elige quien prepara no cuenta como faltante.
                const r = planDeCarga(venta, pair, { tratamiento: 'CRIZAL_FORTE_UV', calibrado: 'COMUN', tipoArmazon: '2', forma: FORMAS_OVES[0], cupon: rol === 'PRIMER_PAR' ? 'XXXXXX' : null, pedidoOrigen: esSegundo ? (origen ?? '000000') : null, potenciaBoost: '0.4', corredorPrecise: 'LARGE' });
                const items = porPar.get(pair) || [];
                const nombreProducto = texto(items[0]?.product?.name ?? items[0]?.productNameSnapshot);
                const eleccion = eleccionQuePide(nombreProducto);
                const campos: CampoDePreparacion[] = [
                    ...(eleccion ? [{ clave: eleccion.clave, etiqueta: eleccion.etiqueta, tipo: 'select' as const, obligatorio: true, opciones: eleccion.opciones }] : []),
                    ...(/\+ crizal/i.test(nombreProducto) ? [{ clave: 'tratamiento', etiqueta: 'Crizal', tipo: 'select' as const, obligatorio: true, porDefecto: venta.labCrizal && CRIZALES.some(c => c.code === venta.labCrizal) ? venta.labCrizal : undefined, opciones: CRIZALES.map(c => ({ value: c.code, label: c.nombre })), ayuda: 'El que lleva el par (la venta no lo guarda: elegilo mirando lo que se cobró)' }] : []),
                    { clave: 'calibrado', etiqueta: 'Calibrado', tipo: 'select', obligatorio: true, porDefecto: venta.labEdgeInStore ? 'SIN' : 'COMUN', opciones: Object.entries(SERVICIO_CALIBRADO).map(([value, label]) => ({ value, label })) },
                    { clave: 'tipoArmazon', etiqueta: 'Tipo de armazón', tipo: 'select', obligatorio: true, opciones: TIPO_ARMAZON_OVES.map(t => ({ value: t.value, label: t.label })) },
                    { clave: 'enviaArmazon', etiqueta: '¿Se manda el armazón?', tipo: 'select', obligatorio: true, porDefecto: venta.userFrameBrand || venta.userFrameModel ? 'Si' : 'No', opciones: [{ value: 'Si', label: 'Sí (va al laboratorio)' }, { value: 'No', label: 'No' }] },
                    // La promo: cupón (vacío = lo genera el robot) y género (la web lo exige y la ficha no lo guarda). Obligatorio para
                    // que no falle recién al apretar Preparar (auditoría del 21/10/2026); si se tipea un cupón, el género no se usa.
                    ...(rol === 'PRIMER_PAR' && providerDePromo(promo?.marca, promo?.tipo) ? [
                        { clave: 'cupon', etiqueta: 'Cupón de la promo (vacío = lo genera el robot)', tipo: 'texto' as const, obligatorio: false, maxLength: 10, patron: PATRON_CUPON_HTML, placeholder: 'lo genera el robot', ayuda: `Dejalo VACÍO y el robot lo genera en ${promo?.marca === 'KODAK' ? WEB_DE_PROMO.KODAK : WEB_DE_PROMO.VARILUX} al aprobar, con los datos de la ficha. Si ya lo generaste a mano, ponelo acá. Sin cupón, Optovisión cobra los dos pares.` },
                        { clave: 'genero', etiqueta: 'Género del cliente (lo pide la web de la promo)', tipo: 'select' as const, obligatorio: true, opciones: [{ value: 'F', label: 'Femenino' }, { value: 'M', label: 'Masculino' }], ayuda: 'La web de la promo lo exige para el cupón y la ficha no lo guarda.' },
                    ] : []),
                    // Con el dibujo de cada forma del portal (public/laboratorios/optovision/formas, capturadas el 20/10/2026): "Forma 11" a secas no dice nada (Ishtar).
                    // OBLIGATORIA: el formulario de OVES frena con "Forma Armazon: debe elegir una de las imagenes" (probado en vivo el 21/10/2026). Va última: es la fila de dibujos.
                    { clave: 'forma', etiqueta: 'Forma del armazón (portal)', tipo: 'select', obligatorio: true, opciones: FORMAS_OVES.map(f => ({ value: String(f), label: `Forma ${String(f).padStart(2, '0')}`, imagen: `/laboratorios/optovision/formas/forma-${String(f).padStart(2, '0')}.png` })) },
                ];
                const existente = yaCargados.get(pair);
                const avisos = [...r.avisos, ...(avisoRoles && roles ? [avisoRoles] : [])];
                if (promo?.tipo === 'MI_PRIMER') avisos.push('Promo Mi Primer: misma modalidad que la doble (cupón, observación y mail a Optovisión con el nº de trabajo); el robot manda el mail al cargar.');
                // Qué le falta a la ficha para que el robot genere el cupón solo (el género se elige acá, así que se simula uno: no cuenta como faltante).
                if (rol === 'PRIMER_PAR' && r.ok) {
                    const c = pedidoDeCupon({ venta, plan: r.plan, productoCRMSegundo: cristalDelSegundoPar(venta), genero: 'F' });
                    if (!c.ok) avisos.push(`Para que el robot genere el cupón solo falta: ${c.faltantes.join(' · ')}. Si no, generalo a mano y tipealo.`);
                    else avisos.push(...c.avisos);
                }
                return {
                    pair,
                    titulo: nombreProducto || null,
                    faltantes: r.ok || r.aMano ? [] : r.faltantes.filter(f => !/^(el cristal lleva Crizal|calibrado|tipo de armazón|forma del armazón|es el 1er par de la promo)/.test(f)),
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
        // El cupón del 1er par: tipeado, o el que el robot obtuvo en la web de la promo.
        const cupon = plan?.cupon ?? r.cuponWeb?.codigo ?? null;
        // La promo PASO A PASO, en palabras, para que se vea qué se hizo y qué sigue (Ishtar, 21/10/2026: "que le indique bien todo").
        const pasosEnPalabras = (): string[] => {
            if (!plan?.promo) return [];
            const miPrimer = plan.promo.tipo === 'MI_PRIMER';
            const l: string[] = [];
            if (plan.rolPromo === 'SEGUNDO_PAR') {
                l.push(`✓ Cupón y 1er par: pedido ${plan.pedidoOrigen ?? '—'} (ya cargado).`);
                l.push(b.portalNumber ? `✓ 2º par cargado: pedido ${b.portalNumber}, asociado al ${plan.pedidoOrigen ?? '—'}.` : `⏳ 2º par: al aprobar se graba en OVES asociado al ${plan.pedidoOrigen ?? '—'}.`);
            } else {
                l.push(cupon ? `✓ Cupón de la promo: ${cupon}${r.cuponWeb ? (r.cuponWeb.reutilizado ? ' (ya existía en la web de la promo)' : ' (lo generó el robot en la web de la promo)') : ''}.` : '⏳ Cupón: al aprobar, el robot lo genera en la web de la promo.');
                l.push(b.portalNumber ? `✓ ${miPrimer ? 'Pedido' : '1er par'} cargado en OVES: nº ${b.portalNumber}, con el cupón en la observación.` : `⏳ ${miPrimer ? 'Pedido' : '1er par'}: al aprobar se graba en OVES con el cupón en la observación.`);
                if (!miPrimer) l.push(b.portalNumber ? '⏳ 2º par: ahora se prepara desde su propio par; lleva este nº en la observación.' : '⏳ 2º par: se prepara cuando este esté cargado.');
            }
            if (miPrimer || plan.rolPromo === 'SEGUNDO_PAR') {
                l.push(r.mailPromoEnviadoEl ? `✓ Mail a Optovisión enviado el ${formatDate(r.mailPromoEnviadoEl)} (promociones@, copia a cordoba@ y al local).` : r.mailPromoPendiente ? `⚠️ Mail a Optovisión pendiente: ${r.mailPromoPendiente}` : `⏳ Mail a Optovisión: sale solo cuando ${miPrimer ? 'el pedido' : 'este 2º par'} esté cargado.`);
            } else {
                l.push('⏳ Mail a Optovisión: sale solo cuando el 2º par esté cargado (se ve en el par 2).');
            }
            return l;
        };
        // Ya cargado: solo los pasos de la promo (lo demás se revisó antes de aprobar). En revisión: todo, sin repetidos
        // (los avisos del cupón viajan en el payload desde preparar y otra vez en el rastro).
        const avisos = b.status === 'CARGADO' ? pasosEnPalabras() : [...new Set([
            ...pasosEnPalabras(),
            ...(((b.payload || {}) as PayloadBorradorOves).avisos || []),
            ...(r.noAplican?.length ? [`el portal no toma para este producto: ${r.noAplican.join(', ')} (quedan sin cargar)`] : []),
            ...(r.cuponAvisos ?? []),
            ...(r.cuponWeb?.reutilizado ? [`el cliente ya tenía el cupón ${r.cuponWeb.codigo} de esta promo en la web (por DNI): se usa ese, no se generó otro`] : []),
        ])];
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
                // Con el cupón ya obtenido (reutilizado al preparar), la fila dice lo que la captura muestra: el real, no la marca.
                { titulo: 'Observación', valor: (cupon ? conCuponReal(plan.observacion, cupon) : plan.observacion) || '—', fuerte: !!plan.promo },
                ...(plan.rolPromo === 'PRIMER_PAR' ? [{ titulo: 'Cupón', valor: cupon ?? (plan.cuponAutomatico ? 'lo genera el robot en la web de la promo al aprobar' : '—'), fuerte: true }] : []),
                ...(r.cuponResuelto ? [{ titulo: 'En la web de la promo', valor: `${r.cuponResuelto.linea.name} · ${r.cuponResuelto.primero.name}${r.cuponResuelto.segundo ? ` + 2º par ${r.cuponResuelto.segundo.name}` : ''}` }] : []),
            ] : [],
            avisos,
            confirmarAntesDeAprobar: plan?.rolPromo === 'SEGUNDO_PAR' ? {
                titulo: 'Es el 2º par de la promo de Optovisión',
                texto: `Antes de aprobar, fijate en la pantalla del portal que la observación diga "Segundo par promo compañero/asociado al num ${plan.pedidoOrigen ?? '—'}" (el nº del 1er par). Sin eso Optovisión cobra los dos pares. Cuando quede cargado, el robot manda el mail a promociones@ y cordoba@ con los dos números.`,
            } : plan?.rolPromo === 'PRIMER_PAR' ? {
                titulo: plan.promo?.tipo === 'MI_PRIMER' ? 'Es una promo Mi Primer' : 'Es el 1er par de la promo de Optovisión',
                texto: `${cupon ? `Fijate en la pantalla del portal que la observación diga "Primer par de Promo num cupón ${cupon}".` : `El robot va a generar el cupón en la web de la promo (${r.cuponResuelto ? `${r.cuponResuelto.linea.name}: ${r.cuponResuelto.primero.name}${r.cuponResuelto.segundo ? ` + ${r.cuponResuelto.segundo.name}` : ''}` : 'con los datos de la ficha'}) y lo va a escribir en la observación antes de grabar.`} ${plan.promo?.tipo === 'MI_PRIMER' ? 'Cuando quede cargado, el robot manda el mail a Optovisión con el nº de trabajo.' : 'Cuando quede cargado, su nº va en la observación del 2º par: el robot lo anota solo al terminar.'}`,
            } : null,
            enlacePortal: null,
            elegido: elegidoDe(((b.payload || {}) as PayloadBorradorOves).opciones),
            documento: r.cuponWeb?.voucherUrl || r.cuponWeb?.pdfUrl ? { url: (r.cuponWeb.voucherUrl || r.cuponWeb.pdfUrl)!, etiqueta: `Voucher del cupón ${r.cuponWeb.codigo} (PDF de la web de la promo)` } : null,
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
        if (texto(body.cupon) && !PATRON_CUPON.test(opciones.cupon ?? '')) return { ok: false, status: 400, error: 'El cupón tiene que ser el código de la web de la promo (letras y números, 6 a 10).' };
        // El nº del 1er par lo deduce el CRM con la regla común (nunca un anulado ni un reproceso): no se acepta del navegador.
        const roles = rolesDeLaPromo(venta);
        if (roles && pair === roles.sinCargo) {
            opciones.pedidoOrigen = await numeroDelPrimerPar(orderId, roles.conCargo);
            if (!opciones.pedidoOrigen) return { ok: false, status: 409, error: `Es el 2º par de la promo: primero cargá el 1er par (par ${roles.conCargo}); su nº va en la observación y sin él Optovisión cobra los dos pares.` };
        }
        const r = planDeCarga(venta, pair, opciones);
        if (!r.ok) return { ok: false, status: 422, error: r.aMano ? `Este pedido va a mano: ${r.aMano}.` : 'Faltan datos para armar el pedido.', faltantes: r.faltantes, avisos: r.avisos };
        const avisos = [...r.avisos];
        // Cupón a cargo del robot: lo que la web de la promo exige tiene que estar ANTES de preparar (género, DNI, nacimiento, receta completa).
        if (r.plan.cuponAutomatico) {
            const c = pedidoDeCupon({ venta, plan: r.plan, productoCRMSegundo: cristalDelSegundoPar(venta), genero: opciones.genero });
            if (!c.ok) return { ok: false, status: 422, error: 'Para que el robot genere el cupón en la web de la promo faltan datos (o generalo a mano y tipealo en "Cupón").', faltantes: c.faltantes, avisos };
            avisos.push(...c.avisos);
        }
        if (r.plan.rolPromo === 'SEGUNDO_PAR' && roles) {
            const aviso = await avisoDeCuponDelSegundoPar(orderId, roles.conCargo, r.plan);
            if (aviso) avisos.push(aviso);
        }
        const payload: PayloadBorradorOves = { opciones, plan: r.plan, avisos };
        const preparado = await Borradores.preparar({ lab: LAB_OPTOVISION, orderId, pair, payload, actor });
        // El robot trabaja FUERA del request (turno, login, formulario: minutos): la ficha sondea el estado.
        void prepararEnPortal(preparado.id).catch(err => console.error('[lab-modulos] preparar en OVES:', err?.message || err));
        return { ok: true, status: 202, borrador: preparado, avisos };
    },

    confirmar: confirmarBorradorAprobado,
    // En OVES no hay borrador en el portal: un rechazo no deja nada que deshacer.
    despuesDeRechazar: async () => ({ cancelado: true, motivo: 'no se había mandado nada al portal' }),
};
