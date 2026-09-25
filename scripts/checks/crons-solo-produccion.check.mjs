// ────────────────────────────────────────────────────────────────────────────
// Los crons internos (`src/instrumentation.ts`) se prenden SOLO en producción.
// SIN RED y SIN BASE: se simulan los timers y `fetch`, y se llama al
// `register()` REAL, no a una copia de su lógica.
//
// Qué protege (25/9/2026):
//  - Un `npm run dev` con el .env real no dispara nada: antes le pegaba a sus
//    propias rutas /api/cron/* con la base local y credenciales reales de mail,
//    Meta y SmartLab (el reporte de laboratorio de los viernes incluido).
//  - Un build de producción en una Mac (`npm start` contra la base del docker,
//    como el A/B de velocidad) tampoco: `next start` pone NODE_ENV=production
//    igual que Railway, así que la base local es la otra señal.
//  - Y lo que importa más: producción NO se apaga. Un guard mal puesto que
//    silencie la conciliación de laboratorio es peor que el problema. Por eso
//    se verifica que producción arme el scheduler, que el arranque siga siendo
//    `node server.js` con NODE_ENV=production, y que una duda (URL ilegible o
//    ausente) deje los crons prendidos, como estaban.
//
// Correr:  npm run check:crons
//   (node --experimental-strip-types --import ./scripts/checks/_alias.mjs
//    scripts/checks/crons-solo-produccion.check.mjs)
// ────────────────────────────────────────────────────────────────────────────

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { decidirScheduler } from '../../src/lib/cron-scheduler.ts';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const leer = (rel) => readFileSync(path.join(RAIZ, rel), 'utf8');

let passed = 0;
const check = (name, cond) => {
  assert.ok(cond, `FALLÓ: ${name}`);
  passed++;
  console.log(`  ✓ ${name}`);
};

const RAILWAY_INTERNA = 'postgresql://u:p@postgres.railway.internal:5432/railway';
const RAILWAY_PROXY = 'postgresql://u:p@maglev.proxy.rlwy.net:41234/railway';
const DOCKER_LOCAL = 'postgresql://postgres:localpassword@localhost:5432/atelier';

// ── 1. La decisión ───────────────────────────────────────────────────────────
console.log('\nDecisión (lib/cron-scheduler.ts)');
const prende = (env) => decidirScheduler(env).prender;

check('npm run dev (NODE_ENV=development) → apagado', !prende({ NODE_ENV: 'development', DATABASE_URL: DOCKER_LOCAL, CRON_SECRET: 'x' }));
check('sin NODE_ENV → apagado', !prende({ DATABASE_URL: RAILWAY_INTERNA }));
check('NODE_ENV=test → apagado', !prende({ NODE_ENV: 'test', DATABASE_URL: RAILWAY_INTERNA }));
check('build local (production + localhost) → apagado', !prende({ NODE_ENV: 'production', DATABASE_URL: DOCKER_LOCAL }));
check('build local (production + 127.0.0.1) → apagado', !prende({ NODE_ENV: 'production', DATABASE_URL: 'postgresql://u:p@127.0.0.1:5432/atelier' }));
check('build local (production + [::1]) → apagado', !prende({ NODE_ENV: 'production', DATABASE_URL: 'postgresql://u:p@[::1]:5432/atelier' }));
check('imagen de Docker en la Mac (host.docker.internal) → apagado', !prende({ NODE_ENV: 'production', DATABASE_URL: 'postgresql://u:p@host.docker.internal:5432/atelier' }));
check('host local en mayúsculas → apagado', !prende({ NODE_ENV: 'production', DATABASE_URL: 'postgresql://u:p@LOCALHOST:5432/atelier' }));
check('producción (base interna de Railway) → PRENDIDO', prende({ NODE_ENV: 'production', DATABASE_URL: RAILWAY_INTERNA }));
check('producción (proxy de Railway) → PRENDIDO', prende({ NODE_ENV: 'production', DATABASE_URL: RAILWAY_PROXY }));
check('producción sin DATABASE_URL → PRENDIDO (ante la duda, como antes)', prende({ NODE_ENV: 'production' }));
check('producción con URL ilegible → PRENDIDO (ante la duda, como antes)', prende({ NODE_ENV: 'production', DATABASE_URL: 'no es una url' }));
check('un host que CONTIENE "localhost" no es local', prende({ NODE_ENV: 'production', DATABASE_URL: 'postgresql://u:p@localhost.railway.internal:5432/x' }));
check('CRONS_LOCALES=1 en dev → PRENDIDO (a propósito)', prende({ NODE_ENV: 'development', DATABASE_URL: DOCKER_LOCAL, CRONS_LOCALES: '1' }));
check('CRONS_LOCALES=1 en build local → PRENDIDO (a propósito)', prende({ NODE_ENV: 'production', DATABASE_URL: DOCKER_LOCAL, CRONS_LOCALES: '1' }));
check('CRONS_LOCALES=true NO alcanza (solo "1")', !prende({ NODE_ENV: 'development', CRONS_LOCALES: 'true' }));
check('CRONS_LOCALES=0 no prende', !prende({ NODE_ENV: 'development', CRONS_LOCALES: '0' }));
check('el motivo del apagado dice cómo prenderlo a propósito', /CRONS_LOCALES=1/.test(decidirScheduler({ NODE_ENV: 'development' }).motivo));
check('el motivo no filtra la contraseña de la base', !/localpassword/.test(
  decidirScheduler({ NODE_ENV: 'production', DATABASE_URL: DOCKER_LOCAL }).motivo
  + decidirScheduler({ NODE_ENV: 'production', DATABASE_URL: 'postgresql://u:secreta@x.proxy.rlwy.net:1/r' }).motivo,
) && !/secreta/.test(decidirScheduler({ NODE_ENV: 'production', DATABASE_URL: 'postgresql://u:secreta@x.proxy.rlwy.net:1/r' }).motivo));

