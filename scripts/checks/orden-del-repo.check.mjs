// ────────────────────────────────────────────────────────────────────────────
// EL ORDEN DEL REPO, VERIFICADO — para que no haya que confiar en la memoria.
//
// Las convenciones de dónde va cada cosa están escritas en CLAUDE.md desde hace
// meses, y aun así el 21/8/2026 una auditoría encontró: 12 scripts sueltos en la
// raíz de `scripts/`, una carpeta `scripts/legacy/` con 21 archivos, 70 scripts
// one-off en `scripts/utils/`, `temp_query.js` y `probe588049.mjs` trackeados,
// y 127 MB de logs y uploads de runtime commiteados. Ninguno de esos archivos
// llegó por mala fe: llegaron porque una regla escrita en un .md no frena nada.
//
// Este check la convierte en algo que falla. Corre en CI y en local, SIN base y
// SIN red, y mira solo lo que git tiene trackeado (lo no trackeado es asunto
// del .gitignore, no del orden del repo).
//
// Correr:  npm run check:orden
// ────────────────────────────────────────────────────────────────────────────

import { execFileSync } from 'node:child_process';

const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\n').filter(Boolean);

/** Hallazgos: cada uno es una regla rota, con el porqué y qué hacer. */
const fallas = [];
const romper = (regla, archivos, comoSeArregla) => {
    if (archivos.length > 0) fallas.push({ regla, archivos, comoSeArregla });
};

// ── 1. LA RAÍZ ES SOLO CONFIGURACIÓN ────────────────────────────────────────
// Un script suelto en la raíz es el primer síntoma de que se dejó de ordenar:
// nadie sabe si escribe en la base, contra cuál, ni si todavía sirve.
const RAIZ_PERMITIDA = new Set([
    '.dockerignore', '.env.example', '.gitignore', '.railwayignore',
    'CLAUDE.md', 'Dockerfile', 'README.md',
    'docker-compose.prod.yml', 'docker-compose.yml',
    'eslint.config.mjs', 'next.config.ts',
    'package-lock.json', 'package.json', 'postcss.config.mjs',
    'railway.toml', 'tsconfig.json', 'vercel.json',
]);
romper(
    'La raíz es SOLO configuración (CLAUDE.md → "Dónde va cada cosa")',
    tracked.filter(f => !f.includes('/') && !RAIZ_PERMITIDA.has(f)),
    'Si el archivo sirve, va a scripts/checks/ (solo lee) o scripts/maintenance/ (escribe),\n' +
    '   con nombre que diga qué hace. Si no sirve, se borra.\n' +
    '   Si es configuración nueva y legítima, agregala a RAIZ_PERMITIDA en este archivo.',
);

// ── 2. LOS SCRIPTS SE CLASIFICAN POR LO QUE LE HACEN A LA BASE ──────────────
// `checks/` solo lee, `maintenance/` escribe. Un script suelto en scripts/ no
// declara de qué lado está, y esa es exactamente la duda que hace que nadie se
// anime a correrlo (o peor: que alguien lo corra contra producción).
const SUBCARPETAS_VALIDAS = ['checks/', 'maintenance/', 'social/', 'utils/', 'legacy/'];
romper(
    'Todo script vive en una subcarpeta de scripts/ que declara si lee o escribe',
    tracked.filter(f => {
        if (!f.startsWith('scripts/')) return false;
        const resto = f.slice('scripts/'.length);
        if (!resto.includes('/')) return true; // suelto en la raíz de scripts/
        return false;
    }),
    'Moverlo: scripts/checks/ si SOLO LEE, scripts/maintenance/ si ESCRIBE en la base.',
);

