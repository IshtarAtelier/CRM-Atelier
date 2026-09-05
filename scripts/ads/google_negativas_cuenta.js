#!/usr/bin/env node
/**
 * Engancha la lista de negativas "General" a NIVEL DE CUENTA.
 *
 * Por qué (5/9/2026): la campaña "Google Maps" es INTELIGENTE (SMART) y la API
 * rechaza tanto vincularle una lista compartida (MUTATE_NOT_ALLOWED) como
 * cargarle negativas propias (OPERATION_NOT_PERMITTED_FOR_CONTEXT). Era la de
 * mayor presupuesto activo y la que generaba las llamadas de gente que buscaba
 * oftalmología, y quedaba fuera de toda la limpieza.
 *
 * Una negativa de CUENTA aplica a TODAS las campañas, incluidas las
 * inteligentes. Es el único camino que las alcanza sin entrar al panel a mano.
 *
 * Uso:
 *   node scripts/ads/google_negativas_cuenta.js            → dry run
 *   GOOGLE_ADS_ALLOW_WRITES=1 node scripts/ads/google_negativas_cuenta.js --yes
 */
const { search, mutate, customerId } = require('./lib/google_client');

const SHARED_SET_ID = process.env.GOOGLE_ADS_NEGATIVE_SET_ID || '11042611019';

async function main() {
  const aplicar = process.argv.includes('--yes');
  const cid = customerId();

  // Google exige que la lista de nivel de cuenta sea de tipo
  // ACCOUNT_LEVEL_NEGATIVE_KEYWORDS. La lista "General" es de tipo
  // NEGATIVE_KEYWORDS (de campaña) y la API la rechaza con
  // NEGATIVE_KEYWORD_SHARED_SET_DOES_NOT_EXIST. Así que se crea una lista
  // hermana de cuenta y se le copian los mismos términos.
  const NOMBRE_CUENTA = 'General (cuenta)';
  const [set] = await search(
    `SELECT shared_set.name, shared_set.member_count, shared_set.type FROM shared_set WHERE shared_set.id = ${SHARED_SET_ID}`,
  );

  console.log(`Lista "${set.sharedSet.name}" · ${set.sharedSet.memberCount} negativas`);
  console.log('Se copia a una lista de CUENTA, que aplica a TODAS las campañas,');
  console.log('incluida "Google Maps", que es inteligente y no acepta negativas de otra forma.');

  if (!aplicar) {
    console.log('\n(dry run — no se tocó nada. Para aplicar: GOOGLE_ADS_ALLOW_WRITES=1 node scripts/ads/google_negativas_cuenta.js --yes)');
    return;
  }

  // 1. La lista de cuenta: se reusa si ya existe.
  let [cuentaSet] = await search(
    `SELECT shared_set.id, shared_set.resource_name FROM shared_set
     WHERE shared_set.type = 'ACCOUNT_LEVEL_NEGATIVE_KEYWORDS' AND shared_set.status != 'REMOVED'`,
  );
  let cuentaRes = cuentaSet?.sharedSet?.resourceName;
  if (!cuentaRes) {
    const r = await mutate('sharedSets:mutate', {
      operations: [{ create: { name: NOMBRE_CUENTA, type: 'ACCOUNT_LEVEL_NEGATIVE_KEYWORDS' } }],
    }, { confirm: true });
    cuentaRes = r?.results?.[0]?.resourceName;
    console.log(`  lista de cuenta creada: ${cuentaRes}`);
  } else {
    console.log(`  lista de cuenta ya existía: ${cuentaRes}`);
  }

  // 2. Copiarle los términos que le falten (tope de Google: 1.000 por lista).
  const origen = await search(
    `SELECT shared_criterion.keyword.text, shared_criterion.keyword.match_type
     FROM shared_criterion WHERE shared_set.id = ${SHARED_SET_ID} LIMIT 5000`,
  );
  const destino = new Set(
    (await search(
      `SELECT shared_criterion.keyword.text, shared_criterion.keyword.match_type
       FROM shared_criterion WHERE shared_set.resource_name = '${cuentaRes}' LIMIT 5000`,
    )).map((r) => `${String(r.sharedCriterion.keyword.text).toLowerCase()}|${r.sharedCriterion.keyword.matchType}`),
  );
  const faltan = origen
    .map((r) => [r.sharedCriterion.keyword.text, r.sharedCriterion.keyword.matchType])
    .filter(([t, m]) => !destino.has(`${String(t).toLowerCase()}|${m}`))
    .slice(0, 1000 - destino.size);
  console.log(`  términos a copiar: ${faltan.length}`);
  for (let i = 0; i < faltan.length; i += 500) {
    const operations = faltan.slice(i, i + 500).map(([text, matchType]) => ({
      create: { sharedSet: cuentaRes, keyword: { text, matchType } },
    }));
    const r = await mutate('sharedCriteria:mutate', { operations }, { confirm: true });
    console.log(`    lote ${i / 500 + 1}: ${r?.results?.length ?? 0}`);
  }

  // 3. Engancharla a la cuenta.
  const yaEngan = (
    await search(`SELECT customer_negative_criterion.negative_keyword_list.shared_set FROM customer_negative_criterion`)
  ).some((r) => r.customerNegativeCriterion?.negativeKeywordList?.sharedSet === cuentaRes);
  if (yaEngan) {
    console.log('\n✅ Ya estaba enganchada a la cuenta. Términos actualizados.');
    return;
  }
  const res = await mutate(
    'customerNegativeCriteria:mutate',
    { operations: [{ create: { negativeKeywordList: { sharedSet: cuentaRes } } }] },
    { confirm: true },
  );
  console.log(`\n✅ Lista enganchada a nivel de cuenta (${res?.results?.[0]?.resourceName || 'ok'}). Aplica a TODAS las campañas, Maps incluida.`);
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
