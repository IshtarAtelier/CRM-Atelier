/**
 * El primer contacto y el mensaje de anuncio: los decide el CÓDIGO.
 * Sin base ni red (también en CI, sin wa-service/node_modules).
 *
 *   npm run check:primer-contacto
 *
 * Por qué (Ishtar, 10/10/2026): "que asesore, no que solo escupa precios". En
 * MetaClip el 74% de los primeros turnos tiraba un precio aunque el prompt
 * decía que no: el modelo tenía las herramientas de precio a mano, un módulo
 * que decía "ARMAZONES: Desde $100.000" (falso: el clip-on más barato publicado
 * sale $175.000 y el armazón de receta $140.000), y reglas que se contradecían.
 * Este check fija que en la apertura:
 *   - la fase sale de UNA función (la misma que alimenta conversacion_en_curso);
 *   - el modelo no tiene las herramientas de precio y fotos;
 *   - hay UN solo bloque de saludo y ningún módulo que empuje a cotizar;
 *   - si igual mete un precio, una foto o un link, sale el saludo del código.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const fase = require('../../wa-service/shared/fase-de-la-charla.js');
const { buildContextModules } = require('../../wa-service/prompts/context-modules.js');
const { armarRespuesta } = require('../../wa-service/shared/respuesta-del-turno.js');
const { FASE, faseDeLaCharla, entroPorAnuncio, esPrimerContacto, instruccionDeFase, validarSalidaDeApertura, restriccionDeFase, HERRAMIENTAS_FUERA_DE_LA_APERTURA } = fase;

let fallas = 0;
const ok = (m) => console.log(`  ✅ ${m}`);
const mal = (m) => { fallas++; console.log(`  ❌ ${m}`); };
const check = (m, cond) => (cond ? ok(m) : mal(m));
const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

// Mensajes con la forma de LangChain sin depender de @langchain (CI no lo instala).
const human = (t) => ({ role: 'human', content: t });
const ai = (t) => ({ role: 'ai', content: t });

console.log('\nLa fase la decide una sola función');
check('historial sin nada nuestro → primer contacto', faseDeLaCharla([human('[sáb, 10 oct, 10:00] Hola quiero más info de los clipones')]) === FASE.PRIMER_CONTACTO);
check('solo la bienvenida automática de Meta → sigue siendo primer contacto',
    faseDeLaCharla([human('Hola'), ai('[sáb, 10 oct, 10:00] ¡Hola! ¿Cómo podemos ayudarte?'), human('info clip')]) === FASE.PRIMER_CONTACTO);
check('el auto-respondedor de fuera de horario tampoco cuenta como "ya hablamos"',
    esPrimerContacto([human('hola'), ai('Bienvenidos a Atelier Optica, en este momento estamos fuera de horario laborar.')]));
check('con un mensaje nuestro → en curso', faseDeLaCharla([human('hola'), ai('Hola Ana, cómo estás?'), human('bien')]) === FASE.EN_CURSO);
check('con historia y entra por un anuncio → anuncio_con_historia',
    faseDeLaCharla([human('hola'), ai('Hola Ana, cómo estás?'), human('info clip')], { entroPorAnuncio: true }) === FASE.ANUNCIO_CON_HISTORIA);
check('sin historia, aunque sea de anuncio → primer contacto',
    faseDeLaCharla([human('info clip')], { entroPorAnuncio: true }) === FASE.PRIMER_CONTACTO);

console.log('\n"Ya hablamos" se decide por la FIRMA del saliente, no por su texto (15/10/2026)');
{
    const { historiaNuestra } = fase;
    const t = (min) => new Date(Date.UTC(2026, 9, 15, 13, min));
    const saludoDelBot = 'Hola Ana, gracias por escribirnos! contame qué estás necesitando';
    const conSaludoDelBot = historiaNuestra([
        { direction: 'INBOUND', content: 'hola', createdAt: t(0) },
        { direction: 'OUTBOUND', senderName: 'Bot', content: saludoDelBot, createdAt: t(1) },
        { direction: 'INBOUND', content: 'info clip', createdAt: t(2) },
    ]);
    check('un saludo del Bot que suena a bienvenida de Meta ES "ya hablamos" (antes repetía el saludo)', conSaludoDelBot.yaHablamos === true && conSaludoDelBot.primerMensajeNuestro.startsWith('Hola Ana'));
    check('…y la fase con esas filas es en curso, no primer contacto',
        faseDeLaCharla([human('hola'), ai(saludoDelBot), human('info clip')], { yaHablamos: conSaludoDelBot.yaHablamos }) === FASE.EN_CURSO);
    check('el auto-respondedor y "Meta (Auto-Reply)" NO son "ya hablamos"', historiaNuestra([
        { direction: 'OUTBOUND', senderName: 'Auto-respondedor', content: 'Bienvenidos a Atelier Optica', createdAt: t(0) },
        { direction: 'OUTBOUND', senderName: 'Meta (Auto-Reply)', content: '¡Hola! ¿Cómo podemos ayudarte?', createdAt: t(1) },
        { direction: 'INBOUND', content: 'hola', createdAt: t(2) },
    ]).yaHablamos === false);
    check('una persona desde el teléfono ("Contame cómo puedo ayudarte") SÍ es "ya hablamos"', historiaNuestra([
        { direction: 'OUTBOUND', senderName: 'Teléfono', content: 'Contame cómo puedo ayudarte', createdAt: t(0) },
    ]).yaHablamos === true);
    check('el primer mensaje nuestro es el más VIEJO, aunque las filas vengan de la más nueva a la más vieja', historiaNuestra([
        { direction: 'OUTBOUND', senderName: 'Bot', content: 'segundo', createdAt: t(5) },
        { direction: 'OUTBOUND', senderName: 'Mile', content: 'primero', createdAt: t(1) },
    ]).primerMensajeNuestro === 'primero');
    const conHistoria = buildContextModules({ agentType: 'sales', messages: [human('hola'), ai(saludoDelBot), human('info clip')], fase: FASE.EN_CURSO, historia: conSaludoDelBot });
    check('conversacion_en_curso usa la misma historia que la fase', /ESTA CONVERSACIÓN YA ESTÁ EMPEZADA/.test(conHistoria));
    const bc = leer('../../wa-service/bot-cloud.js');
    check('bot-cloud.js calcula la historia de las filas y la pasa a la fase y al grafo',
        /const historia = historiaNuestra\(recientes\)/.test(bc) && /historiaNuestra: historia,/.test(bc) && /yaHablamos: historia\.yaHablamos/.test(bc));
    const g = leer('../../wa-service/graph.js');
    check('graph.js declara el canal historiaNuestra y se lo pasa a los módulos', /historiaNuestra: Annotation\(/.test(g) && /historia: state\.historiaNuestra/.test(g));
}

console.log('\nEl anuncio se lee de las filas crudas (antes de que el historial limpie la marca)');
check('marca [MetaClip] en un entrante de este turno → anuncio', entroPorAnuncio([
    { direction: 'INBOUND', content: 'Hola quiero más información [MetaClip]' },
    { direction: 'OUTBOUND', content: 'Hola!' },
]));
check('la marca vieja (antes de nuestro último saliente) no cuenta', !entroPorAnuncio([
    { direction: 'INBOUND', content: 'y cuánto sale?' },
    { direction: 'OUTBOUND', content: 'Hola!' },
    { direction: 'INBOUND', content: 'Hola [MetaClip]' },
]));

console.log('\nUN solo bloque de instrucción, y ningún módulo que empuje a cotizar');
const hist = [human('Hola quiero más información de los anteojos clipones, los vi en meta, cuánto salen?')];
const modsPrimer = buildContextModules({ agentType: 'sales', messages: hist, clientData: null, chatSummary: null, fase: FASE.PRIMER_CONTACTO });
check('primer contacto: sin el módulo de armazones ("SÍ tenés fotos")', !modsPrimer.includes('<armazones_y_productos>'));
check('primer contacto: sin el módulo de precios', !modsPrimer.includes('<precios_y_presupuestos>'));
check('primer contacto: sin "PROHIBIDO saludar"', !modsPrimer.includes('<conversacion_ya_empezada>'));
const modsCurso = buildContextModules({ agentType: 'sales', messages: [...hist, ai('Hola, cómo estás?'), human('para manejar')], clientData: null, chatSummary: null, fase: FASE.EN_CURSO });
check('en curso: los módulos de armazones y "ya empezada" vuelven', modsCurso.includes('<armazones_y_productos>') && modsCurso.includes('<conversacion_ya_empezada>'));
const modsAnuncio = buildContextModules({ agentType: 'sales', messages: [...hist, ai('Hola, cómo estás?'), human('[MetaClip]')], clientData: null, chatSummary: null, fase: FASE.ANUNCIO_CON_HISTORIA });
check('anuncio con historia: NO va "PROHIBIDO saludar" (lo reemplaza el bloque de la fase)', !modsAnuncio.includes('<conversacion_ya_empezada>'));
check('anuncio con historia: tampoco los módulos de cotizar', !modsAnuncio.includes('<armazones_y_productos>') && !modsAnuncio.includes('<precios_y_presupuestos>'));

const bloque = instruccionDeFase(FASE.PRIMER_CONTACTO, 'Luciano', { porAnuncio: true });
check('el bloque de primer contacto es uno solo y trae el nombre', (bloque.match(/<fase_de_la_charla/g) || []).length === 1 && bloque.includes('"Luciano"'));
check('sin nombre lógico, saluda sin nombre', instruccionDeFase(FASE.PRIMER_CONTACTO, '').includes('NINGUNO'));
check('en curso no hay bloque de saludo', instruccionDeFase(FASE.EN_CURSO, 'Ana') === '');
check('el bloque de anuncio con historia no se re-presenta y retoma', /sin presentarte/i.test(instruccionDeFase(FASE.ANUNCIO_CON_HISTORIA, 'Ana')) && /retome|retomar/i.test(instruccionDeFase(FASE.ANUNCIO_CON_HISTORIA, 'Ana')));

console.log('\nNingún piso de precio inventado');
const modulos = leer('../../wa-service/prompts/context-modules.js');
check('context-modules.js no dice "Desde $" (el clip-on más barato publicado sale $175.000)', !/Desde \$\d/.test(modulos));

console.log('\nEn la apertura el modelo NO TIENE las herramientas de precio y fotos');
const graph = leer('../../wa-service/graph.js');
const tools = leer('../../wa-service/agent-tools.js');
for (const h of HERRAMIENTAS_FUERA_DE_LA_APERTURA) check(`"${h}" existe en agent-tools.js (si se renombra, este filtro deja de excluirla)`, tools.includes(`name: "${h}"`));
check('graph.js filtra las herramientas en la apertura antes de bindTools',
    /apertura\s*\?\s*toolsList\.filter\(t => !HERRAMIENTAS_FUERA_DE_LA_APERTURA\.has\(t\.name\)\)/.test(graph) && /bindTools\(herramientas/.test(graph));
check('la fase solo aplica al agente de ventas', /agentType === 'sales'\s*\?\s*\(state\.fase \|\| faseDeLaCharla/.test(graph));

console.log('\nLas reglas no se contradicen');
const core = graph.match(/const CORE_RULES = `([\s\S]*?)`;/)?.[1] || '';
check('CORE_RULES ya no tiene el "PRIMER MENSAJE" (vive en el bloque de la fase)', core && !/PRIMER MENSAJE de la charla/.test(core));
check('la regla 3 ya no dice "tu primer mensaje va directo a atender"', !/tu primer mensaje va directo a atender/.test(core));
check('la regla del embudo va solo a ventas', /agentType === 'sales' \? REGLA_EMBUDO_VENTAS : ''/.test(graph));
check('el ejecutivo lee su propia clave de prompt, nunca la de ventas', /promptCustomDe: \(state\) => state\.customPromptExecutive/.test(graph) && !/rejectCustomPrompt/.test(graph));

console.log('\nLa salida de la apertura se valida');
check('rechaza "$175.000"', !validarSalidaDeApertura('Hola! Los clip-on salen $175.000').ok);
check('rechaza "175.000" sin signo', !validarSalidaDeApertura('arrancan en 175.000').ok);
check('rechaza una foto', !validarSalidaDeApertura('[IMAGE: https://x.com/a.jpg]').ok);
check('rechaza un link', !validarSalidaDeApertura('mirá https://atelieroptica.com.ar/tienda').ok);
check('acepta el saludo', validarSalidaDeApertura('Hola Ana, cómo estás? contame un poquito qué estás necesitando').ok);

const r = restriccionDeFase(FASE.PRIMER_CONTACTO, 'Ana');
const conPrecio = armarRespuesta({ salida: { tipo: 'responder', mensajes: ['Hola Ana! Los clip-on arrancan en $100.000 😊'], herramientas: new Set() }, restriccion: r });
check('si el modelo mete un precio, sale el saludo del código', conPrecio.accion === 'enviar' && conPrecio.burbujas.length === 1 && conPrecio.burbujas[0].texto.startsWith('Hola Ana, cómo estás?') && conPrecio.burbujas[0].origen === 'sistema');
const callado = armarRespuesta({ salida: { tipo: 'callar', mensajes: [], motivo: 'x', herramientas: new Set() }, restriccion: r });
check('un primer contacto nunca queda en silencio', callado.accion === 'enviar' && callado.burbujas[0].texto.startsWith('Hola Ana'));
const bueno = armarRespuesta({ salida: { tipo: 'responder', mensajes: ['Hola Ana, cómo estás? vi que te interesaron los clip-on, contame para qué los querés'], herramientas: new Set() }, restriccion: r });
check('un saludo bueno sale como lo escribió el modelo', bueno.accion === 'enviar' && bueno.burbujas.every(b => b.origen === 'llm'));
const conFoto = armarRespuesta({ salida: { tipo: 'responder', mensajes: ['Hola!'], herramientas: new Set() }, encolados: [{ texto: 'Torino $175.000', imagenes: ['https://x/y.jpg'] }], restriccion: r });
check('lo encolado por una herramienta no sale en la apertura', conFoto.burbujas.every(b => !b.imagenes.length));
check('en curso no hay restricción', restriccionDeFase(FASE.EN_CURSO, 'Ana') === null);

console.log('\nLos que arman el turno pasan la restricción');
for (const f of ['bot-cloud.js', 'index.js', 'routes/api.js']) {
    const src = leer(`../../wa-service/${f}`);
    check(`${f} arma la respuesta con restriccionDeFase(...)`, /restriccion: restriccionDeFase\(/.test(src) || /restriccionDeFase\(result/.test(src));
}

console.log('');
if (fallas) { console.log(`❌ ${fallas} falla(s).`); process.exit(1); }
console.log('✅ Primer contacto: lo decide el código.');
