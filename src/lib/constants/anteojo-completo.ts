import type { ClaveOpcion } from '@/lib/cristales-web/claves';

/**
 * Con qué cristal se calcula el "Anteojo completo desde $X" de la tarjeta de
 * /tienda y de la ficha de los armazones de receta.
 *
 * Es una decisión de negocio, no técnica: define qué anteojo se promete como
 * piso. Propuesta del 28/9/2026: el antirreflex monofocal de stock ("Stock ·
 * Orgánico Blanco c/AR 1.56", $49.500 ese día), porque es el primer cristal
 * que se recomienda y el "Básico" no trae antirreflex. PENDIENTE de que Ishtar
 * lo confirme antes del deploy.
 *
 * Tiene que ser una opción del configurador (una clave de `CLAVES_OPCION`),
 * así el "desde" es exactamente lo que da el configurador al elegirla. El
 * precio NO se escribe acá: sale del producto vinculado a esa opción en
 * /admin (vía GET /api/web/pricing). Solo monofocal o multifocal: el bifocal
 * y el teñido no son un piso razonable para "anteojo completo".
 */
export const CRISTAL_BASE_ANTEOJO_COMPLETO: Extract<ClaveOpcion, `MONOFOCAL.${string}` | `MULTIFOCAL.${string}`> =
    'MONOFOCAL.ORGANICO_AR';
