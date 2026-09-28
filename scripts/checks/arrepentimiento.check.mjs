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
 *   · el mail al cliente sale SOLO si su email coincide con el del pedido, así
 *     el formulario no sirve para mandarle mails nuestros a un tercero;
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

function dobles({ falleNotificacion = false } = {}) {
    const registro = { notificaciones: [], interacciones: [], auditorias: [], mails: [], consultas: [] };
    const db = {
        order: {
            findMany: async (args) => {
                registro.consultas.push(args);
                const sufijo = args?.where?.id?.endsWith;
                return PEDIDO_ID.endsWith(sufijo)
                    ? [{ id: PEDIDO_ID, clientId: 'cliente-1', client: { id: 'cliente-1', name: 'Ana Pérez', email: 'ana@ejemplo.com' } }]
                    : [];
            },
        },
        notification: {
            create: async (args) => {
                if (falleNotificacion) throw new Error('base caída');
                registro.notificaciones.push(args.data);
            },
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
