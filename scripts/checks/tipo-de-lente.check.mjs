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

// ── 6-bis. Un presupuesto armado no es un presupuesto ENVIADO ─────────────────
// 12/9/2026: el motor le preguntó a Alina "¿pudiste ver el presupuesto que te
// pasamos?" y contestó "no me pasaron presupuesto, ya compré en otra óptica".
// 38 de 188 presupuestos creados desde el 7/9 no tenían rastro de envío.
console.log('\n6-bis. Un presupuesto cuenta como enviado solo con prueba de envío');
const { presupuestoFueEnviado } = await import('../../src/lib/embudo/presupuesto-enviado.ts');
const { proximaAccion } = await import('../../src/lib/embudo/playbook.ts');
for (const [nombre, e, esperado] of [
    ['armado hace 3 días, sin PDF ni mensaje humano → NO enviado', { quoteCreatedAt: haceDias(3), pdfEnviadoAt: null, ultimoMensajeHumano: null }, false],
    ['armado hace 3 días, PDF mandado hace 2 → enviado', { quoteCreatedAt: haceDias(3), pdfEnviadoAt: haceDias(2), ultimoMensajeHumano: null }, true],
    ['armado hace 3 días, una persona le escribió hace 2 → enviado', { quoteCreatedAt: haceDias(3), pdfEnviadoAt: null, ultimoMensajeHumano: haceDias(2) }, true],
    ['el mensaje humano ANTERIOR al presupuesto no prueba nada', { quoteCreatedAt: haceDias(3), pdfEnviadoAt: null, ultimoMensajeHumano: haceDias(5) }, false],
    ['sin presupuesto → false', { quoteCreatedAt: null, pdfEnviadoAt: haceDias(1), ultimoMensajeHumano: haceDias(1) }, false],
]) {
    presupuestoFueEnviado(e) === esperado ? ok(nombre) : mal(`${nombre} → ${presupuestoFueEnviado(e)}`);
}
{
    const base = { stage: 'primerContacto', escalonCubierto: false, hasPrescription: true, visitoElLocal: false, tieneChat: true, chatLabels: [], now: ahora };
    const a = proximaAccion({ ...base, quoteCreatedAt: null, borradorSinEnviar: haceDias(1), createdAt: haceDias(1) });
    a.tipo === 'cotizar' && /NUNCA enviado/.test(a.etiqueta) && a.vencida
        ? ok('con un borrador sin enviar, la tarjeta pide MANDARLO (hoy), no "cotizar"')
        : mal(`borrador sin enviar → ${JSON.stringify(a)}`);
    const b = proximaAccion({ ...base, quoteCreatedAt: null, borradorSinEnviar: haceDias(4), createdAt: haceDias(4) });
    b.tipo === 'plantilla' && b.plantilla === 'seguimiento_lentes_con_receta'
        ? ok('a los 3+ días sin envío se le escribe "¿retomamos el armado?", nunca "¿pudiste verlo?"')
        : mal(`borrador viejo → ${JSON.stringify(b)}`);
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

// ── 9. El lector dedicado no deja pasar valores imposibles ───────────────────
// Lo que devuelve el modelo nunca se guarda sin pasar por validar(): un valor
// fuera de rango clínico se descarta (no se "corrige"). Es la red para que una
// mala lectura no termine como receta en una ficha.
console.log('\n9. El lector de recetas descarta lo que no puede ser');
const { validar } = require('../../wa-service/shared/leer-receta.js');
const v = validar({ odEsf: -7.5, odCil: -1.25, odEje: 150, oiEsf: '-8', oiCil: -1.75, oiEje: 10, add: 20, dip: 64 });
v.add === null ? ok('un "20" (agudeza visual) no entra como adición') : mal(`entró la adición ${v.add}`);
v.oiEsf === -8 ? ok('un valor que viene como texto se convierte bien') : mal(`oiEsf quedó ${v.oiEsf}`);
validar({ add: -2.5 }).add === 2.5 ? ok('una adición leída con signo queda positiva') : mal('la adición con signo quedó mal');
validar({ odEje: 200 }).odEje === null ? ok('un eje de 200° se descarta') : mal('pasó un eje de 200°');
validar({ odEsf: 200 }).odEsf === null ? ok('una esfera de 200 (sin coma) se descarta, no se inventa') : mal('pasó una esfera de 200');
validar({ dip: 20 }).dip === null ? ok('una DIP de 20 se descarta') : mal('pasó una DIP de 20');
// Transposición a cilindro negativo (11/9: Julieta leída -4.00 +2.00 x92 → -2.00 -2.00 x2).
const { dudaGrave } = require('../../wa-service/shared/leer-receta.js');
const tj = validar({ odEsf: -3.25, odCil: 1.75, odEje: 71, oiEsf: -4, oiCil: 2, oiEje: 92 });
tj.odEsf === -1.5 && tj.odCil === -1.75 && tj.odEje === 161 && tj.oiEsf === -2 && tj.oiCil === -2 && tj.oiEje === 2
    ? ok('cilindro positivo → se transpone a negativo (misma receta, esfera real)')
    : mal(`transposición mal: ${JSON.stringify(tj)}`);
const tn = validar({ odEsf: null, odCil: 1, odEje: 90, odCercaEsf: 2 });
tn.odEsf === 1 && tn.odCil === -1 && tn.odEje === 180 && tn.odCercaEsf === 3
    ? ok('sin esfera con cilindro +1 x90 → +1.00 -1.00 x180, y la cerca se corre igual')
    : mal(`transposición sin esfera mal: ${JSON.stringify(tn)}`);
const tneg = validar({ odEsf: -2, odCil: -1.5, odEje: 10 });
tneg.odEsf === -2 && tneg.odCil === -1.5 && tneg.odEje === 10 ? ok('cilindro negativo queda como está') : mal('tocó un cilindro negativo');
dudaGrave('Signo de OI Esfera y Cilindro no visibles.') && dudaGrave('el eje del OD podría ser 15 o 45') && !dudaGrave('') && !dudaGrave('DIP no visible') && !dudaGrave('fecha ilegible, firma no se lee')
    ? ok('una duda sobre un valor invalida la lectura; sobre DIP/fecha/firma no')
    : mal('dudaGrave no distingue dudas de valores de dudas inocuas');

// ── 10. Los candados siguen puestos ──────────────────────────────────────────
console.log('\n10. Los candados del bot siguen en su lugar');
const pricing = readFileSync(new URL('../../src/app/api/bot/pricing/route.ts', import.meta.url), 'utf8');
pricing.includes("id: 'SIN_RECETA'") ? ok('sin receta no hay precio de cristales') : mal('se sacó el candado de "sin receta"');
pricing.includes("id: 'RECETA_MONOFOCAL'") ? ok('a una receta monofocal no se le dan multifocales') : mal('se sacó el candado de tipo');
botCloud.includes('procesarRecetaDeLaFoto(') ? ok('el bot pasa cada foto por el lector dedicado') : mal('el bot ya no usa el lector dedicado');
botCloud.includes('preleerFoto(fresh, msg)') && botCloud.includes('lecturasEnCurso.get(')
    ? ok('la foto se empieza a leer al llegar, en paralelo al debounce, y el turno espera esa lectura')
    : mal('la lectura de la foto volvió a arrancar recién en el turno (suma hasta 25 s de latencia)');
// ── 11. La URL de la foto: clave pelada de la nube → /api/storage/view ────────
// 11/9/2026: 717/717 fotos entrantes eran clave pelada y el bot armaba
// `host + clave` (sin barra): un host inexistente. Nunca bajó una foto en prod.
console.log('\n11. La URL para bajar la foto (espejo de resolveMediaUrl del CRM)');
const { urlDelMedio, origenDelCrm } = require('../../wa-service/shared/url-del-medio.js');
const { resolveMediaUrl } = await import('../../src/components/whatsapp/format.ts');
const BASE = 'https://crm.test';
for (const [guardado, esperado] of [
    ['1789078202399_in_1789078202332', `${BASE}/api/storage/view?key=1789078202399_in_1789078202332`],
    ['local://in_123.jpeg', `${BASE}/api/storage/view?key=in_123.jpeg`],
    ['/uploads/foto.jpg', `${BASE}/uploads/foto.jpg`],
    ['https://otro.host/x.jpg', 'https://otro.host/x.jpg'],
]) {
    const bot = urlDelMedio(guardado, BASE);
    const ui = resolveMediaUrl(guardado);
    const uiAbs = ui.startsWith('http') ? ui : `${BASE}${ui}`;
    bot === esperado && uiAbs === esperado
        ? ok(`«${guardado}» → ${esperado.replace(BASE, '')}`)
        : mal(`«${guardado}»: bot=${bot} · ui=${uiAbs} · esperado=${esperado}`);
}
origenDelCrm('https://crm.test/api/bot') === BASE && origenDelCrm('https://crm.test/api/') === BASE
    ? ok('CRM_API_URL con /api/bot, /api o barra final da el mismo origen')
    : mal(`origenDelCrm: ${origenDelCrm('https://crm.test/api/bot')} · ${origenDelCrm('https://crm.test/api/')}`);
botCloud.includes('urlDelMedio(m.mediaUrl)') ? ok('bot-cloud baja la foto con urlDelMedio') : mal('bot-cloud volvió a armar la URL a mano');
!/`\$\{base\}\$\{m(sg)?\.mediaUrl\}`/.test(botCloud + readFileSync(new URL('../../wa-service/index.js', import.meta.url), 'utf8'))
    ? ok('no queda ningún `base + mediaUrl` a mano en el bot')
    : mal('queda un `base + mediaUrl` a mano (clave pelada → host inexistente)');

// Las fotos de los chats (`_in_`/`_eco_`) son sensibles y el bot las baja con su clave.
const viewRoute = readFileSync(new URL('../../src/app/api/storage/view/route.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sensible = viewRoute.match(/const SENSITIVE_KEY = (\/.*\/i);/)?.[1];
const reSensible = sensible ? new Function(`return ${sensible}`)() : null;
reSensible && reSensible.test('1789078202399_in_1789078202332') && reSensible.test('1789078202399_eco_1789078202332') && !reSensible.test('agent_clipon_dorado_1.jpg')
    ? ok('las fotos de los chats exigen sesión o clave del bot; las del catálogo siguen públicas')
    : mal('SENSITIVE_KEY no cubre `_in_`/`_eco_` (fotos de clientes servidas sin sesión) o tapa el catálogo');
viewRoute.includes('esElBot(req)') && botCloud.includes("headers: { 'x-api-key': process.env.BOT_API_KEY }")
    ? ok('el bot manda su clave al bajar la foto y la ruta la acepta')
    : mal('el bot no manda x-api-key al bajar la foto (con `_in_` sensible, recibiría 401)');

const leerRecetaSrc = readFileSync(new URL('../../wa-service/shared/leer-receta.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
leerRecetaSrc.includes('MÁS DE UNA foto, son de la MISMA receta') && botCloud.includes('leerReceta({ imagenes })')
    ? ok('varias fotos del mismo turno se leen JUNTAS (lejos en una, cerca en la otra)')
    : mal('las fotos de un turno se leen de a una: una receta en dos fotos da dos recetas sueltas');
const agentTools = readFileSync(new URL('../../wa-service/agent-tools.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
agentTools.includes("prisma.clientTask.findFirst({ where: { clientId, description: { contains: marcaFoto } }")
    ? ok('si el lector dijo "no legible", la tool no guarda lo que adivine el modelo')
    : mal('la tool volvió a poder guardar valores de una foto que el lector marcó ilegible');

console.log('');
if (fallas.length) {
    console.error(`❌ ${fallas.length} problema(s). El tipo de lente lo decide la ADICIÓN, nunca una etiqueta ni un default.`);
    process.exit(1);
}
console.log('✅ El tipo de lente sale de la receta en todos los caminos.');
