import { prisma } from '../../../lib/db';
import { sendEmail } from '../../../lib/email';
import { logAudit } from '../../../lib/audit';
import { PRIVATE_ADMIN_EMAILS } from '../../../lib/constants';
import type { Actor } from '../../../lib/actor';
import { Borradores } from '../carga/borrador';
import { puedeCrearPedidosReales } from '../carga/produccion';
import { asuntoDelMail, DESTINATARIOS_PROMO } from './promo';
import { LAB_OPTOVISION, NOMBRE_OPTOVISION, VARIABLE_PERMISO_OVES } from './portal';
import type { PayloadBorradorOves, RastroOves } from './borrador-portal';

/**
 * PASO 2 DEL PROCEDIMIENTO DE LA PROMO (Optovisión Essilor, 23/9/2026): el
 * mail a promociones@ y cordoba@ con asunto "<código del vendedor> <nº 1>-<nº 2>".
 * Sin él, Optovisión cobra los dos pares. Sale solo cuando los DOS pares de la
 * promo doble están cargados con su nº, una sola vez, y queda anotado en el
 * borrador del 2º par, en la ficha del cliente y en el AuditLog. Si algo lo
 * impide (falta el código del vendedor, no es producción), NO se inventa: se
 * anota como pendiente y la ficha lo muestra.
 *
 * El "código" del asunto es el USUARIO de la óptica en OVES (Ishtar,
 * 20/10/2026: "nuestro nombre de usuario en Optovisión es ATEL01"): sale de
 * `OVES_USER`, la misma variable con la que entra el robot. Si algún día
 * Optovisión diera un código por persona, SystemSetting
 * `optovision_codigos_vendedor` (JSON { "Nombre como en labSentBy": "CODIGO" })
 * lo pisa para esa persona.
 */
export const CLAVE_CODIGOS_VENDEDOR = 'optovision_codigos_vendedor';

export async function codigoDeVendedorOptovision(nombre: string | null | undefined, env: Record<string, string | undefined> = process.env): Promise<string | null> {
    const fila = await prisma.systemSetting.findUnique({ where: { key: CLAVE_CODIGOS_VENDEDOR } }).catch(() => null);
    if (fila?.value && nombre) {
        try {
            const mapa = JSON.parse(fila.value) as Record<string, string>;
            const buscado = nombre.trim().toLowerCase();
            const k = Object.keys(mapa).find(n => n.trim().toLowerCase() === buscado);
            if (k && String(mapa[k]).trim()) return String(mapa[k]).trim();
        } catch { /* mapa roto: se usa el usuario */ }
    }
    return (env.OVES_USER || '').trim().toUpperCase() || null;
}

/** El cuerpo del mail, en texto plano. Puro. */
export function cuerpoDelMail(o: { cliente: string; primerPar: string; segundoPar: string | null; cupon: string | null; promo: string }): string {
    return [
        `Buen día,`,
        ``,
        o.segundoPar ? `Les enviamos los dos trabajos de la promo ${o.promo} del paciente ${o.cliente}:` : `Les enviamos el trabajo de la promo ${o.promo} del paciente ${o.cliente}:`,
        `· ${o.segundoPar ? '1er par' : 'Pedido'}: ${o.segundoPar ? 'pedido ' : ''}${o.primerPar}${o.cupon ? ` (cupón ${o.cupon})` : ''}`,
        ...(o.segundoPar ? [`· 2º par: pedido ${o.segundoPar} (asociado al ${o.primerPar})`] : []),
        ``,
        `Muchas gracias.`,
        `Atelier Óptica`,
    ].join('\n');
}

/**
 * Si la venta tiene una promo doble con los dos pares CARGADOS y el mail no
 * salió, lo manda. Idempotente: se puede llamar en cada CARGADO y en cada
 * reintento. Devuelve qué hizo.
 */
