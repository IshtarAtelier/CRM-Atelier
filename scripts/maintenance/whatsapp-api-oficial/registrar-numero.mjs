/**
 * Registra el número de la tienda en la Cloud API (POST /{phone_id}/register).
 *
 *   node scripts/maintenance/whatsapp-api-oficial/registrar-numero.mjs
 *
 * POR QUÉ: el número quedó en `platform_type: ON_PREMISE` (resto de la
 * vinculación vieja vía Prometheo), y una cuenta On-Premise no puede crear
 * plantillas de Cloud API — ese era el verdadero origen del error 2494160
 * que Meta nunca supo explicar (dos casos de soporte, cero respuestas útiles).
 *
 * El número está en modo COEXISTENCIA (`is_on_biz_app: true`): registrarlo en
 * la Cloud API NO le saca los mensajes al celular de la óptica — la app sigue
 * recibiendo todo, igual que cuando esto mismo corría con Prometheo. Si algo
 * falla, el peor caso es quedar como estábamos (plantillas bloqueadas).
 *
 * El PIN es la verificación en dos pasos del número: si nunca tuvo, este lo
 * define; si Prometheo dejó uno distinto, Meta va a responder que el PIN no
 * coincide y hay que recuperarlo o resetearlo desde el WhatsApp Manager.
 * Guardado en el .env como WA_CLOUD_PIN para no inventar uno nuevo por corrida.
 */
import 'dotenv/config';

const T = process.env.WA_CLOUD_TOKEN;
const P = process.env.WA_CLOUD_PHONE_NUMBER_ID;
const PIN = process.env.WA_CLOUD_PIN || '463810';
if (!T || !P) { console.error('Faltan WA_CLOUD_TOKEN o WA_CLOUD_PHONE_NUMBER_ID en el .env.'); process.exit(1); }

const V = process.env.WA_CLOUD_API_VERSION || 'v21.0';

const r = await fetch(`https://graph.facebook.com/${V}/${P}/register?access_token=${T}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', pin: PIN }),
});
const j = await r.json();

if (r.ok && j.success) {
    console.log('✅ Número registrado en la Cloud API.');
    const chk = await (await fetch(`https://graph.facebook.com/${V}/${P}?fields=platform_type,status,display_phone_number&access_token=${T}`)).json();
    console.log(`   ${chk.display_phone_number} → plataforma ${chk.platform_type} · estado ${chk.status}`);
} else {
    console.error(`✖ ${r.status}:`, j.error?.error_user_msg || j.error?.message || JSON.stringify(j));
    if (j.error?.error_subcode === 2388093 || /pin/i.test(j.error?.message || '')) {
        console.error('   El número ya tiene un PIN de verificación en dos pasos distinto (probablemente de Prometheo).');
        console.error('   Se recupera desde el WhatsApp Manager → número → Verificación en dos pasos, o desde la app del celular.');
    }
    process.exit(1);
}
