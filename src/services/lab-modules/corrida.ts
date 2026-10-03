import { prisma } from '../../lib/db';
import { sendEmail } from '../../lib/email';
import { PRIVATE_ADMIN_EMAILS } from '../../lib/constants';
import { emailsEnabled } from '../lab-recon/backfill';
import { appUrl } from '../lab-recon/types';
import type { LabModule, OpcionesCorrida, ResultadoSeguimiento } from './contrato';
import { claveDeModulo } from './contrato';
import { conTurno } from './portal/turno';
import { CredencialRechazadaError } from './portal/navegador';
import { estadoDeSalud, formatearCorte, marcarAlertado, registrarExito, registrarFalla } from './portal/salud';

/**
 * UNA CORRIDA DE SEGUIMIENTO de un módulo, con todo lo que la rodea: el turno
 * del portal, la salud (éxito / caída / recuperación) y los avisos. El cron es
 * una línea que llama acá; un script de ensayo también puede.
 *
 * Avisos (solo en producción, o con FORCE_LAB_ALERTS=1):
 *  · caída del módulo: a las 12 h, repetido cada 12 h; credencial rechazada
 *    en el acto (portal/salud.ts);
 *  · restablecido: solo si el corte se había alertado;
 *  · ventas enviadas sin pedido en el portal y pedidos atrasados: UNA vez por
 *    día y por conjunto (misma regla que el aviso de fuentes caídas del cron
 *    diario: cinco mails iguales terminan en la papelera).
 * Todo va a PRIVATE_ADMIN_EMAILS: es operación de laboratorio, no del local.
 */
export interface ResultadoCorrida {
    lab: string;
    ok: boolean;
    skipped?: boolean;
    reason?: string;
    error?: string;
    seguimiento?: ResultadoSeguimiento;
    avisos: string[];
}

const hoyArg = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });

async function avisarUnaVezPorDia(lab: string, clave: string, firma: string, enviar: () => Promise<{ success?: boolean } | void>): Promise<boolean> {
    const key = claveDeModulo(lab, clave);
    const valor = `${hoyArg()}:${firma}`;
    const previo = await prisma.systemSetting.findUnique({ where: { key } }).catch(() => null);
    if (previo?.value === valor) return false;
    const r = await enviar();
    if (r && r.success === false) return false;
    await prisma.systemSetting.upsert({ where: { key }, update: { value: valor }, create: { key, value: valor } }).catch(() => null);
    return true;
}

const linkVenta = (orderId: string) => `${appUrl()}/admin/ventas?id=${orderId}`;

/** ¿Ya pasó la cadencia del módulo desde la última corrida buena? Sin cadencia o sin corrida previa, siempre. Puro. */
export function tocaPaseRapido(ultimaOkAt: Date | null, cadenciaMin: number | undefined, ahora: Date): boolean {
    if (!cadenciaMin || !ultimaOkAt) return true;
    return ahora.getTime() - ultimaOkAt.getTime() >= cadenciaMin * 60_000;
}

