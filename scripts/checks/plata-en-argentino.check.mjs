#!/usr/bin/env node
// ────────────────────────────────────────────────────────────────────────────
// LA PLATA Y LAS FECHAS SE ESCRIBEN EN ARGENTINO. Guardián de esa regla.
//
// POR QUÉ EXISTE (17/9/2026): `order-pdf-generator.ts` tenía 38 llamadas a
// `.toLocaleString()` SIN idioma. En una Mac argentina se ven bien; el
// contenedor de producción es `node:22-slim` y resuelve en **en-US**, así que
// los presupuestos le llegaban al cliente con "$ 745,226" —con coma, que acá
// se lee "setecientos cuarenta y cinco con dos"— y las cuotas con tres
// decimales. El mismo día aparecieron dos más: el bot le pasaba al modelo las
// fechas de los pedidos como "9/17/2026" y el modelo se las repetía al cliente
// por WhatsApp, y el precio que alimenta los copies de Instagram salía con
// coma.
//
// No es un bug, es una CLASE de bug: el dato correcto escrito en un idioma que
// no es el de quien lo lee. Se arregla una vez y vuelve con el próximo
// componente, salvo que algo lo vigile. Esto es ese algo.
//
// La regla ya estaba escrita desde la auditoría del 2/9 en `src/lib/format-precio.ts`
// ("NUNCA `toLocaleString()` a secas sobre un precio"), pero una regla que solo
// vive en un comentario es una sugerencia. La que rige es la que falla el CI.
//
// QUÉ HACE: falla si aparece un `toLocaleString()` / `toLocaleDateString()` /
// `toLocaleTimeString()` sin idioma, o un `Intl.*Format()` sin locale, que no
// esté en la lista de deuda. Corre sin base y sin red.
//
// CÓMO SE ARREGLA UN HALLAZGO:
//   • Plata  → `formatearPrecio()` de `src/lib/format-precio.ts`
//   • Fechas → `formatDate()` / `formatDateLong()` de `src/lib/format-date.ts`
//   • En wa-service (CommonJS, sin alias) → `'es-AR'` explícito.
//
// La lista de deuda SOLO PUEDE ACHICARSE. Al limpiar un archivo, borrá su
// línea. Nunca corras `--registrar-deuda` para tapar un hallazgo nuevo: sería
// anotar como vieja una suciedad que acabás de hacer.
// ────────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const RAIZ = new URL('../../', import.meta.url).pathname;
const CARPETAS = ['src', 'wa-service'];
const EXTENSIONES = ['.ts', '.tsx', '.js', '.mjs', '.cjs'];
const IGNORAR = ['node_modules', '.next', 'dist', 'build', '.playwright-browsers'];

/**
 * Los patrones prohibidos.
 *
 * `toLocaleString('en-US', { timeZone })` NO es un hallazgo: ese idioma se usa
 * para convertir zona horaria, no para mostrar (business-hours.js, turnos.js).
 * Por eso solo se busca el paréntesis VACÍO.
 */
const PATRONES = [
    { re: /\.toLocaleString\(\s*\)/g, que: 'toLocaleString() sin idioma' },
    { re: /\.toLocaleDateString\(\s*\)/g, que: 'toLocaleDateString() sin idioma' },
    { re: /\.toLocaleTimeString\(\s*\)/g, que: 'toLocaleTimeString() sin idioma' },
    { re: /new Intl\.NumberFormat\(\s*\)/g, que: 'Intl.NumberFormat() sin locale' },
    { re: /new Intl\.DateTimeFormat\(\s*\)/g, que: 'Intl.DateTimeFormat() sin locale' },
];

function archivos(dir, acc = []) {
    let entradas;
    try { entradas = readdirSync(dir); } catch { return acc; }
    for (const e of entradas) {
        if (IGNORAR.includes(e)) continue;
        const p = join(dir, e);
        let st;
        try { st = statSync(p); } catch { continue; }
        if (st.isDirectory()) archivos(p, acc);
        else if (EXTENSIONES.some(x => e.endsWith(x))) acc.push(p);
    }
    return acc;
}

