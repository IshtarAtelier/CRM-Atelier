/**
 * Punto de entrada del wa-service. Elige el transporte por WA_TRANSPORT:
 *
 *   cloud → cloud.js  (API oficial de WhatsApp — Cloud API de Meta) ← DEFAULT
 *   webjs → index.js  (WhatsApp Web + Chromium, legacy)
 *
 * Ver docs/plan-whatsapp-api-oficial.md.
 *
 * EL DEFAULT ES `cloud` A PROPÓSITO. Antes era `webjs`, y eso convertía
 * cualquier despiste de configuración en un incidente serio: un servicio
 * nuevo en Railway, un rollback, o un redeploy que pierda la variable
 * levantaba Chromium, el bot IA y los seguimientos proactivos contra el
 * número del negocio — que es justo la automatización no oficial por la que
 * Meta puede bloquear la línea, y de la que la migración a la API oficial
 * vino a sacarnos. Y no se notaba: el log decía una línea alegre y el
 * servicio quedaba "sano".
 *
 * Ahora, ante la duda, se arranca por la vía oficial (que Meta sanciona) y
 * volver al legacy exige decirlo DOS veces, a propósito: WA_TRANSPORT=webjs
 * y WA_ALLOW_LEGACY=1. Si alguien pide webjs sin la segunda, arrancamos en
 * cloud y lo gritamos en el log en vez de obedecer en silencio.
 */
const pedido = (process.env.WA_TRANSPORT || 'cloud').toLowerCase();
const legacyPermitido = process.env.WA_ALLOW_LEGACY === '1';

if (pedido === 'webjs' && !legacyPermitido) {
    console.error('🛑 WA_TRANSPORT=webjs pero falta WA_ALLOW_LEGACY=1.');
    console.error('   El transporte legacy (WhatsApp Web + Chromium) automatiza la app no oficial:');
    console.error('   es la vía por la que Meta puede bloquear el número. Se ignora el pedido.');
    console.error('   Si de verdad hace falta volver al legacy, setear TAMBIÉN WA_ALLOW_LEGACY=1.');
}

const transport = (pedido === 'webjs' && legacyPermitido) ? 'webjs' : 'cloud';

if (transport === 'cloud') {
    console.log('🌐 WA_TRANSPORT=cloud → API oficial de WhatsApp');
    require('./cloud');
} else {
    console.warn('🖥️  WA_TRANSPORT=webjs (con WA_ALLOW_LEGACY=1) → WhatsApp Web (legacy, no oficial)');
    require('./index');
}
