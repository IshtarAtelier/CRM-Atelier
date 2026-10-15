#!/usr/bin/env node
/**
 * Crea la campaña de Búsqueda "Search - Stellest", PAUSADA, según
 * docs/stellest-estrategia-ads.md.
 *
 * Por qué (10/10/2026): en 90 días y 500 términos de búsqueda, ni UNA búsqueda
 * con "stellest" o "miopía" disparó un anuncio — las campañas que corren no
 * tienen esas palabras. Es una campaña NUEVA y aparte: agregar las palabras a
 * Recetados o Multifocales cambiaría a quién le muestran y reiniciaría su
 * aprendizaje (regla permanente de Ishtar: nada que toque lo que ya aprende).
 *
 * Uso:
 *   node --env-file=.env scripts/ads/google_crear_campania_stellest.js            → muestra el plan, no llama a la API
 *   GOOGLE_ADS_ALLOW_WRITES=1 node --env-file=.env scripts/ads/google_crear_campania_stellest.js --validar
 *                                                                               → la API valida todo (validateOnly) y no crea nada
 *   GOOGLE_ADS_ALLOW_WRITES=1 node --env-file=.env scripts/ads/google_crear_campania_stellest.js --yes
 *                                                                               → crea, PAUSADA. Se prende a mano en el panel.
 *
 * Todo va en UNA llamada a googleAds:mutate con nombres temporales, así la API
 * lo crea entero o no crea nada: no quedan campañas a medias.
 */
const { mutate, customerId } = require('./lib/google_client');

const NOMBRE = 'Search - Stellest';
const PRESUPUESTO_DIARIO_ARS = 3000;
const TOPE_CPC_ARS = 250;
const RADIO_KM = 30;
// José Luis de Tejeda 4380, Cerro de las Rosas, Córdoba.
const LOCAL = { lat: -31.3615, lng: -64.2404 };
const LISTA_NEGATIVAS_GENERAL = process.env.GOOGLE_ADS_NEGATIVE_SET_ID || '11042611019';
const ORIGEN = 'https://atelieroptica.com.ar';

const micros = (ars) => Math.round(ars * 1_000_000);
const utm = (ruta) => `${ORIGEN}${ruta}?utm_source=google&utm_medium=cpc&utm_campaign=stellest`;

