/**
 * Corrige los recursos que Google rechazó el 25/9/2026 por "uso de mayúsculas":
 * los dos textos destacados con "OFF" y el sitelink "Traé tu receta", cuya
 * segunda línea también decía "20% OFF". Google no acepta una palabra entera
 * en mayúsculas que no sea marca ni sigla; "off" en minúscula pasa.
 *
 * ESCRIBE en la cuenta, en una sola transacción: crea los tres recursos con el
 * texto corregido, los vincula donde estaban los rechazados (cuenta para los
 * textos destacados, campaña Recetados para el sitelink) y desvincula los
 * rechazados. Los assets rechazados no se borran (quedan como historial).
 * No se editan en el lugar porque el texto de un recurso no es editable.
 *
 * Uso:
 *   node --env-file=.env scripts/maintenance/google-ads/corregir-mayusculas.cjs            → solo valida
 *   GOOGLE_ADS_ALLOW_WRITES=1 node --env-file=.env scripts/maintenance/google-ads/corregir-mayusculas.cjs --aplicar
 */
const { search, mutate, customerId } = require('../../ads/lib/google_client');

const APLICAR = process.argv.includes('--aplicar');
const ARREGLOS = {
  '20% OFF efectivo en local': '20% off efectivo en local',
  '15% OFF por transferencia': '15% off por transferencia',
};
const SITELINK_TEXTO = 'Traé tu receta';
const SITELINK_D2 = '20% off en efectivo en el local';

(async () => {
  const cid = customerId();
  const ops = [];
  let tmp = 0;

  // 1. Textos destacados a nivel cuenta.
  const callouts = await search(`SELECT customer_asset.resource_name, customer_asset.status, asset.resource_name, asset.callout_asset.callout_text, asset.policy_summary.approval_status FROM customer_asset WHERE customer_asset.field_type = 'CALLOUT' AND customer_asset.status = 'ENABLED'`);
  for (const r of callouts) {
    const viejo = r.asset.calloutAsset.calloutText;
    const nuevo = ARREGLOS[viejo];
    if (!nuevo) continue;
    console.log(`Texto destacado "${viejo}" (${r.asset.policySummary?.approvalStatus}) → "${nuevo}"`);
    tmp -= 1;
    const rn = `customers/${cid}/assets/${tmp}`;
    ops.push({ assetOperation: { create: { resourceName: rn, calloutAsset: { calloutText: nuevo } } } });
    ops.push({ customerAssetOperation: { create: { asset: rn, fieldType: 'CALLOUT' } } });
    ops.push({ customerAssetOperation: { remove: r.customerAsset.resourceName } });
  }

  // 2. Sitelink "Traé tu receta" en la campaña que lo tenga (Recetados).
  const links = await search(`SELECT campaign.id, campaign.name, campaign.status, campaign_asset.resource_name, campaign_asset.status, asset.resource_name, asset.final_urls, asset.sitelink_asset.link_text, asset.sitelink_asset.description1, asset.sitelink_asset.description2, asset.policy_summary.approval_status FROM campaign_asset WHERE campaign_asset.field_type = 'SITELINK' AND campaign_asset.status = 'ENABLED' AND campaign.status = 'ENABLED'`);
  for (const r of links) {
    const s = r.asset.sitelinkAsset;
    if (s.linkText !== SITELINK_TEXTO || !/OFF/.test(s.description2 || '')) continue;
    console.log(`Sitelink "${s.linkText}" en ${r.campaign.name} (${r.asset.policySummary?.approvalStatus}): línea 2 "${s.description2}" → "${SITELINK_D2}"`);
    tmp -= 1;
    const rn = `customers/${cid}/assets/${tmp}`;
    ops.push({ assetOperation: { create: { resourceName: rn, finalUrls: r.asset.finalUrls, sitelinkAsset: { linkText: s.linkText, description1: s.description1, description2: SITELINK_D2 } } } });
    ops.push({ campaignAssetOperation: { create: { campaign: `customers/${cid}/campaigns/${r.campaign.id}`, asset: rn, fieldType: 'SITELINK' } } });
    ops.push({ campaignAssetOperation: { remove: r.campaignAsset.resourceName } });
  }

  if (!ops.length) { console.log('Nada para corregir: no quedan recursos con "OFF" en mayúsculas.'); return; }
  console.log(`\n${APLICAR ? 'APLICANDO' : 'Solo validando (validateOnly)'}: ${ops.length} operaciones en una sola transacción…`);
  await mutate('googleAds:mutate', { mutateOperations: ops, partialFailure: false, validateOnly: !APLICAR }, { confirm: true });
  if (!APLICAR) { console.log('✅ Google aceptó la operación. No se cambió nada.'); return; }

  const ahora = await search(`SELECT asset.callout_asset.callout_text, customer_asset.status FROM customer_asset WHERE customer_asset.field_type = 'CALLOUT' AND customer_asset.status = 'ENABLED'`);
  console.log('✅ Aplicado. Textos destacados activos: ' + ahora.map((r) => `"${r.asset.calloutAsset.calloutText}"`).join(' · '));
  const sl = await search(`SELECT campaign.name, campaign.status, campaign_asset.status, asset.sitelink_asset.link_text, asset.sitelink_asset.description2 FROM campaign_asset WHERE campaign_asset.field_type = 'SITELINK' AND campaign_asset.status = 'ENABLED' AND campaign.status = 'ENABLED'`);
  for (const r of sl) if (r.asset.sitelinkAsset.linkText === SITELINK_TEXTO) console.log(`   ${r.campaign.name}: "${SITELINK_TEXTO}" línea 2 = "${r.asset.sitelinkAsset.description2}"`);
  console.log('Los recursos nuevos pasan por revisión de Google (suele tardar unas horas).');
})().catch((e) => { console.error('ERROR', e.message, e.guidance || ''); process.exit(1); });
