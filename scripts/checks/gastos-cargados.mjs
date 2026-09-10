/**
 * Repaso de los gastos cargados: qué conceptos existen mes por mes, con qué
 * nombre y con qué importe.
 *
 * SOLO LECTURA. Sirve para emprolijar la lista de conceptos fijos
 * (src/lib/constants/gastos-fijos.ts): muestra qué nombres reales usa la
 * óptica, cuáles no matchean ningún concepto —y por lo tanto se duplicarían al
 * reconciliar el mes— y qué conceptos nunca se cargaron.
 *
 * Uso:
 *   node scripts/checks/gastos-cargados.mjs           (base local)
 *   node scripts/checks/gastos-cargados.mjs --prod    (producción, solo lee)
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';

const usarProd = process.argv.includes('--prod');

// El .env no se parsea con dotenv a propósito: solo se saca la URL que hace
// falta y nunca se imprime.
const env = Object.fromEntries(
    readFileSync(new URL('../../.env', import.meta.url), 'utf8')
        .split('\n')
        .filter((l) => /^[A-Z_]+=/.test(l))
        .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^["']|["']$/g, '')]),
);

const url = usarProd ? env.PROD_DATABASE_URL : env.DATABASE_URL;
if (!url) {
    console.error(`No encontré ${usarProd ? 'PROD_DATABASE_URL' : 'DATABASE_URL'} en .env`);
    process.exit(1);
}
console.log(`Base: ${usarProd ? 'PRODUCCIÓN' : 'local'} (${url.replace(/:\/\/[^@]*@/, '://***@').split('?')[0]})\n`);

const prisma = new PrismaClient({ datasourceUrl: url });

// Conceptos canónicos, leídos del propio archivo de constantes para no
// mantener la lista en dos lugares.
const fuente = readFileSync(new URL('../../src/lib/constants/gastos-fijos.ts', import.meta.url), 'utf8');
const conceptos = [...fuente.matchAll(/\{ clave: '([^']+)', name: '([^']+)', type: '([^']+)', category: '[^']+', fuente: '([^']+)'[^}]*\}/g)]
    .map((m) => ({
        clave: m[1], name: m[2], type: m[3], fuente: m[4],
        // Los alias se leen del mismo bloque del concepto.
        alias: [...m[0].matchAll(/'([^']*)'/g)].map((a) => a[1]).slice(5),
    }));
const normal = (s) => s.trim().toLowerCase();
// El nombre canónico Y cada alias apuntan al concepto: es exactamente lo que
// hace la adopción en gastos.service.ts.
const canonPorNombre = new Map();
for (const c of conceptos) {
    canonPorNombre.set(normal(c.name), c);
    for (const a of c.alias) canonPorNombre.set(normal(a), c);
}

// Prisma contra producción exige select explícito: el schema local está
// adelantado y devolver la fila entera revienta.
const filas = await prisma.fixedCost.findMany({
    select: { name: true, amount: true, type: true, month: true, year: true },
    orderBy: [{ year: 'asc' }, { month: 'asc' }, { name: 'asc' }],
});

const meses = [...new Set(filas.map((f) => `${f.year}-${String(f.month).padStart(2, '0')}`))].sort();
console.log(`${filas.length} renglones cargados en ${meses.length} meses: ${meses.join(', ')}\n`);

// ── Nombres usados, con en cuántos meses aparecen y el último importe ──
const porNombre = new Map();
for (const f of filas) {
    const k = normal(f.name);
    const v = porNombre.get(k) || { name: f.name, type: f.type, meses: [], importes: [] };
    v.meses.push(`${f.year}-${String(f.month).padStart(2, '0')}`);
    if (f.amount > 0) v.importes.push(f.amount);
    porNombre.set(k, v);
}

const plata = (n) => '$' + Math.round(n).toLocaleString('es-AR');
const filaTabla = (v, marca) => {
    const ult = v.importes.length ? plata(v.importes[v.importes.length - 1]) : '—';
    return `  ${marca} ${v.name.padEnd(34).slice(0, 34)} ${String(v.type || '').padEnd(10)} ${String(v.meses.length).padStart(2)} meses  último ${ult.padStart(12)}`;
};

const coinciden = [], huerfanos = [];
for (const v of porNombre.values()) {
    (canonPorNombre.has(normal(v.name)) ? coinciden : huerfanos).push(v);
}
huerfanos.sort((a, b) => b.meses.length - a.meses.length);
coinciden.sort((a, b) => b.meses.length - a.meses.length);

console.log('═══ SE ADOPTAN SOLOS (nombre canónico o alias) ═══');
coinciden.forEach((v) => {
    const c = canonPorNombre.get(normal(v.name));
    const flecha = normal(c.name) === normal(v.name) ? '' : `  →  ${c.name}`;
    console.log(filaTabla(v, '✅') + flecha);
});

// Dos nombres distintos que caen en el MISMO concepto dentro del MISMO mes
// serían un choque: la clave es única por mes y uno de los dos quedaría afuera.
const choques = [];
const porConceptoMes = new Map();
for (const f of filas) {
    const c = canonPorNombre.get(normal(f.name));
    if (!c) continue;
    const k = `${c.clave}|${f.year}-${String(f.month).padStart(2, '0')}`;
    if (!porConceptoMes.has(k)) porConceptoMes.set(k, []);
    porConceptoMes.get(k).push(f.name);
}
for (const [k, nombres] of porConceptoMes) if (nombres.length > 1) choques.push(`${k}: ${nombres.join(' + ')}`);
console.log(choques.length
    ? `\n❌ CHOQUES (dos nombres para el mismo concepto en el mismo mes):\n   ${choques.join('\n   ')}`
    : '\n✅ Ningún choque: ningún mes tiene dos nombres del mismo concepto.');

console.log('\n═══ NO coinciden: hoy se DUPLICARÍAN al abrir el mes ═══');
console.log('   (cada uno necesita un alias, o ser un concepto nuevo, o quedar como gasto suelto)\n');
huerfanos.forEach((v) => console.log(filaTabla(v, '⚠️ ')));

const nuncaUsados = conceptos.filter((c) => !porNombre.has(normal(c.name)));
console.log('\n═══ Conceptos fijos que NUNCA se cargaron con ese nombre ═══');
nuncaUsados.forEach((c) => console.log(`  ·  ${c.name.padEnd(34)} ${c.type.padEnd(10)} ${c.fuente === 'manual' ? 'a mano' : 'AUTO'}`));

await prisma.$disconnect();
