/**
 * Crea la campaña de MARCA en Google Ads: "Search - Marca".
 * ESCRIBE en la cuenta: crea UNA campaña nueva con su presupuesto, grupo,
 * palabras clave, anuncio y sitelinks. No toca ninguna campaña existente.
 *
 * Por qué (auditoría del 25/9/2026, OK de Ishtar): quien buscaba "atelier
 * óptica" caía en la concordancia amplia de Recetados y se pagaba entre $150 y
 * $300 el clic. Una campaña propia en concordancia EXACTA lo abarata (el
 * anuncio de marca tiene nivel de calidad alto) y ocupa el primer lugar antes
 * de que lo haga un competidor. Google prioriza la keyword exacta idéntica a la
 * búsqueda, así que no hace falta tocar Recetados ni Multifocales.
 *
 * Configuración:
 *  - Presupuesto $300/día (tope), puja MANUAL por clic, máximo $80.
 *  - Solo búsqueda de Google (sin socios ni Display), Argentina, español.
 *  - Mismo horario del local que las otras Search (L-V 9-20, sáb 9-17).
 *  - Destino: la landing propia con utm_campaign=marca, así el chat entra con
 *    la etiqueta [googlemarca] y el id del clic (conversiones offline).
 *  - Lista de negativas "General" vinculada (verificado: no bloquea la marca).
 *  - Sitelinks propios (pisan los viejos de la cuenta): WhatsApp con etiqueta
 *    y clic, tienda online, anteojos de sol, cómo llegar.
 *  - Textos sin palabras enteras en mayúsculas (política de Google, 25/9) y con
 *    la redacción de cuotas de src/lib/promo-cuotas.ts.
 *
 * Idempotente: si ya existe una campaña con ese nombre, no crea otra.
 *
 * Uso:
 *   node --env-file=.env scripts/maintenance/google-ads/crear-campana-marca.cjs            → solo valida
 *   GOOGLE_ADS_ALLOW_WRITES=1 node --env-file=.env scripts/maintenance/google-ads/crear-campana-marca.cjs --aplicar
 */
const { search, mutate, customerId } = require('../../ads/lib/google_client');

const APLICAR = process.argv.includes('--aplicar');
const NOMBRE = 'Search - Marca';
const PRESUPUESTO_DIARIO = 300;
const CPC_MAXIMO = 80;
const LISTA_NEGATIVAS = '11042611019'; // "General"
const TEL = '5493518685644'; // BUSINESS_INFO.phoneE164 sin el "+"
const LANDING = 'https://atelieroptica.com.ar/landing';
const SUFIJO_URL = 'utm_source=google&utm_medium=cpc&utm_campaign=marca';

const KEYWORDS = [
  'atelier optica', 'atelier óptica', 'optica atelier', 'óptica atelier',
  'atelier optica cordoba', 'atelier óptica córdoba',
  'atelier optica cerro de las rosas', 'atelier óptica cerro de las rosas',
  'atelier optica cordoba tus proximos anteojos', 'atelier anteojos', 'atelier lentes',
];
const TITULOS = [
  { text: 'Atelier Óptica Córdoba', pinnedField: 'HEADLINE_1' },
  { text: 'Atelier Óptica, sitio oficial' },
  { text: 'Cerro de las Rosas, Córdoba' },
  { text: 'Anteojos recetados y de sol' },
  { text: 'Lentes multifocales' },
  { text: '3 y 6 cuotas sin interés' },
  { text: 'Hasta 12 cuotas fijas' },
  { text: '15% off por transferencia' },
  { text: '20% off efectivo en el local' },
  { text: 'Consultá por WhatsApp' },
  { text: 'Tienda online con envíos' },
  { text: 'Nueva Cápsula Escarlata' },
  { text: 'José Luis de Tejeda 4380' },
  { text: 'Tus próximos anteojos' },
  { text: 'Te asesoramos en el día' },
];
const DESCRIPCIONES = [
  'Óptica en Cerro de las Rosas. Anteojos recetados, multifocales y de sol.',
  '3 y 6 cuotas sin interés, y hasta 12 cuotas fijas. 15% off por transferencia.',
  'Mandanos tu receta por WhatsApp y te cotizamos en el día. Envíos a todo el país.',
  'Lunes a viernes de 9 a 20 y sábados de 9 a 17. José Luis de Tejeda 4380.',
];
const wa = (mensaje) =>
  `https://wa.me/${TEL}?text=` +
  encodeURIComponent(`${mensaje}\n\n— Campaña: marca · origen: google-ads [googlemarca] [gclid:`) +
  '{gclid}' + // ValueTrack: literal, sin codificar, o Google no lo reemplaza
  encodeURIComponent(']');
