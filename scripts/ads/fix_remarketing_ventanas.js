/**
 * Corrección del conjunto de REMARKETING (120250649502760023).
 *
 * QUÉ ARREGLA (auditoría 27/8/2026, OK de Ishtar 28/8):
 *  - El pool era minúsculo: visitantes web 30d + producto 14d + carrito 14d
 *    con el volumen de tráfico de la tienda pesan casi nada, y la entrega la
 *    dominaban IG/FB 90d. Reach 1.900 en 14 días, CPM 2,5x el de ATP.
 *  - [placaResenas] gastó US$7,38 sin ninguna conversación (su métrica fuerte
 *    fueron clicks, que no es el objetivo del conjunto).
 *
 * QUÉ HACE:
 *  1. Cambia las audiencias del conjunto a ventanas más largas que YA existen:
 *     Visitantes web 30d → Visitantes web 180 días
 *     Vieron producto 14d → Vieron ficha de producto 30 días
 *     (carrito 14d queda: no existe una de 30d y crearla arrancaría vacía igual;
 *      IG 90d y FB 90d quedan; exclusiones quedan.)
 *  2. Mantiene advantage_audience=0 (remarketing puro: la dueña pidió reimpactar,
 *     no diluir el público).
 *  3. Pausa [placaResenas].
 *
 * Se manda el targeting COMPLETO (Graph reemplaza el objeto entero).
 *
 * USO:
 *   node -r dotenv/config scripts/ads/fix_remarketing_ventanas.js         → dry run
 *   META_ALLOW_WRITES=1 META_APP_SECRET= META_AD_ACCOUNT_ID=act_2107444353167176 \
 *     node -r dotenv/config scripts/ads/fix_remarketing_ventanas.js --yes
 */
const c = require('./lib/meta_client.js');

const ADSET = '120250649502760023';
const AD_RESENAS = '120250650090010023';

const AUD = {
  webVieja: '120250899853380023',   // Visitantes web 30 dias
  web180: '120250649493760023',     // Visitantes web 180 días
  prodVieja: '120250899853640023',  // Vieron producto 14 dias
  prod30: '120250650467510023',     // Vieron ficha de producto 30 días
  carrito14: '120250899853790023',
  ig90: '120250899854160023',
  fb90: '120250899854270023',
  exClientes: '120248522647060023',
  exCompradores: '120250899853920023',
};

const targetingNuevo = {
  age_min: 18,
  age_max: 65,
  geo_locations: {
    cities: [{ key: '84740', radius: 25, distance_unit: 'kilometer' }],
    location_types: ['home', 'recent'],
  },
  custom_audiences: [AUD.web180, AUD.prod30, AUD.carrito14, AUD.ig90, AUD.fb90].map(id => ({ id })),
  excluded_custom_audiences: [AUD.exClientes, AUD.exCompradores].map(id => ({ id })),
  targeting_relaxation_types: { lookalike: 0, custom_audience: 0 },
  targeting_automation: { advantage_audience: 0 },
};

(async () => {
  const yes = process.argv.includes('--yes');
  console.log('== PLAN ==');
  console.log('Conjunto:', ADSET, '(remarketing)');
  console.log('  Visitantes web 30d → 180 días · Vieron producto 14d → ficha 30 días');
  console.log('  (carrito 14d, IG 90d, FB 90d y las 2 exclusiones quedan igual; advantage OFF)');
  console.log('Pausar anuncio [placaResenas]:', AD_RESENAS, '(US$7,38 sin conversaciones)');
  if (!yes) { console.log('\nDRY RUN — nada tocado.'); return; }

  await c.post(`/${ADSET}`, { targeting: JSON.stringify(targetingNuevo) }, { confirm: true });
  console.log('✓ Audiencias del conjunto actualizadas');
  await c.post(`/${AD_RESENAS}`, { status: 'PAUSED' }, { confirm: true });
  console.log('✓ [placaResenas] pausado');

  const check = await c.get(`/${ADSET}`, { fields: 'targeting{custom_audiences,excluded_custom_audiences}' });
  console.log('Verificación:', JSON.stringify(check.targeting.custom_audiences.map(a => a.name)));
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
