#!/usr/bin/env node
/**
 * Operaciones de ESCRITURA sobre Meta Ads: pausar/activar y presupuesto diario.
 *
 * Flujo obligatorio (ver scripts/ads/CLAUDE.md):
 *   1. El usuario confirma la operación puntual en la conversación.
 *   2. Sin --yes el script es DRY RUN: muestra estado actual → cambio propuesto
 *      y no toca nada (ni siquiera exige el token de escritura).
 *   3. Con --yes ejecuta, y solo si el comando trae META_ALLOW_WRITES=1 inline
 *      + META_ADS_WRITE_TOKEN en el entorno (el cliente rechaza sin eso).
 *
 * Uso:
 *   node scripts/ads/manage.js --status <id> PAUSED|ACTIVE [--yes]
 *   node scripts/ads/manage.js --daily-budget <id> <montoARS> [--yes]
 *
 * <id> puede ser una campaña, un conjunto (adset) o un anuncio (para --status).
 * El presupuesto diario aplica a campañas con presupuesto propio o a adsets.
 * Nunca reintenta: si falla de forma ambigua, VERIFICAR en Ads Manager.
 */

const { get, post, MetaApiError } = require('./lib/meta_client');

const fmt = (n) => Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 });

function usage(msg) {
  if (msg) console.error(msg);
  console.error(
    'Uso:\n' +
      '  node scripts/ads/manage.js --status <id> PAUSED|ACTIVE [--yes]\n' +
      '  node scripts/ads/manage.js --daily-budget <id> <montoARS> [--yes]',
  );
  process.exit(1);
}

async function main() {
  const argv = process.argv.slice(2);
  const execute = argv.includes('--yes');

  const statusIdx = argv.indexOf('--status');
  const budgetIdx = argv.indexOf('--daily-budget');
  if ((statusIdx > -1) === (budgetIdx > -1)) {
    usage('Indicar exactamente una operación: --status o --daily-budget.');
  }

  if (statusIdx > -1) {
    const id = argv[statusIdx + 1];
    const newStatus = (argv[statusIdx + 2] || '').toUpperCase();
    if (!id || !/^\d+$/.test(id)) usage('El id del objeto debe ser numérico (id de campaña/adset/anuncio de Meta).');
    if (!['PAUSED', 'ACTIVE'].includes(newStatus)) usage('El estado debe ser PAUSED o ACTIVE.');

    const current = await get(id, { fields: 'name,status,effective_status' });
    console.log(`\nObjeto: ${current.name} (${id})`);
    console.log(`Estado actual: ${current.status} (efectivo: ${current.effective_status})`);
    console.log(`Estado propuesto: ${newStatus}`);

    if (current.status === newStatus) {
      console.log('\nYa está en ese estado — nada que hacer.');
      return;
    }
    if (!execute) {
      console.log('\nDRY RUN: no se cambió nada. Repetir con --yes (y META_ALLOW_WRITES=1 inline) para ejecutar.');
      return;
    }
    await post(id, { status: newStatus }, { confirm: true });
    console.log(`\n✓ Estado cambiado a ${newStatus}. Registrado en meta_api.log.`);
    return;
  }

  const id = argv[budgetIdx + 1];
  const rawAmount = argv[budgetIdx + 2] || '';
  if (!id || !/^\d+$/.test(id)) usage('El id de la campaña/adset debe ser numérico.');
  // Solo dígitos: "50.000" en JS es 50 (punto decimal), no cincuenta mil — un
  // monto es-AR con separador de miles bajaría el presupuesto 1000×.
  if (!/^\d+$/.test(rawAmount)) {
    usage(`El monto va en pesos enteros SIN puntos ni comas (recibido: "${rawAmount}"). Ej: 50000 para $50.000.`);
  }
  const amountArs = Number(rawAmount);
  if (amountArs <= 0) usage('El monto debe ser mayor que cero.');

  const current = await get(id, { fields: 'name,status,daily_budget' });
  const currentArs = Number(current.daily_budget || 0) / 100; // Meta usa centavos
  console.log(`\nObjeto: ${current.name} (${id}) — estado ${current.status}`);
  console.log(`Presupuesto diario actual: $${fmt(currentArs)}`);
  console.log(`Presupuesto diario propuesto: $${fmt(amountArs)}`);

  if (!current.daily_budget) {
    console.log(
      '\n⚠ Este objeto no tiene daily_budget propio (¿presupuesto a nivel campaña/CBO o lifetime?). ' +
        'Verificar en Ads Manager dónde vive el presupuesto antes de tocar nada.',
    );
    return;
  }
  if (!execute) {
    console.log('\nDRY RUN: no se cambió nada. Repetir con --yes (y META_ALLOW_WRITES=1 inline) para ejecutar.');
    return;
  }
  await post(id, { daily_budget: String(Math.round(amountArs * 100)) }, { confirm: true });
  console.log(`\n✓ Presupuesto diario cambiado a $${fmt(amountArs)}. Registrado en meta_api.log.`);
}

main().catch((e) => {
  const msg = e instanceof MetaApiError ? `${e.message}\n${e.guidance}` : e.message;
  console.error(`\n✗ ${msg}`);
  process.exit(1);
});
