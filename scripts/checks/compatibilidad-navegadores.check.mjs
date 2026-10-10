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
// Services que SÍ llegan al navegador (los importan el carrito, el checkout y
// la ficha): se revisan aunque estén en src/services.
const SERVICES_DEL_NAVEGADOR = [/^src\/services\/PricingService\.ts$/, /^src\/services\/lab-modules\//];
// Lo que Next NO transpila ni rellena y Safari 15 no tiene. (Sí rellena
// Array.at, Object.hasOwn, flat y fromEntries; la sintaxis la baja a Safari 12.)
const PROHIBIDO = [
  [/\(\?<[=!]/, 'lookbehind de regex (Safari < 16.4)'],
  [/\bstructuredClone\(/, 'structuredClone (Safari < 15.4)'],
  [/\.(findLast|findLastIndex|toSorted|toReversed|toSpliced)\(/, 'métodos de array de ES2023 (Safari < 15.4/16)'],
];
// crypto.randomUUID existe desde Safari 15.4: solo con guarda (?.() o typeof) o por idAleatorio().
// Guarda válida: preguntar por randomUUID mismo ("'randomUUID' in crypto",
// "typeof crypto.randomUUID", "crypto.randomUUID ?", "randomUUID?.()").
// "typeof crypto" NO alcanza: en iOS 15.0–15.3 crypto existe y randomUUID no.
const UUID_SIN_GUARDA = /crypto\??\.randomUUID\(\)/;
const UUID_CON_GUARDA = /randomUUID\?\.\(|crypto\.randomUUID(?![(?])|'randomUUID' in crypto/;

const malos = [];
const recorrer = (dir) => {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) { recorrer(p); continue; }
    if (!/\.(ts|tsx|js|mjs)$/.test(n)) continue;
    const rel = relative(raiz, p).split('\\').join('/');
    if (SOLO_SERVIDOR_O_CRM.some((r) => r.test(rel)) && !SERVICES_DEL_NAVEGADOR.some((r) => r.test(rel))) continue;
    const src = readFileSync(p, 'utf8');
    src.split('\n').forEach((linea, i) => {
      if (/^\s*(\/\/|\*)/.test(linea)) return; // comentarios
      for (const [re, que] of PROHIBIDO) if (re.test(linea)) malos.push(`${rel}:${i + 1} — ${que}`);
      if (UUID_SIN_GUARDA.test(linea) && !UUID_CON_GUARDA.test(linea)) malos.push(`${rel}:${i + 1} — crypto.randomUUID() sin guarda (Safari < 15.4): usar idAleatorio()`);
    });
  }
};
recorrer(join(raiz, 'src'));

console.log('\n▶ Sintaxis que un iPhone con iOS 15 no entiende\n');
if (malos.length) {
  console.error(`  ❌ sintaxis o funciones que Safari de iOS 15 no tiene, en código de la tienda:\n     ${malos.join('\n     ')}`);
  console.error('\n  En un iPhone con iOS 15 el archivo no carga o la acción falla. Reescribir sin eso.\n');
  process.exit(1);
}
console.log('  ✅ nada que un Safari de iOS 15 no entienda en el código que llega a la tienda (lookbehind, ES2023, randomUUID sin guarda)\n');