const SITELINKS = [
  { texto: 'Consultá por WhatsApp', d1: 'Te asesoramos por chat', d2: 'Respuesta en el día', url: wa('Hola, busqué Atelier en Google y quiero que me asesoren.') },
  { texto: 'Tienda online', d1: 'Armazones y anteojos de sol', d2: 'Envíos a todo el país', url: 'https://atelieroptica.com.ar/tienda' },
  { texto: 'Anteojos de sol', d1: 'Nueva Cápsula Escarlata', d2: 'Polarizados y con filtro UV', url: 'https://atelieroptica.com.ar/lentes-de-sol' },
  { texto: 'Cómo llegar', d1: 'José Luis de Tejeda 4380', d2: 'Cerro de las Rosas, Córdoba', url: 'https://maps.app.goo.gl/zsJkwwgx3aRhLpun8' },
];
const HORARIO = [
  ...['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'].map((d) => ({ dayOfWeek: d, startHour: 9, startMinute: 'ZERO', endHour: 20, endMinute: 'ZERO' })),
  { dayOfWeek: 'SATURDAY', startHour: 9, startMinute: 'ZERO', endHour: 17, endMinute: 'ZERO' },
];

function validarTextos() {
  const errores = [];
  const mayus = /\b[A-ZÁÉÍÓÚÑ]{3,}\b/; // palabra entera en mayúsculas → Google la rechaza
  for (const t of TITULOS) { if (t.text.length > 30) errores.push(`título largo (${t.text.length}/30): ${t.text}`); if (mayus.test(t.text)) errores.push(`mayúsculas: ${t.text}`); }
  for (const d of DESCRIPCIONES) { if (d.length > 90) errores.push(`descripción larga (${d.length}/90): ${d}`); if (mayus.test(d)) errores.push(`mayúsculas: ${d}`); }
  for (const s of SITELINKS) { if (s.texto.length > 25 || s.d1.length > 35 || s.d2.length > 35) errores.push(`sitelink largo: ${s.texto}`); }
  for (const k of KEYWORDS) if (k.split(' ').length > 10 || k.length > 80) errores.push(`keyword larga: ${k}`);
  if (TITULOS.some((t) => /12 cuotas sin inter/i.test(t.text)) || DESCRIPCIONES.some((d) => /12 cuotas sin inter/i.test(d))) errores.push('las 12 cuotas nunca son "sin interés"');
  return errores;
}

