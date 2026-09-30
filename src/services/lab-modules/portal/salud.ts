import { prisma } from '../../../lib/db';
import { claveDeModulo } from '../contrato';

/**
 * SALUD DE CADA MÓDULO: cuándo corrió bien por última vez, desde cuándo está
 * caído y cuándo se avisó. Generaliza smartlab_down_since / smartlab_alerted_at
 * con una clave por laboratorio, así el cron avisa igual para cualquier módulo.
 *
 * Política (la misma que SmartLab): avisar recién cuando el módulo lleva más de
 * UMBRAL_CAIDA_MS seguido sin correr bien, repetir como máximo cada
 * REPETIR_ALERTA_MS, y avisar la recuperación SOLO si se había alertado (un
 * micro-corte no genera "Restablecido"). Todo persiste en SystemSetting: un
 * redeploy no borra el corte.
 *
 * Excepción a la espera: una credencial rechazada se avisa en el acto. No es
 * un corte que se arregla solo, y esperar 12 h es lo que costó 15 días en 2026.
 */
export const UMBRAL_CAIDA_MS = 12 * 60 * 60 * 1000;
export const REPETIR_ALERTA_MS = 12 * 60 * 60 * 1000;

export interface EstadoSalud {
    ultimaOkAt: Date | null;
    caidoDesde: Date | null;
    alertadoEn: Date | null;
}

export interface DecisionAlerta {
    alertar: boolean;
    motivo: 'umbral' | 'repeticion' | 'credencial' | 'todavia-no' | 'enfriamiento';
    caidoHaceMs: number;
}

/** Puro: lo prueba `npm run check:lab-modulos`. */
export function decidirAlertaDeCaida(
    estado: EstadoSalud,
    ahora: Date,
    credencialRechazada = false,
): DecisionAlerta {
    const caidoDesde = estado.caidoDesde ?? ahora;
    const caidoHaceMs = ahora.getTime() - caidoDesde.getTime();
    const desdeUltimaAlertaMs = estado.alertadoEn ? ahora.getTime() - estado.alertadoEn.getTime() : Infinity;
    if (desdeUltimaAlertaMs < REPETIR_ALERTA_MS) return { alertar: false, motivo: 'enfriamiento', caidoHaceMs };
    if (credencialRechazada) return { alertar: true, motivo: 'credencial', caidoHaceMs };
    if (caidoHaceMs < UMBRAL_CAIDA_MS) return { alertar: false, motivo: 'todavia-no', caidoHaceMs };
    return { alertar: true, motivo: estado.alertadoEn ? 'repeticion' : 'umbral', caidoHaceMs };
}

/** Puro: ¿la recuperación merece aviso? Solo si el corte llegó a alertarse. */
export function debeAvisarRecuperacion(estado: EstadoSalud): boolean {
    return !!estado.caidoDesde && !!estado.alertadoEn;
}

export function formatearCorte(ms: number): string {
    const horas = Math.floor(ms / 3600000);
    const minutos = Math.round((ms % 3600000) / 60000);
    return horas > 0 ? `${horas} h ${minutos} min` : `${minutos} min`;
}

async function leer(clave: string): Promise<Date | null> {
    const fila = await prisma.systemSetting.findUnique({ where: { key: clave } }).catch(() => null);
    const v = fila?.value ? new Date(fila.value) : null;
    return v && !Number.isNaN(v.getTime()) ? v : null;
}

async function escribir(clave: string, valor: string): Promise<void> {
    await prisma.systemSetting.upsert({ where: { key: clave }, update: { value: valor }, create: { key: clave, value: valor } });
}

export async function estadoDeSalud(lab: string): Promise<EstadoSalud> {
    const [ultimaOkAt, caidoDesde, alertadoEn] = await Promise.all([
        leer(claveDeModulo(lab, 'lastOkAt')),
        leer(claveDeModulo(lab, 'caidoDesde')),
        leer(claveDeModulo(lab, 'alertadoEn')),
    ]);
    return { ultimaOkAt, caidoDesde, alertadoEn };
}

/**
 * Una corrida salió bien: sella lastOkAt y limpia el corte. Devuelve si hay que
 * avisar "restablecido" (el estado del corte se limpia ANTES de avisar: si el
 * aviso falla no se repite en cada tick).
 */
export async function registrarExito(lab: string): Promise<{ avisarRecuperacion: boolean; corteMs: number }> {
    const estado = await estadoDeSalud(lab);
    const ahora = new Date();
    await escribir(claveDeModulo(lab, 'lastOkAt'), ahora.toISOString());
    if (estado.caidoDesde) await escribir(claveDeModulo(lab, 'caidoDesde'), '');
    if (estado.alertadoEn) await escribir(claveDeModulo(lab, 'alertadoEn'), '');
    return {
        avisarRecuperacion: debeAvisarRecuperacion(estado),
        corteMs: estado.caidoDesde ? ahora.getTime() - estado.caidoDesde.getTime() : 0,
    };
}

/** Una corrida falló: registra el inicio del corte y decide si toca avisar. */
export async function registrarFalla(lab: string, credencialRechazada = false): Promise<DecisionAlerta> {
    const estado = await estadoDeSalud(lab);
    const ahora = new Date();
    if (!estado.caidoDesde) {
        await escribir(claveDeModulo(lab, 'caidoDesde'), ahora.toISOString());
        estado.caidoDesde = ahora;
    }
    return decidirAlertaDeCaida(estado, ahora, credencialRechazada);
}

/** El aviso de caída salió de verdad: recién ahí se sella (si no, se reintenta). */
export async function marcarAlertado(lab: string): Promise<void> {
    await escribir(claveDeModulo(lab, 'alertadoEn'), new Date().toISOString());
}
