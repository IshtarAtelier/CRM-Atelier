/**
 * Techo de inversión publicitaria mensual, en pesos, sumando Google Ads y Meta.
 *
 * Lo fijó la dueña el 9/8/2026: "un millón en total entre Google y Meta". No es
 * una sugerencia ni un objetivo — es un límite. Se eligió a partir del promedio
 * medido de los meses cerrados (Google ~$519.000 + Meta ARS ~$348.000 + Meta
 * USD ~US$225 por mes), o sea que sostiene el nivel de inversión actual sin
 * subirlo.
 *
 * Este valor es el DEFAULT. El vigente se guarda en `SystemSetting` bajo
 * `ads_monthly_cap_ars`, para poder cambiarlo sin deployar (mismo criterio que
 * `followups_enabled` o `bot_prompt`).
 */
export const ADS_MONTHLY_CAP_ARS_DEFAULT = 1_000_000;

/** Clave en SystemSetting donde vive el techo vigente. */
export const ADS_MONTHLY_CAP_SETTING_KEY = 'ads_monthly_cap_ars';

/**
 * A partir de qué porcentaje del techo se avisa.
 *
 * Se mira la PROYECCIÓN a fin de mes, no lo gastado: enterarse el día 28 de que
 * se pasó no sirve de nada. Con estos valores, un ritmo que termina en 900.000
 * ya levanta la mano el día 3.
 */
export const ADS_CAP_UMBRAL_ATENCION = 0.85;

/**
 * Código de tienda del local en el Perfil de Empresa de Google. Lo usa el
 * inventario local que se manda a Merchant Center (fichas locales gratuitas):
 * cada fila dice "este producto está en la tienda ATELIER01". Tiene que ser
 * IDÉNTICO al cargado en el perfil (Configuración avanzada → Código de tienda),
 * donde se dio de alta el 25/9/2026. No es visible para el público.
 */
export const GOOGLE_STORE_CODE = 'ATELIER01';
