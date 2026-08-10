/**
 * Guarda de build: sin variables de medición, el build FALLA.
 *
 * EL DAÑO QUE EVITA (pasó el 10/8/2026)
 * La home está prerenderizada estáticamente. Los ids de medición se leen en el
 * layout (`process.env.NEXT_PUBLIC_META_PIXEL_ID`, `NEXT_PUBLIC_GA_ID`,
 * `NEXT_PUBLIC_GOOGLE_ADS_TAG_ID`, y las etiquetas de conversión) y quedan
 * CONGELADOS en el HTML en el momento del build. Un build que corre sin esas
 * variables no falla ni avisa: hornea `undefined` y el sitio queda sirviendo
 * páginas sin píxel, sin Analytics y sin Google Ads.
 *
 * Eso fue exactamente lo que pasó: un deploy dejó la tienda entera sin medir
 * durante horas. El runtime tenía las variables bien cargadas —una sonda a una
 * ruta dinámica respondía normal—, así que nada en los logs, ni en el healthcheck,
 * ni en el sitio a simple vista mostraba el problema. Se descubrió comparando el
 * HTML de producción contra una copia del día anterior.
 *
 * Una medición que se apaga sola y en silencio es peor que no tenerla: se sigue
 * decidiendo dónde poner la plata de publicidad con datos que dejaron de llegar.
 *
 * POR QUÉ FALLA EL BUILD Y NO SOLO AVISA
 * Un warning en un log de build no lo lee nadie. El único momento en que esto se
 * puede corregir barato es antes de publicar.
 *
 * SE PUEDE SALTEAR A PROPÓSITO
 * `PERMITIR_BUILD_SIN_MEDICION=1` para builds locales o de preview, donde no
 * hace falta medir. En producción no se usa nunca.
 */

/** Variables que, si faltan, dejan el sitio publicado sin medir. */
const REQUERIDAS = [
  ['NEXT_PUBLIC_META_PIXEL_ID', 'Píxel de Meta: sin esto no hay remarketing ni optimización de campañas'],
  ['NEXT_PUBLIC_GA_ID', 'Google Analytics'],
  ['NEXT_PUBLIC_GOOGLE_ADS_TAG_ID', 'Etiqueta de Google Ads (AW-…)'],
  ['GOOGLE_ADS_WHATSAPP_LABEL', 'Conversión "WhatsApp": es LA conversión del negocio'],
  ['GOOGLE_ADS_CALL_LABEL', 'Conversión "Llamada"'],
];

const faltantes = REQUERIDAS.filter(([nombre]) => !process.env[nombre]);

if (!faltantes.length) {
  console.log('✅ Medición: las 5 variables están presentes en el build.');
  process.exit(0);
}

if (process.env.PERMITIR_BUILD_SIN_MEDICION === '1') {
  console.warn(
    `⚠️  Medición: faltan ${faltantes.length} variable(s), pero PERMITIR_BUILD_SIN_MEDICION=1 lo autoriza.`,
  );
  console.warn(`   (${faltantes.map(([n]) => n).join(', ')})`);
  process.exit(0);
}

console.error('');
console.error('❌ BUILD DETENIDO: faltan variables de medición.');
console.error('');
console.error('   La home se prerenderiza, así que estos valores quedan CONGELADOS en el HTML.');
console.error('   Un build sin ellas publica un sitio que no mide nada, y no avisa.');
console.error('');
for (const [nombre, porque] of faltantes) {
  console.error(`   · ${nombre}`);
  console.error(`     ${porque}`);
}
console.error('');
console.error('   Cargarlas en el servicio que sirve el dominio (Railway → CRM-Atelier).');
console.error('   Para un build local o de preview donde no importa medir:');
console.error('     PERMITIR_BUILD_SIN_MEDICION=1 npm run build');
console.error('');
process.exit(1);
