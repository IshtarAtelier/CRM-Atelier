#!/usr/bin/env node
/**
 * Botón de arrepentimiento (src/services/arrepentimiento.service.ts), fijado.
 *
 * POR QUÉ EXISTE
 * La auditoría del 25/9/2026 encontró que la tienda no tenía botón de
 * arrepentimiento (Disp. 954/2025). El trámite tiene reglas que, si se rompen,
 * no se ven desde afuera:
 *   · el cliente SIEMPRE se lleva un código, exista o no el pedido, y la
 *     respuesta no revela qué números de pedido son reales;
 *   · la constancia queda firmada (AuditLog con SYSTEM_ACTOR) y el equipo se
 *     entera (Notification + mail);
 *   · el mail al cliente sale SOLO si su email coincide con el del pedido (el
 *     de la ficha o el que escribió al comprar), así el formulario no sirve
 *     para mandarle mails nuestros a un tercero;
 *   · un formulario público no puede llenar la campana: una notificación
 *     pendiente por pedido y tope diario para las que no coinciden;
 *   · si la base no responde, falla: mejor un error que un código de un
 *     trámite que no quedó registrado.
 *
 * Corre sin base, sin red y sin mandar mails (todo va contra dobles).
 * Uso: npm run check:arrepentimiento
 */

import { generarCodigoTramite, normalizarNumeroPedido, registrarArrepentimiento } from '../../src/services/arrepentimiento.service.ts';

const casos = [];
const esperar = (nombre, cond, detalle) => casos.push({ nombre, ok: !!cond, detalle });

const PEDIDO_ID = 'cmuhb8wue006y13o71crvabcd'; // el cliente ve "#ABCD"
const ahora = () => new Date('2026-09-28T19:30:00.000Z'); // 16:30 en Argentina

function dobles({ falleNotificacion = false, emailFicha = 'ana@ejemplo.com', emailAuditoria = null, emailIntentoMp = null, pendientesDelPedido = 0, sinPedidoUltimas24h = 0 } = {}) {
    const registro = { notificaciones: [], interacciones: [], auditorias: [], mails: [], consultas: [] };
    const db = {
        order: {
            findMany: async (args) => {
                registro.consultas.push(args);
                const sufijo = args?.where?.id?.endsWith;
                return PEDIDO_ID.endsWith(sufijo)
                    ? [{
                        id: PEDIDO_ID, clientId: 'cliente-1',
                        client: { id: 'cliente-1', name: 'Ana Pérez', email: emailFicha },
                        paymentIntents: emailIntentoMp ? [{ checkoutContext: JSON.stringify({ customer: { email: emailIntentoMp } }) }] : [],
                    }]
                    : [];
            },
        },
        auditLog: {
            findMany: async (args) => (emailAuditoria && args?.where?.entityId?.in?.includes(PEDIDO_ID)
                ? [{ entityId: PEDIDO_ID, details: { orderType: 'SALE', email: emailAuditoria } }]
                : []),
        },
        notification: {
            create: async (args) => {
                if (falleNotificacion) throw new Error('base caída');
                registro.notificaciones.push(args.data);
            },
            count: async (args) => (args?.where?.orderId ? pendientesDelPedido : sinPedidoUltimas24h),
        },
        interaction: { create: async (args) => { registro.interacciones.push(args.data); } },
    };
    const enviarEmail = async (m) => { registro.mails.push(m); return { success: true }; };
    const registrarAuditoria = async (a) => { registro.auditorias.push(a); };
    return { registro, deps: { db, enviarEmail, registrarAuditoria, ahora } };
}

// Formato
esperar('normaliza "#a1b2 " a "A1B2"', normalizarNumeroPedido(' #a1b2 ') === 'A1B2');
{
    const c = generarCodigoTramite(ahora(), () => 0);
    esperar('código ARR-AAAAMMDD-XXXXX con la fecha de Argentina', c === 'ARR-20260928-AAAAA', c);
    const tarde = generarCodigoTramite(new Date('2026-09-29T01:30:00.000Z'), () => 0); // 22:30 del 28 en Argentina
    esperar('a las 22:30 de Argentina el código sigue siendo del día 28', tarde.startsWith('ARR-20260928-'), tarde);
    esperar('el código no usa 0/O ni 1/I/L', !/[01OIL]/.test(generarCodigoTramite(ahora()).slice(13)));
}