export async function correrSeguimiento(modulo: LabModule, opts: OpcionesCorrida = {}): Promise<ResultadoCorrida> {
    const avisos: string[] = [];
    const lab = modulo.clave;
    if (!modulo.capacidades.seguimiento) return { lab, ok: true, skipped: true, reason: 'el módulo no hace seguimiento', avisos };

    const pasada = opts.sinceDays ? 'rapida' : 'completa';
    if (pasada === 'rapida') {
        const salud = await estadoDeSalud(lab);
        if (!tocaPaseRapido(salud.ultimaOkAt, modulo.cadenciaRapidaMin, new Date())) {
            return { lab, ok: true, skipped: true, reason: `pase rápido cada ${modulo.cadenciaRapidaMin} min; la última corrida buena fue hace menos`, avisos };
        }
    }
    let resultado: ResultadoSeguimiento | { skipped: true; reason: string };
    try {
        resultado = await conTurno(lab, pasada, () => modulo.seguirPedidos(opts), { esperar: opts.esperarTurno });
    } catch (err: any) {
        const credencial = err instanceof CredencialRechazadaError;
        const decision = await registrarFalla(lab, credencial);
        console.error(`[lab-modulos] ${modulo.nombre}: falló el seguimiento (${decision.motivo}, caído hace ${formatearCorte(decision.caidoHaceMs)}):`, err?.message || err);
        if (decision.alertar && emailsEnabled()) {
            const asunto = credencial
                ? `🔑 ${modulo.nombre}: el portal rechazó la credencial`
                : `⚠️ ${modulo.nombre} lleva ${formatearCorte(decision.caidoHaceMs)} sin sincronizar`;
            const r = await sendEmail({
                to: PRIVATE_ADMIN_EMAILS,
                subject: asunto,
                html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
                    <h2 style="color:#d32f2f">${asunto}</h2>
                    <p>El seguimiento de pedidos de <strong>${modulo.nombre}</strong> no está corriendo.</p>
                    <p><strong>Último error:</strong> ${String(err?.message || err)}</p>
                    ${credencial ? '<p>Hay que revisar las variables de entorno en Railway y, si están bien, pedirle la clave nueva al laboratorio. Hasta entonces no entran estados ni costos.</p>' : '<p style="color:#888;font-size:12px">Si sigue caído, llega otro aviso en 12 horas. Al recuperarse avisa solo.</p>'}
                    </div>`,
            });
            if (r?.success) { await marcarAlertado(lab); avisos.push(credencial ? 'credencial-rechazada' : 'caida'); }
        }
        return { lab, ok: false, error: err?.message || String(err), avisos };
    }

    if ('skipped' in resultado && resultado.skipped) {
        return { lab, ok: true, skipped: true, reason: resultado.reason, avisos };
    }
    const seguimiento = resultado as ResultadoSeguimiento;

    const salud = await registrarExito(lab);
    if (salud.avisarRecuperacion && emailsEnabled()) {
        await sendEmail({
            to: PRIVATE_ADMIN_EMAILS,
            subject: `✅ ${modulo.nombre} restablecido`,
            html: `<h3 style="color:#2e7d32">✅ ${modulo.nombre} volvió a sincronizar</h3><p>Estuvo <b>${formatearCorte(salud.corteMs)}</b> sin conexión. Última corrida: ${seguimiento.vistos} pedidos vistos, ${seguimiento.avanzados} ventas avanzadas.</p>`,
        });
        avisos.push('restablecido');
    }

    if (emailsEnabled() && (seguimiento.sinPedidoEnPortal.length || seguimiento.atrasados.length)) {
        const firma = [
            ...seguimiento.sinPedidoEnPortal.map(v => `s:${v.orderId}`),
            ...seguimiento.atrasados.map(p => `a:${p.portalNumber}`),
        ].sort().join(',');
        const enviado = await avisarUnaVezPorDia(lab, 'avisoDiario', firma, () => sendEmail({
            to: PRIVATE_ADMIN_EMAILS,
            subject: `🏭 ${modulo.nombre}: ${seguimiento.sinPedidoEnPortal.length} venta(s) sin pedido en el portal, ${seguimiento.atrasados.length} atrasado(s)`,
            html: `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#1f2937">
                ${seguimiento.sinPedidoEnPortal.length ? `<h3 style="color:#d97706">Ventas enviadas al laboratorio que NO aparecen en el portal</h3>
                <p>Están marcadas como enviadas en el CRM, pero ${modulo.nombre} no tiene un pedido con su número ni con su código. O no se cargaron, o se cargaron sin identificar la venta.</p>
                <ul style="line-height:1.7">${seguimiento.sinPedidoEnPortal.map(v => `<li><a href="${linkVenta(v.orderId)}">${v.cliente}</a> — enviada hace ${v.enviadaHace} día(s)</li>`).join('')}</ul>` : ''}
                ${seguimiento.atrasados.length ? `<h3 style="color:#d32f2f">Pedidos con la fecha del laboratorio vencida</h3>
                <ul style="line-height:1.7">${seguimiento.atrasados.map(p => `<li>Pedido ${p.portalNumber}${p.cliente ? ` — ${p.cliente}` : ''}: prometido para ${p.estimatedAt.toLocaleDateString('es-AR')}, ${p.diasDeAtraso} día(s) de atraso</li>`).join('')}</ul>` : ''}
                <p style="color:#888;font-size:12px">Este aviso sale una vez por día mientras la lista no cambie.</p></div>`,
        }));
        if (enviado) avisos.push('aviso-diario');
    }

    return { lab, ok: true, seguimiento, avisos };
}
