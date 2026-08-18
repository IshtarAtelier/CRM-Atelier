/**
 * Punto de entrada del wa-service. Elige el transporte por WA_TRANSPORT:
 *
 *   cloud → cloud.js  (API oficial de WhatsApp — Cloud API de Meta)
 *   webjs → index.js  (WhatsApp Web + Chromium, legacy; default hasta migrar)
 *
 * Ver docs/plan-whatsapp-api-oficial.md. Cambiar la variable en Railway y
 * redeployar es todo lo que hace falta para pasar de uno a otro (hasta el
 * paso 4 de la Fase 4 se puede volver atrás así).
 */
const transport = (process.env.WA_TRANSPORT || 'webjs').toLowerCase();
if (transport === 'cloud') {
    console.log('🌐 WA_TRANSPORT=cloud → API oficial de WhatsApp');
    require('./cloud');
} else {
    console.log('🖥️  WA_TRANSPORT=webjs → WhatsApp Web (legacy)');
    require('./index');
}
