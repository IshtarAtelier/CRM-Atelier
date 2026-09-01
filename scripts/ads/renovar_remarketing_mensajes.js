/**
 * Renovación de los creatives del conjunto de REMARKETING (120250649502760023)
 * de la campaña "Mensajes ✉️" (auditoría 31/8/2026).
 *
 * QUÉ ARREGLA:
 *  - [placaResenas] decía "675 reseñas" (hoy son 700+) y estaba pausado.
 *  - [metaSiguenImg] y [metaCuotasImg] decían "20% en efectivo" (condición
 *    vieja) y no mencionaban las 12 cuotas.
 *  - Redacción vigente (Ishtar, 31/8 noche): "3 y 6 cuotas sin interés, y
 *    hasta 12 cuotas fijas" — nunca el %, nunca "sin interés" para las 12,
 *    y sin "con Mercado Pago" (misma fórmula que el barrido de generadores).
 *
 * QUÉ HACE (los creatives son inmutables: se crea uno nuevo por anuncio y se
 * apunta el anuncio existente ahí — conserva id, historial y atribución):
 *  1. Sube las 12 placas nuevas (3 familias × 4 formatos) desde public/social/.
 *  2. Por cada familia, clona el asset_feed_spec del creative actual (mismas
 *     reglas de ubicación por formato y mismo welcome message [MetaRMK]) con
 *     las imágenes y textos nuevos.
 *  3. Apunta cada anuncio a su creative nuevo; activa los dos que estaban
 *     pausados y renombra el de reseñas (decía "675").
 *  4. Pausa [metaBuscanosImg] (US$0,77 sin chats; manda a Google en vez de
 *     conversar). [metaFridaCuotas] queda como está: es el único con chats.
 *
 * Los anuncios re-apuntados vuelven a revisión de Meta: es esperable.
 *
 * USO:
 *   node -r dotenv/config scripts/ads/renovar_remarketing_mensajes.js          → dry run
 *   META_ALLOW_WRITES=1 META_AD_ACCOUNT_ID=act_2107444353167176 \
 *     node -r dotenv/config scripts/ads/renovar_remarketing_mensajes.js --yes
 */
const fs = require('node:fs');
const path = require('node:path');
const c = require('./lib/meta_client.js');

const RAIZ = path.join(__dirname, '..', '..');
const jpeg = (pieza) => path.join(RAIZ, 'public', 'social', pieza, '01.jpg');

// Cada familia: el anuncio existente, su creative actual (plantilla del clon),
// las 4 placas nuevas por etiqueta de formato, y los textos nuevos.
const FAMILIAS = [
  {
    ad: '120250650090010023', // [placaResenas] — pausado, decía 675
    creativeViejo: '3625737997594342',
    nombreNuevo: '[placaResenas] Más de 700 reseñas 5 estrellas',
    activar: true,
    imagenes: {
      cuadrado: jpeg('ad-l2-calificacion-cuadrado'),
      feed45: jpeg('ad-l2-calificacion'),
      story916: jpeg('ad-l2-calificacion-story'),
      apaisado: jpeg('ad-l2-calificacion-apaisado'),
    },
    body: '★ 5,0 con más de 700 reseñas en Google. “Volví a elegirlos porque la calidad es realmente impecable. Los anteojos multifocales son hermosos y de primera.” — Claudia S. Escribinos por WhatsApp y comprobalo.',
    title: '★ 5,0 en Google — más de 700 reseñas',
  },
  {
    ad: '120250649504270023', // [metaSiguenImg] — activo, condición vieja
    creativeViejo: '1001675992939254',
    activar: false, // ya está activo
    imagenes: {
      cuadrado: jpeg('ad-l2-siguen-aca-cuadrado'),
      feed45: jpeg('ad-l2-siguen-aca'),
      story916: jpeg('ad-l2-siguen-aca-story'),
      apaisado: jpeg('ad-l2-siguen-aca-apaisado'),
    },
    body: 'Esos lentes que estuviste mirando siguen acá. 3 y 6 cuotas sin interés, hasta 12 cuotas fijas, o 15% en efectivo o transferencia. Pasá por el Cerro sin turno, o escribinos por WhatsApp.',
    title: 'Esos lentes que viste siguen acá',
  },
  {
    ad: '120250649503190023', // [metaCuotasImg] — pausado, "20% en efectivo"
    creativeViejo: '1676510056756083',
    activar: true,
    imagenes: {
      cuadrado: jpeg('ad-l2-numeros-que-cierran-cuadrado'),
      feed45: jpeg('ad-l2-numeros-que-cierran'),
      story916: jpeg('ad-l2-numeros-que-cierran-story'),
      apaisado: jpeg('ad-l2-numeros-que-cierran-apaisado'),
    },
    body: 'Ya los viste. Ahora los números: 3 y 6 cuotas sin interés con tarjeta, hasta 12 cuotas fijas, o 15% de descuento en efectivo o transferencia. Lunes a sábado, sin turno previo. Escribinos por WhatsApp.',
    title: 'Elegí cómo pagarlos',
  },
];

