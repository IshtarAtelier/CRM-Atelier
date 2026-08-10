/**
 * Cambia POR QUÉ PUJA una campaña de Google Ads. ESCRIBE (con las dos llaves).
 *
 * POR QUÉ EXISTE ESTE SCRIPT Y NO ALCANZA CON LAS ACCIONES DE CONVERSIÓN
 * El 10/8/2026 se intentó lo obvio —pasar a secundarias las acciones "Local
 * actions" y las de YouTube— y Google lo rechazó: esas acciones las crea él y
 * son inmutables por API. Pero además el intento estaba mal apuntado: a nivel
 * CUENTA esas categorías ya estaban en "solo mide". Lo que realmente dirige la
 * puja son los `campaign_conversion_goal`, que cada campaña puede sobrescribir,
 * y ahí estaba el problema de verdad:
 *
 *   Search - Multifocales  → pujaba SOLO por GET_DIRECTIONS ("cómo llegar")
 *   Search - Óptica        → pujaba SOLO por GET_DIRECTIONS
 *
 * Dos campañas de búsqueda, contra gente tipeando "multifocales precio", que
 * le pedían a Google que consiguiera pedidos de indicaciones al local. Google
 * hizo exactamente lo que se le pidió.
 *
 * QUÉ HACE
 * Marca `biddable: true` en las categorías que se le pasen, para las campañas
 * que se le pasen. No borra nada y no desactiva lo que ya estaba: solo suma.
 * Para SACAR un objetivo hay que pasarlo en `--sacar`, explícito y aparte.
 *
 * ADVERTENCIA QUE HAY QUE DECIR EN VOZ ALTA
 * Cambiar el objetivo de una campaña le REINICIA EL APRENDIZAJE. Dos o tres
 * semanas de rendimiento errático antes de estabilizar. No es un arreglo
 * instantáneo, es una inversión. Por eso el default es simular.
 *
 * Uso:
 *   node --env-file=.env scripts/maintenance/google-ads-objetivos-campania.mjs
 *      → simula sobre las campañas del PLAN de abajo
 *
 *   GOOGLE_ADS_ALLOW_WRITES=1 node --env-file=.env \
 *     scripts/maintenance/google-ads-objetivos-campania.mjs --aplicar
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { search, mutate, GoogleAdsApiError, customerId } = require('../ads/lib/google_client');

const APLICAR = process.argv.includes('--aplicar');

/**
 * Qué campaña pasa a perseguir qué. Por NOMBRE EXACTO: si alguien renombra una
 * campaña, este script no la encuentra y avisa, en vez de tocar otra parecida.
 *
 * `CONTACT/WEBSITE` es el objetivo que agrupa WhatsApp, Formularios y Llamada
 * del sitio — es por donde entra el pedido de presupuesto, que para esta óptica
 * es el paso previo a casi toda venta de multifocal.
 * `PURCHASE/WEBSITE` es la compra de la tienda (llega importada de GA4).
 */
const PLAN = [
  {
    campania: 'Search - Multifocales',
    sumar: [
      { category: 'PURCHASE', origin: 'WEBSITE', por: 'que persiga la venta, no el "cómo llegar"' },
      { category: 'CONTACT', origin: 'WEBSITE', por: 'el pedido de presupuesto por WhatsApp' },
    ],
  },
  {
    campania: 'Search - Optica',
    sumar: [
      { category: 'PURCHASE', origin: 'WEBSITE', por: 'que persiga la venta, no el "cómo llegar"' },
      { category: 'CONTACT', origin: 'WEBSITE', por: 'el pedido de presupuesto por WhatsApp' },
    ],
  },
];

const GAQL = `
  SELECT
    campaign.id,
    campaign.name,
    campaign.status,
    campaign_conversion_goal.category,
    campaign_conversion_goal.origin,
    campaign_conversion_goal.biddable,
    campaign_conversion_goal.resource_name
  FROM campaign_conversion_goal
  WHERE campaign.status = 'ENABLED'
`;

let filas;
try {
  filas = await search(GAQL);
} catch (err) {
  console.error(err instanceof GoogleAdsApiError ? `Google Ads rechazó la consulta: ${err.message}` : err);
  process.exit(1);
}

const porCampania = new Map();
for (const f of filas) {
  const nombre = f.campaign?.name;
  if (!porCampania.has(nombre)) porCampania.set(nombre, []);
  porCampania.get(nombre).push({ ...f.campaignConversionGoal, campaignId: f.campaign?.id });
}

console.log(`Cuenta ${customerId()} · Modo: ${APLICAR ? '⚠️  APLICAR (escribe)' : 'simulación'}\n`);

const operations = [];
const faltantes = [];

for (const item of PLAN) {
  const metas = porCampania.get(item.campania);
  if (!metas) {
    faltantes.push(item.campania);
    continue;
  }

  const activos = metas.filter((m) => m.biddable).map((m) => `${m.category}/${m.origin}`);
  console.log(`== ${item.campania} ==`);
  console.log(`   ANTES  → puja por: ${activos.length ? activos.join(', ') : '(nada)'}`);

  const nuevos = [];
  for (const s of item.sumar) {
    const meta = metas.find((m) => m.category === s.category && m.origin === s.origin);
    if (!meta) {
      // La categoría no existe para esta campaña: Google las crea todas, así que
      // esto significa que cambió algo del modelo. Avisar, no inventar.
      console.log(`   ⚠️  no existe el objetivo ${s.category}/${s.origin} en esta campaña — revisar a mano`);
      continue;
    }
    if (meta.biddable) {
      console.log(`   ·  ${s.category}/${s.origin} ya estaba activo`);
      continue;
    }
    nuevos.push(`${s.category}/${s.origin}`);
    operations.push({
      op: { update: { resourceName: meta.resourceName, biddable: true }, updateMask: 'biddable' },
      etiqueta: `${item.campania}: +${s.category}/${s.origin} (${s.por})`,
    });
  }

  console.log(`   DESPUÉS→ puja por: ${[...activos, ...nuevos].join(', ')}`);
  if (nuevos.length) console.log(`   ➕ se agregan: ${nuevos.join(', ')}`);
  console.log();
}

if (faltantes.length) {
  console.log(`⚠️  Campañas del plan que no aparecen activas: ${faltantes.join(', ')}`);
  console.log('   ¿Renombradas o pausadas? Revisar antes de dar el cambio por hecho.\n');
}

if (!operations.length) {
  console.log('No hay nada que cambiar.');
  process.exit(0);
}

console.log('CAMBIOS A APLICAR:');
for (const o of operations) console.log(`  ↑ ${o.etiqueta}`);

if (!APLICAR) {
  console.log('\nSimulación: no se escribió nada.');
  console.log('  GOOGLE_ADS_ALLOW_WRITES=1 node --env-file=.env scripts/maintenance/google-ads-objetivos-campania.mjs --aplicar');
  process.exit(0);
}

try {
  const res = await mutate(
    'campaignConversionGoals:mutate',
    { operations: operations.map((o) => o.op) },
    { confirm: true },
  );
  console.log(`\n✅ ${res.results?.length ?? operations.length} objetivos activados.`);
  console.log('El aprendizaje de esas campañas se reinicia: 2-3 semanas erráticas es lo normal.');
} catch (err) {
  console.error('\n❌ No se aplicó:', err instanceof GoogleAdsApiError ? err.message : err);
  if (err instanceof GoogleAdsApiError && err.guidance) console.error('   ', err.guidance);
  // Las mutaciones no se reintentan: un error ambiguo puede haberse aplicado igual.
  console.error('    Verificar en Google Ads antes de volver a correr esto.');
  process.exit(1);
}
