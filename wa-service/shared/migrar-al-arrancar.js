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
 * SI FALLA, SE MIRA LA BASE DE VERDAD (15/10/2026, segunda auditoría): una
 * migración puede fallar por cosas que no tocan al bot (DATABASE_URL pooled
 * que rompe el advisory lock, usuario sin ALTER, drift en otra tabla). Morir
 * ahí dejaba al bot en un loop de reinicios. Ahora se consulta
 * information_schema por COLUMNAS_REQUERIDAS (shared/columnas-chat.js, la
 * única lista): si están todas, se arranca con un error fuerte en el log y un
 * aviso a los admins; si falta alguna (o no se pudo ni consultar), NO arranca
 * (salvo WA_ARRANCAR_SIN_MIGRAR=1). Decisión: lo peor que puede pasar es
 * perder entrantes.
 *
 * Tiempos: 3 intentos de hasta 30 s con pausas de 5 y 10 s → peor caso ~2 min
 * antes de decidir, holgado dentro del healthcheck de 300 s de Railway. Arrancando con el schema
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

const { COLUMNAS_REQUERIDAS } = require('./columnas-chat');

const ESPERAS_ENTRE_INTENTOS_MS = [5000, 10000];
const TOPE_POR_INTENTO_MS = 30 * 1000;

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
 * ¿La base tiene todas las columnas que el código necesita?
 * @returns {Promise<{ ok: boolean, faltan: string[], error?: string }>}
 */
async function verificarColumnasReales({ requeridas = COLUMNAS_REQUERIDAS } = {}) {
    let prisma;
    try {
        const { PrismaClient } = require('@prisma/client');
        prisma = new PrismaClient();
        const tablas = Object.keys(requeridas);
        const filas = await prisma.$queryRawUnsafe(
            `SELECT table_name, column_name FROM information_schema.columns
              WHERE table_schema = current_schema() AND table_name = ANY($1::text[])`,
            tablas,
        );
        const hay = new Set(filas.map(f => `${f.table_name}.${f.column_name}`));
        const faltan = [];
        for (const t of tablas) for (const c of requeridas[t]) if (!hay.has(`${t}.${c}`)) faltan.push(`${t}.${c}`);
        return { ok: faltan.length === 0, faltan };
    } catch (e) {
        return { ok: false, faltan: [], error: (e && e.message) || String(e) };
    } finally {
        if (prisma) await prisma.$disconnect().catch(() => {});
    }
}

function avisarFalloDeMigracion(error) {
    try {
        const { avisarAdmins } = require('./avisar-admins');
        return avisarAdmins({
            asunto: 'wa-service: no pudo migrar la base al arrancar',
            cuerpo: `prisma migrate deploy falló (${String(error).slice(0, 300)}). El bot arrancó igual porque la base tiene todas las columnas que necesita, pero hay migraciones sin aplicar: revisar los logs del wa-service y correr migrate deploy.`,
            urgente: true,
            dedupePrefijo: 'wa-migracion-fallida',
        });
    } catch { return Promise.resolve(false); }
}

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
    verificar = verificarColumnasReales,
    avisar = avisarFalloDeMigracion,
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
        return decidirSinMigrar({ env, consola, error: 'sin schema', verificar, avisar });
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
    return decidirSinMigrar({ env, consola, error: ultimoError, verificar, avisar });
}

async function decidirSinMigrar({ env, consola, error, verificar, avisar }) {
    consola.error('🛑🛑🛑 [Migraciones] NO SE PUDO MIGRAR LA BASE:', error);
    const v = await verificar();
    if (v.ok) {
        consola.error('🛑 [Migraciones] Pero la base tiene TODAS las columnas que el bot necesita: se arranca igual.');
        consola.error('   Hay migraciones sin aplicar: revisar y correr `prisma migrate deploy` a mano.');
        await Promise.resolve(avisar(error)).catch(() => {});
        return { arrancar: true, motivo: 'fallo-pero-columnas-ok' };
    }
    consola.error(v.error
        ? `🛑 [Migraciones] Tampoco se pudo verificar el schema real: ${v.error}`
        : `🛑 [Migraciones] Faltan columnas en la base: ${v.faltan.join(', ')}`);
    if (env.WA_ARRANCAR_SIN_MIGRAR === '1') {
        consola.error('🛑 [Migraciones] WA_ARRANCAR_SIN_MIGRAR=1: se arranca IGUAL. Si el schema está atrasado, los entrantes pueden perderse.');
        return { arrancar: true, motivo: 'forzado' };
    }
    consola.error('🛑 [Migraciones] El wa-service NO arranca: con el schema atrasado los entrantes se perderían (el webhook ya contestó 200).');
    consola.error('   Sin proceso, Meta reintenta la entrega. Para arrancar igual: WA_ARRANCAR_SIN_MIGRAR=1.');
    return { arrancar: false, motivo: 'fallo' };
}

module.exports = { migrarAlArrancar, buscarSchema, verificarColumnasReales, ESPERAS_ENTRE_INTENTOS_MS, TOPE_POR_INTENTO_MS };
