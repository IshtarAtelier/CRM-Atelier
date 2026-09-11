/**
 * Guardián del tipo de lente. SOLO LEE archivos — sin base y sin red.
 *
 *   node --experimental-strip-types --import ./scripts/checks/_alias.mjs scripts/checks/tipo-de-lente.check.mjs
 *
 * Qué cuida, y por qué (bug del 8/9/2026: el bot le mandó un presupuesto de
 * multifocales a un cliente con receta monofocal):
 *
 *   1. LA REGLA. Hay adición → multifocal. No hay → monofocal. Sin excepciones.
 *   2. QUE NADIE VUELVA A ETIQUETAR "Multifocal" SOLO POR EL ORIGEN. Durante
 *      meses, todo lead entrado por un anuncio de Meta salía etiquetado
 *      'Multifocal' porque esa era la campaña. El bot lee las etiquetas de la
 *      ficha en su contexto, así que arrancaba la charla convencido.
 *   3. QUE NADIE VUELVA A DEFAULTEAR A MULTIFOCAL. `|| 'ADDITION'` significa
 *      "ante la duda, el lente más caro": es el más caro de los dos errores.
 *   4. QUE EL ESPEJO DEL BOT NO SE DESINCRONICE del helper del CRM (el
 *      wa-service es CommonJS y no puede importar el .ts).
 *
 * OJO: el prompt del bot NO vive en el repo, vive en `SystemSetting.bot_prompt`.
 * Este check no puede vigilarlo. Si vuelve a aparecer un "igual se le cotiza"
 * sin receta, se corrige desde /admin/whatsapp.
 */
import { readFileSync } from 'node:fs';
import { tipoDeRecetaSegunNumeros, tipoDeRecetaConDefault } from '../../src/lib/receta/tipo-de-lente.ts';
import { cubreLaReceta, parsearRango } from '../../src/lib/receta/rango-de-cristal.ts';
import { classifyLead } from '../../src/lib/leads-pipeline.ts';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const espejo = require('../../wa-service/shared/tipo-de-lente.js');

const fallas = [];
const ok = (m) => console.log(`  ✅ ${m}`);
const mal = (m) => { fallas.push(m); console.log(`  ❌ ${m}`); };

// ── 1. La regla ──────────────────────────────────────────────────────────────
console.log('\n1. La regla: la adición manda, no la etiqueta');
const casos = [
    ['sin adición, la IA dijo Multifocal', tipoDeRecetaSegunNumeros({ add: 0 }, 'Multifocal'), 'FAR'],
    ['con adición, la IA dijo Monofocal', tipoDeRecetaSegunNumeros({ add: 2 }, 'Monofocal'), 'ADDITION'],
    ['adición por ojo', tipoDeRecetaSegunNumeros({ additionOD: 1.75 }), 'ADDITION'],
    ['adición negativa (mal leída de una foto)', tipoDeRecetaSegunNumeros({ add: -2 }), 'ADDITION'],
    ['receta vacía', tipoDeRecetaSegunNumeros({}), 'FAR'],
    // Caso real (9/9/2026, receta de Sambran Maximiliano): miopía -7,50/-8,00,
    // columna A.V. con "20/25" y NINGUNA adición. El bot la leyó como
    // multifocal y cotizó $735.000. Un parseFloat("20/25") da 20.
    ['A.V. 20/25 leída como adición', tipoDeRecetaSegunNumeros({ add: 20 }, 'Multifocal'), 'FAR'],
    ['A.V. en decimales (1.0)', tipoDeRecetaSegunNumeros({ add: 1.0 }) === 'ADDITION' ? 'ADDITION' : 'FAR', 'ADDITION'],
    ['adición fuera de rango (15)', tipoDeRecetaSegunNumeros({ add: 15 }), 'FAR'],
    // Las DOS formas válidas de escribir una receta multifocal (regla de
    // Ishtar, 9/9/2026): "Lejos" + columna Add, o "Lejos" y "Cerca" con su
    // graduación cada una. La segunda no tiene columna Add: la adición es la
    // diferencia, y sin esto esa receta se leía como monofocal.
    ['add baja +0.75 (presbicia inicial)', tipoDeRecetaSegunNumeros({ add: 0.75 }), 'ADDITION'],
    ['Lejos -2.00 y Cerca +0.50, sin columna Add', tipoDeRecetaSegunNumeros({ sphereOD: -2, nearSphereOD: 0.5 }), 'ADDITION'],
    ['Lejos -6 y Cerca -4.75, sin columna Add', tipoDeRecetaSegunNumeros({ sphereOD: -6, nearSphereOD: -4.75 }), 'ADDITION'],
    ['Cerca igual a Lejos: no hay adición', tipoDeRecetaSegunNumeros({ sphereOD: -2, nearSphereOD: -2 }), 'FAR'],
    ['diferencia absurda entre lejos y cerca', tipoDeRecetaSegunNumeros({ sphereOD: -2, nearSphereOD: 8 }), 'FAR'],
    ['receta de cerca se respeta', tipoDeRecetaSegunNumeros({}, 'NEAR'), 'NEAR'],
    ['sin dato explícito NO asume multifocal', tipoDeRecetaConDefault({}, undefined), 'FAR'],
    ['elección explícita de un óptico se respeta', tipoDeRecetaConDefault({}, 'ADDITION'), 'ADDITION'],
];
for (const [nombre, real, esperado] of casos) {
    real === esperado ? ok(`${nombre} → ${real}`) : mal(`${nombre} → ${real}, esperado ${esperado}`);
}