// ── 3. NADA GENERADO NI DE RUNTIME EN GIT ──────────────────────────────────
// El .gitignore no desaloja lo que ya estaba commiteado: hay que sacarlo del
// índice a mano una vez. Mientras siga trackeado, cada build lo ensucia.
const GENERADOS = [
    { patron: /^storage\//, que: 'uploads de runtime' },
    { patron: /^logs?\//, que: 'logs' },
    { patron: /\.log$/, que: 'logs' },
    { patron: /^\.next/, que: 'build de Next' },
    { patron: /\.tsbuildinfo$/, que: 'caché de TypeScript' },
    { patron: /^node_modules\//, que: 'dependencias' },
    { patron: /\.DS_Store$/, que: 'basura de macOS' },
];
for (const { patron, que } of GENERADOS) {
    romper(
        `Nada generado en git — ${que}`,
        tracked.filter(f => patron.test(f)),
        'git rm -r --cached <ruta>   (los saca del índice sin borrarlos del disco)\n' +
        '   y verificá que estén en el .gitignore.',
    );
}

// ── 4. NADA CON NOMBRE DE "UN RATO" ────────────────────────────────────────
// Un archivo llamado temp_query.js o probe588049.mjs nació para una tarde y se
// quedó a vivir. El nombre es la confesión: si hay que conservarlo, hay que
// renombrarlo a lo que hace; si no, se borra.
const TEMPORALES = /(^|\/)(tmp|temp|probe|dump|scratch)[-_.\d]|(^|\/)(test|prueba)-[^/]*\.(m?js|ts)$|\.(bak|old|orig|copy)\b|(^|\/)[^/]*(-copy|-viejo|-old|NO-USAR)[^/]*$/i;
romper(
    'Ningún archivo con nombre de temporalidad (tmp/temp/probe/dump/.bak/-viejo/NO-USAR)',
    tracked.filter(f => TEMPORALES.test(f)),
    'Si todavía sirve: renombralo a lo que hace y ponelo en su carpeta.\n' +
    '   Si fue de un rato: se borra (queda en el historial de git si hiciera falta).',
);

// ── 5. LOS DATOS PESADOS VAN EN SU TEMA, CON README ────────────────────────
// Un JSON de 190 KB suelto en maintenance/ no dice qué revierte ni si ya se
// aplicó. La regla de CLAUDE.md es: scripts/maintenance/<tema>/ + README.
romper(
    'Los datos/entregables van en scripts/maintenance/<tema>/ con README, nunca sueltos',
    tracked.filter(f => /^scripts\/maintenance\/[^/]+\.(json|csv|pdf|xlsx?)$/i.test(f)),
    'Moverlos a scripts/maintenance/<tema>/ con un README que diga qué son y cómo se aplican.\n' +
    '   Si la migración que revierten ya se dio por buena, se borran.',
);

// ── 6. CARPETAS QUE ADMITEN SER BASURA ─────────────────────────────────────
// "legacy" no es una categoría de arquitectura: es un cajón. Mientras exista,
// es el lugar donde va a caer lo próximo que nadie quiera decidir.
const cajones = ['scripts/legacy/'];
for (const cajon of cajones) {
    const dentro = tracked.filter(f => f.startsWith(cajon));
    romper(
        `Sin carpetas-cajón — "${cajon}" no dice qué hace nada de lo que tiene adentro`,
        dentro.length > 0 ? [`${cajon} (${dentro.length} archivos)`] : [],
        'Cada archivo: o se recupera con nombre y carpeta que digan qué hace, o se borra.\n' +
        '   El historial de git lo conserva igual.',
    );
}

// ── Deuda conocida vs. desorden nuevo ───────────────────────────────────────
// El día que se escribió este check había 339 archivos fuera de lugar. Un check
// que falla por los 339 se desactiva en la primera semana y no protege nada.
//
// Entonces: la deuda que ya existía queda ANOTADA en un archivo aparte (visible,
// contada en cada corrida, y que solo puede achicarse), y el check falla
// únicamente por lo NUEVO. Así el repo no puede empeorar ni un archivo más,
// mientras la deuda vieja se limpia cuando haya tiempo.
//
// Al limpiar algo, sacá su línea de `orden-del-repo.deuda.json`. Si sacás un
// archivo de la deuda y no lo limpiaste, el check falla — que es lo que tiene
// que pasar.
import { readFileSync, writeFileSync } from 'node:fs';

const RUTA_DEUDA = new URL('./orden-del-repo.deuda.json', import.meta.url);
const REGISTRAR = process.argv.includes('--registrar-deuda');

let deuda = [];
try {
    deuda = JSON.parse(readFileSync(RUTA_DEUDA, 'utf8')).archivos ?? [];
} catch {
    // Sin archivo de deuda: todo cuenta como nuevo (es el estado ideal).
}
const enDeuda = new Set(deuda);

// `--registrar-deuda`: congela el estado actual como línea de base. Se corre UNA
// vez, al estrenar el check. Volver a correrlo para "arreglar" una falla nueva
// es hacer trampa: estarías anotando como deuda algo que acabás de ensuciar.
if (REGISTRAR) {
    const todos = fallas.flatMap(f => f.archivos).sort();
    writeFileSync(RUTA_DEUDA, JSON.stringify({
        _comentario: 'Archivos fuera de lugar que ya existían cuando se estrenó check:orden ' +
            '(21/8/2026). El check NO falla por estos, pero sí por cualquier archivo nuevo. ' +
            'Esta lista solo puede achicarse: al limpiar un archivo, borrá su línea.',
        generado: '2026-08-21',
        archivos: todos,
    }, null, 2) + '\n');
    console.log(`\n📌 Deuda registrada: ${todos.length} archivo(s) en orden-del-repo.deuda.json\n`);
    process.exit(0);
}

// Partir cada falla en lo viejo (tolerado) y lo nuevo (bloqueante).
const nuevas = fallas
    .map(f => ({ ...f, archivos: f.archivos.filter(a => !enDeuda.has(a)) }))
    .filter(f => f.archivos.length > 0);
const totalDeuda = fallas.reduce((n, f) => n + f.archivos.filter(a => enDeuda.has(a)).length, 0);

// ── Resultado ───────────────────────────────────────────────────────────────
console.log('\n— Orden del repo: dónde va cada cosa —\n');

if (nuevas.length === 0) {
    console.log(`✅ ${tracked.length} archivos trackeados, nada nuevo fuera de lugar.`);
    if (totalDeuda > 0) {
        console.log(`\n📋 Deuda conocida pendiente: ${totalDeuda} archivo(s) de antes del 21/8/2026.`);
        console.log('   Están listados en scripts/checks/orden-del-repo.deuda.json.');
        console.log('   Al limpiar uno, borrá su línea de ese archivo.');
    }
    console.log('');
    process.exit(0);
}

const MUESTRA = 12;
let total = 0;
for (const { regla, archivos, comoSeArregla } of nuevas) {
    total += archivos.length;
    console.log(`✖ ${regla}`);
    for (const a of archivos.slice(0, MUESTRA)) console.log(`     ${a}`);
    if (archivos.length > MUESTRA) console.log(`     … y ${archivos.length - MUESTRA} más`);
    console.log(`   → ${comoSeArregla}\n`);
}
console.log(`${total} archivo(s) NUEVOS fuera de lugar en ${nuevas.length} regla(s).`);
if (totalDeuda > 0) console.log(`(Además hay ${totalDeuda} de deuda vieja ya registrada, que no cuentan acá.)`);
console.log('\nLas reglas están en CLAUDE.md → "Dónde va cada cosa" y "Higiene del repo".\n');
process.exit(1);
