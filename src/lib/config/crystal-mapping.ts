/**
 * Mapeo de Cristales para la Web
 * 
 * Este archivo centraliza la conexión entre las opciones visuales del Configurador (Web)
 * y los nombres exactos o palabras clave de los productos en la base de datos (Prisma).
 * 
 * Instrucciones: 
 * Reemplazar los valores en 'matchKeywords' o usar 'exactMatchName' con el texto exacto 
 * del producto que deba vincularse a cada opción.
 */

export const CrystalMapping = {
  MONOFOCAL: {
    ORGANICO_BLANCO: {
      type: "Cristal Monofocal",
      matchKeywords: ["ogranico blanco", "organico blanco", "organico blanco (bifocal"], 
      exactMatchName: " Ogranico Blanco"
    },
    ORGANICO_AR: {
      type: "Cristal Monofocal",
      matchKeywords: ["ogranico blanco con antireflejo", "organico ar", "organico blanco antirreflex"],
      exactMatchName: "Ogranico Blanco con Antireflejo "
    },
    ORGANICO_BLUE: {
      type: "Cristal Monofocal",
      matchKeywords: ["orgánico super blue", "organico super blue", "orgánico blue", "organico blue light"],
      exactMatchName: "Orgánico Super Blue Asferico Antirreflejo"
    },
    ORGANICO_BLANCO_TENIDO: {
      type: "Cristal Monofocal",
      matchKeywords: ["organico blanco teñido", "ogranico blanco teñido", "organico blanco tenido"],
      exactMatchName: "Organico blanco teñido"
    },
    POLI_BLUE: {
      type: "Cristal Monofocal",
      matchKeywords: ["policarbonato blue", "poli uv420", "policarbonato antireflejo"],
      exactMatchName: "Policarbonato antireflejo " // Reemplazar en sistema cuando creen el "Poli Blue"
    },
    ORGANICO_FOTOCROMATICO: {
      type: "Cristal Monofocal",
      matchKeywords: ["organico fotocromatico", "fotocromatico gris", "acclimates", "transitions gens 1.59", "transitions gens 1.67"],
      exactMatchName: "Organico fotocromatico Gris "
    }
  },
  BIFOCAL: {
    ORGANICO_BLANCO: {
      type: "Cristal Bifocal",
      matchKeywords: ["organico", "blanco"],
      exactMatchName: "Flat Top Orgánico Blanco (Bifocal  Grupo)"
    }
  },
  MULTIFOCAL: {
    SMART_FREE: {
      type: "Cristal Multifocal",
      matchKeywords: ["one", "estandar", "orma"], 
      exactMatchName: "SMART FREE - Organico Blue Ligth con Ar essential, 2x1"
    },
    VARILUX: {
      type: "Cristal Multifocal",
      matchKeywords: ["varilux", "physio", "comfort max", "stylis"], 
      exactMatchName: "SMART FREE - Stylis Blanco 2x1"
    },
    FOTOCROMATICO: {
      type: "Cristal Multifocal",
      matchKeywords: ["foto", "transitions", "gen s"],
      exactMatchName: "SMART FREE - Oraganico Blue Ligth con Ar essential Fotocoromatico  Gris 2x1"
    }
  },
  EXTRAS: {
    TINT: 25000
  }
};
