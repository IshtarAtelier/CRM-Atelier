/**
 * ¿Este servidor tiene que prender el scheduler de `instrumentation.ts`?
 *
 * El scheduler (SmartLab cada 10 min, conciliación diaria y reporte semanal de
 * laboratorio, ads, cierre de mes, recordatorios, seguimientos, carritos...)
 * arranca en CUALQUIER servidor Node que levante la app. Hasta el 25/9/2026 lo
 * único que lo frenaba era que faltara `CRON_SECRET`, y el `.env` local lo
 * tiene, junto con las credenciales reales de mail, Meta y SmartLab. Un
 * `npm run dev` le pegaba entonces a sus propias rutas `/api/cron/*` con la
 * base local y podía mandar mails de verdad — el reporte de laboratorio de los
 * viernes incluido, con datos de una base desactualizada. El candado "ya corrió
 * hoy" (`SystemSetting`) vive en la base que use cada servidor, así que el de
 * producción no frena al local.
 *
 * La regla, en orden:
 *   1. `CRONS_LOCALES=1` lo prende siempre: es la forma de probar un cron en
 *      local A PROPÓSITO.
 *   2. Fuera de `NODE_ENV=production` no se prende. `next dev` pone
 *      `development`; producción corre `node server.js` (build standalone),
 *      que fuerza `production` por su cuenta además del `ENV` del Dockerfile.
 *   3. Con la base en esta misma máquina (localhost, 127.0.0.1, ::1 o
 *      host.docker.internal) tampoco: es un build de producción corriendo en
 *      una Mac — `npm start` pone `production` igual que Railway. Producción
 *      no puede tener la base en localhost: el contenedor de la app no corre
 *      Postgres, y `migrate deploy` al arrancar fallaría.
 *   4. Todo lo demás es producción y se prende.
 *
 * Por qué no se mira una variable de Railway (RAILWAY_*): no se pudo comprobar
 * cuál inyecta en tiempo de ejecución, y si faltara apagaría los crons de
 * producción sin avisar, que es peor que el problema. Por eso las dos señales
 * que apagan (no-production, base local) solo pueden darse fuera de Railway, y
 * ante cualquier duda (URL ilegible o ausente) se prende, como antes.
 *
 * Lo fija `npm run check:crons`, sin red ni base.
 */

export interface DecisionScheduler {
    prender: boolean;
    /** Frase para el log de arranque: dice por qué, en castellano. */
    motivo: string;
}

/** Hosts que solo pueden ser esta misma máquina. */
const HOSTS_LOCALES = new Set(['localhost', '127.0.0.1', '[::1]', '::1', '0.0.0.0', 'host.docker.internal']);

/** El host de `DATABASE_URL`, o `null` si no hay o no se puede leer. */
export function hostDeLaBase(databaseUrl: string | undefined): string | null {
    if (!databaseUrl) return null;
    try {
        return new URL(databaseUrl).hostname.toLowerCase() || null;
    } catch {
        return null;
    }
}

export function decidirScheduler(env: Record<string, string | undefined>): DecisionScheduler {
    if (env.CRONS_LOCALES === '1') {
        return { prender: true, motivo: 'CRONS_LOCALES=1 (pedido a propósito)' };
    }
    if (env.NODE_ENV !== 'production') {
        return {
            prender: false,
            motivo: `NODE_ENV=${env.NODE_ENV || '(vacío)'}, no es producción. Para probar un cron acá: CRONS_LOCALES=1`,
        };
    }
    const host = hostDeLaBase(env.DATABASE_URL);
    if (host && HOSTS_LOCALES.has(host)) {
        return {
            prender: false,
            motivo: `build de producción con la base en ${host}: es una máquina local, no Railway. Para probar un cron acá: CRONS_LOCALES=1`,
        };
    }
    return { prender: true, motivo: `producción (base en ${host ?? 'host sin leer'})` };
}
