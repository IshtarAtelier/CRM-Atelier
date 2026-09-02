/**
 * Formato de precios de la tienda — fuente única.
 *
 * POR QUÉ EXISTE (hallazgo A-14 de la auditoría del 2/9/2026):
 * en el configurador convivían `$215.000` y `$215,000` en la misma pantalla.
 * Esa coma es la firma de un `toLocaleString()` SIN idioma: el servidor de
 * Node resuelve en inglés y el navegador del visitante en español, así que el
 * HTML del servidor y el del cliente no coinciden. En Next.js eso es un error
 * de hidratación, y un error de hidratación deja los componentes cliente sin
 * montar — que es exactamente lo que dejó el nombre y el precio de la ficha
 * congelados en `opacity: 0` (hallazgo A-01). Un mismo bug, dos síntomas.
 *
 * La regla: NUNCA `toLocaleString()` a secas sobre un precio. Siempre por acá,
 * o con `'es-AR'` explícito. El locale fijo hace que servidor y navegador
 * escriban el mismo texto siempre, sin importar dónde corran.
 *
 * `formatearPrecio` NO lleva el signo $ adentro a propósito: hay pantallas que
 * lo separan del número (`<span>$</span><span>182.750</span>`) y otras que
 * anteponen "AR$". El signo lo pone quien lo muestra.
 */

const LOCALE = 'es-AR';

/** 182750 → "182.750". Redondea: en la tienda no se muestran centavos. */
export function formatearPrecio(valor: number | null | undefined): string {
    return Math.round(Number(valor) || 0).toLocaleString(LOCALE);
}

/** 182750 → "$182.750". El atajo para el caso común. */
export function precioConSigno(valor: number | null | undefined): string {
    return `$${formatearPrecio(valor)}`;
}
