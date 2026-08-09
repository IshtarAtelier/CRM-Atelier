/**
 * Salud del Meta Pixel — SOLO LECTURA.
 *
 * Muestra si el píxel existe, cuándo disparó por última vez y qué eventos
 * recibió en los últimos 7 días. Sirve para saber si el Pixel del navegador y
 * el Conversions API están llegando de verdad a Meta.
 *
 * Va por `scripts/ads/lib/meta_client.js` como exige `scripts/ads/CLAUDE.md`
 * (prohibido fetch/curl directo a graph.facebook.com desde un script): de ahí
 * salen gratis la versión pineada, el appsecret_proof, el backoff y el logging
 * sin secretos.
 *
 * Los tokens NO son intercambiables: `META_ACCESS_TOKEN` es el que usa el
 * Conversions API para ESCRIBIR eventos, y no necesariamente puede LEER las
 * estadísticas del píxel. La lectura pide `ads_read`, que es lo que tiene
 * `META_ADS_TOKEN`. Por eso se prueban en orden y se informa cuál sirvió.
 *
 * Uso:  node --env-file=.env scripts/checks/pixel-salud.mjs
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { get, debugToken } = require('../ads/lib/meta_client');

const PIXEL_ID = process.env.META_PIXEL_ID;
if (!PIXEL_ID) {
  console.error('Falta META_PIXEL_ID en el entorno. Correr con: node --env-file=.env');
  process.exit(1);
}

const CANDIDATOS = [
  ['META_ADS_TOKEN', process.env.META_ADS_TOKEN],
  ['META_SYSTEM_USER_TOKEN', process.env.META_SYSTEM_USER_TOKEN],
  ['META_ACCESS_TOKEN', process.env.META_ACCESS_TOKEN],
].filter(([, valor]) => Boolean(valor));

if (!CANDIDATOS.length) {
  console.error('No hay ningún token de Meta en el entorno.');
  process.exit(1);
}

const desde = Math.floor(Date.now() / 1000) - 7 * 24 * 3600;

/** Agrupa la respuesta de /stats?aggregation=event en {evento: cantidad}. */
function contarPorEvento(stats) {
  const porEvento = new Map();
  for (const bloque of stats?.data ?? []) {
    for (const fila of bloque?.data ?? []) {
      porEvento.set(fila.value, (porEvento.get(fila.value) ?? 0) + Number(fila.count || 0));
    }
  }
  return [...porEvento.entries()].sort((a, b) => b[1] - a[1]);
}

let sirvio = null;

for (const [nombre, token] of CANDIDATOS) {
  console.log(`\n── Probando ${nombre} ──`);

  // Scopes primero: dice por qué falla, en vez de dejar un error opaco.
  try {
    const info = await debugToken(token);
    const d = info?.data ?? {};
    const scopes = Array.isArray(d.scopes) ? d.scopes.join(', ') : '(no informa scopes)';
    console.log(`  tipo ${d.type ?? '?'} · scopes: ${scopes}`);
    if (Array.isArray(d.scopes) && !d.scopes.includes('ads_read')) {
      console.log('  ⚠️ sin ads_read: no va a poder leer las estadísticas del píxel');
    }
  } catch (err) {
    console.log(`  no se pudo inspeccionar el token: ${err instanceof Error ? err.message : err}`);
  }

  try {
    const meta = await get(`${PIXEL_ID}`, { fields: 'name,last_fired_time,is_unavailable' }, token);
    console.log(`  ✅ Pixel "${meta.name}" (${PIXEL_ID})`);
    console.log(`     último evento recibido: ${meta.last_fired_time ?? 'NUNCA'}`);
    if (meta.is_unavailable) console.log('     ⚠️ Meta lo marca como no disponible');

    const stats = await get(`${PIXEL_ID}/stats`, { aggregation: 'event', start_time: desde }, token);
    const eventos = contarPorEvento(stats);
    console.log('     eventos de los últimos 7 días:');
    if (!eventos.length) {
      console.log('       (ninguno — el píxel no está recibiendo NADA)');
    } else {
      for (const [evento, cantidad] of eventos) {
        console.log(`       ${evento.padEnd(20)} ${cantidad}`);
      }
    }
    sirvio = nombre;
    break;
  } catch (err) {
    // Los errores de Meta no incluyen el token; el cliente además redacta.
    console.log(`  ✗ ${err instanceof Error ? err.message : err}`);
  }
}

console.log('');
if (sirvio) {
  console.log(`Token que puede auditar el píxel: ${sirvio}`);
  if (sirvio !== 'META_ACCESS_TOKEN') {
    console.log('(AdsService.getPixelHealth prueba los tokens en este mismo orden.)');
  }
} else {
  console.log('Ningún token del entorno puede leer el píxel.');
  console.log('Arreglo: en Business Manager → Usuarios del sistema, darle al token');
  console.log('permiso "Ver rendimiento" (ads_read) sobre el activo del píxel.');
  process.exitCode = 1;
}
