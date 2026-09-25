/**
 * Tráfico del equipo: un navegador marcado como interno no le cuenta nada a
 * Meta ni a Google, y tampoco entra en la analítica propia.
 *
 * EL DAÑO QUE EVITA (25/9/2026)
 * `/api/web/track` espeja el embudo a Meta por el Conversions API para TODO el
 * tráfico, y el espejo server-side no depende del píxel ni de ningún permiso
 * del navegador. Cada prueba del equipo —mirar una ficha, cargar un carrito,
 * verificar un deploy en /checkout— le llegaba a Meta como un ViewContent,
 * AddToCart o InitiateCheckout de un cliente. La campaña "Ventas | Tienda
 * online" optimiza con esos eventos: el ruido propio le enseña a buscar gente
 * como nosotros.
 *
 * CÓMO SE MARCA UN NAVEGADOR
 * Una cookie de larga duración (`ate_interno=1`) que ponen dos lugares:
 *  - `/interno` (src/app/interno/route.ts): para el celular o la compu de
 *    cualquiera del equipo, con o sin usuario en el CRM.
 *  - El middleware, cuando alguien del equipo abre /admin con su sesión: todo
 *    navegador donde se usa el CRM queda marcado solo. Las cuentas OPTICA
 *    (mayoristas) NO se marcan: son clientes, no el equipo.
 * La pone siempre el SERVIDOR (Set-Cookie), nunca `document.cookie`: Safari le
 * corta a 7 días la vida a las cookies escritas por JavaScript.
 *
 * QUÉ NO TOCA
 * Las compras. `MetaConversionService.registrarCompra*` no mira esta marca: una
 * compra real de alguien del equipo sigue siendo una compra, y la analítica
 * propia la registra igual (el `purchase` lo graba el checkout del lado del
 * servidor, no pasa por /api/web/track).
 *
 * Sin dependencias a propósito: lo importan el middleware (edge), una ruta
 * (node) y el navegador.
 */

export const COOKIE_TRAFICO_INTERNO = 'ate_interno';

/** 400 días: el tope que Chrome le pone a cualquier cookie. */
export const TRAFICO_INTERNO_MAX_AGE_S = 400 * 24 * 60 * 60;

/**
 * Sirve igual para el header `Cookie` del servidor y para `document.cookie`:
 * los dos separan con "; ". Exige el nombre exacto (`xate_interno=1` no vale)
 * y el valor exacto (`ate_interno=0` no vale).
 */
const PATRON_COOKIE_INTERNO = /(?:^|;\s*)ate_interno=1(?:;|$)/;

/** ¿Este request viene de un navegador del equipo? (servidor) */
export function esTraficoInterno(cookieHeader: string | null | undefined): boolean {
  return Boolean(cookieHeader) && PATRON_COOKIE_INTERNO.test(cookieHeader as string);
}

/** ¿Este navegador es del equipo? (cliente; en el servidor siempre false) */
export function navegadorEsInterno(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    return PATRON_COOKIE_INTERNO.test(document.cookie);
  } catch {
    return false;
  }
}

/**
 * Envuelve un script inline de medición (gtag, píxel) para que no corra en un
 * navegador del equipo. Hace falta además de `navegadorEsInterno()` porque esos
 * scripts se hornean en el HTML estático del build: la decisión tiene que
 * tomarse en el navegador, al ejecutarse, no al renderizar.
 */
export function conGuardaInterno(js: string): string {
  return `if(!${PATRON_COOKIE_INTERNO.toString()}.test(document.cookie)){\n${js}\n}`;
}

/**
 * Opciones del Set-Cookie. NO es httpOnly a propósito: el navegador la tiene
 * que poder leer para no cargar el píxel ni gtag.
 */
export function opcionesCookieInterno(maxAge = TRAFICO_INTERNO_MAX_AGE_S) {
  return {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}
