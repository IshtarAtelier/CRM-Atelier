/**
 * Las gráficas oficiales de Smart Lens para MyoFix y MyoLens, en UN solo lugar.
 *
 * Son las diapositivas de las presentaciones que mandó el laboratorio
 * (Downloads/Smart Lens - Myofix.pdf y Smart Lens - MyoLens.pdf, 25/9/2026),
 * exportadas tal cual a public/images/smartlens/ (ver su LEEME.md). Las usan el
 * área de cristales (/cristales-opticos/myofix y /myolens) y las notas del blog
 * (/blog/myofix y /blog/myolens): si se cambia un texto alternativo o se saca
 * una lámina, cambia en todas las páginas a la vez.
 *
 * El `alt` describe lo que DICE la lámina, porque el texto está dentro de la
 * imagen: sin eso, un lector de pantalla y Google no ven nada.
 */

export interface Diapositiva {
    src: string;
    alt: string;
    /** Texto corto debajo de la imagen. */
    pie?: string;
}

const img = (nombre: string) => `/images/smartlens/${nombre}.webp`;

export const MYOFIX = {
    portada: { src: img('myofix-portada'), alt: 'Cristal MyoFix de Smart Lens sobre fondo turquesa, con el logotipo MyoFix by Smart Lens.' },
    epidemia: [
        { src: img('myofix-oms-2050'), alt: 'Cita de la Organización Mundial de la Salud: para 2050 la miopía afectará al 50% de la población mundial.' },
        { src: img('myofix-epidemia'), alt: 'Gráfico de la futura epidemia de miopía: población afectada en miles de millones y porcentaje de prevalencia de 2000 a 2050, que llega al 49,8%.' },
        { src: img('myofix-factores-de-riesgo'), alt: 'Factores de riesgo de la miopía infantil: genética, actividades prolongadas de cerca y pantallas.' },
        { src: img('myofix-progresion'), alt: 'Curva de progresión de la miopía según la edad: sube durante la infancia y se estabiliza cerca de los 20 a 25 años.' },
    ] as Diapositiva[],
    tecnologia: [
        { src: img('myofix-defocus-technology'), alt: 'Esquema del cristal MyoFix con Defocus Technology: zona central con la potencia prescripta y desenfoque hipermetrópico periférico alrededor.', pie: 'Zona central con la graduación exacta y desenfoque periférico alrededor.' },
        { src: img('myofix-esquema-tecnico'), alt: 'Esquema técnico sobre un anteojo: zona central con potencia óptica prescripta, desenfoque periférico y control de espesor periférico.', pie: 'Esquema técnico: centro, periferia y control de espesor.' },
        { src: img('myofix-esquema-visual'), alt: 'Esquema visual: la luz que pasa por la periferia del cristal MyoFix se enfoca por delante de la retina.', pie: 'La periferia del cristal enfoca por delante de la retina.' },
        { src: img('myofix-respuesta-fisiologica'), alt: 'Tomografía de coroides: la investigación clínica preliminar de MyoFix mostró engrosamiento de la coroides, más 10 micrones con el cristal frente a menos 16,3 sin él.', pie: 'Investigación clínica preliminar: engrosamiento de la coroides.' },
    ] as Diapositiva[],
    ventajas: [
        { src: img('myofix-ventajas-esteticas'), alt: 'Ventajas estéticas: cristales más finos y estéticos, pensados para evitar el bullying.' },
        { src: img('myofix-ventajas-tecnicas'), alt: 'Ventajas técnicas: lente fabricada con tecnología Freeform digital e individualizada.' },
    ] as Diapositiva[],
    uso: [
        { src: img('myofix-tratamiento-terapeutico'), alt: 'Tratamiento terapéutico: se recomienda a partir de los 5 años o cuando el médico detecta miopía progresiva; uso todo el día, o como mínimo 2 horas diarias después de las 18.' },
        { src: img('myofix-como-se-prescribe'), alt: 'Cómo se prescribe: en la receta, tratamiento de control de miopía MyoFix.' },
        { src: img('myofix-como-se-adapta'), alt: 'Cómo se adapta: la toma de medidas es igual que la de una lente monofocal.' },
    ] as Diapositiva[],
    especificaciones: [
        { src: img('myofix-rango-de-potencias'), alt: 'Rango de potencias de MyoFix: esfera hasta -12,00 y cilindro hasta -6,00 dioptrías; también corrige astigmatismo.' },
        { src: img('myofix-tratamientos'), alt: 'Tratamientos incluidos: protección UV, antirraya, antirreflejo y antiestático. Disponibles: polarizado, fotosensible y BlueTech.' },
        { src: img('myofix-materiales'), alt: 'Disponible en todos los materiales: orgánico 1.5, orgánico 1.56, policarbonato 1.59, orgánico 1.61 y alto índice 1.67.' },
    ] as Diapositiva[],
    consejos: { src: img('myofix-consejos'), alt: 'Consejos útiles para padres: descanso cada 20 minutos de pantalla, limitar el tiempo de pantalla, 30 cm de distancia, 2 horas diarias al aire libre, modo oscuro, texto más grande, sin pantallas 2 horas antes de dormir y buena iluminación.' } as Diapositiva,
};

