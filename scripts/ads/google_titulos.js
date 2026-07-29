#!/usr/bin/env node
/**
 * Títulos de la campaña de Máximo Rendimiento al local.
 *
 * Por qué: la campaña que se lleva el 68% del gasto ($380.969/mes) tenía 11
 * títulos que decían QUÉ vende y ninguno que dijera POR QUÉ comprarle a Atelier.
 * Los ganchos comerciales (cuotas, descuento, envío) vivían en la campaña de
 * ventas, que casi no gasta.
 *
 * Datos confirmados por el usuario (29/7/2026):
 *   · 20% OFF en efectivo SOLO en el local. En la web es 15%. Por eso el título
 *     dice "en el local": la PMax combina los títulos como quiere y no se puede
 *     garantizar que aparezca solo con destino local.
 *   · 3 Y 6 cuotas sin interés (los avisos decían solo 3).
 *   · Garantía de adaptación: 90 días corridos.
 *
 * "Gafas" sale de esta campaña: en Argentina se dice anteojos. Se mantiene en
 * las campañas web, donde la búsqueda "gafas online" sí convierte.
 *
 * Editar títulos NO reinicia el aprendizaje: son recursos, no objetivos.
 *
 * Uso:
 *   node scripts/ads/google_titulos.js                       → dry run
 *   GOOGLE_ADS_ALLOW_WRITES=1 node scripts/ads/google_titulos.js --yes
 */

const { search, mutate, customerId } = require('./lib/google_client');

const CAMPANIA = 'Máximo rendimiento al local';
const MAX_HEADLINE = 30;

// No se saca ninguno: decisión del usuario (29/7). El tope de la PMax es 15
// títulos y hay 11, así que entran 4. Se eligen los que hoy faltan por completo:
// el descuento, las cuotas, la garantía y el laboratorio propio. "Armazón Vondel
// park Rudo" y los dos "Gafas" quedan ocupando lugar — al liberarlos entrarían
// "Anteojos y Lentes en Córdoba", "Mejor calificada en Córdoba" y
// "Anteojos recetados en Córdoba".
const SACAR = [];

// Títulos a sumar (≤30 caracteres, lo valida el script antes de mandar)
const SUMAR = [
  // Google RECHAZA por política los títulos con "OFF" + porcentaje
  // ("20% OFF en el local" y "15% OFF en efectivo" dan POLICY_FINDING
  // PROHIBITED). Con "descuento" pasa. Verificado con validateOnly.
  '20% de descuento en efectivo',
  '3 y 6 cuotas sin interés',
  'Garantía de adaptación 90 días',
  'Laboratorio propio',
];

async function main() {
  const aplicar = process.argv.includes('--yes');
  const cid = customerId();

  const rows = await search(`
    SELECT asset_group.id, asset_group.resource_name, asset_group_asset.resource_name,
           asset_group_asset.field_type, asset.text_asset.text
    FROM asset_group_asset
    WHERE asset_group_asset.status != 'REMOVED' AND campaign.name = '${CAMPANIA}'`);

  const titulos = rows.filter((r) => r.assetGroupAsset.fieldType === 'HEADLINE');
  const grupo = rows[0]?.assetGroup?.resourceName;
  if (!grupo) throw new Error(`No se encontró el grupo de recursos de "${CAMPANIA}"`);

  const existentes = new Set(titulos.map((r) => r.asset.textAsset.text.toLowerCase()));

  const largos = SUMAR.filter((t) => t.length > MAX_HEADLINE);
  if (largos.length) {
    throw new Error(`Estos títulos pasan los ${MAX_HEADLINE} caracteres: ${largos.map((t) => `"${t}" (${t.length})`).join(', ')}`);
  }

  const aSacar = SACAR
    .map(([texto, motivo]) => {
      const fila = titulos.find((r) => r.asset.textAsset.text === texto);
      return fila ? { texto, motivo, rn: fila.assetGroupAsset.resourceName } : null;
    })
    .filter(Boolean);

  const aSumar = SUMAR.filter((t) => !existentes.has(t.toLowerCase()));
  const quedan = titulos.length - aSacar.length + aSumar.length;

  console.log(`Campaña: ${CAMPANIA}`);
  console.log(`Títulos hoy: ${titulos.length}  →  después: ${quedan} (máximo 15)\n`);

  console.log('── SACAR ──');
  aSacar.forEach((x) => console.log(`  ✗ "${x.texto}"  — ${x.motivo}`));
  if (!aSacar.length) console.log('  (nada)');

  console.log('\n── SUMAR ──');
  aSumar.forEach((t) => console.log(`  ✓ "${t}"  (${t.length} car.)`));
  if (!aSumar.length) console.log('  (nada)');

  if (quedan > 15) throw new Error(`Quedarían ${quedan} títulos y el máximo es 15.`);
  if (!aSacar.length && !aSumar.length) return console.log('\nNada para hacer.');

  if (!aplicar) {
    console.log('\n(dry run — no se tocó nada. Para aplicar: GOOGLE_ADS_ALLOW_WRITES=1 node scripts/ads/google_titulos.js --yes)');
    return;
  }

  // 1) Crear los assets de texto
  let nuevos = [];
  if (aSumar.length) {
    const res = await mutate(
      'assets:mutate',
      { operations: aSumar.map((text) => ({ create: { textAsset: { text }, type: 'TEXT' } })) },
      { confirm: true },
    );
    nuevos = (res.results || []).map((r) => r.resourceName);
    console.log(`\nCreados ${nuevos.length} recursos de texto.`);
  }

  // 2) Vincular los nuevos y desvincular los que salen
  const ops = [
    ...nuevos.map((asset) => ({ create: { assetGroup: grupo, asset, fieldType: 'HEADLINE' } })),
    ...aSacar.map((x) => ({ remove: x.rn })),
  ];
  const res2 = await mutate('assetGroupAssets:mutate', { operations: ops }, { confirm: true });
  console.log(`✅ Aplicadas ${res2.results?.length ?? 0} operaciones (${nuevos.length} altas, ${aSacar.length} bajas).`);
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
