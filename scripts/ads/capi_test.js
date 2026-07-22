#!/usr/bin/env node
/**
 * Prueba de extremo a extremo del Conversions API de Meta.
 *
 * Manda un evento Purchase con la MISMA forma que arma AdsService en el
 * checkout (mismos campos de user_data y custom_data), pero con
 * `test_event_code`: Meta lo muestra solo en la pestaña "Probar eventos" del
 * Administrador de eventos y NO entra en los datos reales del píxel, así que
 * no ensucia las conversiones ni confunde al algoritmo.
 *
 * Uso (el código de prueba se saca del Administrador de eventos):
 *   META_ALLOW_WRITES=1 META_ADS_WRITE_TOKEN=<token de conversiones> \
 *   META_PIXEL_ID=<id> node scripts/ads/capi_test.js TEST12345
 *
 * Sirve para responder "¿el token anda?" sin esperar a que caiga una venta.
 */

const crypto = require('crypto');
const { post, MetaApiError } = require('./lib/meta_client');

const sha256 = (v) => crypto.createHash('sha256').update(String(v).trim().toLowerCase()).digest('hex');

async function main() {
  const testCode = process.argv[2];
  if (!testCode || !/^TEST\w+$/i.test(testCode)) {
    console.error('Falta el código de prueba. Ej: node scripts/ads/capi_test.js TEST12345');
    process.exit(1);
  }
  const pixelId = process.env.META_PIXEL_ID;
  if (!pixelId) {
    console.error('Falta META_PIXEL_ID en el entorno.');
    process.exit(1);
  }

  // Datos deliberadamente falsos: es una prueba, no puede llevar PII real.
  const event = {
    event_name: 'Purchase',
    event_time: Math.floor(Date.now() / 1000),
    action_source: 'website',
    event_id: `capi-test-${Date.now()}`,
    event_source_url: 'https://atelieroptica.com.ar/checkout',
    user_data: {
      em: [sha256('prueba.capi@atelieroptica.com.ar')],
      ph: [sha256('5490000000000')],
      client_user_agent: 'atelier-capi-test/1.0',
    },
    custom_data: {
      currency: 'ARS',
      value: 1,
      order_id: `PRUEBA-${Date.now()}`,
    },
  };

  const res = await post(
    `${pixelId}/events`,
    { data: JSON.stringify([event]), test_event_code: testCode },
    { confirm: true },
  );

  if (res.events_received >= 1) {
    console.log(`✓ Meta recibió el evento (events_received: ${res.events_received}).`);
    console.log(`  Verlo en: Administrador de eventos → píxel ${pixelId} → Probar eventos (código ${testCode}).`);
    console.log(`  event_id de esta prueba: ${event.event_id}`);
  } else {
    console.log('Respuesta inesperada:', JSON.stringify(res));
  }
}

main().catch((e) => {
  console.error(`✗ ${e instanceof MetaApiError ? `${e.message}\n${e.guidance}` : e.message}`);
  process.exit(1);
});
