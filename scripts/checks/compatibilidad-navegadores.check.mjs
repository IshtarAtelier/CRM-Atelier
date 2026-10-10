#!/usr/bin/env node
/**
 * Lo que llega al navegador de la TIENDA no puede usar sintaxis que un iPhone
 * con iOS 15 no entiende.
 *
 * POR QUÉ EXISTE
 * El 10/10/2026 la regla del cartel (src/lib/promo-cuotas.ts) usó un
 * lookbehind de expresiones regulares, `(?<!…)`. Ese módulo lo importan la
 * barra, el carrito, la ficha y el checkout, y Safari anterior a 16.4 no
 * soporta lookbehind: el archivo entero tira "invalid group specifier" al
 * cargar y la página no arranca. tsc y el build no lo ven (para ellos es
 * válido); solo un navegador viejo lo descubre, en la mano de un cliente.
 *
 * Qué mira: todo src/ menos lo que corre solo en el servidor (rutas de API,
 * services, crons) y lo que es solo del CRM (lo usa el equipo, con navegadores
 * al día). Corre sin base y sin red.
 * Uso: npm run check:navegadores
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SOLO_SERVIDOR_O_CRM = [
  /^src\/app\/api\//, /^src\/services\//, /^src\/app\/admin\//, /^src\/components\/admin\//,
  /^src\/components\/whatsapp\//, /^src\/lib\/server\//, /^src\/instrumentation\.ts$/, /^src\/middleware\.ts$/,
];
const LOOKBEHIND = /\(\?<[=!]/;

const malos = [];
const recorrer = (dir) => {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) { recorrer(p); continue; }
    if (!/\.(ts|tsx|js|mjs)$/.test(n)) continue;
    const rel = relative(raiz, p).split('\\').join('/');
    if (SOLO_SERVIDOR_O_CRM.some((r) => r.test(rel))) continue;
    const src = readFileSync(p, 'utf8');
    src.split('\n').forEach((linea, i) => { if (LOOKBEHIND.test(linea)) malos.push(`${rel}:${i + 1}`); });
  }
};
recorrer(join(raiz, 'src'));

console.log('\n▶ Sintaxis que un iPhone con iOS 15 no entiende\n');
if (malos.length) {
  console.error(`  ❌ lookbehind de regex (?<= / (?<! en código de la tienda:\n     ${malos.join('\n     ')}`);
  console.error('\n  Safari anterior a 16.4 no lo soporta y el archivo entero no carga. Reescribir sin lookbehind.\n');
  process.exit(1);
}
console.log('  ✅ ningún lookbehind de regex en código que llega al navegador de la tienda\n');