// ── 2. El register() REAL, con timers y fetch simulados ──────────────────────
console.log('\nregister() de instrumentation.ts');

const timers = [];
const fetches = [];
const logs = [];
const orig = { setTimeout: globalThis.setTimeout, setInterval: globalThis.setInterval, fetch: globalThis.fetch, log: console.log };
const ENV_TOCADAS = ['NEXT_RUNTIME', 'NODE_ENV', 'DATABASE_URL', 'CRONS_LOCALES', 'CRON_SECRET'];
const envOriginal = Object.fromEntries(ENV_TOCADAS.map((k) => [k, process.env[k]]));

const { register } = await import('../../src/instrumentation.ts');

async function arrancar(env) {
  timers.length = 0; fetches.length = 0; logs.length = 0;
  for (const k of ENV_TOCADAS) delete process.env[k];
  Object.assign(process.env, { NEXT_RUNTIME: 'nodejs', CRON_SECRET: 'secreto-de-prueba' }, env);
  globalThis.setTimeout = (fn, ms) => { timers.push({ tipo: 'timeout', ms }); return 0; };
  globalThis.setInterval = (fn, ms) => { timers.push({ tipo: 'interval', ms }); return 0; };
  globalThis.fetch = (url) => { fetches.push(String(url)); return Promise.reject(new Error('sin red en el check')); };
  console.log = (...a) => logs.push(a.join(' '));
  try {
    await register();
  } finally {
    globalThis.setTimeout = orig.setTimeout;
    globalThis.setInterval = orig.setInterval;
    globalThis.fetch = orig.fetch;
    console.log = orig.log;
  }
  return { timers: [...timers], fetches: [...fetches], logs: [...logs] };
}

try {
  const dev = await arrancar({ NODE_ENV: 'development', DATABASE_URL: DOCKER_LOCAL });
  check('npm run dev con CRON_SECRET: no arma ningún timer', dev.timers.length === 0);
  check('npm run dev: no llama a ninguna ruta', dev.fetches.length === 0);
  check('npm run dev: avisa en el log que está APAGADO', dev.logs.some((l) => l.includes('[CRON] Scheduler APAGADO')));

  const local = await arrancar({ NODE_ENV: 'production', DATABASE_URL: DOCKER_LOCAL });
  check('build de producción en la Mac: no arma ningún timer', local.timers.length === 0 && local.fetches.length === 0);

  const prod = await arrancar({ NODE_ENV: 'production', DATABASE_URL: RAILWAY_INTERNA });
  check('PRODUCCIÓN: arma el scheduler (primer disparo a los 30 s)', prod.timers.some((t) => t.tipo === 'timeout' && t.ms === 30000));
  check('PRODUCCIÓN: avisa en el log que está prendido', prod.logs.some((l) => l.includes('[CRON] Scheduler prendido')));

  const aProposito = await arrancar({ NODE_ENV: 'development', DATABASE_URL: DOCKER_LOCAL, CRONS_LOCALES: '1' });
  check('CRONS_LOCALES=1 en dev: arma el scheduler', aProposito.timers.length > 0);

  const edge = await arrancar({ NEXT_RUNTIME: 'edge', NODE_ENV: 'production', DATABASE_URL: RAILWAY_INTERNA });
  check('runtime edge: no arma nada (como antes)', edge.timers.length === 0);
} finally {
  for (const k of ENV_TOCADAS) {
    if (envOriginal[k] === undefined) delete process.env[k];
    else process.env[k] = envOriginal[k];
  }
}

// El guard tiene que estar ANTES de cualquier timer o fetch del archivo: si
// alguien agrega un robot arriba del guard, el paso 2 no lo vería si ese robot
// usa algo que no se simula acá.
const fuente = leer('src/instrumentation.ts');
const posGuard = fuente.indexOf('decidirScheduler(');
const primerEfecto = Math.min(
  ...['setTimeout(', 'setInterval(', 'fetch('].map((s) => fuente.indexOf(s)).filter((i) => i >= 0),
);
check('en instrumentation.ts el guard va antes de cualquier setTimeout/setInterval/fetch', posGuard > 0 && posGuard < primerEfecto);

// ── 3. Producción sigue siendo "production" ──────────────────────────────────
// Si el arranque de Railway dejara de ser el build standalone, el guard podría
// apagar los crons de producción sin que nadie se entere.
console.log('\nArranque de producción');
const dockerfile = leer('Dockerfile');
const runner = dockerfile.slice(dockerfile.lastIndexOf('FROM '));
check('Dockerfile: la imagen final fija ENV NODE_ENV=production', /^ENV NODE_ENV=production\b/m.test(runner));
check('Dockerfile: arranca con node server.js', /CMD .*node server\.js/.test(runner));
const railway = leer('railway.toml');
check('railway.toml: el CRM arranca con node server.js', /node server\.js/.test(railway));
check('railway.toml y Dockerfile: nunca next dev', !/next dev/.test(railway) && !/next dev/.test(dockerfile));
const pkg = JSON.parse(leer('package.json'));
check('package.json: "start" es next start (production)', /\bnext start\b/.test(pkg.scripts.start) && !/next dev/.test(pkg.scripts.start));

console.log(`\n✅ ${passed} verificaciones OK — los crons internos solo se prenden en producción.\n`);
