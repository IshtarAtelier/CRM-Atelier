#!/usr/bin/env node
/**
 * Borra las campañas de Meta que quedaron en desuso (OK de Ishtar 28/9/26:
 * "fijate cuáles están en desuso ... las eliminás"). Solo borra si la campaña
 * está pausada o archivada: una activa no se toca. El historial de gasto queda
 * en los informes; una campaña borrada no se recupera.
 *
 * De a una, con 20 s de pausa (la cuenta se maneja muy por debajo del límite).
 *
 *   node scripts/ads/borrar_campanias_muertas.js                  → dry run
 *   META_ALLOW_WRITES=1 node scripts/ads/borrar_campanias_muertas.js --yes
 */
require('dotenv').config({ quiet: true });
const { get, post } = require('./lib/meta_client');

const MUERTAS = [
  '120250804098450023', // [REEMPLAZADA 28/8 - no encender] Coleccion | Catalogo Tienda
  '120248915218510023', // Campaña de Tráfico en Instagram (pausada desde 28/7)
  '120250902617630023', // Remarketing | Tienda (archivada, nunca gastó)
  '120250840537910023', // Campaña de Ventas Tienda Web (archivada, nunca gastó)
  '120251235949780023', // Compras | Catalogo Tienda (reemplazada por Ventas | Tienda online)
];
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const aplicar = process.argv.includes('--yes');
  for (const id of MUERTAS) {
    const c = await get(id, { fields: 'name,effective_status' });
    if (!['PAUSED', 'ARCHIVED'].includes(c.effective_status)) { console.log(`✋ no se toca (está ${c.effective_status}): ${c.name}`); continue; }
    if (!aplicar) { console.log(`→ borraría: ${c.name}`); continue; }
    await post(id, { status: 'DELETED' }, { confirm: true });
    console.log(`✓ borrada: ${c.name}`);
    await esperar(20000);
  }
  console.log(aplicar ? '\n✅ Listo: campañas viejas borradas.' : '\nDRY RUN: repetir con --yes (y META_ALLOW_WRITES=1 inline).');
}

main().catch((e) => { console.error(`✗ ${e.message}`); process.exit(1); });
