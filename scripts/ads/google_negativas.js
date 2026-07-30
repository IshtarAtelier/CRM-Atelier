#!/usr/bin/env node
/**
 * Agrega palabras negativas a la lista compartida de la cuenta de Google Ads.
 *
 * Por qué: la lista "General" (id 11042611019) ya está aplicada a las dos
 * campañas de Máximo Rendimiento, pero 548 de sus 586 términos están en
 * concordancia EXACTA — bloquean solo esa frase escrita idéntica. Por eso
 * "clinica romagosa oftalmologia" estaba bloqueado y "clinica romagosa" a secas
 * seguía mostrando el aviso.
 *
 * Agregar negativas NO reinicia el aprendizaje de la campaña: eso solo pasa al
 * cambiar la estrategia de puja, los objetivos de conversión o el presupuesto
 * de golpe. Una negativa solo acota dónde se muestra.
 *
 * Uso:
 *   node scripts/ads/google_negativas.js                          → dry run
 *   GOOGLE_ADS_ALLOW_WRITES=1 node scripts/ads/google_negativas.js --yes
 */

const { search, mutate, customerId } = require('./lib/google_client');

const SHARED_SET_ID = process.env.GOOGLE_ADS_NEGATIVE_SET_ID || '11042611019';

// BROAD: nombres distintivos, no tapan ninguna búsqueda legítima de óptica.
// PHRASE: palabras comunes (torre, soler, galileo, elvira) donde una amplia sí
// taparía búsquedas buenas.
// Tercera tanda. Dos correcciones y una decisión de negocio del usuario:
//  · Las negativas NO cubren variantes: "optica arguello" no bloquea "óptica
//    arguello norte". Van las dos formas, con y sin tilde.
//  · gratis y pami estaban en 66 términos EXACTOS y por eso se filtraba
//    "anteojos gratis apross". Pasan a amplia.
//  · APROSS, Nobis y "obra social" NO se bloquean: la óptica cubre obras
//    sociales. Lo que no sirve es PAMI y quien busca gratis.
const TERCERA_TANDA = [
  ['gratis', 'BROAD'],
  ['pami', 'BROAD'],
  // tildes que se escaparon de la segunda tanda
  ['óptica arguello', 'PHRASE'],
  ['óptica visión', 'PHRASE'],
  ['óptica mys', 'PHRASE'],
  ['óptica santa lucía', 'PHRASE'],
  ['óptica alta vista', 'PHRASE'],
  ['alta vista córdoba', 'PHRASE'],
  // competencia que apareció al mirar 90 días
  ['optione', 'BROAD'],
  ['opticazul', 'BROAD'],
  ['europtica', 'BROAD'],
  ['lutz ferrando', 'PHRASE'],
  ['optica reartes', 'PHRASE'],
  ['óptica reartes', 'PHRASE'],
  ['optica mendez', 'PHRASE'],
  ['óptica méndez', 'PHRASE'],
  ['optica suiza', 'PHRASE'],
  ['óptica suiza', 'PHRASE'],
  ['optica cervantes', 'PHRASE'],
  ['óptica cervantes', 'PHRASE'],
  ['campo visual optica', 'PHRASE'],
  ['campo visual óptica', 'PHRASE'],
  ['por tus ojos', 'PHRASE'],
  ['mas vision cordoba', 'PHRASE'],
  ['más visión córdoba', 'PHRASE'],
  ['mostaza sánchez', 'PHRASE'],
  // zonas fuera del mercado del local
  ['rio ceballos', 'PHRASE'],
  ['río ceballos', 'PHRASE'],
  ['san vicente', 'PHRASE'],
];

