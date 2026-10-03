import { prisma } from '../../lib/db';
import { sendEmail } from '../../lib/email';
import { PRIVATE_ADMIN_EMAILS } from '../../lib/constants';
import { emailsEnabled } from '../lab-recon/backfill';
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
 *  · restablecido: solo si el corte se había alertado.
 * Son los mismos avisos de salud que ya tiene SmartLab. Las ventas sin pedido
 * en el portal y los pedidos atrasados NO mandan mail: van al reporte semanal
 * (CLAUDE.md: de laboratorio salen dos mails y nada más).
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

    // Las ventas sin pedido en el portal y los pedidos atrasados NO mandan un
    // mail propio (CLAUDE.md: de laboratorio salen DOS mails y nada más). Se
    // guardan por módulo y el reporte semanal los muestra (weekly-email.ts).
    await guardarHallazgos(lab, {
        en: new Date().toISOString(),
        sinPedidoEnPortal: seguimiento.sinPedidoEnPortal,
        atrasados: seguimiento.atrasados.map(p => ({ ...p, estimatedAt: p.estimatedAt.toISOString() })),
    });
    if (pasada === 'completa') await marcarPasadaCompleta(lab);

    return { lab, ok: true, seguimiento, avisos };
}

export interface HallazgosDeModulo {
    en: string;
    sinPedidoEnPortal: { orderId: string; cliente: string; enviadaHace: number }[];
    atrasados: { portalNumber: string; cliente: string | null; estimatedAt: string; diasDeAtraso: number }[];
}

async function guardarHallazgos(lab: string, h: HallazgosDeModulo) {
    const key = claveDeModulo(lab, 'hallazgos');
    const value = JSON.stringify(h);
    await prisma.systemSetting.upsert({ where: { key }, update: { value }, create: { key, value } }).catch(err => console.error('[lab-modulos] hallazgos:', err));
}

/** Lo último que cada módulo vio (para el reporte semanal). */
export async function leerHallazgos(lab: string): Promise<HallazgosDeModulo | null> {
    const fila = await prisma.systemSetting.findUnique({ where: { key: claveDeModulo(lab, 'hallazgos') } }).catch(() => null);
    if (!fila?.value) return null;
    try { return JSON.parse(fila.value) as HallazgosDeModulo; } catch { return null; }
}

/**
 * La pasada COMPLETA (todo el historial) la decide el propio cron: si la última
 * completa buena tiene más de HORAS_ENTRE_COMPLETAS, el tick corre completa en
 * vez de rápida. Así un pedido que salió de la ventana del pase rápido no se
 * congela en el espejo. Puro.
 */
export const HORAS_ENTRE_COMPLETAS = 20;
export function tocaPasadaCompleta(ultimaCompleta: Date | null, ahora: Date, horas = HORAS_ENTRE_COMPLETAS): boolean {
    if (!ultimaCompleta) return true;
    return ahora.getTime() - ultimaCompleta.getTime() >= horas * 3600_000;
}

async function marcarPasadaCompleta(lab: string) {
    const key = claveDeModulo(lab, 'ultimaCompleta');
    const value = new Date().toISOString();
    await prisma.systemSetting.upsert({ where: { key }, update: { value }, create: { key, value } }).catch(err => console.error('[lab-modulos] ultimaCompleta:', err));
}

export async function ultimaPasadaCompleta(lab: string): Promise<Date | null> {
    const fila = await prisma.systemSetting.findUnique({ where: { key: claveDeModulo(lab, 'ultimaCompleta') } }).catch(() => null);
    const d = fila?.value ? new Date(fila.value) : null;
    return d && !Number.isNaN(d.getTime()) ? d : null;
}
