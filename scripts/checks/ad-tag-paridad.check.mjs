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
 * La lógica pura del lado TS vive en `src/lib/ads/ad-tag-core.ts` (sin
 * imports), así que acá se importa DIRECTO con strip-types y se comparan
 * resultados función por función — ya no se extrae el regex con otro regex.
 *
 * Uso: node --experimental-strip-types scripts/checks/ad-tag-paridad.check.mjs
 */

import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, '../..');

const cjs = require(resolve(raiz, 'wa-service/shared/ad-tag.js'));
const ts = await import(pathToFileURL(resolve(raiz, 'src/lib/ads/ad-tag-core.ts')).href);

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

  // Alias: [ClipsJav] es un anuncio real cargado sin prefijo meta/google.
  'Quiero informacion sobre lentes clip on [ClipsJav]',
  '[ clipsjav ] hola',
  '[metaClip] antes que [ClipsJav]',     // la etiqueta canónica gana

  // Prefills genéricos sin etiqueta (formatos imagen/video con quick replies,
  // o el autofill default de Meta) → fallbackAdTag = 'generico'.
  '¡Hola! Quiero más información',
  'Quiero obtener más información.',
  'hola quiero mas informacion',
  'Hola! Quiero más información sobre los clipon',  // no es la frase exacta → null
  'quiero mas informacion',                          // frase distinta → null

  // Cliente que declara el origen en texto libre.
  'Hola, los vi en Meta y quería saber de los multifocales',
  'LOS VI EN META',
  'los vi en metadona',                  // borde de palabra → null
  'vi en meta',                          // frase incompleta → null
];

const FUNCIONES = ['parseAdTag', 'prefillAdTag', 'fallbackAdTag', 'stripAdTags'];

let fallas = 0;
let comparaciones = 0;
for (const fn of FUNCIONES) {
  if (typeof cjs[fn] !== 'function' || typeof ts[fn] !== 'function') {
    fallas++;
    console.error(`❌ ${fn} no está exportada en las dos copias.`);
    continue;
  }
  for (const caso of CORPUS) {
    comparaciones++;
    const a = cjs[fn](caso);
    const b = ts[fn](caso);
    const iguales = JSON.stringify(a) === JSON.stringify(b);
    if (!iguales) {
      fallas++;
      console.error(`❌ ${fn} diverge para ${JSON.stringify(caso)}`);
      console.error(`   wa-service/shared/ad-tag.js  → ${JSON.stringify(a)}`);
      console.error(`   src/lib/ads/ad-tag-core.ts   → ${JSON.stringify(b)}`);
    }
  }
}

// Casos con resultado esperado fijo: la paridad no alcanza si las DOS copias
// se equivocan igual. Estos anclan el comportamiento que arregló cada bug.
const ESPERADOS = [
  ['prefillAdTag', 'Quiero informacion sobre lentes clip on [ClipsJav]', 'clipsjav'],
  ['prefillAdTag', '¡Hola! Quiero más información', null],   // el fallback es aparte
  ['fallbackAdTag', '¡Hola! Quiero más información', 'generico'],
  ['fallbackAdTag', 'Quiero obtener más información.', 'generico'],
  ['fallbackAdTag', 'Hola, los vi en Meta y quería saber de los multifocales', 'generico'],
  ['fallbackAdTag', 'Hola! Quiero más información sobre los clipon', null],
  ['fallbackAdTag', 'los vi en metadona', null],
  ['prefillAdTag', '[metaClip] antes que [ClipsJav]', 'clip'],
  ['stripAdTags', 'hola [ClipsJav]', 'hola'],
];
for (const [fn, entrada, esperado] of ESPERADOS) {
  for (const [nombre, impl] of [['cjs', cjs], ['ts', ts]]) {
    comparaciones++;
    const salida = impl[fn](entrada);
    if (JSON.stringify(salida) !== JSON.stringify(esperado)) {
      fallas++;
      console.error(`❌ ${fn} (${nombre}) para ${JSON.stringify(entrada)}: esperaba ${JSON.stringify(esperado)}, dio ${JSON.stringify(salida)}`);
    }
  }
}

if (fallas) {
  console.error(`\n❌ ${fallas} fallas en ${comparaciones} comparaciones. Las dos copias tienen que dar lo mismo.`);
  process.exit(1);
}

console.log(`✅ Paridad del parser de etiquetas: ${comparaciones} comparaciones iguales en las dos implementaciones (${FUNCIONES.join(', ')}).`);
