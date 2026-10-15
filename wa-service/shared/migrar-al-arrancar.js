'use strict';

/**
 * El wa-service aplica las migraciones pendientes ANTES de arrancar.
 *
 * Por qué (auditoría del 15/10/2026): el Dockerfile del wa-service copia
 * `prisma/` y corre `prisma generate` con el schema del repo, pero solo el CRM
 * corría `migrate deploy` al arrancar. Si el wa-service salía antes que el CRM
 * (son proyectos distintos en Railway, nada ordena sus deploys), su cliente
 * Prisma ya conocía columnas que la base todavía no tenía: toda lectura de
 * `whatsAppChat` sin `select` (persistInbound incluido) reventaba con P2022.
 * Y el webhook le contesta 200 a Meta ANTES de guardar (transport/webhook.js),
 * así que cada entrante que fallaba al guardarse se perdía para siempre.
 *
 * `migrate deploy` es idempotente (si no hay nada pendiente no hace nada) y
 * toma un advisory lock de Postgres (`pg_advisory_lock(72707369)`, verificado
 * en el schema-engine de prisma 5.22): dos instancias, o el CRM y el
 * wa-service arrancando juntos, se ponen en fila en vez de chocar. La espera
 * del lock tiene tope (~10 s); por eso se reintenta con pausas.
 *
 * SI FALLA, EL PROCESO NO ARRANCA (salvo WA_ARRANCAR_SIN_MIGRAR=1). Decisión:
 * lo peor que puede pasar es perder entrantes. Arrancando con el schema
 * atrasado, el webhook contesta 200 y después el guardado revienta: Meta no
 * reintenta y el mensaje se pierde. Sin proceso, Meta no recibe el 200 y
 * REINTENTA la entrega (hasta días), y Railway reinicia el contenedor
 * (que vuelve a intentar migrar) o mantiene el deploy anterior. Es el mismo
 * criterio que el CRM (`migrate deploy && next start`).
 *
 * WA_SALTEAR_MIGRACION=1 lo saltea del todo (desarrollo local apuntando a una
 * base que se migra a mano).
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ESPERAS_ENTRE_INTENTOS_MS = [5000, 10000, 20000];
const TOPE_POR_INTENTO_MS = 2 * 60 * 1000;

function buscarSchema(base = __dirname) {
    const candidatos = [
        path.join(base, '..', 'prisma', 'schema.prisma'),       // contenedor: /app/prisma
        path.join(base, '..', '..', 'prisma', 'schema.prisma'), // repo: atelier/prisma
    ];
    return candidatos.find(p => fs.existsSync(p)) || null;
}

function correrMigrateDeploy({ schema, cwd }) {
    let cli;
    try { cli = require.resolve('prisma/build/index.js'); } catch { return { ok: false, error: 'no se encontró el CLI de prisma (dependencia "prisma" de wa-service)' }; }
    const r = spawnSync(process.execPath, [cli, 'migrate', 'deploy', '--schema', schema], {
        cwd, stdio: 'inherit', timeout: TOPE_POR_INTENTO_MS, env: process.env,
    });
    if (r.error) return { ok: false, error: r.error.message };
    if (r.status !== 0) return { ok: false, error: `migrate deploy salió con código ${r.status}` };
    return { ok: true };
}

const dormir = ms => new Promise(r => setTimeout(r, ms));

/**
 * @returns {Promise<{ arrancar: boolean, motivo: string }>}
 */
async function migrarAlArrancar({
    env = process.env,
    correr = correrMigrateDeploy,
    schema = buscarSchema(),
    esperas = ESPERAS_ENTRE_INTENTOS_MS,
    esperar = dormir,
    consola = console,
} = {}) {
    if (env.WA_SALTEAR_MIGRACION === '1') {
        consola.warn('⚠️ [Migraciones] WA_SALTEAR_MIGRACION=1: no se aplican migraciones al arrancar.');
        return { arrancar: true, motivo: 'salteado' };
    }
    if (!env.DATABASE_URL) {
        consola.warn('⚠️ [Migraciones] Sin DATABASE_URL: no hay base que migrar.');
        return { arrancar: true, motivo: 'sin-base' };
    }
    if (!schema) {
        consola.error('🛑 [Migraciones] No se encontró prisma/schema.prisma: no se puede migrar.');
        return decidirSinMigrar(env, consola, 'sin schema');
    }
    let ultimoError = '';
    for (let intento = 0; intento <= esperas.length; intento++) {
        consola.log(`🗄️  [Migraciones] prisma migrate deploy (intento ${intento + 1}/${esperas.length + 1})…`);
        const r = correr({ schema, cwd: path.dirname(path.dirname(schema)) });
        if (r.ok) {
            consola.log('✅ [Migraciones] Base al día.');
            return { arrancar: true, motivo: 'migrada' };
        }
        ultimoError = r.error;
        consola.error(`❌ [Migraciones] Falló: ${r.error}`);
        if (intento < esperas.length) await esperar(esperas[intento]);
    }
    return decidirSinMigrar(env, consola, ultimoError);
}

function decidirSinMigrar(env, consola, error) {
    consola.error('🛑🛑🛑 [Migraciones] NO SE PUDO MIGRAR LA BASE:', error);
    if (env.WA_ARRANCAR_SIN_MIGRAR === '1') {
        consola.error('🛑 [Migraciones] WA_ARRANCAR_SIN_MIGRAR=1: se arranca IGUAL. Si el schema está atrasado, los entrantes pueden perderse.');
        return { arrancar: true, motivo: 'forzado' };
    }
    consola.error('🛑 [Migraciones] El wa-service NO arranca: con el schema atrasado los entrantes se perderían (el webhook ya contestó 200).');
    consola.error('   Sin proceso, Meta reintenta la entrega. Para arrancar igual: WA_ARRANCAR_SIN_MIGRAR=1.');
    return { arrancar: false, motivo: 'fallo' };
}

module.exports = { migrarAlArrancar, buscarSchema, ESPERAS_ENTRE_INTENTOS_MS };