const hallazgos = [];
for (const carpeta of CARPETAS) {
    for (const ruta of archivos(join(RAIZ, carpeta))) {
        const rel = relative(RAIZ, ruta);
        let texto;
        try { texto = readFileSync(ruta, 'utf8'); } catch { continue; }
        const lineas = texto.split('\n');
        lineas.forEach((linea, i) => {
            // Un comentario que MENCIONA el patrón (como el de este archivo o el
            // de format-precio.ts) no es una llamada. Sin esto, la propia
            // documentación de la regla haría fallar la regla.
            const limpia = linea.trim();
            if (limpia.startsWith('//') || limpia.startsWith('*') || limpia.startsWith('/*')) return;
            for (const { re, que } of PATRONES) {
                re.lastIndex = 0;
                if (re.test(linea)) hallazgos.push({ archivo: rel, linea: i + 1, que });
            }
        });
    }
}

const RUTA_DEUDA = new URL('./plata-en-argentino.deuda.json', import.meta.url);
const REGISTRAR = process.argv.includes('--registrar-deuda');

let deuda = [];
try {
    deuda = JSON.parse(readFileSync(RUTA_DEUDA, 'utf8')).archivos ?? [];
} catch {
    // Sin archivo de deuda: todo cuenta como nuevo (es el estado ideal).
}

// La deuda se anota POR ARCHIVO, no por línea: si se anotara por línea, agregar
// una línea arriba correría todas las de abajo y el check fallaría por
// archivos que nadie tocó.
const enDeuda = new Set(deuda);

if (REGISTRAR) {
    const unicos = [...new Set(hallazgos.map(h => h.archivo))].sort();
    writeFileSync(RUTA_DEUDA, JSON.stringify({
        _comentario: 'Archivos con toLocaleString()/Intl sin idioma que ya existían cuando se estrenó check:plata (17/9/2026). El check NO falla por estos, pero sí por cualquier archivo nuevo. Esta lista SOLO PUEDE ACHICARSE: al limpiar un archivo, borrá su línea.',
        generado: new Date().toISOString().slice(0, 10),
        archivos: unicos,
    }, null, 2) + '\n');
    console.log(`Deuda registrada: ${unicos.length} archivo(s).`);
    process.exit(0);
}

console.log('\n— La plata y las fechas, en argentino —\n');

const nuevos = hallazgos.filter(h => !enDeuda.has(h.archivo));
const viejos = hallazgos.filter(h => enDeuda.has(h.archivo));

// Un archivo que salió de la deuda pero sigue sucio: alguien borró su línea sin
// limpiarlo. Se avisa, pero no hace falta un caso aparte: ya cuenta como nuevo.

if (nuevos.length > 0) {
    console.error(`❌ ${nuevos.length} lugar(es) escriben plata o fechas sin decir el idioma.\n`);
    console.error('   En producción (node:22-slim) eso resuelve en en-US: "$ 745,226" en vez de "$ 745.226".\n');
    for (const h of nuevos.slice(0, 40)) {
        console.error(`   ${h.archivo}:${h.linea} — ${h.que}`);
    }
    if (nuevos.length > 40) console.error(`   … y ${nuevos.length - 40} más.`);
    console.error('\n   Plata  → formatearPrecio() de src/lib/format-precio.ts');
    console.error('   Fechas → formatDate() / formatDateLong() de src/lib/format-date.ts');
    console.error("   En wa-service (sin alias) → 'es-AR' explícito.\n");
    process.exit(1);
}

console.log(`✅ Ningún lugar nuevo escribe plata o fechas sin idioma.`);
if (viejos.length > 0) {
    console.log(`\n📋 Deuda conocida: ${viejos.length} lugar(es) en ${new Set(viejos.map(v => v.archivo)).size} archivo(s),`);
    console.log('   listados en scripts/checks/plata-en-argentino.deuda.json.');
    console.log('   Son casi todos pantallas internas del CRM. Al limpiar uno, borrá su línea.');
}
console.log('');