const AD_BUSCANOS = '120250679485260023'; // [metaBuscanosImg] → pausar

/** El asset_feed_spec del creative viejo, listo para crear el nuevo. */
function clonarSpec(spec, familia, hashesPorEtiqueta) {
  const nuevo = JSON.parse(JSON.stringify(spec));
  // Las etiquetas se citan por nombre; los ids del creative viejo no viajan.
  nuevo.images = Object.entries(hashesPorEtiqueta).map(([etiqueta, hash]) => ({
    hash,
    adlabels: [{ name: etiqueta }],
  }));
  for (const regla of nuevo.asset_customization_rules || []) {
    if (regla.image_label) regla.image_label = { name: regla.image_label.name };
  }
  nuevo.bodies = [{ text: familia.body }];
  nuevo.titles = [{ text: familia.title }];
  return nuevo;
}

(async () => {
  const yes = process.argv.includes('--yes');
  const acct = c.accountId();

  console.log('== PLAN ==');
  for (const f of FAMILIAS) {
    console.log(`Anuncio ${f.ad}: creative nuevo (4 placas + texto vigente)` +
      (f.activar ? ' y ACTIVAR' : '') + (f.nombreNuevo ? ` y renombrar a "${f.nombreNuevo}"` : ''));
    console.log('   BODY:', f.body.slice(0, 90) + '…');
  }
  console.log(`Pausar [metaBuscanosImg]: ${AD_BUSCANOS} (sin chats, manda a Google)`);
  console.log('[metaFridaCuotas] queda ACTIVO como está (único con chats).');

  for (const f of FAMILIAS) {
    for (const ruta of Object.values(f.imagenes)) {
      if (!fs.existsSync(ruta)) throw new Error(`Falta la placa ${ruta} — renderizar primero.`);
    }
  }
  if (!yes) { console.log('\nDRY RUN — nada tocado. Ejecutar con --yes + META_ALLOW_WRITES=1.'); return; }

  for (const f of FAMILIAS) {
    // 1. Subir las 4 placas de la familia.
    const hashes = {};
    for (const [etiqueta, ruta] of Object.entries(f.imagenes)) {
      const r = await c.post(`/${acct}/adimages`, { bytes: fs.readFileSync(ruta).toString('base64') }, { confirm: true });
      const primera = Object.values(r.images || {})[0];
      if (!primera?.hash) throw new Error(`Sin hash para ${ruta}`);
      hashes[etiqueta] = primera.hash;
      console.log(`✓ ${path.basename(path.dirname(ruta))} → ${primera.hash.slice(0, 12)}…`);
    }

    // 2. Clonar el spec del creative viejo con placas y textos nuevos.
    const viejo = await c.get(`/${f.creativeViejo}`, { fields: 'object_story_spec,asset_feed_spec' });
    const creative = await c.post(`/${acct}/adcreatives`, {
      name: `${f.title} ${new Date().toISOString().slice(0, 10)}`,
      object_story_spec: JSON.stringify({
        page_id: viejo.object_story_spec.page_id,
        instagram_user_id: viejo.object_story_spec.instagram_user_id,
      }),
      asset_feed_spec: JSON.stringify(clonarSpec(viejo.asset_feed_spec, f, hashes)),
    }, { confirm: true });
    console.log('✓ Creative nuevo:', creative.id);

    // 3. Apuntar el anuncio (y activar/renombrar si corresponde).
    const cambios = { creative: JSON.stringify({ creative_id: creative.id }) };
    if (f.activar) cambios.status = 'ACTIVE';
    if (f.nombreNuevo) cambios.name = f.nombreNuevo;
    await c.post(`/${f.ad}`, cambios, { confirm: true });
    console.log(`✓ Anuncio ${f.ad} apuntado al creative nuevo${f.activar ? ' y ACTIVO' : ''} (vuelve a revisión)`);
  }

  // 4. Pausar el que no conversa.
  await c.post(`/${AD_BUSCANOS}`, { status: 'PAUSED' }, { confirm: true });
  console.log('✓ [metaBuscanosImg] pausado');

  const check = await c.getAllPages('/120250649502760023/ads', { fields: 'id,name,effective_status', limit: 50 });
  console.log('\nEstado final del conjunto:');
  for (const ad of check) console.log(`  ${ad.effective_status.padEnd(15)} ${ad.name}`);
})().catch((e) => { console.error('ERROR:', e.message, e.guidance || ''); process.exit(1); });
