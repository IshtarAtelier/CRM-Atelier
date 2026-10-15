#!/usr/bin/env node
/**
 * El primer mensaje del cliente decide el origen cuando lo prueba — y el CRM y
 * el bot tienen que decidir LO MISMO. Casos reales del 16/9/2026: fichas que
 * una persona marcó "Google Ads" con la etiqueta de Meta o el texto de la web
 * a la vista.
 * Uso: node --experimental-strip-types --import ./scripts/checks/_alias.mjs scripts/checks/origen-deterministico.check.mjs
 */
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
import { readFileSync } from 'node:fs';
const { origenDeterministico, origenDeChat, FRASES_DEL_SITIO } = await import(pathToFileURL(resolve(raiz, 'src/lib/origen-deterministico.ts')).href);
const { mensajeDelBotonFlotante } = await import(pathToFileURL(resolve(raiz, 'src/lib/whatsapp-mensaje-flotante.ts')).href);
const { conMarcaDeLaWeb, MARCA_DE_LA_WEB, hrefConOrigen } = await import(pathToFileURL(resolve(raiz, 'src/lib/whatsapp-origen-web.ts')).href);
let fallos = 0;
const check = (n, ok, det='') => { console.log(`  ${ok?'✓':'✖'} ${n}${ok||!det?'':' — '+det}`); if(!ok) fallos++; };
const o = (t) => origenDeterministico(t)?.origen ?? null;
console.log('Etiqueta del anuncio manda');
check('[metaishvarilux] → Meta', o('Estoy interesado en lentes Multifocales [metaishvarilux]') === 'Meta');
check('[MetaClip] → Meta', o('Hola quiero más información de los anteojos clipones, los vi en meta.[MetaClip]') === 'Meta');
check('[ClipsJav] (alias) → Meta', o('Quiero informacion sobre lentes clip on [ClipsJav]') === 'Meta');
check('[googlesearch-recetados] → Google Ads', o('Hola Atelier! 👋 Vi sus anteojos en la web… — Campaña: recetados · origen: google [googlesearch-recetados]') === 'Google Ads', o('… [googlesearch-recetados]'));
console.log('Frases de los anuncios');
check('"Vi su anuncio en Google" → Google Ads', o('Hola! Vi su anuncio en Google y quiero recibir más información.') === 'Google Ads');
check('"Los vi en Google Ads." (sitio con gclid) → Google Ads', o('Los vi en la nueva web de Atelier. Los vi en Google Ads.') === 'Google Ads');
check('"Los vi en Meta." (sitio con fbclid) → Meta', o('Los vi en la nueva web de Atelier. Los vi en Meta.') === 'Meta');
console.log('Textos del sitio → Tienda online (no Google Ads)');
check('frase nueva de Google (29/9)', o('Los vi en un anuncio de Google. ¡Hola! Estoy en la web de Atelier y quisiera que me asesoren.') === 'Google Ads');
check('frase nueva de Meta (29/9)', o('Los vi en un anuncio de Instagram. ¡Hola! Quiero comprar el anteojo Onix') === 'Meta');
check('botón flotante nuevo (29/9)', o('¡Hola! Estoy en la web de Atelier y quisiera que me asesoren.') === 'Tienda online');
check('ficha de producto (link)', o('¡Hola! Tengo dudas sobre el modelo Vega C1.\n\nhttps://atelieroptica.com.ar/producto/vega-c1') === 'Tienda online');
check('botón flotante', o('Los vi en la nueva web de Atelier, quisiera que me asesoren.') === 'Tienda online');
check('tienda', o('¡Hola Atelier! Estoy recorriendo la tienda online y me gustaría recibir asesoramiento. https://atelieroptica.com.ar/tienda') === 'Tienda online');
check('reel', o('Hola, entré a la web de Atelier y me gustaría recibir asesoramiento.') === 'Tienda online');
check('landing sin pauta', o('Hola Atelier! 👋 Vi sus anteojos en la web y quiero recibir asesoramiento y un presupuesto.\n\n— Campaña: default') === 'Tienda online');
console.log('Sin prueba → nadie decide por la persona');
check('"Hola"', o('Hola') === null);
check('consulta genérica', o('Hola buen dia! Tenes lentes de sol para niños?') === null);
check('menciona google sin anuncio (orgánico, lo decide la persona)', o('los encontré buscando en google') === null);
check('vacío', o('') === null && o(null) === null);
console.log('El chat entero, no solo el primer mensaje (casos reales del 16/9/26)');
const c = (chat) => origenDeChat(chat)?.origen ?? null;
check('etiqueta guardada sin prefijo → Meta', c({ adTag: 'clip', mensajesEntrantes: ['', '¡Hola! Quiero más información'] }) === 'Meta');
check('etiqueta guardada google: → Google Ads', c({ adTag: 'google:search-recetados', mensajesEntrantes: ['Hola'] }) === 'Google Ads');
check('primer entrante VACÍO (referral de Meta): sigue leyendo', c({ adTag: null, mensajesEntrantes: ['', '', 'Estoy interesado en lentes Multifocales [metaishvarilux]'] }) === 'Meta');
check('la etiqueta gana al texto posterior (primer toque)', c({ adTag: 'ishvarilux', mensajesEntrantes: ['Los vi en la nueva web de Atelier, quisiera que me asesoren.'] }) === 'Meta');
check('sin etiqueta y sin prueba → null', c({ adTag: null, mensajesEntrantes: ['Hola', 'buenas tardes', '¿precio de multifocales?'] }) === null);
check('chat vacío → null', c({ adTag: null, mensajesEntrantes: [] }) === null);
console.log('El id del anuncio que manda Meta con el clic (no depende del texto)');
check('borró el mensajito precargado → igual es Meta', c({ adSourceId: '120250350194950023', adTag: null, mensajesEntrantes: ['Hola, precio de multifocales?'] }) === 'Meta');
check('el id gana a un texto del sitio posterior', c({ adSourceId: '120249083743660023', adTag: null, mensajesEntrantes: ['Los vi en la nueva web de Atelier, quisiera que me asesoren.'] }) === 'Meta');
check('sin id, todo sigue como antes', c({ adSourceId: null, adTag: 'clip', mensajesEntrantes: [''] }) === 'Meta');
check('id vacío no decide nada', c({ adSourceId: '  ', adTag: null, mensajesEntrantes: ['Hola'] }) === null);
console.log('Cada variante del botón flotante se reconoce como de la web (10/10/26)');
// Lo que de verdad llega al chat: el texto + el link si la página lo comparte
// (mismo armado que buildWhatsAppUrl). Checkout, configurador y blog no traían
// ninguna frase de la lista y esos chats quedaban sin origen.
const paginas = [
  { nombre: 'home', pathname: '/' },
  { nombre: 'nuestro local', pathname: '/nuestro-local' },
  { nombre: 'tienda', pathname: '/tienda' },
  { nombre: 'ficha de producto', pathname: '/producto/vega-c1' },
  { nombre: 'configurador', pathname: '/arma-tus-lentes' },
  { nombre: 'checkout', pathname: '/checkout' },
  { nombre: 'nota del blog', pathname: '/blog/que-es-la-miopia', tituloNota: '¿Qué es la miopía?' },
  { nombre: 'ficha con nombre del modelo', pathname: '/producto/vega-c1', productName: 'Vega C1' },
];
for (const p of paginas) {
  const { texto, compartePagina } = mensajeDelBotonFlotante(p);
  const llega = compartePagina ? `${texto}\n\nhttps://atelieroptica.com.ar${p.pathname}` : texto;
  check(`${p.nombre} → Tienda online`, o(llega) === 'Tienda online', JSON.stringify(llega));
}
check('mayorista NO cuenta como tienda (es otro número y otro público)', o(mensajeDelBotonFlotante({ pathname: '/mayorista', isOptica: true }).texto) === null);
console.log('Links a mano del sitio: la marca la pone WhatsAppAttribution al hacer clic (10/10/26)');
// Textos reales de notas del blog, FAQ y contacto que no traían ninguna frase.
for (const texto of [
  'Hola Atelier! Quiero consultar por lentes de control de miopía para mi hijo.',
  '¡Hola! Tengo una consulta sobre lentes de contacto.',
  'Hola, quiero turno para control visual',
]) {
  const conMarca = conMarcaDeLaWeb(texto);
  check(`"${texto.slice(0, 40)}…" → Tienda online con la marca`, o(conMarca) === 'Tienda online' && conMarca.startsWith(texto.trimEnd()), conMarca);
}
const conLink = conMarcaDeLaWeb('Hola! Leí la nota de multifocales.\n\nhttps://atelieroptica.com.ar/blog/multifocales');
check('con link al final: la marca va antes del link (vista previa intacta)', conLink === `Hola! Leí la nota de multifocales. ${MARCA_DE_LA_WEB}\n\nhttps://atelieroptica.com.ar/blog/multifocales`, JSON.stringify(conLink));
const yaTiene = '¡Hola! Estoy en la web de Atelier y quisiera que me asesoren.';
check('si ya prueba el origen, no se duplica', conMarcaDeLaWeb(yaTiene) === yaTiene);
const deAnuncio = 'Los vi en Google Ads. Hola, precio de multifocales?';
check('si viene de un anuncio, no se pisa el origen', conMarcaDeLaWeb(deAnuncio) === deAnuncio);
check('texto vacío queda vacío', conMarcaDeLaWeb('') === '');
check('sin punto final: la marca queda como otra oración', conMarcaDeLaWeb('Hola, quiero agendar un turno') === `Hola, quiero agendar un turno. ${MARCA_DE_LA_WEB}`);
// La decisión del clic, por comportamiento (antes se buscaba texto en el
// componente y pasaba aunque se borrara la guarda del número).
const TIENDA = '5493518685644', MAYORISTA = '5493510000000';
const wa = (num, texto) => `https://wa.me/${num}?text=${encodeURIComponent(texto)}`;
const textoDe = (href) => (href ? new URL(href).searchParams.get('text') : null);
const base = { pathname: '/blog/control-miopia', fraseAnuncio: null, telefonoTienda: TIENDA };
check('al número de la tienda, sin origen → con la marca',
  textoDe(hrefConOrigen({ ...base, href: wa(TIENDA, 'Hola, quiero un turno') })) === `Hola, quiero un turno. ${MARCA_DE_LA_WEB}`);