const GRUPOS = [
  {
    nombre: 'Marca Stellest',
    landing: utm('/blog/optica-certificada-stellest-cordoba'),
    keywords: [
      ['stellest', 'EXACT'], ['lentes stellest', 'EXACT'], ['stellest cordoba', 'EXACT'],
      ['stellest córdoba', 'EXACT'], ['stellest essilor', 'EXACT'],
      ['stellest optica', 'PHRASE'], ['stellest donde comprar', 'PHRASE'], ['optica stellest cordoba', 'PHRASE'],
      ['anteojos stellest', 'PHRASE'],
    ],
    titulos: ['Óptica Certificada Stellest', 'Stellest en Córdoba', 'Lentes Stellest de Essilor', 'Traé la Receta y Listo', 'Cerro de las Rosas, Córdoba', 'Sin Turno Previo', '3 y 6 Cuotas Sin Interés', 'Hasta 12 Cuotas Fijas'],
    descripciones: [
      'Essilor fabrica Stellest solo para ópticas certificadas. Atelier lo está. Traé la receta.',
      'Elegimos el armazón con tu hijo, medimos con el armazón puesto y reajustamos sin cargo.',
      'Presupuesto por WhatsApp, el mismo día. Tejeda 4380, Cerro de las Rosas.',
    ],
  },
  {
    nombre: 'Precio Stellest',
    landing: utm('/blog/stellest-precio-argentina-y-formas-de-pago'),
    keywords: [
      ['stellest precio', 'PHRASE'], ['cuanto cuesta stellest', 'PHRASE'], ['precio lentes stellest', 'PHRASE'],
      ['stellest cuotas', 'PHRASE'],
    ],
    titulos: ['Lentes Stellest: Precio Único', 'Stellest en Córdoba', 'Óptica Certificada Stellest', '3 y 6 Cuotas Sin Interés', 'Hasta 12 Cuotas Fijas', 'Presupuesto por WhatsApp'],
    descripciones: [
      'Stellest tiene precio único: no depende de la receta. Te lo pasamos por WhatsApp.',
      'Óptica certificada por Essilor en Córdoba. Antirreflejo Crizal incluido. Traé la receta.',
      '3 y 6 cuotas sin interés, y hasta 12 cuotas fijas. Cerro de las Rosas, sin turno previo.',
    ],
  },
  {
    nombre: 'Control de miopía',
    landing: utm('/blog/stellest'),
    keywords: [
      ['control de miopia niños', 'PHRASE'], ['lentes control miopia', 'PHRASE'], ['frenar miopia niños', 'PHRASE'],
      ['lentes para frenar la miopia', 'PHRASE'], // 'miopia infantil tratamiento' NO: Google lo rechaza por "Health in personalized advertising" (15/10/2026).
      ['lentes miopia infantil cordoba', 'PHRASE'], ['lentes para miopia progresiva', 'PHRASE'],
    ],
    titulos: ['Frená la Miopía de tu Hijo', 'Control de Miopía Infantil', 'Lentes Stellest de Essilor', 'Óptica Certificada Stellest', 'Cerro de las Rosas, Córdoba', 'Traé la Receta y Listo'],
    descripciones: [
      '67% menos progresión de la miopía en promedio (ensayo clínico de 2 años de Essilor).',
      'Corrige como un lente común y además frena el avance. Solo en ópticas certificadas.',
      'Traé la receta del oftalmopediatra y te explicamos todo, sin apuro. Sin turno previo.',
    ],
  },
  // El grupo "Categoría (MiyoSmart)" se sacó el 15/10/2026: la API lo rechazó
  // por política (POLICY_ERROR sobre keyword.text): es marca registrada de Hoya.
];

const NEGATIVAS = [
  'ortoqueratologia', 'orto-k', 'ortok', 'lentes de contacto', 'atropina', 'cirugia', 'cirugía', 'laser', 'láser',
  'oftalmologo', 'oftalmólogo', 'oftalmologia', 'oftalmología', 'turno', 'obra social', 'pdf', 'estudio', 'tesis', 'curso',
];

function armarOperaciones(cid) {
  const T = (n) => `customers/${cid}/${n}`;
  const ops = [];
  const BUDGET = T('campaignBudgets/-1');
  const CAMP = T('campaigns/-2');
  ops.push({ campaignBudgetOperation: { create: {
    resourceName: BUDGET, name: `${NOMBRE} · presupuesto`, amountMicros: micros(PRESUPUESTO_DIARIO_ARS),
    deliveryMethod: 'STANDARD', explicitlyShared: false,
  } } });
  ops.push({ campaignOperation: { create: {
    resourceName: CAMP, name: NOMBRE, status: 'PAUSED', advertisingChannelType: 'SEARCH', campaignBudget: BUDGET,
    targetSpend: { cpcBidCeilingMicros: micros(TOPE_CPC_ARS) },
    networkSettings: { targetGoogleSearch: true, targetSearchNetwork: false, targetContentNetwork: false, targetPartnerSearchNetwork: false },
    containsEuPoliticalAdvertising: 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING',
  } } });
  // Zona: radio alrededor del local. Idioma: español (languageConstants/1003).
  ops.push({ campaignCriterionOperation: { create: { campaign: CAMP, proximity: {
    geoPoint: { latitudeInMicroDegrees: Math.round(LOCAL.lat * 1e6), longitudeInMicroDegrees: Math.round(LOCAL.lng * 1e6) },
    radius: RADIO_KM, radiusUnits: 'KILOMETERS',
  } } } });
  ops.push({ campaignCriterionOperation: { create: { campaign: CAMP, language: { languageConstant: 'languageConstants/1003' } } } });
  for (const n of NEGATIVAS) {
    ops.push({ campaignCriterionOperation: { create: { campaign: CAMP, negative: true, keyword: { text: n, matchType: 'PHRASE' } } } });
  }
  ops.push({ campaignSharedSetOperation: { create: { campaign: CAMP, sharedSet: T(`sharedSets/${LISTA_NEGATIVAS_GENERAL}`) } } });

  let temp = -3;
  for (const g of GRUPOS) {
    const AG = T(`adGroups/${temp--}`);
    ops.push({ adGroupOperation: { create: { resourceName: AG, name: g.nombre, campaign: CAMP, status: 'ENABLED', type: 'SEARCH_STANDARD', cpcBidMicros: micros(TOPE_CPC_ARS) } } });
    for (const [text, matchType] of g.keywords) {
      ops.push({ adGroupCriterionOperation: { create: { adGroup: AG, status: 'ENABLED', keyword: { text, matchType } } } });
    }
    ops.push({ adGroupAdOperation: { create: { adGroup: AG, status: 'ENABLED', ad: {
      finalUrls: [g.landing],
      responsiveSearchAd: {
        headlines: g.titulos.map((text) => ({ text })),
        descriptions: g.descripciones.map((text) => ({ text })),
        path1: 'stellest',
      },
    } } } });
  }
  return ops;
}

