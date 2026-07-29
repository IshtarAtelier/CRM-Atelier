#!/usr/bin/env node
/**
 * Enlaces del sitio en la campaña de Máximo Rendimiento al local.
 *
 * El hallazgo: la cuenta tiene 15 enlaces buenos a nivel cuenta (/tienda,
 * /lentes-de-sol, /cristales-opticos, /arma-tus-lentes...), pero los enlaces
 * definidos EN una campaña ANULAN los de la cuenta. La PMax al local tenía dos
 * propios —WhatsApp y "Guía de Cómo Llegar"— así que el sitio no aparecía nunca
 * en la campaña que se lleva el 68% del gasto. Y "Cómo llegar" refuerza justo la
 * conversión falsa que estamos tratando de dejar de premiar.
 *
 * Además se corrige la barra final de dos enlaces: /clip-on/ y /cristales-opticos/
 * responden 308 y rebotan a la versión sin barra. En un aviso eso es un salto
 * de más.
 *
 * Nota: la API de Google Ads NO permite borrar assets (AssetService solo crea y
 * actualiza). Los enlaces basura de la tienda vieja —"Email Protection" (404 de
 * Cloudflare), "Mensuales" (ruta anidada de Tiendanube, 404), "Procuctos" (typo)
 * y "Ver Todos Los Productos"— quedan huérfanos en la biblioteca: no están a
 * nivel cuenta ni en ninguna campaña, así que no sirven. Para sacarlos de la
 * biblioteca hay que hacerlo desde la interfaz.
 *
 * Uso:
 *   node scripts/ads/google_enlaces.js                       → dry run
 *   GOOGLE_ADS_ALLOW_WRITES=1 node scripts/ads/google_enlaces.js --yes
 */

const { search, mutate } = require('./lib/google_client');

const CAMPANIA = 'Máximo rendimiento al local';

// Enlaces que queremos que aparezcan (texto exacto tal como está en la cuenta)
const QUEREMOS = [
  'Anteojos con Receta',
  'Lentes de sol',
  'Nuestros Cristales',
  'Cotizá tus Lentes',
  'Ver Todo En Clip On',
];

// Barra final que hace rebotar (308) → se limpia en el asset, sirve para todas
// las campañas que lo usan
const LIMPIAR_BARRA = {
  'Nuestros Cristales': 'https://atelieroptica.com.ar/cristales-opticos',
  'Ver Todo En Clip On': 'https://atelieroptica.com.ar/clip-on',
};

async function main() {
  const aplicar = process.argv.includes('--yes');

  const camp = await search(
    `SELECT campaign.id, campaign.resource_name FROM campaign WHERE campaign.name = '${CAMPANIA}'`,
  );
  const campaña = camp[0]?.campaign?.resourceName;
  if (!campaña) throw new Error(`No se encontró la campaña "${CAMPANIA}"`);

  const enCampania = await search(`
    SELECT campaign.name, asset.sitelink_asset.link_text FROM campaign_asset
    WHERE campaign_asset.status != 'REMOVED' AND campaign_asset.field_type = 'SITELINK'
      AND campaign.name = '${CAMPANIA}'`);
  const yaEstan = new Set(enCampania.map((r) => r.asset.sitelinkAsset?.linkText));

  const biblioteca = await search(
    `SELECT asset.resource_name, asset.sitelink_asset.link_text, asset.final_urls
     FROM asset WHERE asset.type = 'SITELINK'`,
  );
  const porTexto = new Map(biblioteca.map((r) => [r.asset.sitelinkAsset?.linkText, r.asset]));

  const aVincular = QUEREMOS.filter((t) => !yaEstan.has(t)).map((t) => {
    const a = porTexto.get(t);
    if (!a) throw new Error(`No existe el enlace "${t}" en la biblioteca`);
    return { texto: t, rn: a.resourceName, url: (a.finalUrls || [])[0] };
  });

  const aLimpiar = Object.entries(LIMPIAR_BARRA)
    .map(([texto, url]) => {
      const a = porTexto.get(texto);
      if (!a || (a.finalUrls || [])[0] === url) return null;
      return { texto, rn: a.resourceName, de: (a.finalUrls || [])[0], a: url };
    })
    .filter(Boolean);

  console.log(`Campaña: ${CAMPANIA}`);
  console.log(`Enlaces propios hoy: ${enCampania.length} (${[...yaEstan].join(', ')})\n`);

  console.log('── LIMPIAR BARRA FINAL ──');
  aLimpiar.forEach((x) => console.log(`  "${x.texto}"  ${x.de}  →  ${x.a}`));
  if (!aLimpiar.length) console.log('  (nada)');

  console.log('\n── VINCULAR A LA CAMPAÑA ──');
  aVincular.forEach((x) => console.log(`  "${x.texto}"  →  ${x.url}`));
  if (!aVincular.length) console.log('  (nada)');

  if (!aplicar) {
    return console.log('\n(dry run — para aplicar: GOOGLE_ADS_ALLOW_WRITES=1 node scripts/ads/google_enlaces.js --yes)');
  }

  if (aLimpiar.length) {
    await mutate(
      'assets:mutate',
      {
        operations: aLimpiar.map((x) => ({
          update: { resourceName: x.rn, finalUrls: [x.a] },
          updateMask: 'finalUrls',
        })),
      },
      { confirm: true },
    );
    console.log(`\n✅ Limpiados ${aLimpiar.length} enlaces con barra final.`);
  }

  if (aVincular.length) {
    const res = await mutate(
      'campaignAssets:mutate',
      {
        operations: aVincular.map((x) => ({
          create: { campaign: campaña, asset: x.rn, fieldType: 'SITELINK' },
        })),
      },
      { confirm: true },
    );
    console.log(`✅ Vinculados ${res.results?.length ?? 0} enlaces del sitio a la campaña.`);
  }
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
