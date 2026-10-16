/**
 * IA sin crédito: dónde se carga, cada cuánto se re-avisa y cada cuánto se
 * prueba (pedido de Ishtar del 16/10/2026). Lo usan `ia-credito.service.ts`,
 * el endpoint del bot y la sonda de `instrumentation.ts`.
 *
 * Contexto (memoria del 8/10/2026): el CRM y el bot usan la MISMA
 * `GOOGLE_GENAI_API_KEY`, PREPAGA en AI Studio y sin recarga automática.
 * Cuando llega a cero, Google contesta 402 y el bot queda mudo.
 */

/** Cargar saldo: AI Studio → Billing → Add funds. */
export const LINK_RECARGA_AI_STUDIO = 'https://aistudio.google.com/app/billing';

/** Si sigue sin crédito, se vuelve a avisar como mucho cada estas horas. */
export const HORAS_ENTRE_AVISOS_SIN_CREDITO = 6;

/**
 * Un 429 suelto es un pico de un minuto y se arregla solo. Recién si la cuota
 * sigue agotada después de estos minutos se trata como episodio y se avisa.
 */
export const MINUTOS_CUOTA_SOSTENIDA = 20;

/**
 * Cada cuánto la sonda prueba la clave con una llamada mínima (5 tokens de
 * salida, sin "pensamiento"). Costo con gemini-2.5-flash: ~10 tokens de
 * entrada + 5 de salida ≈ USD 0,00002 por llamada; 48 por día y por instancia
 * → menos de USD 0,10 por mes aun con dos instancias.
 */
export const MINUTOS_ENTRE_SONDAS_DE_CREDITO = 30;
export const MODELO_SONDA_CREDITO = 'gemini-2.5-flash';

/** Marcas en SystemSetting (texto ISO; '' = sin episodio). */
export const CLAVE_EPISODIO_DESDE = 'ia_sin_credito_desde';
export const CLAVE_AVISADO_AT = 'ia_sin_credito_avisado_at';
export const CLAVE_CUOTA_DESDE = 'ia_cuota_desde';
