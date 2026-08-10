/**
 * Pasa a SECUNDARIAS las acciones de conversión que no son una venta ni un
 * contacto real. ESCRIBE en la cuenta de Google Ads (solo con las dos llaves).
 *
 * POR QUÉ
 * Una acción marcada como PRIMARIA es lo que la puja automática trata de
 * conseguir. La cuenta tenía como primarias cosas como "Local actions - Website
 * visits" (o sea: una visita a la página contaba como conversión) y "Directions"
 * ("cómo llegar"). Google, obediente, aprende a comprar los clics más baratos
 * que producen esos eventos — que son exactamente los que NO compran. Es lo que
 * la auditoría midió como el 44% del gasto.
 *
 * Pasarlas a secundarias NO las borra ni las deja de medir: se siguen viendo en
 * los informes, pero dejan de dirigir la puja. Es reversible con un clic.
 *
 * QUÉ NO TOCA — y esto es lo importante
 * Ninguna acción de venta ni de contacto real. Se quedan PRIMARIAS:
 *   · Atelier Optica - Web (web) purchase  → la venta
 *   · WhatsApp                             → por donde la gente pide presupuesto
 *   · Clicks to call y las llamadas de Maps/anuncios → un llamado es un lead real
 * La lista de abajo es por NOMBRE EXACTO, no por una regla que mañana barra de
 * más. Si Google renombra una acción, este script no la encuentra y avisa, que
 * es la forma correcta de fallar.
 *
 * Uso:
 *   node --env-file=.env scripts/maintenance/google-ads-conversiones-secundarias.mjs
 *      → simula: muestra antes/después y no escribe nada
 *
 *   GOOGLE_ADS_ALLOW_WRITES=1 node --env-file=.env \
 *     scripts/maintenance/google-ads-conversiones-secundarias.mjs --aplicar
 *      → escribe (requiere confirmación explícita de la dueña en la conversación)
 *
 * OJO CON EL EFECTO VISIBLE: al día siguiente la columna "Conversiones" de
 * Google Ads CAE FUERTE. No es que se rompió nada — es que deja de contar humo.
 * Lo que tiene que subir en las semanas siguientes son las ventas reales.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { search, mutate, GoogleAdsApiError } = require('../ads/lib/google_client');

const APLICAR = process.argv.includes('--aplicar');

/**
 * Las que se degradan, por nombre exacto, con el motivo escrito. El motivo no es
 * decoración: es lo que permite entender dentro de seis meses por qué está cada
 * una acá, sin tener que reconstruir la auditoría.
 */
const A_DEGRADAR = new Map([
  ['Indicaciones de Maps de campaña inteligente', 'pedir "cómo llegar" no es comprar'],
  ['Local actions - Directions', 'pedir "cómo llegar" no es comprar'],
  ['Local actions - Website visits', 'una visita a la web contando como conversión'],
  ['Local actions - Other engagements', 'una interacción suelta no es intención de compra'],
  ['YouTube channel subscriptions', 'suscribirse al canal no es comprar anteojos'],
  ['YouTube follow-on views', 'ver otro video no es comprar anteojos'],
]);

const GAQL = `
  SELECT
    conversion_action.resource_name,
    conversion_action.name,
    conversion_action.status,
    conversion_action.category,
    conversion_action.primary_for_goal
  FROM conversion_action
  ORDER BY conversion_action.name
`;

let filas;
try {
  filas = await search(GAQL);
} catch (err) {
  console.error(err instanceof GoogleAdsApiError ? `Google Ads rechazó la consulta: ${err.message}` : err);
  process.exit(1);
}

const porNombre = new Map(filas.map((f) => [f.conversionAction?.name, f.conversionAction]));

const cambios = [];
const yaEstaban = [];
const noEncontradas = [];

for (const [nombre, motivo] of A_DEGRADAR) {
  const ca = porNombre.get(nombre);
  if (!ca) {
    noEncontradas.push(nombre);
    continue;
  }
  // `primary_for_goal` no viene en la respuesta cuando es true (es el default de
  // la API): la ausencia significa PRIMARIA, no "no sé".
  if (ca.primaryForGoal === false) yaEstaban.push(nombre);
  else cambios.push({ nombre, motivo, resourceName: ca.resourceName });
}

console.log(`Modo: ${APLICAR ? '⚠️  APLICAR (escribe en la cuenta)' : 'simulación'}\n`);

// Qué se mantiene primaria, dicho en voz alta: es la mitad de la revisión que
// alguien tiene que poder hacer de un vistazo antes de dar el OK.
const siguenPrimarias = filas
  .map((f) => f.conversionAction)
  .filter((ca) => ca && ca.status !== 'REMOVED' && ca.primaryForGoal !== false && !A_DEGRADAR.has(ca.name));

console.log('SE MANTIENEN PRIMARIAS (la puja las sigue persiguiendo):');
for (const ca of siguenPrimarias) console.log(`  ✅ ${ca.name}  ·  ${ca.category}`);

console.log(`\nPASAN A SECUNDARIAS (${cambios.length}):`);
for (const c of cambios) console.log(`  ↓  ${c.nombre}  —  ${c.motivo}`);

if (yaEstaban.length) console.log(`\nYa eran secundarias, no se tocan: ${yaEstaban.join(', ')}`);
if (noEncontradas.length) {
  console.log(`\n⚠️  No aparecen en la cuenta (¿renombradas?): ${noEncontradas.join(', ')}`);
  console.log('   Revisar a mano antes de dar por hecho el cambio.');
}

if (!cambios.length) {
  console.log('\nNo hay nada que cambiar.');
  process.exit(0);
}

if (!APLICAR) {
  console.log('\nSimulación: no se escribió nada.');
  console.log('Para aplicarlo:');
  console.log('  GOOGLE_ADS_ALLOW_WRITES=1 node --env-file=.env scripts/maintenance/google-ads-conversiones-secundarias.mjs --aplicar');
  process.exit(0);
}

// Una sola llamada con todas las operaciones: o entran todas o no entra
// ninguna, y no quedamos a mitad de camino si algo falla.
const operations = cambios.map((c) => ({
  update: { resourceName: c.resourceName, primaryForGoal: false },
  updateMask: 'primary_for_goal',
}));

try {
  const res = await mutate('conversionActions:mutate', { operations }, { confirm: true });
  console.log(`\n✅ ${res.results?.length ?? cambios.length} acciones pasadas a secundarias.`);
  console.log('La columna "Conversiones" va a caer fuerte mañana: es lo esperado.');
} catch (err) {
  console.error('\n❌ No se aplicó:', err instanceof GoogleAdsApiError ? err.message : err);
  if (err instanceof GoogleAdsApiError && err.guidance) console.error('   ', err.guidance);
  // Nunca se reintenta: una mutación con error ambiguo puede haberse aplicado.
  console.error('    Verificar en Google Ads antes de volver a correr esto.');
  process.exit(1);
}