check('al número MAYORISTA → no se toca', hrefConOrigen({ ...base, href: wa(MAYORISTA, 'Hola, quiero un turno') }) === null);
check('desde el CRM (/admin) → no se toca, ni con anuncio',
  hrefConOrigen({ ...base, pathname: '/admin/ventas', fraseAnuncio: 'Los vi en Meta.', href: wa(TIENDA, 'Hola Juan, tu pedido está listo') }) === null
  && hrefConOrigen({ ...base, pathname: '/login', href: wa(TIENDA, 'Hola') }) === null);
check('con identificador de anuncio → la frase del anuncio adelante y sin marca de la web',
  textoDe(hrefConOrigen({ ...base, fraseAnuncio: 'Los vi en Meta.', href: wa(TIENDA, 'Hola, precio?') })) === 'Los vi en Meta. Hola, precio?');
check('el anuncio también va al número mayorista (lo mide igual)',
  textoDe(hrefConOrigen({ ...base, fraseAnuncio: 'Los vi en Meta.', href: wa(MAYORISTA, 'Hola') })) === 'Los vi en Meta. Hola');
check('sin texto prellenado → no se inventa uno', hrefConOrigen({ ...base, href: `https://wa.me/${TIENDA}` }) === null);
check('el link ya marcado no cambia (doble clic)', hrefConOrigen({ ...base, href: wa(TIENDA, `Hola. ${MARCA_DE_LA_WEB}`) }) === null);
check('api.whatsapp.com/send?phone= también se reconoce',
  textoDe(hrefConOrigen({ ...base, href: `https://api.whatsapp.com/send?phone=${TIENDA}&text=${encodeURIComponent('Hola')}` })) === `Hola. ${MARCA_DE_LA_WEB}`);
