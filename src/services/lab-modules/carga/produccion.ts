import { hostDeLaBase } from '../../../lib/cron-scheduler';

/**
 * ¿Este server puede crear pedidos REALES en un laboratorio? Misma señal que
 * los crons (lib/cron-scheduler.ts): producción Y la base fuera de esta
 * máquina. Un `npm run dev` —o un `npm start` local, que corre con
 * NODE_ENV=production— con la credencial real tiene que poder PREPARAR (que
 * solo lee) pero nunca mandar un pedido a fabricar. Para probar a propósito
 * fuera de producción, cada laboratorio tiene su variable de permiso
 * (`SMARTLAB_PERMITIR_CARGA=1`, `OVES_PERMITIR_CARGA=1`). Puro.
 */
export function puedeCrearPedidosReales(variableDePermiso: string, env: Record<string, string | undefined> = process.env): boolean {
    if (env[variableDePermiso] === '1') return true;
    if (env.NODE_ENV !== 'production') return false;
    const host = hostDeLaBase(env.DATABASE_URL);
    return !!host && !HOSTS_LOCALES.has(host);
}

const HOSTS_LOCALES = new Set(['localhost', '127.0.0.1', '[::1]', '::1', '0.0.0.0', 'host.docker.internal']);