(async () => {
  const errores = validarTextos();
  if (errores.length) { console.error('Textos inválidos:\n  ' + errores.join('\n  ')); process.exit(1); }

  const existe = await search(`SELECT campaign.id, campaign.name, campaign.status FROM campaign WHERE campaign.name = '${NOMBRE}' AND campaign.status != 'REMOVED'`);
  if (existe.length) { console.log(`Ya existe "${NOMBRE}" (id ${existe[0].campaign.id}, ${existe[0].campaign.status}). No se crea otra.`); return; }

  const cid = customerId();
  const tmp = (n) => `customers/${cid}/${n}`;
  const PRESUPUESTO = tmp('campaignBudgets/-1');
  const CAMPANA = tmp('campaigns/-2');
  const GRUPO = tmp('adGroups/-3');
  const ops = [];

  ops.push({ campaignBudgetOperation: { create: { resourceName: PRESUPUESTO, name: `${NOMBRE} (presupuesto)`, amountMicros: String(PRESUPUESTO_DIARIO * 1e6), deliveryMethod: 'STANDARD', explicitlyShared: false } } });
  ops.push({ campaignOperation: { create: {
    resourceName: CAMPANA, name: NOMBRE, status: 'ENABLED', advertisingChannelType: 'SEARCH', campaignBudget: PRESUPUESTO,
    manualCpc: {},
    networkSettings: { targetGoogleSearch: true, targetSearchNetwork: false, targetContentNetwork: false, targetPartnerSearchNetwork: false },
    geoTargetTypeSetting: { positiveGeoTargetType: 'PRESENCE_OR_INTEREST' },
    finalUrlSuffix: SUFIJO_URL,
    containsEuPoliticalAdvertising: 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING',
  } } });
  ops.push({ campaignCriterionOperation: { create: { campaign: CAMPANA, language: { languageConstant: 'languageConstants/1003' } } } });
  ops.push({ campaignCriterionOperation: { create: { campaign: CAMPANA, location: { geoTargetConstant: 'geoTargetConstants/2032' } } } });
  for (const h of HORARIO) ops.push({ campaignCriterionOperation: { create: { campaign: CAMPANA, adSchedule: h } } });
  ops.push({ campaignSharedSetOperation: { create: { campaign: CAMPANA, sharedSet: tmp(`sharedSets/${LISTA_NEGATIVAS}`) } } });

  ops.push({ adGroupOperation: { create: { resourceName: GRUPO, campaign: CAMPANA, name: 'Marca', status: 'ENABLED', type: 'SEARCH_STANDARD', cpcBidMicros: String(CPC_MAXIMO * 1e6) } } });
  for (const k of KEYWORDS) ops.push({ adGroupCriterionOperation: { create: { adGroup: GRUPO, status: 'ENABLED', keyword: { text: k, matchType: 'EXACT' } } } });
  ops.push({ adGroupAdOperation: { create: { adGroup: GRUPO, status: 'ENABLED', ad: {
    finalUrls: [LANDING],
    responsiveSearchAd: { headlines: TITULOS, descriptions: DESCRIPCIONES.map((text) => ({ text })), path1: 'atelier', path2: 'cordoba' },
  } } } });

  SITELINKS.forEach((s, i) => {
    const rn = tmp(`assets/-${10 + i}`);
    ops.push({ assetOperation: { create: { resourceName: rn, finalUrls: [s.url], sitelinkAsset: { linkText: s.texto, description1: s.d1, description2: s.d2 } } } });
    ops.push({ campaignAssetOperation: { create: { campaign: CAMPANA, asset: rn, fieldType: 'SITELINK' } } });
  });

  console.log(`"${NOMBRE}": $${PRESUPUESTO_DIARIO}/día, puja manual máx $${CPC_MAXIMO}, Argentina, español, L-V 9-20 y sáb 9-17.`);
  console.log(`Palabras clave EXACTAS (${KEYWORDS.length}): ${KEYWORDS.join(' · ')}`);
  console.log(`Anuncio → ${LANDING}?${SUFIJO_URL} · ${TITULOS.length} títulos · ${DESCRIPCIONES.length} descripciones`);
  console.log(`Sitelinks: ${SITELINKS.map((s) => s.texto).join(' · ')}`);
  console.log(`\n${APLICAR ? 'CREANDO' : 'Solo validando (validateOnly)'}: ${ops.length} operaciones en una sola transacción…`);
  const res = await mutate('googleAds:mutate', { mutateOperations: ops, partialFailure: false, validateOnly: !APLICAR }, { confirm: true });
  if (!APLICAR) { console.log('✅ Google aceptó la operación. No se creó nada.'); return; }

  const idCampana = (res.mutateOperationResponses || []).map((r) => r.campaignResult?.resourceName).find(Boolean);
  console.log(`✅ Creada: ${idCampana}`);
  const v = await search(`SELECT campaign.name, campaign.status, campaign.primary_status, campaign_budget.amount_micros, campaign.bidding_strategy_type FROM campaign WHERE campaign.name = '${NOMBRE}'`);
  for (const r of v) console.log(`VERIFICACIÓN: ${r.campaign.name} · ${r.campaign.status} · ${r.campaign.primaryStatus} · $${Number(r.campaignBudget.amountMicros) / 1e6}/día · ${r.campaign.biddingStrategyType}`);
  console.log('El anuncio y los sitelinks pasan por la revisión de Google (unas horas).');
})().catch((e) => { console.error('ERROR', e.message, e.guidance || ''); process.exit(1); });
