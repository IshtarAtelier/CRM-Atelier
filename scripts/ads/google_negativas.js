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
// Cuarta tanda (agosto 2026). Salió de cruzar los 500 términos de 90 días
// contra las 669 negativas ya cargadas, aplicando la semántica real de Google
// (EXACT bloquea la frase idéntica, PHRASE la secuencia, BROAD exige todas las
// palabras). Quedaban 306 términos sin bloquear y $88.353 de gasto ahí.
//
// Lo que NO se bloquea, y por qué (cada uno se miró contra el negocio):
//  · Otras localidades (Villa Allende, Carlos Paz, Alta Gracia, Unquillo):
//    convierten Y hay envío gratis a todo el país. No son fuga.
//  · OSDE, Apross, Swiss, Galeno, Accord: la óptica las atiende (ver
//    /obras-sociales). Son leads buenos.
//  · "opticas nueva cordoba", "optica centro": Nueva Córdoba y Centro son
//    barrios, no competidores.
//  · "clínica de ojos córdoba" a secas: ambiguo, alguien puede terminar
//    comprando anteojos. Se bloquean sólo las clínicas con nombre propio y la
//    intención quirúrgica, que sí es turno médico.
//
// CUIDADO con "iris": Atelier vende los modelos Iris C1 e Iris C3. Una amplia
// con esa palabra taparía búsquedas de su propio producto, así que va como
// frase con "optica" adelante. Mismo criterio para modelo, lens, mayo, torres,
// italia y campo visual, que son palabras corrientes.
const CUARTA_TANDA = [
  // Ópticas de la competencia que aparecieron al cruzar 90 días. Todas como
  // frase con "optica/óptica" adelante: las palabras sueltas son comunes.
  ['optica modelo', 'PHRASE'],
  ['óptica modelo', 'PHRASE'],
  ['lens optica', 'PHRASE'],
  ['lens óptica', 'PHRASE'],
  ['optica italia', 'PHRASE'],
  ['óptica italia', 'PHRASE'],
  ['optica iris', 'PHRASE'],
  ['óptica iris', 'PHRASE'],
  ['optica guemes', 'PHRASE'],
  ['óptica güemes', 'PHRASE'],
  ['más visión', 'PHRASE'],
  ['mas vision optica', 'PHRASE'],
  ['optica mayo', 'PHRASE'],
  ['óptica mayo', 'PHRASE'],
  ['optica torres', 'PHRASE'],
  ['óptica torres', 'PHRASE'],
  ['campo visual', 'PHRASE'],
  ['los granaderos', 'PHRASE'],
  ['hiper libertad', 'PHRASE'],
  ['la casa de las opticas', 'PHRASE'],
  ['la casa de las ópticas', 'PHRASE'],
  ['infinit', 'BROAD'],
  ['modernclix', 'BROAD'],
  // Clínicas con nombre propio y cirugía: es turno médico, no un armazón.
  ['centro privado de ojos', 'PHRASE'],
  ['clinica lazarte', 'PHRASE'],
  ['clínica lazarte', 'PHRASE'],
  ['cirugia', 'BROAD'],
  ['cirugía', 'BROAD'],
  ['oftalmologia', 'BROAD'],
  ['oftalmología', 'BROAD'],
  // Obras sociales que la óptica NO atiende (las que sí, arriba).
  ['sancor salud', 'PHRASE'],
  ['prevencion salud', 'PHRASE'],
  ['prevención salud', 'PHRASE'],
];

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

