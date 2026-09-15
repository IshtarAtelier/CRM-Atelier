#!/usr/bin/env node
/**
 * La landing tiene que etiquetar el chat de WhatsApp en el formato que el bot
 * parsea. Este check hace el viaje completo: arma la línea como la landing y
 * la lee como el bot (los DOS parsers, el de src y el del wa-service).
 *
 * Nació el 15/9/2026 cuando se descubrió que la landing decía
 * "— Campaña: default · origen: google" (legible, no parseable) y por eso
 * ningún chat de Google entraba etiquetado.
 *
 * Uso: node --experimental-strip-types scripts/checks/landing-atribucion.check.mjs
 */
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const bot = require(resolve(raiz, 'wa-service/shared/ad-tag.js'));
const core = await import(pathToFileURL(resolve(raiz, 'src/lib/ads/ad-tag-core.ts')).href);
const { lineaAtribucionWhatsApp, etiquetaDeAnuncio } = await import(pathToFileURL(resolve(raiz, 'src/lib/landing/wa-attribution.ts')).href);

let fallos = 0;
const check = (nombre, ok, detalle = '') => { console.log(`  ${ok ? '✓' : '✖'} ${nombre}${ok || !detalle ? '' : ' — ' + detalle}`); if (!ok) fallos++; };
const mensaje = (slug, v) => 'Hola Atelier! 👋 Vi sus anteojos en la web.' + lineaAtribucionWhatsApp(slug, v);

console.log('Google Ads (Search) → etiqueta google:<campaña>');
{
  const m = mensaje('default', { utmSource: 'google', utmMedium: 'cpc', utmCampaign: 'search-recetados', gclid: 'X' });
  check('src la lee', core.prefillAdTag(m) === 'google:search-recetados', core.prefillAdTag(m));
  check('el bot la lee igual', bot.prefillAdTag(m) === 'google:search-recetados', bot.prefillAdTag(m));
  check('la línea sigue siendo legible', /Campaña: default \(search-recetados\) · origen: google/.test(m));
}
console.log('Google sin utm_campaign → cae al slug de la landing');
{
  const m = mensaje('multifocales', { gclid: 'X' });
  check('etiqueta google:multifocales', core.prefillAdTag(m) === 'google:multifocales', core.prefillAdTag(m));
  check('origen dice google-ads', /origen: google-ads/.test(m));
}
console.log('Meta (fbclid / utm_source=ig) → etiqueta sin prefijo, como el histórico');
{
  check('fbclid', core.prefillAdTag(mensaje('sol', { fbclid: 'Y', utmCampaign: 'flor' })) === 'flor');
  check('utm_source=ig', core.prefillAdTag(mensaje('sol', { utmSource: 'ig', utmCampaign: 'agos' })) === 'agos');
  check('el bot coincide', bot.prefillAdTag(mensaje('sol', { fbclid: 'Y', utmCampaign: 'flor' })) === 'flor');
}
console.log('Sin pauta → SIN etiqueta (no inflar el ROAS)');
{
  check('visita directa', etiquetaDeAnuncio('default', {}) === null);
  check('orgánico desde google.com (referrer, sin gclid)', etiquetaDeAnuncio('default', { referrerHost: 'www.google.com' }) === null);
  check('el mensaje directo no parsea a nada', core.prefillAdTag(mensaje('default', {})) === null);
}
console.log('Bordes');
{
  check('un "]" en utm_campaign no rompe el corchete', core.prefillAdTag(mensaje('default', { gclid: 'X', utmCampaign: 'ab]c' })) === 'google:abc');
  check('espacios se van (el parser también los quita)', core.prefillAdTag(mensaje('default', { gclid: 'X', utmCampaign: 'search recetados' })) === 'google:searchrecetados');
  check('la etiqueta no dispara falsos negativos: stripAdTags la saca', !/\[google/.test(bot.stripAdTags(mensaje('default', { gclid: 'X', utmCampaign: 'baja' }))));
}
console.log('');
if (fallos) { console.error(`${fallos} chequeo(s) fallaron`); process.exit(1); }
console.log('Todos los chequeos pasaron');