// Segunda tanda (90 días de datos): el resto de las ópticas y clínicas de
// Córdoba que aparecían en los temas de búsqueda de la PMax.
const SEGUNDA_TANDA = [
  // nombres propios distintivos → amplia
  ['onnis', 'BROAD'],
  ['lazzarini', 'BROAD'],
  ['amuchastegui', 'BROAD'],
  ['rapilent', 'BROAD'],
  ['popoff', 'BROAD'],
  ['molinari', 'BROAD'],
  ['ferrario', 'BROAD'],
  ['almiron', 'BROAD'],
  ['crillon', 'BROAD'],
  ['bulacio', 'BROAD'],
  ['biolab', 'BROAD'],
  // combinaciones (la palabra suelta es común) → frase
  ['rizzi lauret', 'PHRASE'],
  ['mega lent', 'PHRASE'],
  ['mostaza sanchez', 'PHRASE'],
  ['testi quiros', 'PHRASE'],
  ['optica arguello', 'PHRASE'],
  ['optica vision', 'PHRASE'],
  ['optica lens', 'PHRASE'],
  ['optica palacios', 'PHRASE'],
  ['optica italia', 'PHRASE'],
  ['optica valencia', 'PHRASE'],
  ['optica mys', 'PHRASE'],
  ['optica la esmeralda', 'PHRASE'],
  ['optica campos', 'PHRASE'],
  ['optica santa lucia', 'PHRASE'],
  ['optica rudi', 'PHRASE'],
  ['optica lara', 'PHRASE'],
  ['optica uepc', 'PHRASE'],
  ['ioc cordoba', 'PHRASE'],
  ['sof cordoba', 'PHRASE'],
  ['clinica de ojos', 'PHRASE'],
  ['oftalmo alta gracia', 'PHRASE'],
  ['mas vision dinosaurio', 'PHRASE'],
];

const TERMINOS = [
  ...TERCERA_TANDA,
  ...SEGUNDA_TANDA,
  ['visualizar', 'BROAD'],
  ['praga', 'BROAD'],
  ['unilent', 'BROAD'],
  ['minilent', 'BROAD'],
  ['clarylent', 'BROAD'],
  ['tustanoski', 'BROAD'],
  ['passeri', 'BROAD'],
  ['paesani', 'BROAD'],
  ['falavigna', 'BROAD'],
  ['lauricella', 'BROAD'],
  ['giobellina', 'BROAD'],
  ['romagosa', 'BROAD'],
  ['faro', 'BROAD'],
  ['faros', 'BROAD'],
  ['optica la torre', 'PHRASE'],
  ['optica soler', 'PHRASE'],
  ['optica galileo', 'PHRASE'],
  ['optica elvira', 'PHRASE'],
  ['eduardo elvira', 'PHRASE'],
  ['alta vista optica', 'PHRASE'],
  ['maldonado bas', 'PHRASE'],
];

const norm = (s) => String(s || '').trim().toLowerCase();

async function main() {
  const aplicar = process.argv.includes('--yes');
  const cid = customerId();

  // Qué hay hoy, para no duplicar
  const actuales = await search(
    `SELECT shared_criterion.keyword.text, shared_criterion.keyword.match_type
     FROM shared_criterion WHERE shared_set.id = ${SHARED_SET_ID} LIMIT 5000`,
  );
  const yaEstan = new Set(
    actuales.map((r) => `${norm(r.sharedCriterion?.keyword?.text)}|${r.sharedCriterion?.keyword?.matchType}`),
  );

  const nuevos = TERMINOS.filter(([t, m]) => !yaEstan.has(`${norm(t)}|${m}`));
  const repetidos = TERMINOS.length - nuevos.length;

  console.log(`Lista "General" (${SHARED_SET_ID}) · ${actuales.length} términos hoy`);
  console.log(`A agregar: ${nuevos.length}${repetidos ? ` (${repetidos} ya estaban)` : ''}\n`);
  nuevos.forEach(([t, m]) => console.log(`  [${m.padEnd(6)}] ${t}`));

  if (!nuevos.length) {
    console.log('\nNada para hacer.');
    return;
  }

  if (!aplicar) {
    console.log('\n(dry run — no se tocó nada. Para aplicar: GOOGLE_ADS_ALLOW_WRITES=1 node scripts/ads/google_negativas.js --yes)');
    return;
  }

  const operations = nuevos.map(([text, matchType]) => ({
    create: {
      sharedSet: `customers/${cid}/sharedSets/${SHARED_SET_ID}`,
      keyword: { text, matchType },
    },
  }));

  const res = await mutate('sharedCriteria:mutate', { operations }, { confirm: true });
  const hechos = res?.results?.length ?? 0;
  console.log(`\n✅ Agregados ${hechos} términos a la lista.`);
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