// Pedido y email que coinciden
{
    const { registro, deps } = dobles();
    const r = await registrarArrepentimiento({ numeroPedido: '#abcd', email: 'ANA@ejemplo.com ', motivo: 'No me quedó <b>bien</b>' }, deps);
    await new Promise((ok) => setTimeout(ok, 0));
    esperar('devuelve un código', /^ARR-\d{8}-[A-Z2-9]{5}$/.test(r.codigo), r.codigo);
    esperar('busca el pedido por los últimos 4 del id', registro.consultas[0]?.where?.id?.endsWith === 'abcd', JSON.stringify(registro.consultas[0]));
    esperar('crea UNA notificación pendiente del tipo WITHDRAWAL_REQUEST, atada al pedido',
        registro.notificaciones.length === 1 && registro.notificaciones[0].type === 'WITHDRAWAL_REQUEST'
        && registro.notificaciones[0].status === 'PENDING' && registro.notificaciones[0].orderId === PEDIDO_ID,
        JSON.stringify(registro.notificaciones));
    const a = registro.auditorias[0];
    esperar('deja la constancia firmada por Sistema, con el código como entidad',
        a && a.entityType === 'WITHDRAWAL_REQUEST' && a.entityId === r.codigo && a.userName === 'Sistema' && a.details?.emailCoincide === true,
        JSON.stringify(a));
    esperar('deja una nota firmada en la ficha del cliente',
        registro.interacciones.length === 1 && registro.interacciones[0].clientId === 'cliente-1'
        && registro.interacciones[0].userName === 'Sistema' && registro.interacciones[0].content.includes(r.codigo),
        JSON.stringify(registro.interacciones));
    esperar('avisa al equipo y le manda la constancia al cliente', registro.mails.length === 2
        && registro.mails.some((m) => m.to.trim() === 'ANA@ejemplo.com'.trim() || m.to === 'ANA@ejemplo.com'), JSON.stringify(registro.mails.map((m) => m.to)));
    const alEquipo = registro.mails.find((m) => m.subject.includes('Botón de arrepentimiento'));
    esperar('el mail al equipo trae el link /admin/ventas?id=', alEquipo?.html.includes(`/admin/ventas?id=${PEDIDO_ID}`));
    esperar('el motivo va escapado (nada de HTML del cliente en el mail)', alEquipo && !alEquipo.html.includes('<b>bien</b>') && alEquipo.html.includes('&lt;b&gt;'));
}

// Pedido que no existe o email que no coincide
for (const [nombre, solicitud] of [
    ['pedido inexistente', { numeroPedido: '#ZZZZ', email: 'ana@ejemplo.com' }],
    ['email que no es el del pedido', { numeroPedido: '#ABCD', email: 'otra@ejemplo.com' }],
]) {
    const { registro, deps } = dobles();
    const r = await registrarArrepentimiento(solicitud, deps);
    await new Promise((ok) => setTimeout(ok, 0));
    esperar(`${nombre}: igual devuelve un código (no revela si el pedido existe)`, /^ARR-/.test(r.codigo) && Object.keys(r).sort().join() === 'codigo,recibidoEn');
    esperar(`${nombre}: igual queda la notificación y la constancia`, registro.notificaciones.length === 1 && registro.auditorias.length === 1);
    esperar(`${nombre}: la notificación pide revisarlo a mano`, registro.notificaciones[0]?.message.includes('revisar a mano') && registro.notificaciones[0]?.orderId === null);
    esperar(`${nombre}: NO le manda mail a ese email, solo al equipo`, registro.mails.length === 1 && !registro.mails[0].to.includes(solicitud.email), JSON.stringify(registro.mails.map((m) => m.to)));
    esperar(`${nombre}: no toca ninguna ficha`, registro.interacciones.length === 0);
}

// Cliente que ya existía: la ficha se encontró por teléfono y tiene otro
// email (o ninguno). El que escribió al comprar está en la auditoría de la
// compra web o en el intento de Mercado Pago.
for (const [nombre, opciones] of [
    ['email del checkout guardado en la auditoría de la compra', { emailFicha: null, emailAuditoria: 'ana.nueva@ejemplo.com' }],
    ['email del checkout en el intento de Mercado Pago', { emailFicha: 'vieja@ejemplo.com', emailIntentoMp: 'Ana.Nueva@ejemplo.com' }],
]) {
    const { registro, deps } = dobles(opciones);
    await registrarArrepentimiento({ numeroPedido: '#ABCD', email: 'ana.nueva@ejemplo.com' }, deps);
    await new Promise((ok) => setTimeout(ok, 0));
    esperar(`${nombre}: coincide con el pedido`, registro.notificaciones[0]?.orderId === PEDIDO_ID, JSON.stringify(registro.notificaciones));
    esperar(`${nombre}: el cliente recibe su constancia`, registro.mails.some((m) => m.to === 'ana.nueva@ejemplo.com'));
}