check('los espacios viajan como %20, no como "+"', !String(hrefConOrigen({ ...base, href: wa(TIENDA, 'Hola che') })).includes('+'));
const attribution = readFileSync(resolve(raiz, 'src/components/Storefront/WhatsAppAttribution.tsx'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
check('WhatsAppAttribution decide con hrefConOrigen (sin lógica propia)', /hrefConOrigen\(\{/.test(attribution) && !/conMarcaDeLaWeb|searchParams/.test(attribution));
// Y le pasa lo que corresponde: la página real (para no marcar desde el CRM),
// la frase del anuncio, el número de la tienda; y aplica el resultado en el clic.
check('…con la página real, la frase del anuncio y el número de la tienda',
  /pathname:\s*window\.location\.pathname/.test(attribution) && /fraseAnuncio:\s*adPlatformSentence\(\)/.test(attribution) && /telefonoTienda:\s*WHATSAPP_PHONE\b/.test(attribution));
check('…y reescribe el link en la fase de captura del clic', /link\.href\s*=\s*nuevo/.test(attribution) && /addEventListener\('click',\s*onClick,\s*true\)/.test(attribution));
{
  const primero = hrefConOrigen({ ...base, fraseAnuncio: 'Los vi en Meta.', href: wa(TIENDA, 'Hola, precio?') });
  check('doble clic con anuncio: la frase no se repite', primero !== null && hrefConOrigen({ ...base, fraseAnuncio: 'Los vi en Meta.', href: primero }) === null);
}

console.log('El bot decide con la MISMA lista de frases');
const tools = readFileSync(resolve(raiz, 'wa-service/tools.js'), 'utf8');
check('wa-service/tools.js tiene la lista idéntica a FRASES_DEL_SITIO', tools.includes(`/${FRASES_DEL_SITIO.source}/i`), 'actualizar las dos copias juntas');
console.log('');
if (fallos) { console.error(`${fallos} chequeo(s) fallaron`); process.exit(1); }
console.log('Todos los chequeos pasaron');
