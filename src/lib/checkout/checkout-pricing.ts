import { CrystalMapping } from '@/lib/config/crystal-mapping';
import { WHERE_VENDIBLE } from '@/lib/catalog/vendible';
import { estiloDeTenidoDelProducto } from '@/lib/constants/tenido';

/**
 * PRECIOS DE CRISTALES DE LA TIENDA Y DEL CHECKOUT — la única fuente.
 *
 * Hasta el 11/9/2026 este cálculo existía TRES veces: acá, en /api/web/pricing
 * (lo que ve el cliente) y en /api/checkout/payway (lo que se le cobra). Las
 * copias ya habían divergido: la de Payway no aplicaba `excludeKeywords` y
 * cobraba "Mi Primer Varilux" a la mitad de lo publicado (ver payway), y esta
 * tampoco la aplicaba. Ahora web y checkout leen de acá, así que lo que se
 * publica y lo que se cobra no pueden separarse.
 */

/** Lo que la tienda puede vender: cristales y tratamientos, sin archivados. */
export async function cargarCatalogoWeb(prisma: any) {
  const [crystals, treatments] = await Promise.all([
    prisma.product.findMany({ where: { AND: [{ category: 'Cristal' }, WHERE_VENDIBLE] } }),
    // Los tratamientos se guardan con category 'Tratamiento'. Hasta el 11/9/2026
    // se buscaban en 'Tratamientos y Accesorios', una categoría que no tiene
    // ningún producto: el teñido de la tienda salía SIEMPRE del respaldo fijo
    // de $25.000, sin importar lo que costara de verdad.
    prisma.product.findMany({ where: { AND: [{ category: 'Tratamiento' }, WHERE_VENDIBLE] } }),
  ]);
  return { crystals, treatments };
}

/**
 * Precio del teñido de la tienda: el COMPACTO, que es el teñido base (color
 * entero). Se elige por estilo y no por "el primero que diga teñido", porque
 * hay tres (compacto, degradé, según muestra) con precios distintos y el
 * primero que devolvía la base era cualquiera.
 */
export const findTintPrice = (treatments: any[]) => {
  const compactos = treatments
    .filter(p => estiloDeTenidoDelProducto(p) === 'COMPACTO' && p.price > 0)
    .sort((a, b) => a.price - b.price);
  if (compactos.length) return compactos[0].price;
  return CrystalMapping.EXTRAS.TINT;
};

export const findPrice = (crystals: any[], config: any) => {
  let matches = crystals;
  if (config.type) {
    matches = matches.filter(p => p.type === config.type);
  }
  // Exclusiones del mapeo ("mi primer": restricciones de adición, no puede ser
  // el precio "desde"). Esta rama faltaba en esta copia.
  if (config.excludeKeywords && config.excludeKeywords.length > 0) {
    matches = matches.filter(p =>
      !config.excludeKeywords.some((kw: string) => p.name?.toLowerCase().includes(kw))
    );
  }
  if (config.exactMatchName) {
    const exactMatch = matches.find(p => p.name?.toLowerCase() === config.exactMatchName.toLowerCase());
    if (exactMatch && exactMatch.price) return exactMatch.price;
  }
  if (config.matchKeywords && config.matchKeywords.length > 0) {
    matches = matches.filter(p =>
      config.matchKeywords.some((kw: string) => p.name?.toLowerCase().includes(kw))
    );
  } else if (config.matchKeywords && config.matchKeywords.length === 0 && config.type === "Cristal Monofocal") {
    matches = matches.filter(p =>
      !p.name?.toLowerCase().includes('blue') &&
      !p.name?.toLowerCase().includes('foto') &&
      !p.name?.toLowerCase().includes('transitions')
    );
  }
  if (matches.length === 0) return 0;
  return Math.min(...matches.map(p => p.price || 0));
};

