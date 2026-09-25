/**
 * Hace que los sitelinks que van al WhatsApp también manden el id del clic.
 * ESCRIBE en la cuenta: actualiza EN EL LUGAR la URL final de esos sitelinks
 * (no crea assets nuevos, no toca campañas).
 *
 * Cómo: al mensaje prellenado se le agrega ` [gclid:{gclid}]`. `{gclid}` es un
 * ValueTrack: Google lo reemplaza por el id real en el momento del clic. Si
 * alguna vez no lo reemplazara, queda el literal con llaves, que el parser
 * ignora y stripAdTags limpia (ver ad-tag-core.ts). La landing hace lo mismo
 * por su lado (wa-attribution.ts); esto cubre los clics que van derecho al
 * chat sin pasar por la landing.
 *
 * Uso:
 *   node --env-file=.env scripts/maintenance/google-ads/sitelinks-agregar-gclid.cjs            → solo valida
 *   GOOGLE_ADS_ALLOW_WRITES=1 node --env-file=.env scripts/maintenance/google-ads/sitelinks-agregar-gclid.cjs --aplicar
 */
const { search, mutate } = require('../../ads/lib/google_client');

const APLICAR = process.argv.includes('--aplicar');
// `{gclid}` va con llaves LITERALES: Google solo reemplaza el ValueTrack así.
// El 25/9/2026 se aplicó codificado (%7Bgclid%7D) y ningún clic llegaba al
// mensaje; el resto del texto sí va codificado.
const SUFIJO = encodeURIComponent(' [gclid:') + '{gclid}' + encodeURIComponent(']');
const CODIFICADO = /%20%5Bgclid%3A%7Bgclid%7D%5D$/i;

(async () => {
  const filas = await search(
    `SELECT campaign.name, campaign.status, campaign_asset.status, asset.resource_name, asset.sitelink_asset.link_text, asset.final_urls
     FROM campaign_asset WHERE campaign_asset.field_type = 'SITELINK' AND campaign_asset.status = 'ENABLED' AND campaign.status = 'ENABLED'`,
  );
  const vistos = new Set();
  const ops = [];
  for (const r of filas) {
    const rn = r.asset.resourceName;
    if (vistos.has(rn)) continue;
    vistos.add(rn);
    const url = (r.asset.finalUrls || [])[0] || '';
    if (!/wa\.me/.test(url)) { console.log(`  (${r.campaign.name}) "${r.asset.sitelinkAsset.linkText}": no va al WhatsApp, no se toca`); continue; }
    if (/\{gclid\}/.test(url)) { console.log(`  (${r.campaign.name}) "${r.asset.sitelinkAsset.linkText}": ya manda el clic`); continue; }
    // Si quedó la versión codificada, se reemplaza; si no hay nada, se agrega.
    const nueva = CODIFICADO.test(url) ? url.replace(CODIFICADO, SUFIJO) : url + SUFIJO;
    console.log(`  (${r.campaign.name}) "${r.asset.sitelinkAsset.linkText}"\n     antes:   …${url.slice(-45)}\n     después: …${nueva.slice(-45)}`);
    ops.push({ update: { resourceName: rn, finalUrls: [nueva] }, updateMask: 'final_urls' });
  }
  if (!ops.length) { console.log('Nada para cambiar.'); return; }
  console.log(`\n${APLICAR ? 'APLICANDO' : 'Solo validando (validateOnly)'}: ${ops.length} sitelinks…`);
  await mutate('assets:mutate', { operations: ops, partialFailure: false, validateOnly: !APLICAR }, { confirm: true });
  if (!APLICAR) { console.log('✅ Google aceptó la operación. No se cambió nada.'); return; }
  const despues = await search(`SELECT asset.resource_name, asset.final_urls FROM asset WHERE asset.resource_name IN (${[...vistos].map((v) => `'${v}'`).join(',')})`);
  const conClic = despues.filter((r) => /\{gclid\}/.test((r.asset.finalUrls || [])[0] || '')).length;
  console.log(`✅ Aplicado. VERIFICACIÓN: ${conClic} de ${despues.length} sitelinks mandan el clic.`);
})().catch((e) => { console.error('ERROR', e.message, e.guidance || ''); process.exit(1); });
