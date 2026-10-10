import { problemasDelCartel } from '@/lib/promo-cuotas';

/**
 * Lo que una clave de configuración web NO puede guardar, con el motivo para
 * quien la edita. Vacío = se puede guardar. Puro: lo usan la ruta que guarda
 * (/api/settings, antes del upsert) y el formulario de /admin/web (antes de
 * mandar nada), y check:oferta lo prueba con casos.
 */
export function problemasDeConfiguracion(key: string, value: unknown): string[] {
  if (key === 'web_announcement_text') return problemasDelCartel(String(value ?? ''));
  return [];
}
