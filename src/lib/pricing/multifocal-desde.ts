import { resolverOpcionesDeCristal } from '@/services/cristales-web.service';
import { precioMultifocalDesdeDe } from '@/lib/cristales-web/claves';

/**
 * Precio "desde" de un multifocal, leído de la base.
 *
 * Para qué: la landing de multifocales necesita un ancla de precio — sin un
 * número, la página no puede competir contra quien sí publica uno, y la
 * búsqueda de "precio lentes multifocales" se va a otro lado. Pero la regla R6
 * del proyecto es que un precio publicado JAMÁS se escribe a mano: sale de la
 * base o no sale.
 *
 * Es el multifocal más barato de los que VENDE la tienda: las opciones de
 * multifocal del configurador, con el producto vinculado en /admin/web →
 * Cristales. Así la landing, el configurador y el checkout dicen el mismo
 * número por construcción (antes había una copia del matcher por palabras
 * clave acá, otra en la tienda y dos en el checkout). NO incluye el armazón:
 * por eso quien lo muestra dice "cristales desde", nunca "anteojos desde".
 *
 * Devuelve `null` cuando no puede calcularlo, y quien lo usa simplemente no
 * muestra el ancla. Nada de valores por defecto.
 */
export async function precioMultifocalDesde(): Promise<number | null> {
  try {
    return precioMultifocalDesdeDe(await resolverOpcionesDeCristal());
  } catch (err) {
    // Una landing sin ancla de precio sigue sirviendo; una que revienta, no.
    console.error('[precioMultifocalDesde] No se pudo calcular:', err);
    return null;
  }
}
