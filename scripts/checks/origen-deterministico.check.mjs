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
const { origenDeterministico } = await import(pathToFileURL(resolve(raiz, 'src/lib/origen-deterministico.ts')).href);
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
check('botón flotante', o('Los vi en la nueva web de Atelier, quisiera que me asesoren.') === 'Tienda online');
check('tienda', o('¡Hola Atelier! Estoy recorriendo la tienda online y me gustaría recibir asesoramiento. https://atelieroptica.com.ar/tienda') === 'Tienda online');
check('reel', o('Hola, entré a la web de Atelier y me gustaría recibir asesoramiento.') === 'Tienda online');
check('landing sin pauta', o('Hola Atelier! 👋 Vi sus anteojos en la web y quiero recibir asesoramiento y un presupuesto.\n\n— Campaña: default') === 'Tienda online');
console.log('Sin prueba → nadie decide por la persona');
check('"Hola"', o('Hola') === null);
check('consulta genérica', o('Hola buen dia! Tenes lentes de sol para niños?') === null);
check('menciona google sin anuncio (orgánico, lo decide la persona)', o('los encontré buscando en google') === null);
check('vacío', o('') === null && o(null) === null);
console.log('');
if (fallos) { console.error(`${fallos} chequeo(s) fallaron`); process.exit(1); }
console.log('Todos los chequeos pasaron');
