/**
 * ¿De verdad guardamos de dónde vino un cliente de Meta si borra el mensajito?
 *
 * Camino real completo: payload de la Cloud API con `referral` → normalize()
 * del webhook → persistInbound() → base. El mensaje de la prueba NO trae la
 * etiqueta [metaXxx] a propósito: simula al cliente que borra el texto
 * precargado y escribe lo suyo, que es el caso que hasta el 16/9/2026 nos
 * dejaba sin saber de qué anuncio vino.
 *
 * Uso: npm run check:referral   (necesita docker compose up -d db)
 */
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:localpassword@localhost:5432/atelier';
process.env.CRM_API_URL = 'http://localhost:9/nada';   // que no haya alta de ficha real

// ESCRIBE (crea un chat de prueba y lo borra). Solo contra la base LOCAL: si la
// URL no es localhost, se niega. Nunca correr esto contra producción.
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL)) {
    console.error('Este check escribe: solo corre contra la base local. Abortado.');
    process.exit(1);
}
const { normalize } = require('../../wa-service/transport/webhook');
const { persistInbound } = require('../../wa-service/transport/inbound');
const { prisma } = require('../../wa-service/db');

const TEL = '5493510000777';
const AD_ID = '120250350194950023';
const CLID = 'AbCdEf_prueba_clid_123';

const payload = {
  object: 'whatsapp_business_account',
  entry: [{ id: '1', changes: [{ field: 'messages', value: {
    metadata: { phone_number_id: '111' },
    contacts: [{ wa_id: TEL, profile: { name: 'Prueba Referral' } }],
    messages: [{
      from: TEL, id: 'wamid.PRUEBA_' + Date.now(), timestamp: String(Math.floor(Date.now()/1000)),
      type: 'text',
      // El cliente BORRÓ el mensajito precargado y escribió lo suyo:
      text: { body: 'Hola, cuánto sale un multifocal?' },
      referral: {
        source_url: 'https://fb.me/xyz', source_id: AD_ID, source_type: 'ad',
        headline: 'Multifocales en cuotas', body: 'Vení a probártelos',
        media_type: 'image', ctwa_clid: CLID,
      },
    }],
  }}]}],
};

(async () => {
  const { messages } = normalize(payload);
  console.log(`normalize → ${messages.length} mensaje(s); referral presente: ${Boolean(messages[0].referral)}`);
  await persistInbound(messages[0], {});
  const chat = await prisma.whatsAppChat.findUnique({
    where: { waId: TEL },
    select: { adTag: true, adSourceId: true, adSourceType: true, adCtwaClid: true, adHeadline: true, adSourceUrl: true, adReferralAt: true },
  });
  console.log('\nGuardado en el chat:');
  console.log(`  adTag        : ${chat.adTag}`);
  console.log(`  adSourceId   : ${chat.adSourceId}`);
  console.log(`  adSourceType : ${chat.adSourceType}`);
  console.log(`  adCtwaClid   : ${chat.adCtwaClid}`);
  console.log(`  adHeadline   : ${chat.adHeadline}`);
  console.log(`  adReferralAt : ${chat.adReferralAt && chat.adReferralAt.toISOString()}`);
  const ok = chat.adSourceId === AD_ID && chat.adCtwaClid === CLID;
  console.log(`\n${ok ? '✅' : '❌'} el id del anuncio ${ok ? 'quedó guardado aunque el texto no traía etiqueta' : 'NO se guardó'}`);
  // limpieza: es la base local, pero no dejamos basura
  const ch = await prisma.whatsAppChat.findUnique({ where: { waId: TEL }, select: { id: true, clientId: true } });
  await prisma.whatsAppMessage.deleteMany({ where: { chatId: ch.id } });
  await prisma.whatsAppChat.delete({ where: { id: ch.id } });
  if (ch.clientId) await prisma.client.delete({ where: { id: ch.clientId } }).catch(() => {});
  console.log('(chat de prueba borrado de la base local)');
  await prisma.$disconnect();
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