export const buildPricingMap = (crystals: any[], treatments: any[]) => {
  return {
    MONOFOCAL: {
      ORGANICO_BLANCO: findPrice(crystals, CrystalMapping.MONOFOCAL.ORGANICO_BLANCO) || 20000,
      ORGANICO_AR: findPrice(crystals, CrystalMapping.MONOFOCAL.ORGANICO_AR) || 45000,
      ORGANICO_BLUE: findPrice(crystals, CrystalMapping.MONOFOCAL.ORGANICO_BLUE) || 68000,
      POLI_BLUE: findPrice(crystals, CrystalMapping.MONOFOCAL.POLI_BLUE) || 120000,
      ORGANICO_FOTOCROMATICO: findPrice(crystals, CrystalMapping.MONOFOCAL.ORGANICO_FOTOCROMATICO) || 105000,
      ORGANICO_BLANCO_TENIDO: findPrice(crystals, CrystalMapping.MONOFOCAL.ORGANICO_BLANCO_TENIDO) || 68000,
    },
    BIFOCAL: {
      ORGANICO_BLANCO: findPrice(crystals, CrystalMapping.BIFOCAL.ORGANICO_BLANCO) || 45000,
    },
    MULTIFOCAL: {
      SMART_FREE: findPrice(crystals, CrystalMapping.MULTIFOCAL.SMART_FREE) || 120000,
      VARILUX: findPrice(crystals, CrystalMapping.MULTIFOCAL.VARILUX) || 350000,
      FOTOCROMATICO: findPrice(crystals, CrystalMapping.MULTIFOCAL.FOTOCROMATICO) || 180000,
    },
    EXTRAS: {
      TINT: findTintPrice(treatments)
    }
  };
};

/**
 * Precio efectivo del armazón (fuente de verdad única para checkout y desglose de la orden).
 * - Mayorista con wholesalePrice > 0 → wholesalePrice (la oferta retail NO aplica a mayoristas).
 * - Retail con salePrice válido (0 < salePrice < price) → salePrice (precio de oferta).
 * - En cualquier otro caso → price de lista.
 * Siempre sale de la DB (dbProduct), nunca del payload del cliente.
 */
export const effectiveFramePrice = (dbProduct: any, isWholesaleUser: boolean): number => {
  if (isWholesaleUser && dbProduct.wholesalePrice > 0) return dbProduct.wholesalePrice;
  const sale = dbProduct.salePrice;
  if (sale != null && sale > 0 && sale < dbProduct.price) return sale;
  return dbProduct.price;
};

export const recalculateItemPrice = (
  item: any,
  dbProduct: any,
  isWholesaleUser: boolean,
  pricingMap: any
) => {
  const framePrice = effectiveFramePrice(dbProduct, isWholesaleUser);
  let calculatedPrice = framePrice;
  const isCustomLens = item.lensConfig && (item.lensConfig.lensType !== "NONE" || item.lensConfig.color);

  if (isCustomLens) {
    const { lensType, treatment, color } = item.lensConfig;
    if (color) {
      // SUN FLOW
      if (lensType === "NONE" || lensType === "MONOFOCAL") calculatedPrice += (pricingMap.MONOFOCAL.ORGANICO_BLANCO || 0);
      else if (lensType === "BIFOCAL") calculatedPrice += (pricingMap.BIFOCAL.ORGANICO_BLANCO || 0);
      else if (lensType === "MULTIFOCAL") calculatedPrice += (pricingMap.MULTIFOCAL.SMART_FREE || 0);
      
      if (lensType !== null) {
        calculatedPrice += pricingMap.EXTRAS.TINT;
      }
    } else {
      // CLEAR FLOW
      if (lensType === "MONOFOCAL") {
        const txPrice = treatment ? pricingMap.MONOFOCAL[treatment as keyof typeof pricingMap.MONOFOCAL] : undefined;
        if (txPrice === undefined) throw new Error("Tratamiento monofocal inválido o faltante.");
        calculatedPrice += txPrice;
      }
      else if (lensType === "BIFOCAL") {
        calculatedPrice += pricingMap.BIFOCAL.ORGANICO_BLANCO;
      }
      else if (lensType === "MULTIFOCAL") {
        const txPrice = treatment ? pricingMap.MULTIFOCAL[treatment as keyof typeof pricingMap.MULTIFOCAL] : undefined;
        if (txPrice === undefined) throw new Error("Tratamiento multifocal inválido o faltante.");
        calculatedPrice += txPrice;
      }
    }
  }

  return calculatedPrice;
};