export async function avisarMailDePromo(orderId: string, robot: Actor, aprobadoPor: { id: string | null; name: string } | null = null): Promise<{ enviado: boolean; motivo: string }> {
    // Lo manda el robot; la persona que aprobó queda nombrada, no firmando (como `aplicarEstadoEnVenta`).
    const firma = aprobadoPor ? `${robot.name} (aprobó ${aprobadoPor.name})` : robot.name;
    const borradores = await prisma.labOrderDraft.findMany({ where: { orderId, lab: LAB_OPTOVISION, status: 'CARGADO' }, select: { id: true, pair: true, payload: true, portalNumber: true, resumenPortal: true } });
    const conPlan = borradores.map(b => ({ ...b, plan: (b.payload as unknown as PayloadBorradorOves)?.plan })).filter(b => b.plan);
    const primero = conPlan.find(b => b.plan.rolPromo === 'PRIMER_PAR');
    const segundo = conPlan.find(b => b.plan.rolPromo === 'SEGUNDO_PAR');
    // Mi Primer (un solo par): el mail sale con el 1er par cargado. Doble: con los dos.
    const esMiPrimer = primero?.plan.promo?.tipo === 'MI_PRIMER';
    const dueno = esMiPrimer ? primero : segundo;
    if (!dueno) return { enviado: false, motivo: esMiPrimer ? 'no hay un par de Mi Primer cargado' : 'no hay un 2º par de promo cargado' };
    const rastro = (dueno.resumenPortal || {}) as RastroOves;
    if (rastro.mailPromoEnviadoEl) return { enviado: false, motivo: `ya enviado el ${rastro.mailPromoEnviadoEl}` };
    const numeroPrimero = primero?.portalNumber ?? segundo?.plan.pedidoOrigen ?? null;
    const numeroSegundo = esMiPrimer ? null : (segundo?.portalNumber ?? null);
    const pendiente = async (motivo: string) => { await Borradores.anotarRastro(dueno.id, { mailPromoPendiente: motivo } as any).catch(() => null); return { enviado: false, motivo }; };
    if (!numeroPrimero || (!esMiPrimer && !numeroSegundo)) return pendiente(esMiPrimer ? 'falta el nº del par para el mail a Optovisión' : 'faltan los nº de los dos pares para el mail a Optovisión');
    const venta = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, clientId: true, labSentBy: true, client: { select: { name: true } } } });
    if (!venta) return pendiente('la venta no existe');
    const codigo = await codigoDeVendedorOptovision(venta.labSentBy);
    if (!codigo) return pendiente('falta el usuario de OVES (OVES_USER en el entorno), que es el código que va en el asunto del mail: cargarlo y reintentar desde la ficha. Sin el mail, Optovisión cobra los dos pares.');
    const asunto = asuntoDelMail(codigo, numeroPrimero, numeroSegundo);
    if (!asunto) return pendiente('no se pudo armar el asunto del mail');
    if (!puedeCrearPedidosReales(VARIABLE_PERMISO_OVES)) return pendiente(`fuera de producción no se manda el mail a Optovisión (asunto: ${asunto})`);
    const marca = (dueno.plan.promo?.marca ?? primero?.plan.promo?.marca) === 'KODAK' ? 'Kodak' : 'Varilux';
    const promo = esMiPrimer ? `Mi Primer ${marca}` : marca === 'Kodak' ? '2x1 Kodak' : 'Doble Disfrute Varilux';
    const cliente = venta.client?.name || 'cliente';
    // Reclamo atómico ANTES de mandar: solo un llamador pasa (dos cargas a la vez
    // o un reintento encimado mandarían dos mails). Un reclamo de más de 10 min
    // sin "enviado" se considera caído y se puede volver a reclamar.
    const limite = new Date(Date.now() - 10 * 60_000).toISOString();
    const reclamado = await prisma.$executeRaw`UPDATE "LabOrderDraft" SET "resumenPortal" = COALESCE("resumenPortal", '{}'::jsonb) || ${JSON.stringify({ mailPromoReclamadoEl: new Date().toISOString() })}::jsonb
        WHERE id = ${dueno.id} AND ("resumenPortal"->>'mailPromoEnviadoEl') IS NULL AND (("resumenPortal"->>'mailPromoReclamadoEl') IS NULL OR ("resumenPortal"->>'mailPromoReclamadoEl') < ${limite})`;
    if (reclamado !== 1) return { enviado: false, motivo: 'otro proceso está mandando el mail (o ya salió)' };
    try {
        await sendEmail({
            to: DESTINATARIOS_PROMO.join(','),
            bcc: PRIVATE_ADMIN_EMAILS,
            subject: asunto,
            text: cuerpoDelMail({ cliente, primerPar: numeroPrimero, segundoPar: numeroSegundo, cupon: primero?.plan.cupon ?? null, promo }),
        });
    } catch (err: any) {
        // Se suelta el reclamo y queda PENDIENTE: la ficha lo muestra y lo reintenta al abrirse.
        await Borradores.anotarRastro(dueno.id, { mailPromoReclamadoEl: null } as any).catch(() => null);
        return pendiente(`no se pudo mandar el mail a Optovisión (${err?.message || err}); se reintenta al abrir la ficha`);
    }
    const cuando = new Date().toISOString();
    await Borradores.anotarRastro(dueno.id, { mailPromoEnviadoEl: cuando, mailPromoPendiente: null } as any);
    await prisma.interaction.create({
        data: { clientId: venta.clientId, type: 'LAB_STATUS', content: `📧 ${firma}: mail de la promo ${promo} enviado a ${NOMBRE_OPTOVISION} (${DESTINATARIOS_PROMO.join(', ')}) con asunto "${asunto}".`, userId: robot.id ?? null, userName: firma },
    }).catch(err => console.error('[lab-modulos] no se pudo registrar el mail de promo en la ficha:', err));
    logAudit({ userId: robot.id ?? null, userName: firma, action: 'UPDATE', entityType: 'ORDER', entityId: orderId, details: { lab: LAB_OPTOVISION, mailPromo: asunto, destinatarios: DESTINATARIOS_PROMO } }).catch(() => null);
    return { enviado: true, motivo: asunto };
}
