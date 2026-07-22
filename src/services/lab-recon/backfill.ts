import { prisma } from '../../lib/db';

/**
 * MODO BACKFILL POR LABORATORIO (estreno en producción): mientras un lab no
 * tenga su backfill completo, sus entradas se registran y cruzan pero SIN
 * emails, SIN flip a FINISHED y SIN notificaciones — y quedan marcadas como
 * ya alertadas. Evita el aluvión retroactivo (35 días de facturas de golpe =
 * decenas de emails + WhatsApps de "listo para retirar" a clientes de pedidos
 * viejos ya entregados).
 *
 * El flag es POR PROVEEDOR y lo setea el cron diario SOLO tras una corrida
 * exitosa de ese proveedor: si IMAP falla el día 1, el histórico de Optovision
 * sigue en silencio hasta que su backfill de verdad ocurra (con un flag global,
 * esa falla parcial soltaba el aluvión al día siguiente). Se lee de la DB con un
 * cache corto — sin contadores en memoria que puedan quedar clavados si una
 * corrida se cuelga.
 *
 * SUMAR UN LABORATORIO = agregarlo a BACKFILL_LABS y su primer barrido entra
 * solo, en silencio, sin tocar nada más.
 */
export const BACKFILL_LABS = ['OPTOVISION', 'GRUPO_OPTICO'] as const;

export function backfillKey(lab: string) {
    return `lab_recon_backfill_done:${lab}`;
}

let backfillCache: { at: number; done: Record<string, boolean> } | null = null;

export async function isQuietLab(lab: string): Promise<boolean> {
    const now = Date.now();
    if (!backfillCache || now - backfillCache.at > 60_000) {
        const keys = BACKFILL_LABS.map(l => backfillKey(l));
        const rows = await prisma.systemSetting.findMany({ where: { key: { in: keys } } })
            .catch(() => [] as { key: string; value: string }[]);
        const done: Record<string, boolean> = {};
        for (const l of BACKFILL_LABS) {
            done[l] = rows.some(r => r.key === backfillKey(l) && !!r.value);
        }
        backfillCache = { at: now, done };
    }
    // Solo los labs conocidos entran en modo silencioso pre-backfill.
    return backfillCache.done[lab] === false;
}

export function invalidateBackfillCache() {
    backfillCache = null;
}

/** Emails de alerta habilitados: en local solo con FORCE_LAB_ALERTS=1. */
export function emailsEnabled(): boolean {
    return process.env.NODE_ENV === 'production' || process.env.FORCE_LAB_ALERTS === '1';
}