// Quinta tanda (4/9/2026). Motivo: la dueña reporta "muchas llamadas de gente
// que piensa que somos un lugar de oftalmología" y otras que buscan ópticas
// para autos. El diagnóstico contra la API confirmó un círculo vicioso: la
// conversión que más pesa en la cuenta es "Clicks to call" (701 en 90 días),
// así que cada llamada equivocada de alguien que buscaba una clínica cuenta
// como ÉXITO y Google manda todavía más gente de oftalmología. En 90 días:
// 306 términos médicos, 1.062 impresiones y $10.452 de gasto, con 14
// "conversiones" que son exactamente esas llamadas equivocadas.
//
// Criterio de esta tanda:
//  · "clinica"/"clínica" en AMPLIA. Ninguna búsqueda legítima de óptica lleva
//    esa palabra, y en EXACTA no servía: se bloqueaba "clinica romagosa
//    oftalmologia" y entraba "clinica romagosa" a secas.
//  · Clínicas con nombre propio que aparecieron en los términos reales
//    (Reyes Giobellina, Santa Lucía, Maldonado Bas, Mostaza Sánchez, Onnis,
//    SOF, Alvear). Onnis y Mostaza Sánchez son apellidos: no tapan producto.
//  · La acepción de AUTO: "óptica" también es el faro. Amplia en auto,
//    vehículo, moto, repuestos y las marcas de autos.
//  · "de ojos" / "del ojo" en FRASE: cubre "clínica de ojos", "centro de
//    ojos", "médico del ojo" sin tocar "anteojos" (es una sola palabra).
//
// Lo que NO se bloquea, revisado uno por uno contra el negocio:
//  · "campo visual" suelto, "iris", "modelo", "lens": son producto de Atelier.
//  · Obras sociales que la óptica SÍ atiende (OSDE, Apross, Swiss, Galeno).
//  · Localidades: hay envío a todo el país.
//  · "luz azul": es el filtro de los cristales, NO un faro.
const QUINTA_TANDA = [
  // Intención médica pura
  ['clinica', 'BROAD'], ['clínica', 'BROAD'],
  ['oculista', 'BROAD'],
  ['oftalmologo', 'BROAD'], ['oftalmólogo', 'BROAD'],
  ['oftalmologa', 'BROAD'], ['oftalmóloga', 'BROAD'],
  ['sanatorio', 'BROAD'], ['hospital', 'BROAD'],
  ['turno', 'BROAD'], ['turnos', 'BROAD'],
  ['consultorio', 'BROAD'],
  ['cataratas', 'BROAD'], ['glaucoma', 'BROAD'], ['retina', 'BROAD'],
  ['conjuntivitis', 'BROAD'], ['orzuelo', 'BROAD'], ['pterigion', 'BROAD'], ['estrabismo', 'BROAD'],
  ['lasik', 'BROAD'],
  ['laser ojos', 'PHRASE'], ['láser ojos', 'PHRASE'],
  ['fondo de ojo', 'PHRASE'],
  ['operacion de ojos', 'PHRASE'], ['operación de ojos', 'PHRASE'],
  ['operacion de la vista', 'PHRASE'], ['operación de la vista', 'PHRASE'],
  ['centro oftalmologico', 'PHRASE'], ['centro oftalmológico', 'PHRASE'],
  ['medico de ojos', 'PHRASE'], ['médico de ojos', 'PHRASE'],
  ['doctor de ojos', 'PHRASE'],
  ['especialista en ojos', 'PHRASE'],
  ['control de la vista', 'PHRASE'],
  ['examen de la vista', 'PHRASE'],
  ['estudio de la vista', 'PHRASE'],
  ['de ojos', 'PHRASE'], ['del ojo', 'PHRASE'],
  ['ojos cordoba', 'PHRASE'], ['ojos córdoba', 'PHRASE'],
  // Clínicas con nombre propio vistas en los términos reales
  ['reyes giobellina', 'BROAD'],
  ['santa lucia', 'PHRASE'], ['santa lucía', 'PHRASE'],
  ['maldonado bas', 'BROAD'],
  ['mostaza sanchez', 'BROAD'], ['mostaza sánchez', 'BROAD'],
  ['onnis', 'BROAD'],
  ['sof oftalmologia', 'PHRASE'], ['sof oftalmología', 'PHRASE'],
  ['alvear cordoba', 'PHRASE'],
  // La acepción AUTO de "óptica" (el faro)
  ['optica de auto', 'PHRASE'], ['óptica de auto', 'PHRASE'],
  ['optica para auto', 'PHRASE'], ['óptica para auto', 'PHRASE'],
  ['opticas para autos', 'PHRASE'], ['ópticas para autos', 'PHRASE'],
  ['optica de vehiculo', 'PHRASE'], ['óptica de vehículo', 'PHRASE'],
  ['optica delantera', 'PHRASE'], ['óptica delantera', 'PHRASE'],
  ['optica trasera', 'PHRASE'], ['óptica trasera', 'PHRASE'],
  ['auto', 'BROAD'], ['autos', 'BROAD'],
  ['vehiculo', 'BROAD'], ['vehículo', 'BROAD'],
  ['camioneta', 'BROAD'], ['moto', 'BROAD'],
  ['repuestos', 'BROAD'], ['autopartes', 'BROAD'],
  ['chevrolet', 'BROAD'], ['renault', 'BROAD'], ['peugeot', 'BROAD'],
  ['toyota', 'BROAD'], ['volkswagen', 'BROAD'], ['fiat', 'BROAD'], ['ford', 'BROAD'],
  // Fibra óptica e instrumentos (los otros sentidos de la palabra)
  ['fibra optica', 'PHRASE'], ['fibra óptica', 'PHRASE'],
  ['microscopio', 'BROAD'], ['telescopio', 'BROAD'],
  ['binoculares', 'BROAD'], ['mira telescopica', 'PHRASE'],
  // Empleo
  ['empleo', 'BROAD'], ['curriculum', 'BROAD'], ['currículum', 'BROAD'],
  ['vacante', 'BROAD'], ['busco trabajo', 'PHRASE'], ['bolsa de trabajo', 'PHRASE'],
];

