/**
 * Lo que el bot NUNCA le puede mandar a un cliente, y lo que NUNCA se le puede
 * romper. Sin base ni red (también en CI, sin wa-service/node_modules).
 *
 *   npm run check:salida-bot
 *
 * Cada fuga es un mensaje que de verdad salió a producción:
 *  - 4/10: razonamiento interno en inglés ("I have already confirmed… I should not respond").
 *  - 21/9: "El cliente agradeció. Te espero…" (hablaba DEL cliente).
 *  - 8 y 9/10: copió las notas del historial ("Respetá lo que ya dijo y no lo repitas.]")
 *    y reenvió los mensajes de una vendedora.
 *  - 14/8: "desde [precio]" sin completar.
 * Y cada caso "intacto" es algo que un filtro anterior rompió:
 *  - 10/10: el borrado "por oración" con regex cortaba "$185.000" en "$185." y
 *    los links a la mitad.
 *  - 10/10: el anti-repetición aplastaba los `\n\n` y todo salía en una burbuja.
 *  - 10/10: "the best seller" en una respuesta castellana la silenciaba.
 * Si alguien afloja `wa-service/shared/limpiar-salida-bot.js`, esto falla.
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const salida = require('../../wa-service/shared/limpiar-salida-bot.js');
const { limpiarSalidaBot, sanearBloques, quitarRepeticiones, partirEnBurbujas, PATRONES_CON_TEST } = salida;
const { oraciones } = require('../../wa-service/shared/partir-oraciones.js');
const { detectarIdioma } = require('../../wa-service/shared/idioma.js');
const { armarRespuesta, leerSalidaDelGrafo } = require('../../wa-service/shared/respuesta-del-turno.js');

let fallas = 0;
const mal = (m) => { fallas++; console.log(`  ❌ ${m}`); };

// ── 1. Fugas reales: no sale nada de esto ────────────────────────────────────
const NO_PUEDE_SALIR = [
    /\b(?:the|should|according|instructions|user)\b/i,
    /el cliente|seg[uú]n las instrucciones|no debo responder/i,
    /Respet[áa] lo que ya dijo|Lo escrib|NO vos/i,
    /\[(?!IMAGE:)[^\]]*\]|\]/,
    /\bvoc[eê]\b|obrigad/i,
];
const fugas = [
    "I have already confirmed that a call will be scheduled for tomorrow and the user has thanked me.\n\nAccording to the instructions, I should not respond further if the client's last message doesn't require a new action.",
    'El cliente agradeció. Te espero si tenés alguna otra consulta 😊',
    '😊\n\nRespetá lo que ya dijo y no lo repitas.] Dale Juanma, te esperamos mañana. Un abrazo!\n\nLo confirmo y te escribo en un ratito',
    'Respetá lo que ya dijo y no lo repitas.] Dale! Cuando puedas!',
    '[mié, 8 oct, 16:24] [Lo escribió Mile, del equipo] hola',
    'Hola Vaidaa! La promo 2x1 es desde [precio]. Pasate por Tejeda 4380.',
    'Hola! La promo es desde [PRECIO]. Te espero.',
    'Olá! Você quer ver os modelos? Obrigada pelo contato',
    'The user said thanks. I will not reply.',
];
for (const c of fugas) {
    const { texto } = limpiarSalidaBot(c);
    const m = NO_PUEDE_SALIR.find(re => re.test(texto));
    if (m) mal(`salió: "${texto.slice(0, 80)}"`);
}

// ── 2. Lo sano sale intacto, carácter por carácter ───────────────────────────
const INTACTOS = [
    'Hola Luciano, cómo estás? contame un poquito qué estás necesitando',
    'Dale, cuando la tengas me la pasás. trabajamos con todas las obras sociales y prepagas.',
    'Ray-Ban Clubmaster Classic, el más vendido 👉 https://atelieroptica.com.ar/tienda',
    'Te paso fotitos [IMAGE: https://atelieroptica.com.ar/a.jpg]',
    // Precios y links con relleno o filtros alrededor: el filtro viejo los cortaba.
    'El Ray-Ban sale $185.000, ahí te paso la foto',
    'El Wayfarer es the best seller de Ray-Ban 😊 sale $185.000',
    'El cristal 1.74 sale $34.480. Lo hacemos con el equipo de laboratorio.',
    'Mirá acá: https://atelieroptica.com.ar/catalogo/mujer/sol?search=ray.ban y elegí el que más te guste',
    'Estamos en Av. Rafael Núñez 4380, local 2. Te esperamos!',
];
for (const c of INTACTOS) {
    const { texto } = limpiarSalidaBot(c);
    if (texto !== c) mal(`se tocó un mensaje sano: "${c.slice(0, 60)}" → "${texto.slice(0, 60)}"`);
}

// ── 3. Lo que se saca, se saca ENTERO: precios y links nunca a la mitad ──────
const CON_DATOS = [
    ['Un momentito. El Ray-Ban sale $185.000. Mirá https://atelieroptica.com.ar/tienda/ray-ban.x?y=1. Dale!', ['$185.000', 'https://atelieroptica.com.ar/tienda/ray-ban.x?y=1']],
    ['Soy un asistente virtual. El Clubmaster sale $185.000 en efectivo.', ['$185.000']],
    ['Te derivo con un asesor. Mientras tanto mirá https://atelieroptica.com.ar/tienda', ['https://atelieroptica.com.ar/tienda']],
    ['El cliente preguntó por el precio. Sale $34.480 con el antirreflejo.', ['$34.480']],
    ['La promo es desde [precio]. El armazón solo sale $85.500, mirá atelieroptica.com.ar/tienda', ['$85.500', 'atelieroptica.com.ar/tienda']],
];
for (const [c, datos] of CON_DATOS) {
    const { texto } = limpiarSalidaBot(c);
    for (const d of datos) if (!texto.includes(d)) mal(`se perdió o se cortó "${d}" en: "${c.slice(0, 50)}" → "${texto}"`);
    if (/\$\d{1,3}\.(?!\d)/.test(texto)) mal(`quedó un precio cortado: "${texto}"`);
}
const os = oraciones('El Ray-Ban sale $185.000. Mirá https://atelieroptica.com.ar/x.y. Av. Colón 1.250, Dr. Pérez. Listo!');
if (os.length !== 4 || !os[0].endsWith('$185.000.') || !os[1].includes('https://atelieroptica.com.ar/x.y')) mal(`el divisor de oraciones partió mal: ${JSON.stringify(os)}`);

// ── 4. Idioma: sobre la respuesta entera, sin falsos positivos ───────────────
if (detectarIdioma('El Wayfarer es the best seller de Ray-Ban, sale $185.000').idioma !== 'es') mal('"the best seller" en castellano se tomó por inglés');
if (detectarIdioma('Tenemos el *Crystal Blue Light Protection* y el *Transitions Gen S* para vos').idioma !== 'es') mal('nombres de producto en inglés se tomaron por inglés');
if (detectarIdioma('Hello! How are you? Do you need new glasses?').idioma !== 'en') mal('una respuesta en inglés no se detectó');
if (detectarIdioma('Olá! Você quer ver os modelos? Obrigada').idioma !== 'pt') mal('una respuesta en portugués no se detectó');
if (detectarIdioma('no').idioma !== 'es') mal('"no" solo cuenta para inglés');
const r = sanearBloques('Hola!\n\nI should not respond further to the user.');
if (!r.rechazo || r.rechazo.tipo !== 'idioma') mal('una respuesta mitad en inglés no se RECHAZÓ entera (se recortó)');

// ── 5. Las burbujas sobreviven de punta a punta ──────────────────────────────
const rep = quitarRepeticiones(['Hola Juan! 😊', 'El Clubmaster sale $185.000 🙌', 'Cuando tengas tu receta o quieras venir a probarte los armazones, te esperamos en el local'],
    ['Cuando tengas tu recetita o quieras ver los armazones, te esperamos en el local']);
if (rep.bloques.length !== 2) mal(`quitarRepeticiones aplastó o perdió burbujas: ${JSON.stringify(rep.bloques)}`);
const resp = armarRespuesta({
    salida: { tipo: 'responder', mensajes: ['Hola Juan! 😊 qué bueno', 'El Clubmaster sale $185.000 🙌 te gusta?'], herramientas: new Set() },
    encolados: [{ texto: '*Clubmaster*\n• Precio contado: *$185.000*', imagenes: ['https://atelieroptica.com.ar/a.jpg'] }],
});
if (resp.burbujas.length !== 3 || resp.burbujas[0].origen !== 'sistema' || resp.burbujas[1].origen !== 'llm') mal(`armarRespuesta no respetó burbujas/orden/origen: ${JSON.stringify(resp.burbujas)}`);
if (!resp.burbujas[1].texto.includes('😊') || !resp.burbujas[2].texto.includes('🙌')) mal('se perdió el emoji de una burbuja (todo salía en una)');
for (const b of partirEnBurbujas('Te cuento que el Clubmaster es uno de los más vendidos y sale $185.000 en efectivo o transferencia. Además tenemos 3 y 6 cuotas sin interés con todas las tarjetas. Pasate cuando quieras por el local.')) {
    if (/\$185\.$/.test(b) || /^000/.test(b)) mal(`partirEnBurbujas cortó un precio: "${b}"`);
}

// ── 6. Callarse es un campo, y derivar sin tarea se escala ───────────────────
const callar = armarRespuesta({ salida: { tipo: 'callar', mensajes: [], motivo: 'agradeció', herramientas: new Set() } });
if (callar.accion !== 'callar' || callar.burbujas.length) mal('no_responder no dejó el turno en silencio');
const deriva = armarRespuesta({ salida: { tipo: 'texto', mensajes: ['Te paso con alguien del equipo que te va a responder'], herramientas: new Set() } });
if (!deriva.escalar) mal('derivar sin herramienta no pidió crear la tarea desde el código');
if (/alguien del equipo/i.test(deriva.textoLLM)) mal('la frase de derivación salió al cliente');
const conTarea = armarRespuesta({ salida: { tipo: 'texto', mensajes: ['Lo confirmo y te escribo en un ratito 😊'], herramientas: new Set(['pedir_ayuda']) } });
if (conTarea.escalar) mal('con pedir_ayuda corrida, igual pidió escalar (tarea duplicada)');
const laboratorio = armarRespuesta({ salida: { tipo: 'texto', mensajes: ['Lo hacemos con el equipo de laboratorio, sale $34.480.'], herramientas: new Set() } });
if (laboratorio.escalar || !laboratorio.textoLLM.includes('$34.480')) mal('"con el equipo de laboratorio" se tomó como derivación');
const conPensamiento = leerSalidaDelGrafo({ messages: [{ content: [{ type: 'thinking', thinking: 'The user thanked me, I should not respond.' }, { type: 'text', text: 'Gracias a vos! 😊' }] }] });
if (conPensamiento.mensajes.join('') !== 'Gracias a vos! 😊') mal(`se coló una parte 'thinking' en la salida: ${JSON.stringify(conPensamiento.mensajes)}`);

// ── 7. Idempotente: el punto de salida vuelve a sanear lo ya saneado ─────────
for (const c of [...fugas, ...INTACTOS, ...CON_DATOS.map(x => x[0])]) {
    const una = limpiarSalidaBot(c).texto;
    const dos = limpiarSalidaBot(una).texto;
    if (una !== dos) mal(`sanear dos veces cambia el texto: "${una.slice(0, 50)}" → "${dos.slice(0, 50)}"`);
}

// ── 8. Ninguna lista usada con .test() tiene la bandera g ────────────────────
for (const [nombre, lista] of Object.entries(PATRONES_CON_TEST)) {
    for (const re of lista) if (re.global || re.sticky) mal(`${nombre} tiene un patrón con /g o /y usado con .test(): ${re}`);
}

if (fallas) { console.log(`\n❌ ${fallas} caso(s) fallaron.`); process.exit(1); }
console.log(`✅ Salida del bot: ${fugas.length} fugas reales bloqueadas, ${INTACTOS.length} mensajes sanos intactos, ${CON_DATOS.length} con precios/links que no se cortan, burbujas e idioma bien.`);
