/**
 * Qué video de YouTube va en cada nota del blog. Única fuente: la nota
 * estática (`src/app/blog/<slug>/page.tsx`) y la dinámica
 * (`src/app/blog/[slug]/page.tsx`, para las que viven en la base) leen de
 * acá, así que agregar un video nuevo a una nota es una línea en este mapa,
 * no un cambio en dos lugares.
 *
 * Los 15 son reels educativos, subidos como Shorts NO LISTADOS (10/9/2026):
 * el proyecto de YouTube todavía no pasó la auditoría de Google, pero un
 * Short no listado se puede insertar igual en cualquier página — no hace
 * falta que sea público para esto.
 *
 * Quedaron afuera del blog (no tienen nota educativa que les corresponda,
 * son promocionales/de servicio, no de un tema puntual): 2x1-multifocales,
 * 6-cuotas, garantia-30-dias.
 */
export interface VideoBlog {
  id: string;
  titulo: string;
}

export const VIDEOS_POR_SLUG: Record<string, VideoBlog[]> = {
  'diferencia-miopia-hipermetropia-astigmatismo': [
    { id: 'reKHmCV4n-Q', titulo: '¿Qué es la miopía?' },
    { id: 'uJcOBmlh24s', titulo: '¿Qué es la hipermetropía?' },
  ],
  'sintomas-presbicia-soluciones': [
    { id: 'FRJW6R-DvVo', titulo: '¿Qué es la presbicia?' },
  ],
  stellest: [
    { id: '3DGpl1q8gXA', titulo: 'Stellest: hasta 67% menos avance de la miopía' },
  ],
  'lentes-stellest-control-miopia-infantil': [
    { id: 'S8Sj_ilLqvo', titulo: 'Cómo frenar el avance de la miopía infantil' },
  ],
  'control-miopia-infantil-lentes': [
    { id: 'MwEhhMSsWno', titulo: 'MyoFix: control de la miopía infantil' },
  ],
  'lentes-fotocromaticos-transitions': [
    { id: '18QzTYloXdk', titulo: 'El lente que se oscurece solo con el sol' },
  ],
  'guia-cristales': [
    { id: 'jkQJx6etcAE', titulo: 'Índices de refracción: cuál te conviene' },
    { id: '0cV9O-jdS38', titulo: '¿Qué es un lente monofocal?' },
  ],
  'bifocales-vs-multifocales-diferencias': [
    { id: 'cg8wZtPYVi8', titulo: 'Bifocal vs. progresivo: la diferencia se siente' },
    { id: 'ZpmXlPCOMjI', titulo: 'Cómo funciona un lente progresivo' },
  ],
  'pasos-faciles-adaptacion-multifocales': [
    { id: 'E1IIgUdjAME', titulo: 'Por qué la medición cambia todo en un progresivo' },
  ],
};
