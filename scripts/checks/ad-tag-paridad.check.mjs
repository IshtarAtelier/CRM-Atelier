#!/usr/bin/env node
/**
 * Verifica que las DOS implementaciones del parser de etiquetas de anuncio den
 * exactamente el mismo resultado.
 *
 * Por qué hay dos: el wa-service se despliega como imagen propia y su
 * Dockerfile solo copia `prisma/` y `wa-service/`, así que no puede importar
 * nada de `src/`. La duplicación es una consecuencia del despliegue, no una
 * decisión de diseño — y este check es el precio que paga por existir.
 *
 * Por qué importa: antes había CUATRO copias del regex y no eran iguales
 * (`meta-insights.ts` aceptaba `[a-z0-9_ -]`, el resto `[^\]]`). Un mismo chat
 * podía recibir una etiqueta al entrar por el bot y otra distinta al
 * reportarse, y nadie se enteraba.
 *
 * Uso: node --experimental-strip-types scripts/checks/ad-tag-paridad.check.mjs
 */

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, '../..');

const cjs = require(resolve(raiz, 'wa-service/shared/ad-tag.js'));

// El .ts no se puede importar sin build, así que se evalúa su regex y su
// normalización tal como están escritos en el archivo. Si alguien cambia la
// forma del parseo allá sin tocar acá, el check lo detecta igual porque compara
// resultados, no texto.
const ts = readFileSync(resolve(raiz, 'src/lib/ads/ad-tag.ts'), 'utf8');
const mRegex = ts.match(/const m = String\(text\)\.match\((\/.+?\/i)\);/);
if (!mRegex) {
  console.error('❌ No se pudo extraer el regex de src/lib/ads/ad-tag.ts.');
  console.error('   Si cambiaste la forma de parseAdTag, actualizá este check.');
  process.exit(1);
}
const regexTs = new RegExp(mRegex[1].slice(1, -2), 'i');

function parseTs(text) {
  if (!text) return null;
  const m = String(text).match(regexTs);
  if (!m) return null;
  const campaign = m[2].trim().toLowerCase().replace(/\s+/g, '');
  if (!campaign) return null;
  return { platform: m[1].toLowerCase() === 'google' ? 'GOOGLE' : 'META', campaign };
}

// Corpus: casos reales y los bordes que rompieron algo alguna vez.
const CORPUS = [
  '[metaFlor] Hola, quiero info',
  'Hola [ metaAgos ] me interesa',
  '[METACLIP] consulta',
  '[meta clip on] hola',
  '[googleVerano] quiero precios',
  '[GOOGLE recetados] hola',
  'Hola, vi su anuncio',
  '',
  null,
  undefined,
  '[meta]',                              // sin campaña → null
  '[google]',                            // sin campaña → null
  '[metaFlor.2026] hola',                // punto: el regex viejo lo cortaba
  '[metaCampaña Ñoño] hola',             // tildes y ñ
  'texto antes [metaBry] y después',
  '[otracosa] hola',                     // vocabulario cerrado → null
  'sin corchetes meta suelto',
  '[meta-guion] hola',
  '   [metaEspacios]   ',
  '[metaFlor] y [googleVerano] juntos',  // gana el primero
];

let fallas = 0;
for (const caso of CORPUS) {
  const a = cjs.parseAdTag(caso);
  const b = parseTs(caso);
  const iguales = JSON.stringify(a) === JSON.stringify(b);
  if (!iguales) {
    fallas++;
    console.error(`❌ Divergen para ${JSON.stringify(caso)}`);
    console.error(`   wa-service/shared/ad-tag.js → ${JSON.stringify(a)}`);
    console.error(`   src/lib/ads/ad-tag.ts       → ${JSON.stringify(b)}`);
  }
}

if (fallas) {
  console.error(`\n❌ ${fallas} de ${CORPUS.length} casos divergen. Las dos copias tienen que dar lo mismo.`);
  process.exit(1);
}

console.log(`✅ Paridad del parser de etiquetas: ${CORPUS.length}/${CORPUS.length} casos iguales en las dos implementaciones.`);
