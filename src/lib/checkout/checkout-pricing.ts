import { CrystalMapping } from '@/lib/config/crystal-mapping';

export const findTintPrice = (treatments: any[]) => {
  const tintProduct = treatments.find(p => p.name?.toLowerCase().includes('teñido') || p.name?.toLowerCase().includes('tenido'));
  if (tintProduct && tintProduct.price) return tintProduct.price;
  return CrystalMapping.EXTRAS.TINT;
};

export const findPrice = (crystals: any[], config: any) => {
  let matches = crystals;
  if (config.type) {
    matches = matches.filter(p => p.type === config.type);
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

export const recalculateItemPrice = (
  item: any, 
  dbProduct: any, 
  isWholesaleUser: boolean, 
  pricingMap: any
) => {
  const framePrice = isWholesaleUser && dbProduct.wholesalePrice > 0 ? dbProduct.wholesalePrice : dbProduct.price;
  let calculatedPrice = framePrice;
  const isCustomLens = item.lensConfig && (item.lensConfig.lensType !== "NONE" || item.lensConfig.color);

  if (isCustomLens) {
    const { lensType, treatment, color } = item.lensConfig;
    if (color) {
      // SUN FLOW
      if (lensType === "NONE" || lensType === "MONOFOCAL") calculatedPrice += (pricingMap.MONOFOCAL.ORGANICO_BLANCO || 0);
      else if (lensType === "BIFOCAL") calculatedPrice += (pricingMap.BIFOCAL.ORGANICO_BLANCO || 0);
      else if (lensType === "MULTIFOCAL") calculatedPrice += (pricingMap.MULTIFOCAL.SMART_FREE || 0);
      
      if (lensType !== null && lensType !== "NONE") {
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