function validarLargos() {
  const errores = [];
  for (const g of GRUPOS) {
    g.titulos.forEach((t) => { if (t.length > 30) errores.push(`Título de ${g.nombre} pasa 30: "${t}" (${t.length})`); });
    g.descripciones.forEach((d) => { if (d.length > 90) errores.push(`Descripción de ${g.nombre} pasa 90: "${d}" (${d.length})`); });
    if (g.titulos.length < 3) errores.push(`${g.nombre}: menos de 3 títulos`);
    if (g.descripciones.length < 2) errores.push(`${g.nombre}: menos de 2 descripciones`);
    if (/12 cuotas sin inter/i.test(g.titulos.concat(g.descripciones).join(' '))) errores.push(`${g.nombre}: "12 cuotas sin interés" está prohibido (solo 3 y 6)`);
  }
  return errores;
}

async function main() {
  const validar = process.argv.includes('--validar');
  const aplicar = process.argv.includes('--yes');
  const errores = validarLargos();
  if (errores.length) { errores.forEach((e) => console.error('✗', e)); process.exit(1); }

  const cid = customerId();
  const ops = armarOperaciones(cid);
  console.log(`\n${NOMBRE} — PAUSADA · $${PRESUPUESTO_DIARIO_ARS}/día · tope CPC $${TOPE_CPC_ARS} · ${RADIO_KM} km alrededor del local · solo Búsqueda de Google`);
  for (const g of GRUPOS) {
    console.log(`\n▸ ${g.nombre} → ${g.landing}`);
    console.log(`  keywords: ${g.keywords.map(([t, m]) => (m === 'EXACT' ? `[${t}]` : `"${t}"`)).join(' · ')}`);
    console.log(`  títulos: ${g.titulos.join(' | ')}`);
    g.descripciones.forEach((d) => console.log(`  desc: ${d}`));
  }
  console.log(`\nNegativas propias: ${NEGATIVAS.join(', ')}\nLista compartida vinculada: General (${LISTA_NEGATIVAS_GENERAL})`);
  console.log(`\n${ops.length} operaciones en una sola llamada.`);

  if (!validar && !aplicar) { console.log('\nPLAN solamente. --validar para que la API lo revise, --yes para crear (pausada).'); return; }
  const payload = { mutateOperations: ops, partialFailure: false, validateOnly: validar && !aplicar };
  const res = await mutate('googleAds:mutate', payload, { confirm: true });
  if (validar && !aplicar) { console.log('\n✅ La API validó las operaciones. No se creó nada.'); return; }
  const campana = res?.mutateOperationResponses?.find((r) => r.campaignResult)?.campaignResult?.resourceName;
  console.log(`\n✅ Creada PAUSADA: ${campana || '(ver panel)'}. Revisarla en Google Ads y prenderla a mano.`);
}

main().catch((e) => { console.error('Error:', e.message); if (e.guidance) console.error(e.guidance); process.exit(1); });
