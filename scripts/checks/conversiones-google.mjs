/**
 * Acciones de conversión de Google Ads — SOLO LECTURA (GAQL).
 *
 * Para qué: el sitio no puede reportar la compra web a Google Ads sin la
 * "label" del tag (la parte después de la barra en `AW-123456789/AbC-D_efGh`).
 * Ese valor NO se inventa: lo emite Google al crear la acción de conversión.
 * Este chequeo lista las acciones que YA existen en la cuenta, con su estado,
 * si cuentan para la puja (primaria/secundaria) y —cuando Google lo expone— la
 * label lista para cargar en `GOOGLE_ADS_CONVERSION_LABEL`.
 *
 * Va por `scripts/ads/lib/google_client.js` como exige scripts/ads/CLAUDE.md
 * (nada de fetch directo a la API). No escribe nada y no imprime credenciales.
 *
 * Uso:  node --env-file=.env scripts/checks/conversiones-google.mjs
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { search, GoogleAdsApiError } = require('../ads/lib/google_client');

const GAQL = `
  SELECT
    conversion_action.id,
    conversion_action.name,
    conversion_action.status,
    conversion_action.type,
    conversion_action.category,
    conversion_action.primary_for_goal,
    conversion_action.origin,
    conversion_action.tag_snippets
  FROM conversion_action
  ORDER BY conversion_action.name
`;

/**
 * La label vive dentro del `event_snippet` que devuelve Google, con la forma
 * `send_to': 'AW-123/AbC-D_efGh'`. Se extrae con regex porque la API no la
 * expone como campo propio.
 */
function extraerLabel(tagSnippets) {
  for (const snippet of tagSnippets ?? []) {
    const texto = `${snippet.eventSnippet ?? ''}${snippet.globalSiteTag ?? ''}`;
    const m = texto.match(/AW-\d+\/([A-Za-z0-9_\-]+)/);
    if (m) return { tag: m[0], label: m[1] };
  }
  return null;
}

let filas;
try {
  filas = await search(GAQL);
} catch (err) {
  if (err instanceof GoogleAdsApiError) {
    console.error('Google Ads rechazó la consulta:', err.message);
  } else {
    console.error('Error consultando Google Ads:', err instanceof Error ? err.message : err);
  }
  process.exit(1);
}

if (!filas.length) {
  console.log('La cuenta no tiene NINGUNA acción de conversión creada.');
  console.log('Hay que crearla en Google Ads → Objetivos → Conversiones.');
  process.exit(0);
}

console.log(`=== Acciones de conversión (${filas.length}) ===\n`);

const compras = [];
const humoPrimario = [];

// Acciones que cuentan intención local, no venta. Como PRIMARIAS le enseñan a
// Google a comprar clics de "Cómo llegar": es el 82% de humo de la auditoría.
const CATEGORIAS_LOCALES = new Set(['GET_DIRECTIONS', 'PAGE_VIEW', 'ENGAGEMENT']);

for (const fila of filas) {
  const ca = fila.conversionAction ?? {};
  const tag = extraerLabel(ca.tagSnippets);
  const esPrimaria = ca.primaryForGoal !== false;
  const vive = ca.status === 'ENABLED';
  console.log(`▸ ${ca.name}`);
  console.log(`  estado ${ca.status} · ${esPrimaria ? 'PRIMARIA' : 'SECUNDARIA'} · tipo ${ca.type} · categoría ${ca.category} · origen ${ca.origin}`);
  if (tag) console.log(`  etiqueta: ${tag.tag}`);

  if (ca.category === 'PURCHASE') {
    compras.push({
      nombre: ca.name,
      estado: ca.status,
      esPrimaria,
      vive,
      tag,
      // Importada de GA4: se alimenta del evento `purchase` de GA4 y NO
      // necesita etiqueta en el sitio.
      esGA4: String(ca.type ?? '').includes('GOOGLE_ANALYTICS_4'),
      // Tiendanube ya no es la plataforma: su acción no puede volver a disparar.
      esLegado: /tienda\s*nube|tiendanube/i.test(ca.name ?? ''),
    });
  }
  if (vive && esPrimaria && CATEGORIAS_LOCALES.has(ca.category)) {
    humoPrimario.push(ca.name);
  }
}

console.log('\n=== Compras: quién le reporta la venta a Google ===');
const ga4Viva = compras.find((c) => c.esGA4 && c.vive && c.esPrimaria);
const legadoVivo = compras.filter((c) => c.esLegado && c.vive);

if (ga4Viva) {
  console.log(`✅ Ya hay una vía activa: "${ga4Viva.nombre}" (importada de GA4, PRIMARIA).`);
  console.log('   Google recibe la compra por el evento purchase de GA4 — sin etiqueta en el sitio.');
  console.log('   ⚠️ NO cargar GOOGLE_ADS_CONVERSION_LABEL con una acción de sitio web');
  console.log('      mientras esta siga primaria: la misma venta se contaría DOS veces');
  console.log('      y el ROAS saldría inflado. Se elige UNA sola vía.');
} else {
  const conEtiqueta = compras.find((c) => c.vive && c.tag && !c.esLegado);
  if (conEtiqueta) {
    console.log(`Acción de compra propia del sitio: "${conEtiqueta.nombre}" (${conEtiqueta.estado}).`);
    console.log(`  GOOGLE_ADS_CONVERSION_ID=${conEtiqueta.tag.tag.split('/')[0]}`);
    console.log(`  GOOGLE_ADS_CONVERSION_LABEL=${conEtiqueta.tag.label}`);
  } else {
    console.log('❌ Ninguna vía activa reporta la compra web. Hay que crear la acción');
    console.log('   (Objetivos → Conversiones → Sitio web → Compra) o importar la de GA4.');
  }
}

for (const l of legadoVivo) {
  console.log(`\n🔴 LEGADO ACTIVO: "${l.nombre}" (${l.estado}, ${l.esPrimaria ? 'PRIMARIA' : 'secundaria'}).`);
  console.log('   Tiendanube ya no es la plataforma, así que no puede volver a disparar.');
  if (l.esPrimaria) console.log('   Como PRIMARIA, Google puja por una conversión que nunca ocurre.');
  if (l.tag) console.log(`   Su etiqueta (${l.tag.label}) NO va en el sitio nuevo.`);
}

if (humoPrimario.length) {
  console.log(`\n🔴 ${humoPrimario.length} acciones LOCALES marcadas como PRIMARIAS (señal fabricada):`);
  for (const n of humoPrimario) console.log(`   - ${n}`);
  console.log('   Pasarlas a SECUNDARIAS (nunca borrarlas). Es el "Gran Corte" del plan:');
  console.log('   la columna Conversiones cae fuerte porque deja de contar humo.');
}