// ── 2. Nadie etiqueta por el origen ──────────────────────────────────────────
console.log('\n2. Nadie vuelve a etiquetar "Multifocal" por el canal de entrada');
for (const archivo of ['wa-service/tools.js', 'wa-service/index.js']) {
    const src = readFileSync(new URL(`../../${archivo}`, import.meta.url), 'utf8');
    // Solo llamadas reales, no los comentarios que explican por qué se sacó.
    const llamadas = src.split('\n').filter(l =>
        /addTagToClient\(\s*\{[^}]*tagName:\s*['"](Multifocal|Monofocal|Bifocal)['"]/.test(l));
    llamadas.length === 0
        ? ok(`${archivo}: sin auto-etiquetado de tipo de lente`)
        : mal(`${archivo}: vuelve a etiquetar el tipo de lente automáticamente → ${llamadas[0].trim().slice(0, 90)}`);
}

// ── 3. Nadie defaultea a multifocal ──────────────────────────────────────────
console.log('\n3. Nadie vuelve a asumir multifocal ante la duda');
for (const archivo of ['src/services/contact.service.ts', 'src/components/contacts/PrescriptionManager.tsx', 'src/app/api/bot/prescriptions/route.ts']) {
    const src = readFileSync(new URL(`../../${archivo}`, import.meta.url), 'utf8');
    const malas = src.split('\n').filter(l =>
        /prescriptionType[^\n]*(\|\|\s*['"]ADDITION['"])/.test(l) && !l.trim().startsWith('//') && !l.trim().startsWith('*'));
    malas.length === 0
        ? ok(`${archivo}: sin default a 'ADDITION'`)
        : mal(`${archivo}: volvió el default a multifocal → ${malas[0].trim().slice(0, 90)}`);
}

// ── 4. El espejo del bot no se desincroniza ──────────────────────────────────
console.log('\n4. El espejo del wa-service dice lo mismo que el helper del CRM');
const paridad = [
    [{ add: 0 }, 'Multifocal', 'Monofocal'],
    [{ add: 2 }, 'Monofocal', 'Multifocal'],
    [{ add: null }, null, 'Monofocal'],
];
for (const [datos, declarado, esperadoEspejo] of paridad) {
    const delEspejo = espejo.interesSegunReceta(declarado, datos.add);
    const delCrm = tipoDeRecetaSegunNumeros(datos, declarado) === 'ADDITION' ? 'Multifocal' : 'Monofocal';
    delEspejo === esperadoEspejo && delEspejo === delCrm
        ? ok(`add=${datos.add} declarado=${declarado} → ${delEspejo} en los dos`)
        : mal(`add=${datos.add} declarado=${declarado}: espejo dice ${delEspejo}, CRM dice ${delCrm}`);
}

// ── 4-bis. Nombres de ficha ──────────────────────────────────────────────────
// Un nombre de perfil de WhatsApp que son puros emojis no es un nombre: no se
// puede llamar, buscar ni saludar a esa ficha, y entra igual al embudo.
console.log('\n4-bis. Una ficha nueva necesita un nombre de verdad');
const { esNombreValido } = require('../../wa-service/shared/nombre-de-persona.js');
for (const [nombre, esperado] of [
    ['Julio Pérez', true], ['Ana', true], ['José María', true],
    ['😊', false], ['🫵🏻💪', false], ['⭐⭐⭐🌅☝', false], ['...', false],
    ['3541215971', false], ['hola quiero info', false],
]) {
    esNombreValido(nombre) === esperado
        ? ok(`"${nombre}" → ${esperado ? 'válido' : 'rechazado'}`)
        : mal(`"${nombre}" → ${esNombreValido(nombre) ? 'válido' : 'rechazado'}, esperado ${esperado ? 'válido' : 'rechazado'}`);
}

// ── 5. El rango del cristal cruza con la receta ──────────────────────────────
// Cotizar un cristal fuera de rango es prometer algo que el laboratorio no
// puede fabricar. El rango va declarado en el nombre ("… · Esf -10/+8 Cil -6/6").
console.log('\n5. Ningún cristal se ofrece fuera del rango que cubre');
const maxi = { odEsf: -7.5, odCil: -1.25, oiEsf: -8, oiCil: -1.75 }; // receta real del 9/9/2026
const casosRango = [
    ['stock Esf -4/+4 NO sirve para -8', cubreLaReceta('Stock · Mineral 1.523 · Esf -4/+4 Cil -2/2', maxi), false],
    ['stock Esf -6/+6 NO sirve para -8', cubreLaReceta('Stock · Policarbonato · Esf -6/+6 Cil -2/2', maxi), false],
    ['tallado Esf -10/+8 sí sirve', cubreLaReceta('Monofocal TALLADO (CNC) · Esf -10/+8 Cil -6/6', maxi), true],
    ['Esf +8/+22 no sirve para un -8 (el signo importa)', cubreLaReceta('… Esf +8/+22 Cil -2/2', maxi), false],
    ['Esf +8/+22 sí sirve para un +9', cubreLaReceta('… Esf +8/+22 Cil -2/2', { odEsf: 9, oiEsf: 9 }), true],
    ['cilindro -4 no entra en Cil -2/2', cubreLaReceta('… Esf -6/+6 Cil -2/2', { odEsf: -2, odCil: -4 }), false],
    ['sin rango declarado no se descarta', cubreLaReceta('KODAK SV DIGITAL - ORMA + CRIZAL', maxi), true],
    ['sin datos de receta no se descarta', cubreLaReceta('… Esf -4/+4 Cil -2/2', {}), true],
    ['lee el rango del nombre', parsearRango('… Esf -10/+8 Cil -6/6')?.esfMin, -10],
];
for (const [nombre, real, esperado] of casosRango) {
    real === esperado ? ok(`${nombre}`) : mal(`${nombre} → ${real}, esperado ${esperado}`);
}

// ── 6. La tarjeta no dice "Sin contactar" si alguien le escribió ─────────────
// Medido el 9/9/2026: 194 de 339 leads con presupuesto figuraban "Sin
// contactar" y una PERSONA les había escrito. La única prueba de contacto era
// la etiqueta que deja una PLANTILLA, pero dentro de la ventana de 24 h el
// equipo contesta con texto libre. El tablero le mentía al equipo sobre su
// propio trabajo. Son DOS preguntas distintas y hay que mantenerlas separadas:
// `contactado` (¿le hablaron?) y `escalonCubierto` (¿el toque de hoy está hecho?).
console.log('\n6. "Sin contactar" solo cuando de verdad nadie le habló');
const D = 86400000, ahora = Date.now(), haceDias = (d) => new Date(ahora - d * D);
const baseLead = { hasPrescription: false, chatLabels: [], tagNames: [], now: ahora };
const casosEmbudo = [
    ['le escribieron hace 2 días: NO es "sin contactar"',
     classifyLead({ ...baseLead, quoteCreatedAt: haceDias(6), ultimoMensajeHumano: haceDias(2) }),
     { contactado: true, escalonCubierto: false }],
    ['…y el toque de hoy sigue marcado como pendiente', null, null],
    ['nadie le escribió nunca: sí es "sin contactar"',
     classifyLead({ ...baseLead, quoteCreatedAt: haceDias(6) }),
     { contactado: false, escalonCubierto: false }],
    ['un mensaje ANTERIOR al presupuesto no cuenta',
     classifyLead({ ...baseLead, quoteCreatedAt: haceDias(3), ultimoMensajeHumano: haceDias(9) }),
     { contactado: false, escalonCubierto: false }],
    ['el mensaje humano cubre el escalón vigente ese día',
     classifyLead({ ...baseLead, quoteCreatedAt: haceDias(3), ultimoMensajeHumano: haceDias(0.2) }),
     { contactado: true, escalonCubierto: true }],
    ['la plantilla enviada sigue contando como siempre',
     classifyLead({ ...baseLead, quoteCreatedAt: haceDias(3), chatLabels: ['SEGUIMIENTO_DIA_1'] }),
     { contactado: true, escalonCubierto: true }],
];
for (const [nombre, real, esperado] of casosEmbudo) {
    if (!real) { ok(nombre); continue; }
    real.contactado === esperado.contactado && real.escalonCubierto === esperado.escalonCubierto
        ? ok(`${nombre}`)
        : mal(`${nombre} → contactado:${real.contactado} escalón:${real.escalonCubierto}, esperado ${JSON.stringify(esperado)}`);
}

// ── 7. El bot VE las fotos (causa raíz del 10/9/2026) ────────────────────────
// Las fotos de WhatsApp se guardan sin extensión y el servidor las sirve como
// application/octet-stream. El bot descartaba todo lo que no dijera "image/" en
// la cabecera: no vio NINGUNA receta desde el pase a la API oficial, e inventó
// las que "guardó" (Maxi: real -7.50/-8.00, guardó -6/-5.50 con adición 2.5).
console.log('\n7. El bot recibe las fotos aunque el servidor no diga "image/"');
const { detectarTipoDeImagen } = require('../../wa-service/shared/tipo-de-imagen.js');
const jpeg = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0, 0x10, 0x4A, 0x46, 0x49, 0x46, 0, 1]);
detectarTipoDeImagen(jpeg) === 'image/jpeg' ? ok('un JPEG se reconoce por sus bytes') : mal('no reconoce un JPEG por sus bytes');
detectarTipoDeImagen(Buffer.from('<!DOCTYPE html><html>')) === null ? ok('un HTML no pasa por imagen') : mal('un HTML pasa por imagen');
const botCloud = readFileSync(new URL('../../wa-service/bot-cloud.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
botCloud.includes("if (!mimeType.startsWith('image/')) return null;")
    ? mal('bot-cloud.js volvió a filtrar la foto por la cabecera del servidor')
    : ok('bot-cloud.js decide por los bytes, no por la cabecera');

// ── 8. Nunca derivar (regla estricta de Ishtar, 10/9/2026) ───────────────────
console.log('\n8. El bot nunca le dice al cliente que lo deriva');
const { limpiarSalidaBot } = require('../../wa-service/shared/limpiar-salida-bot.js');
for (const frase of ['Te paso con alguien del equipo que te va a responder a la brevedad 😊', 'Te derivo con un asesor.', 'Dejame que lo vea con el equipo y te confirmamos']) {
    const sale = limpiarSalidaBot(frase).texto;
    /deriv|alguien del equipo|con el equipo|asesor/i.test(sale) ? mal(`se escapa: "${frase}"`) : ok(`"${frase.slice(0, 40)}…" se reemplaza`);
}

console.log('');
if (fallas.length) {
    console.error(`❌ ${fallas.length} problema(s). El tipo de lente lo decide la ADICIÓN, nunca una etiqueta ni un default.`);
    process.exit(1);
}
console.log('✅ El tipo de lente sale de la receta en todos los caminos.');
