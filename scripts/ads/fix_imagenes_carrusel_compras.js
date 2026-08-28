/**
 * Cambia la imagen del anuncio "Carrusel cuotas - Compras" (campaña nueva
 * 120251235949780023) por imágenes que venden:
 *  - Tarjeta 1: la placa de 12 cuotas (clienta eligiendo armazones EN el local,
 *    con el mensaje "Ahora hasta 12 cuotas" en la gráfica propia).
 *  - Tarjeta 2: armazones reales del estante (anteojos-rosa-pastel).
 *  - Tarjeta 3: dinámica del catálogo (el producto la pone Meta).
 * La tarjeta estática anterior reusaba el hash viejo de la campaña original.
 *
 * Los creatives son inmutables: se crea uno nuevo y se apunta el anuncio ahí
 * (vuelve a revisión, ya estaba en PENDING_REVIEW — no pierde nada).
 *
 * USO:
 *   META_ALLOW_WRITES=1 META_APP_SECRET= META_AD_ACCOUNT_ID=act_2107444353167176 \
 *     node -r dotenv/config scripts/ads/fix_imagenes_carrusel_compras.js --yes
 */
const fs = require('node:fs');
const c = require('./lib/meta_client.js');

const AD_CARRUSEL = '120251236028020023';
const PRODUCT_SET = '1743674383421832';
const PAGE_ID = '112571191818391';
const IG_USER = '17841458761171093';
const LINK = 'https://atelieroptica.com.ar/tienda';
const URL_TAGS = 'utm_source=meta&utm_medium=paid&utm_campaign={{campaign.id}}&utm_content={{ad.id}}';

const IMAGENES = [
  { archivo: 'public/social/campania-12-pagos-cuadrado/01.jpg', nombre: 'placa-12-cuotas-1080' },
  { archivo: 'public/images/blog/anteojos-rosa-pastel.jpg', nombre: 'armazones-estante' },
];

(async () => {
  const yes = process.argv.includes('--yes');
  const acct = c.accountId();
  console.log('== PLAN ==');
  console.log('Subir', IMAGENES.length, 'imágenes y recrear el creative del anuncio', AD_CARRUSEL);
  if (!yes) { console.log('DRY RUN — nada tocado.'); return; }

  const hashes = [];
  for (const img of IMAGENES) {
    const bytes = fs.readFileSync(img.archivo).toString('base64');
    const r = await c.post(`/${acct}/adimages`, { bytes }, { confirm: true });
    const primera = Object.values(r.images || {})[0];
    if (!primera?.hash) throw new Error(`Sin hash para ${img.archivo}`);
    hashes.push(primera.hash);
    console.log('✓ Imagen subida:', img.nombre, '→', primera.hash.slice(0, 12) + '…');
  }

  const creative = await c.post(`/${acct}/adcreatives`, {
    name: `Carrusel cuotas ${new Date().toISOString().slice(0, 10)} (placa 12 cuotas + estante)`,
    product_set_id: PRODUCT_SET,
    url_tags: URL_TAGS,
    object_story_spec: JSON.stringify({
      page_id: PAGE_ID,
      instagram_user_id: IG_USER,
      template_data: {
        link: LINK,
        message: '👓 Tus próximos lentes están en Atelier Óptica\n💳 6 cuotas sin interés · hasta 12 cuotas con Mercado Pago\n🎁 Envío gratis a todo el país 🇦🇷',
        call_to_action: { type: 'SHOP_NOW' },
        child_attachments: [
          { link: LINK, image_hash: hashes[0], name: 'Ahora hasta 12 cuotas con Mercado Pago', call_to_action: { type: 'SHOP_NOW' }, static_card: true },
          { link: LINK, image_hash: hashes[1], name: '6 cuotas sin interés + envío gratis', call_to_action: { type: 'SHOP_NOW' }, static_card: true },
          { link: LINK, call_to_action: { type: 'SHOP_NOW' } },
        ],
        multi_share_end_card: false,
        format_option: 'carousel_images_multi_items',
      },
    }),
  }, { confirm: true });
  console.log('✓ Creative nuevo:', creative.id);

  await c.post(`/${AD_CARRUSEL}`, { creative: JSON.stringify({ creative_id: creative.id }) }, { confirm: true });
  console.log('✓ Anuncio apuntado al creative nuevo (vuelve a revisión, ya estaba ahí)');
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
