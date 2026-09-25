/**
 * Crea en Google Ads la acción de conversión "Venta (CRM)": la que recibe las
 * ventas cerradas del mostrador que empezaron con un clic en un anuncio
 * (conversiones offline). ESCRIBE en la cuenta (crea UNA acción de conversión;
 * no toca campañas, puja ni presupuestos).
 *
 * Por qué nueva y no la de Tiendanube: "Tiendanube Backend purchases" es de un
 * sistema que ya no existe y quedó como secundaria con cero cargas; mezclar ahí
 * las ventas del CRM confundiría el historial.
 *
 * Nace SECUNDARIA a propósito: mide, no cambia la puja. Hacer que Google
 * optimice por estas ventas reinicia el aprendizaje y es una decisión aparte
 * (la del 15/9/2026), que se toma en el panel cuando haya datos.
 *
 * Idempotente: si ya existe una acción con ese nombre, no crea otra y muestra
 * su id. El id es lo que va en Railway como GOOGLE_ADS_OFFLINE_CONVERSION_ACTION.
 *
 * Uso:
 *   node --env-file=.env scripts/maintenance/google-ads/crear-accion-venta-crm.cjs            → solo valida
 *   GOOGLE_ADS_ALLOW_WRITES=1 node --env-file=.env scripts/maintenance/google-ads/crear-accion-venta-crm.cjs --aplicar
 */
const { search, mutate } = require('../../ads/lib/google_client');

const APLICAR = process.argv.includes('--aplicar');
const NOMBRE = 'Venta (CRM)';

(async () => {
  const existentes = await search(
    `SELECT conversion_action.resource_name, conversion_action.id, conversion_action.name, conversion_action.status, conversion_action.type, conversion_action.primary_for_goal FROM conversion_action WHERE conversion_action.name = '${NOMBRE}' AND conversion_action.status != 'REMOVED'`,
  );
  if (existentes.length) {
    const c = existentes[0].conversionAction;
    console.log(`Ya existe "${c.name}" (id ${c.id}, ${c.type}, ${c.primaryForGoal === false ? 'secundaria' : 'PRINCIPAL'}, ${c.status}). No se crea otra.`);
    console.log(`\nEn Railway (servicio CRM-Atelier):\n  GOOGLE_ADS_OFFLINE_CONVERSION_ACTION=${c.id}\n  GOOGLE_ADS_UPLOAD_CONVERSIONS=1`);
    return;
  }

  const operations = [{
    create: {
      name: NOMBRE,
      type: 'UPLOAD_CLICKS',
      category: 'PURCHASE',
      status: 'ENABLED',
      primaryForGoal: false,
      countingType: 'ONE_PER_CLICK',
      clickThroughLookbackWindowDays: 90,
      valueSettings: { defaultValue: 0, alwaysUseDefaultValue: false },
      attributionModelSettings: { attributionModel: 'GOOGLE_ADS_LAST_CLICK' },
    },
  }];
  console.log(`${APLICAR ? 'CREANDO' : 'Solo validando (validateOnly)'} la acción "${NOMBRE}": subida por clic, compra, secundaria, ventana 90 días, valor por venta.`);
  const res = await mutate('conversionActions:mutate', { operations, partialFailure: false, validateOnly: !APLICAR }, { confirm: true });
  if (!APLICAR) { console.log('✅ Google aceptó la operación. No se creó nada.'); return; }
  const rn = res?.results?.[0]?.resourceName || '';
  const id = rn.split('/').pop();
  console.log(`✅ Creada: ${rn}`);
  console.log(`\nEn Railway (servicio CRM-Atelier):\n  GOOGLE_ADS_OFFLINE_CONVERSION_ACTION=${id}\n  GOOGLE_ADS_UPLOAD_CONVERSIONS=1`);
})().catch((e) => { console.error('ERROR', e.message, e.guidance || ''); process.exit(1); });
