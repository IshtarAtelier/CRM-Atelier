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
 * ÓPTICAS MAYORISTAS (Ishtar, 25/9/2026)
 * Son clientes, pero B2B: su recorrido por la tienda no se le enseña a Meta,
 * con el mismo criterio con que sus compras ya no se espejaban (ver
 * `medirCompraWeb` en api/checkout/payway). A diferencia del equipo, SÍ entran
 * en la analítica propia, que es donde se las quiere ver, y gtag carga igual.
 * El servidor lo sabe por la sesión (OPTICA); el navegador, por la cookie
 * `ate_mayorista=1` que ponen el login y /api/auth/me.
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

export const COOKIE_MAYORISTA = 'ate_mayorista';
const PATRON_COOKIE_MAYORISTA = /(?:^|;\s*)ate_mayorista=1(?:;|$)/;

/** ¿El navegador de una óptica mayorista, por su cookie? (servidor) */
export function esNavegadorMayorista(cookieHeader: string | null | undefined): boolean {
  return Boolean(cookieHeader) && PATRON_COOKIE_MAYORISTA.test(cookieHeader as string);
}

function cookiesDelNavegador(): string {
  if (typeof document === 'undefined') return '';
  try {
    return document.cookie;
  } catch {
    return '';
  }
}

/** ¿Este navegador es del equipo? (cliente; en el servidor siempre false) */
export function navegadorEsInterno(): boolean {
  return PATRON_COOKIE_INTERNO.test(cookiesDelNavegador());
}

/** ¿Este navegador no le cuenta nada a Meta? El equipo o una óptica mayorista. */
export function navegadorSinMeta(): boolean {
  const c = cookiesDelNavegador();
  return PATRON_COOKIE_INTERNO.test(c) || PATRON_COOKIE_MAYORISTA.test(c);
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

/** Como `conGuardaInterno`, pero tampoco corre para una óptica mayorista. Es la del píxel de Meta. */
export function conGuardaSinMeta(js: string): string {
  return `if(!${PATRON_COOKIE_INTERNO.toString()}.test(document.cookie)&&!${PATRON_COOKIE_MAYORISTA.toString()}.test(document.cookie)){\n${js}\n}`;
}

/**
 * Opciones del Set-Cookie de las dos marcas. NO es httpOnly a propósito: el
 * navegador la tiene que poder leer para no cargar el píxel.
 */
export function opcionesCookieMarca(maxAge = TRAFICO_INTERNO_MAX_AGE_S) {
  return {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}
