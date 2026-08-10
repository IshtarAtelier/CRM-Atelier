import { prisma } from '@/lib/db';
import { CrystalMapping } from '@/lib/config/crystal-mapping';

/**
 * Precio "desde" de un multifocal, leído de la base.
 *
 * Para qué: la landing de multifocales necesita un ancla de precio — sin un
 * número, la página no puede competir contra quien sí publica uno, y la
 * búsqueda de "precio lentes multifocales" se va a otro lado. Pero la regla R6
 * del proyecto es que un precio publicado JAMÁS se escribe a mano: sale de la
 * base o no sale.
 *
 * Por eso devuelve `null` cuando no puede calcularlo, y quien lo usa
 * simplemente no muestra el ancla. Nada de valores por defecto: un precio
 * inventado que queda viejo es exactamente el daño que R6 existe para impedir.
 * (La ruta `/api/web/pricing` sí tiene un fallback hardcodeado para que el
 * configurador nunca muestre $0; acá no corresponde, porque esto es una página
 * pública e indexable, no un formulario interactivo.)
 *
 * El "desde" es el cristal multifocal más barato del catálogo — hoy la gama
 * SMART_FREE. NO incluye el armazón: por eso quien lo muestra dice "cristales
 * desde", nunca "anteojos desde".
 *
 * Respeta `excludeKeywords` del mapeo. No es un detalle: el 10/8/2026 se
 * descubrió que las copias del checkout ignoraban esa exclusión y por eso
 * cobraban la mitad de lo publicado. Una gama excluida está excluida en TODOS
 * los lugares donde se lee un precio.
 */
export async function precioMultifocalDesde(): Promise<number | null> {
  try {
    const config = CrystalMapping.MULTIFOCAL.SMART_FREE as {
      type?: string;
      matchKeywords?: string[];
      excludeKeywords?: string[];
      exactMatchName?: string;
    };

    const cristales = await prisma.product.findMany({
      where: { category: 'Cristal', ...(config.type ? { type: config.type } : {}) },
      select: { name: true, price: true },
    });
    if (!cristales.length) return null;

    let candidatos = cristales;

    if (config.excludeKeywords?.length) {
      candidatos = candidatos.filter(
        (p) => !config.excludeKeywords!.some((kw) => p.name?.toLowerCase().includes(kw)),
      );
    }
    if (config.exactMatchName) {
      const exacto = candidatos.find(
        (p) => p.name?.toLowerCase() === config.exactMatchName!.toLowerCase(),
      );
      if (exacto?.price) return exacto.price;
    }
    if (config.matchKeywords?.length) {
      candidatos = candidatos.filter((p) =>
        config.matchKeywords!.some((kw) => p.name?.toLowerCase().includes(kw)),
      );
    }

    const precios = candidatos.map((p) => p.price || 0).filter((v) => v > 0);
    return precios.length ? Math.min(...precios) : null;
  } catch (err) {
    // Una landing sin ancla de precio sigue sirviendo; una que revienta, no.
    console.error('[precioMultifocalDesde] No se pudo calcular:', err);
    return null;
  }
}
