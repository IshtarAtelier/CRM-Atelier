// Este módulo quedó partido en dos con `crystal-color.ts`, que hacía la misma
// pregunta con otro nombre. Todo vive allá ahora; esto es solo el puente para
// no romper imports viejos.
//
// NO agregar nada acá: lo nuevo va en `crystal-color.ts`.

export { needsColorSelection } from './crystal-color';

/** Los tres estilos de teñido. La lista viva está en `constants/tenido.ts`. */
export const COLOR_CATEGORIES = [
    { key: 'COMPACTO', label: 'Color Compacto' },
    { key: 'MUESTRA', label: 'Color Según Muestra' },
    { key: 'DEGRADE', label: 'Color Degradé' },
] as const;
