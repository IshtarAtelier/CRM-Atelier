/**
 * Salud del Meta Pixel — SOLO LECTURA contra la Graph API.
 *
 * Muestra qué eventos recibió el píxel en los últimos 7 días (por hora agregada
 * a evento), para verificar que el Pixel del navegador y el Conversions API
 * están llegando de verdad a Meta. No modifica nada y JAMÁS imprime el token.
 *
 * Usa META_PIXEL_ID + META_ACCESS_TOKEN del .env (token de Ads: alcanza para
 * leer stats del píxel; NO sirve para publicar, ver CLAUDE.md).
 *
 * Correr:  node scripts/checks/pixel-salud.mjs
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

function leerEnv(nombre) {
  if (process.env[nombre]) return process.env[nombre];
  try {
    const env = readFileSync(path.join(process.cwd(), '.env'), 'utf8');
    const linea = env.split('\n').find((l) => l.startsWith(`${nombre}=`));
    if (!linea) return null;
    return linea.slice(nombre.length + 1).trim().replace(/^["']|["']$/g, '');
  } catch {
    return null;
  }
}

const PIXEL_ID = leerEnv('META_PIXEL_ID');
// Se prueban los tokens disponibles en orden: el primero que tenga permiso gana.
const TOKENS = [
  ['META_ACCESS_TOKEN', leerEnv('META_ACCESS_TOKEN')],
  ['META_ADS_TOKEN', leerEnv('META_ADS_TOKEN')],
  ['META_SYSTEM_USER_TOKEN', leerEnv('META_SYSTEM_USER_TOKEN')],
].filter(([, v]) => v);

if (!PIXEL_ID || !TOKENS.length) {
  console.error('Faltan META_PIXEL_ID o tokens de Meta en el .env');
  process.exit(1);
}

async function graph(ruta, token) {
  const sep = ruta.includes('?') ? '&' : '?';
  const res = await fetch(
    `https://graph.facebook.com/v24.0/${ruta}${sep}access_token=${encodeURIComponent(token)}`,
  );
  return res.json();
}

const desde = Math.floor(Date.now() / 1000) - 7 * 24 * 3600;

for (const [nombre, token] of TOKENS) {
  // 1) Metadatos del píxel: existe, nombre, último disparo.
  const info = await graph(`${PIXEL_ID}?fields=name,last_fired_time,is_unavailable`, token);
  if (info.error) {
    // El mensaje de error de Meta no incluye el token; imprimirlo es seguro.
    console.log(`[${nombre}] sin acceso a metadatos: ${info.error.message} (code ${info.error.code})`);
  } else {
    console.log(`[${nombre}] Pixel "${info.name}" (${PIXEL_ID})`);
    console.log(`  Último evento recibido: ${info.last_fired_time ?? 'NUNCA'}`);
    if (info.is_unavailable) console.log('  ⚠️ Meta lo marca como no disponible');
  }

  // 2) Stats por evento de los últimos 7 días.
  const stats = await graph(`${PIXEL_ID}/stats?aggregation=event&start_time=${desde}`, token);
  if (stats.error) {
    console.log(`[${nombre}] sin acceso a stats: ${stats.error.message} (code ${stats.error.code})`);
    continue;
  }
  const porEvento = new Map();
  for (const bloque of stats.data ?? []) {
    for (const fila of bloque.data ?? []) {
      porEvento.set(fila.value, (porEvento.get(fila.value) ?? 0) + fila.count);
    }
  }
  console.log(`  Eventos últimos 7 días:`);
  if (!porEvento.size) {
    console.log('    (ninguno — el píxel no está recibiendo NADA)');
  } else {
    for (const [evento, count] of [...porEvento.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${evento.padEnd(20)} ${count}`);
    }
  }
  break; // ya obtuvimos stats con este token
}
