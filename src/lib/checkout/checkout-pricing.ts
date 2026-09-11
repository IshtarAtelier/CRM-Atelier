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

/**
 * QUÉ PRODUCTO ES CADA OPCIÓN DE LA WEB.
 *
 * La tienda vinculaba cada opción ("Orgánico Blanco", "Diseño Digital ONE",
 * "Multi Fotocromático"…) con un producto BUSCÁNDOLO POR EL NOMBRE. El 8/9/2026
 * se normalizaron los nombres del catálogo y ninguno de los 9 nombres exactos
 * existió más: la web pasó a mostrar los precios de respaldo fijos, un Smart ONE
 * donde debía ir un Smart FREE, y un monofocal fotocromático de $791.435. Nadie
 * se enteró, porque los respaldos hacen que la tienda "ande".
 *
 * Ahora cada opción apunta a un producto POR SU ID, guardado en la
 * configuración de la web (`web_cristales_opciones`, clave "GRUPO.OPCION"). El id
 * no cambia cuando se renombra un producto. Si una opción no tiene id cargado,
 * cae a las palabras clave de CrystalMapping (así la base local, sin
 * configuración, sigue funcionando). Si tiene id y el producto ya no es
 * vendible (archivado o borrado), NO se adivina otro: se usa el respaldo y se
 * avisa por log — `npm run check:tienda` lo muestra.
 *
 * El PRECIO que se cobra y el CRISTAL que se manda al laboratorio salen de esta
 * misma función: si salieran de dos lugares, se podría cobrar un producto y
 * fabricar otro.
 */
export type OpcionesCristalesWeb = Record<string, string>;

type Resolucion = { producto: any | null; via: 'id' | 'id-no-vendible' | 'palabra-clave' | 'ninguno' };

const porPalabraClave = (crystals: any[], config: any) => {
  let matches = crystals;
  if (config.type) matches = matches.filter(p => p.type === config.type);
  // Exclusiones del mapeo ("mi primer": restricciones de adición, no puede ser
  // el precio "desde").
  if (config.excludeKeywords && config.excludeKeywords.length > 0) {
    matches = matches.filter(p => !config.excludeKeywords.some((kw: string) => p.name?.toLowerCase().includes(kw)));
  }
  if (config.exactMatchName) {
    const exacto = matches.find(p => p.name?.toLowerCase() === config.exactMatchName.toLowerCase());
    if (exacto) return exacto;
  }
  if (config.matchKeywords && config.matchKeywords.length > 0) {
    matches = matches.filter(p => config.matchKeywords.some((kw: string) => p.name?.toLowerCase().includes(kw)));
  } else if (config.matchKeywords && config.matchKeywords.length === 0 && config.type === "Cristal Monofocal") {
    matches = matches.filter(p =>
      !p.name?.toLowerCase().includes('blue') &&
      !p.name?.toLowerCase().includes('foto') &&
      !p.name?.toLowerCase().includes('transitions')
    );
  }
  if (matches.length === 0) return null;
  return [...matches].sort((x, y) => (x.price || 0) - (y.price || 0))[0];
};

export function resolverOpcionWeb(
  crystals: any[],
  grupo: 'MONOFOCAL' | 'BIFOCAL' | 'MULTIFOCAL',
  opcion: string,
  opciones: OpcionesCristalesWeb = {},
): Resolucion {
  const clave = `${grupo}.${opcion}`;
  const id = opciones[clave];
  if (id) {
    const producto = crystals.find(p => p.id === id);
    if (producto) return { producto, via: 'id' };
    console.error(`[tienda] La opción ${clave} apunta a ${id}, que ya no es vendible (archivado o borrado). Se usa el precio de respaldo.`);
    return { producto: null, via: 'id-no-vendible' };
  }
  const config = (CrystalMapping as any)[grupo]?.[opcion];
  if (!config) return { producto: null, via: 'ninguno' };
  const producto = porPalabraClave(crystals, config);
  return { producto, via: producto ? 'palabra-clave' : 'ninguno' };
}

/** Compatibilidad: el precio de una config de CrystalMapping, por palabra clave. */
export const findPrice = (crystals: any[], config: any) => porPalabraClave(crystals, config)?.price || 0;

/** El cristal que se adjunta a la orden (y que ve el laboratorio) para un ítem del checkout. */
export function resolveCrystalProduct(item: any, crystals: any[], opciones: OpcionesCristalesWeb = {}) {
  if (!item.lensConfig || (item.lensConfig.lensType === "NONE" && !item.lensConfig.color)) return null;
  const { lensType, treatment, color } = item.lensConfig;
  let grupo: 'MONOFOCAL' | 'BIFOCAL' | 'MULTIFOCAL' | null = null;
  let opcion: string | null = null;
  if (color) {
    if (lensType === "NONE" || lensType === "MONOFOCAL") { grupo = 'MONOFOCAL'; opcion = 'ORGANICO_BLANCO'; }
    else if (lensType === "BIFOCAL") { grupo = 'BIFOCAL'; opcion = 'ORGANICO_BLANCO'; }
    else if (lensType === "MULTIFOCAL") { grupo = 'MULTIFOCAL'; opcion = 'SMART_FREE'; }
  } else {
    if (lensType === "MONOFOCAL") { grupo = 'MONOFOCAL'; opcion = treatment; }
    else if (lensType === "BIFOCAL") { grupo = 'BIFOCAL'; opcion = 'ORGANICO_BLANCO'; }
    else if (lensType === "MULTIFOCAL") { grupo = 'MULTIFOCAL'; opcion = treatment; }
  }
  if (!grupo || !opcion) return null;
  return resolverOpcionWeb(crystals, grupo, opcion, opciones).producto;
}

export const buildPricingMap = (crystals: any[], treatments: any[], opciones: OpcionesCristalesWeb = {}) => {
  const precio = (g: 'MONOFOCAL' | 'BIFOCAL' | 'MULTIFOCAL', o: string) =>
    resolverOpcionWeb(crystals, g, o, opciones).producto?.price || 0;
  return {
    MONOFOCAL: {
      ORGANICO_BLANCO: precio('MONOFOCAL', 'ORGANICO_BLANCO') || 20000,
      ORGANICO_AR: precio('MONOFOCAL', 'ORGANICO_AR') || 45000,
      ORGANICO_BLUE: precio('MONOFOCAL', 'ORGANICO_BLUE') || 68000,
      POLI_BLUE: precio('MONOFOCAL', 'POLI_BLUE') || 120000,
      ORGANICO_FOTOCROMATICO: precio('MONOFOCAL', 'ORGANICO_FOTOCROMATICO') || 105000,
      ORGANICO_BLANCO_TENIDO: precio('MONOFOCAL', 'ORGANICO_BLANCO_TENIDO') || 68000,
    },
    BIFOCAL: {
      ORGANICO_BLANCO: precio('BIFOCAL', 'ORGANICO_BLANCO') || 45000,
    },
    MULTIFOCAL: {
      SMART_FREE: precio('MULTIFOCAL', 'SMART_FREE') || 120000,
      VARILUX: precio('MULTIFOCAL', 'VARILUX') || 350000,
      FOTOCROMATICO: precio('MULTIFOCAL', 'FOTOCROMATICO') || 180000,
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
