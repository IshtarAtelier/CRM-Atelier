export const SmartLabDictionary: Record<string, {
    lensTypeId: number;
    materialId: number;
    colorId: number;
    articleId: number;
    treatments: number[];
}> = {
    // 1. SMART FREE - Organico Blue Ligth con Ar essential, 2x1
    "SMART FREE - Organico Blue Ligth con Ar essential, 2x1": {
        lensTypeId: 5,
        materialId: 20, // ORG BLUE LIGHT 1.56
        colorId: 1, // Blanco
        articleId: 28463, // MULTIFOCAL SMART FREE ORGANICO BLUE LIGHT C/AR ESSENTIAL
        treatments: []
    },
    // 2. SMART FREE - Oraganico Blue Ligth con Ar essential Fotocoromatico  Gris 2x1
    "SMART FREE - Oraganico Blue Ligth con Ar essential Fotocoromatico  Gris 2x1": {
        lensTypeId: 5,
        materialId: 33, // ORG FOTO BLUE 1.56
        colorId: 6, // Gris
        articleId: 28682, // MULTIFOCAL SMART FREE ORGANICO FOTO BLUE C/AR ESSENTIAL
        treatments: []
    },
    // 3. SMART FREE - Policarbonato Blue Ligth con Ar essential 2x1
    "SMART FREE - Policarbonato Blue Ligth con Ar essential 2x1": {
        lensTypeId: 5,
        materialId: 27, // POLI BLUE 1.59
        colorId: 1, // Blanco
        articleId: 11245, // MULTIFOCAL SMART FREE POLI BLUE LIGHT (Nota: SmartLab no tiene version con AR, este es el unico)
        treatments: []
    },
    // 4. SMART FREE - Stylis BLUE LIGHT  2x1
    "SMART FREE - Stylis BLUE LIGHT  2x1": {
        lensTypeId: 5,
        materialId: 31, // ORG BLUE ALTO INDICE 1.67
        colorId: 1, // Blanco
        articleId: 28596, // MULTIFOCAL SMART FREE ALTO INDICE 1.67 BLUE
        treatments: []
    },
    // 5. SMART FREE - Stylis Fotocromatico  2x1
    "SMART FREE - Stylis Fotocromatico  2x1": {
        lensTypeId: 5,
        materialId: 17, // ORG FOTO 1.67
        colorId: 6, // Gris
        articleId: 28598, // MULTIFOCAL SMART FREE ALTO INDICE 1.67 FOTOCROMATICO
        treatments: []
    },
    // 6. SMART FREE - Stylis Blanco 2x1
    "SMART FREE - Stylis Blanco 2x1": {
        lensTypeId: 5,
        materialId: 15, // ORG ALTO INDICE 1.74
        colorId: 1, // Blanco
        articleId: 28779, // MULTIFOCAL SMART FREE ALTO INDICE 1.74 BCO
        treatments: []
    }
};

export const SmartLabColors = {
    BLANCO: 1,
    GRIS: 6,
    SEPIA: 7,
    VERDE: 8
};

export const SmartLabTreatments = {
    ULTRALAYER: 5,
    MULTIFACETADO: 9,
    PRISMA: 10,
    ELEMENT: 16
};