// Sexta tanda (4/9/2026). Marcas de anteojos que Atelier NO vende y que igual
// se llevaban $3.035 en 90 días (509 impresiones, 9 clics). Quien busca una
// marca busca ESA marca: no compra otra cosa.
//
// Verificado contra el catálogo de producción antes de bloquear:
//  · NO se bloquean Rusty, Mormaii, Karun, Mistral, Tiffany ni Ossira —
//    están en el stock aunque hoy no estén publicadas en la web.
//  · NO se bloquean las FORMAS (aviador, wayfarer, clubmaster, hexagonal):
//    son formas de armazón que Atelier sí vende con nombre propio, y la
//    tienda filtra por forma. "ray ban aviador" ya cae por "ray ban".
//  · Las de dos palabras van en FRASE; las de una, amplia, salvo "carrera"
//    y "police", que son palabras corrientes en castellano y van en frase
//    pegadas a lo que se busca.
const SEXTA_TANDA = [
  ['ray ban', 'BROAD'], ['rayban', 'BROAD'], ['ray-ban', 'BROAD'],
  ['oakley', 'BROAD'],
  ['vulk', 'BROAD'],
  ['lacoste', 'BROAD'],
  ['versace', 'BROAD'],
  ['prada', 'BROAD'],
  ['gucci', 'BROAD'],
  ['armani', 'BROAD'], ['emporio armani', 'PHRASE'],
  ['miu miu', 'PHRASE'],
  ['polaroid', 'BROAD'],
  ['cartier', 'BROAD'],
  ['persol', 'BROAD'],
  ['fendi', 'BROAD'],
  ['tommy hilfiger', 'PHRASE'],
  ['chanel', 'BROAD'],
  ['guess', 'BROAD'],
  ['dolce gabbana', 'PHRASE'], ['dolce & gabbana', 'PHRASE'],
  ['michael kors', 'PHRASE'],
  ['burberry', 'BROAD'],
  ['calvin klein', 'PHRASE'],
  ['swarovski', 'BROAD'],
  ['dior', 'BROAD'],
  ['maui jim', 'PHRASE'],
  ['arnette', 'BROAD'],
  ['hugo boss', 'PHRASE'],
  ['anteojos carrera', 'PHRASE'], ['lentes carrera', 'PHRASE'], ['carrera anteojos', 'PHRASE'],
  ['anteojos police', 'PHRASE'], ['lentes police', 'PHRASE'],
];

const TERMINOS = [
  ...SEXTA_TANDA,
  ...QUINTA_TANDA,
  ...CUARTA_TANDA,
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
