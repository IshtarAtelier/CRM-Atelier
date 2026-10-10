#!/usr/bin/env node
/**
 * El respaldo de los PDF (presupuesto, recibo y ficha del cliente) tiene que
 * generar un PDF de verdad.
 *
 * POR QUÉ EXISTE
 * Los tres generadores arman el PDF con un navegador headless y, si falla, con
 * jsPDF. Los tres respaldos cargaban la librería con
 * `const { default: jsPDF } = await import('jspdf')`, y en Node ese `default`
 * es el objeto de exports, no la clase: el respaldo tiraba "jsPDF is not a
 * constructor" SIEMPRE, y el cliente se quedaba sin presupuesto o sin recibo
 * justo el día que el navegador headless no arrancaba (comprobado el
 * 10/10/2026). Nadie lo veía porque el camino principal casi siempre anda.
 *
 * Qué hace: fuerza el respaldo (corre desde una carpeta sin navegadores) y
 * genera un recibo de mentira; además, ningún archivo vuelve a cargar jsPDF
 * por `default`.
 *
 * Corre sin base y sin red.
 * Uso: node --experimental-strip-types --import ./scripts/checks/_alias.mjs scripts/checks/pdf-respaldo.check.mjs
 */
import { readdirSync, readFileSync, statSync, mkdtempSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
let fallas = 0;
const check = (nombre, ok, detalle = '') => {
  console.log(`  ${ok ? '✅' : '❌'} ${nombre}${ok || !detalle ? '' : `\n       ${detalle}`}`);
  if (!ok) fallas++;
};

console.log('\n▶ Respaldo de los PDF (jsPDF)\n');

const { cargarJsPDF } = await import(pathToFileURL(join(raiz, 'src/lib/cargar-jspdf.ts')).href);
const JsPDF = await cargarJsPDF();
let doc = null;
try { doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }); } catch (e) { check('cargarJsPDF devuelve el constructor', false, e.message); }
if (doc) check('cargarJsPDF devuelve el constructor (en Node)', typeof doc.output === 'function');

// Sin `default:` en ningún lado.
const malos = [];
const recorrer = (dir) => {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) { if (n !== 'node_modules') recorrer(p); continue; }
    if (!/\.(ts|tsx|js|mjs)$/.test(n)) continue;
    if (/\{\s*default\s*:\s*jsPDF\s*\}\s*=\s*await\s+import\(\s*['"]jspdf['"]\s*\)/.test(readFileSync(p, 'utf8'))) malos.push(relative(raiz, p));
  }
};
recorrer(join(raiz, 'src'));
check('ningún archivo carga jsPDF por `default`', malos.length === 0, malos.join(', '));

// El respaldo de punta a punta: desde una carpeta sin navegadores headless el
// generador cae a jsPDF, como en un server donde Chromium no arranca.
const { generateReceiptPDF } = await import(pathToFileURL(join(raiz, 'src/lib/receipt-pdf-generator.ts')).href);
const cwd = process.cwd();
const silencio = { error: console.error, warn: console.warn };
try {
  process.chdir(mkdtempSync(join(tmpdir(), 'pdf-respaldo-')));
  console.error = () => {}; console.warn = () => {};
  const r = await generateReceiptPDF(
    { id: 'pago-prueba', amount: 120000, date: '2026-10-10T15:00:00.000Z', method: 'TRANSFER' },
    { id: 'orden-de-prueba-abcd', total: 240000, items: [], payments: [] },
    { name: 'Cliente de Prueba' },
  );
  const bytes = Buffer.from(r.base64 || '', 'base64');
  check('el recibo de respaldo es un PDF de verdad', bytes.subarray(0, 5).toString() === '%PDF-' && bytes.length > 1000, `${bytes.length} bytes, empieza con ${JSON.stringify(bytes.subarray(0, 5).toString())}`);
} catch (e) {
  check('el recibo de respaldo es un PDF de verdad', false, e.message);
} finally {
  console.error = silencio.error; console.warn = silencio.warn;
  process.chdir(cwd);
}

if (fallas) { console.error(`\n❌ ${fallas} problema(s): sin respaldo, el día que falla el navegador headless no sale ningún PDF.\n`); process.exit(1); }
console.log('\n✅ El respaldo de los PDF genera un PDF.\n');
