import { revisarCartel } from '@/lib/promo-cuotas';

/**
 * Lo que una clave de configuración web no debería guardar, con el motivo para
 * quien la edita. Puro: lo usan la ruta que guarda (/api/settings, antes del
 * upsert) y el formulario de /admin/web (antes de mandar nada), y check:oferta
 * lo prueba con casos.
 *  · bloqueantes: no se guarda nunca (p. ej. "efectivo" en el cartel online).
 *  · dudosos: la regla puede equivocarse ("12 cuotas sin interés" leído en el
 *    texto); se guarda solo si quien edita lo confirma.
 */
export function revisarConfiguracion(key: string, value: unknown): { bloqueantes: string[]; dudosos: string[] } {
  if (key === 'web_announcement_text') return revisarCartel(String(value ?? ''));
  return { bloqueantes: [], dudosos: [] };
}