export const MYOLENS = {
    portada: { src: img('myolens-portada'), alt: 'Hombre con anteojos y el logotipo MyoLens Myopia Confort de Smart Lens: diseñadas especialmente para las necesidades de los miopes.' },
    problema: [
        { src: img('myolens-miopia-en-latam'), alt: 'Se estima que el 15% de la población latinoamericana es miope; en Argentina son unos 7,5 millones de personas.' },
        { src: img('myolens-paradoja-potencia-real'), alt: 'La paradoja de las lentes convencionales: en el centro la potencia real, -4 dioptrías, es la correcta.', pie: 'En el centro, la potencia es la correcta.' },
        { src: img('myolens-paradoja-potencia-percibida'), alt: 'La paradoja de las lentes convencionales: hacia la periferia la potencia percibida sube a -4,4 y -4,8 dioptrías, una sobrecorrección miópica.', pie: 'En la periferia, un monofocal común sobrecorrige.' },
        { src: img('myolens-miopes-e-hipermetropes'), alt: 'Hoy miopes e hipermétropes usan la misma geometría de monofocal común, aunque sus necesidades visuales son completamente diferentes.' },
    ] as Diapositiva[],
    tecnologia: [
        { src: img('myolens-inteligencia-artificial'), alt: 'La inteligencia artificial en los ojos del futuro: la nueva tecnología de cálculo permite diseñar lentes individualizadas para mejorar la visión de los miopes.' },
        { src: img('myolens-microceldas'), alt: 'Precisión y confort: la tecnología exclusiva Microcell Optimization mejora la visión del miope en toda el área del lente y en cualquier dirección de mirada.', pie: '1 · Precisión y confort (Microcell Optimization Tech).' },
        { src: img('myolens-relajacion'), alt: 'Relajación: el diseño con inteligencia artificial suma un booster de potencia en la zona de cerca para jornadas intensas de lectura (AI-Get Technology).', pie: '2 · Relajación para la visión de cerca (AI-Get Technology).' },
        { src: img('myolens-salud-visual'), alt: 'Salud visual: en cualquier zona del cristal, la potencia que percibe el ojo es exactamente la de la receta.', pie: '3 · La potencia justa en todo el cristal.' },
        { src: img('myolens-mas-finas'), alt: 'Más finas, livianas y estéticas que los monofocales tradicionales, por su geometría individualizada.', pie: '4 · Más finas, livianas y estéticas.' },
    ] as Diapositiva[],
    uso: [
        { src: img('myolens-para-toda-edad'), alt: 'Tres hombres de distintas edades con anteojos: MyoLens sirve cualquiera sea la edad y la necesidad correctiva.' },
        { src: img('myolens-uso-extendido'), alt: 'Diseñadas para un uso extendido, diario y permanente, y aún más para jornadas intensas de visión cercana y celulares.' },
    ] as Diapositiva[],
    especificaciones: [
        { src: img('myolens-rango-de-potencias'), alt: 'Rango de potencias de MyoLens: esfera hasta -12,00 y cilindro hasta -6,00 dioptrías; también corrige astigmatismo.' },
        { src: img('myolens-tratamientos'), alt: 'Tratamientos incluidos: protección UV, antirraya, antirreflejo y antiestático. Disponibles: polarizado, fotosensible y BlueTech.' },
        { src: img('myolens-materiales'), alt: 'Disponible en todos los materiales: orgánico 1.5, orgánico 1.56, policarbonato 1.59, orgánico 1.61 y alto índice 1.67.' },
    ] as Diapositiva[],
    familia: { src: img('myolens-myofix-y-myolens'), alt: 'La familia Smart Lens: MyoFix, tratamiento de ralentización de la miopía para chicos, y MyoLens, monofocal correctora de miopía.' } as Diapositiva,
};