// Una sola notificación pendiente por pedido
{
    const { registro, deps } = dobles({ pendientesDelPedido: 1 });
    const r = await registrarArrepentimiento({ numeroPedido: '#ABCD', email: 'ana@ejemplo.com' }, deps);
    await new Promise((ok) => setTimeout(ok, 0));
    esperar('pedido con una solicitud pendiente: no se repite en la campana ni en el mail del equipo',
        registro.notificaciones.length === 0 && !registro.mails.some((m) => m.subject.includes('Botón de arrepentimiento')), JSON.stringify(registro.mails.map((m) => m.subject)));
    esperar('…pero el cliente recibe su código y queda la constancia', registro.mails.some((m) => m.to === 'ana@ejemplo.com') && registro.auditorias[0]?.entityId === r.codigo && registro.auditorias[0]?.details?.sinAviso === 'ya-pendiente');
}

// Tope diario para las que no coinciden con ningún pedido (formulario público)
{
    const { registro, deps } = dobles({ sinPedidoUltimas24h: 5 });
    const r = await registrarArrepentimiento({ numeroPedido: '#ZZZZ', email: 'spam@ejemplo.com' }, deps);
    await new Promise((ok) => setTimeout(ok, 0));
    esperar('pasado el tope diario sin pedido: ni campana ni mails', registro.notificaciones.length === 0 && registro.mails.length === 0);
    esperar('…pero el código existe en la auditoría', /^ARR-/.test(r.codigo) && registro.auditorias[0]?.entityId === r.codigo && registro.auditorias[0]?.details?.sinAviso === 'tope-diario');
}

// Campo trampa: el código que se muestra tiene que ser real
{
    const { registro, deps } = dobles();
    const r = await registrarArrepentimiento({ numeroPedido: '#ABCD', email: 'ana@ejemplo.com', sospechoso: true }, deps);
    await new Promise((ok) => setTimeout(ok, 0));
    esperar('campo trampa: queda la constancia con el mismo código que se muestra', registro.auditorias[0]?.entityId === r.codigo && registro.auditorias[0]?.details?.sinAviso === 'campo-trampa');
    esperar('campo trampa: no avisa, no manda mails, no toca la ficha', registro.notificaciones.length === 0 && registro.mails.length === 0 && registro.interacciones.length === 0);
}

// La compra web guarda el email del checkout (si no, un cliente que ya
// existía no coincide nunca) y la ruta ya no inventa códigos.
{
    const { readFileSync } = await import('node:fs');
    const payway = readFileSync(new URL('../../src/app/api/checkout/payway/route.ts', import.meta.url), 'utf8');
    esperar('la auditoría de la compra web guarda el email del checkout', /entityType: 'ORDER'[\s\S]{0,400}details: \{[^}]*email: customer\.email/.test(payway));
    const ruta = readFileSync(new URL('../../src/app/api/web/arrepentimiento/route.ts', import.meta.url), 'utf8');
    esperar('la ruta no devuelve códigos que no se registraron', !/generarCodigoTramite/.test(ruta) && /sospechoso: !!sitio/.test(ruta));
}

// Base caída
{
    const { registro, deps } = dobles({ falleNotificacion: true });
    let fallo = false;
    try { await registrarArrepentimiento({ numeroPedido: '#ABCD', email: 'ana@ejemplo.com' }, deps); } catch { fallo = true; }
    esperar('si no se puede registrar, falla en vez de dar un código', fallo);
    esperar('y no manda mails de un trámite que no quedó', registro.mails.length === 0);
}

const fallas = casos.filter((c) => !c.ok);
for (const c of casos) console.log(`${c.ok ? '✅' : '❌'} ${c.nombre}${c.ok || !c.detalle ? '' : `\n     ${c.detalle}`}`);
console.log(`\n${casos.length - fallas.length}/${casos.length} casos OK`);
if (fallas.length) process.exit(1);
