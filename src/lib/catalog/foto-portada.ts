import { existsSync } from "node:fs";
import { join } from "node:path";
import type { CarouselProduct } from "@/lib/home-fallback";

// ────────────────────────────────────────────────────────────────────────────
// Elegir, en el SERVIDOR, el primer producto de una categoría cuya foto exista
// de verdad.
//
// POR QUÉ NO SE ARREGLA EN EL NAVEGADOR
// Primero se intentó con `onError` en la imagen: si la foto fallaba, la portada
// pasaba al siguiente producto. No funciona, y la razón es sutil: el HTML llega
// del servidor y el navegador empieza a bajar la foto ANTES de que React
// hidrate. Cuando la foto falla en ese intervalo, el evento `error` se dispara
// sin que haya todavía ningún handler escuchando, y se pierde para siempre — la
// portada se queda con el ícono de imagen rota del navegador. Verificado:
// después de 8 segundos el `src` seguía siendo el roto y `naturalWidth` era 0.
//
// POR QUÉ ACÁ SÍ
// Las fotos del catálogo son archivos de `public/`. El servidor puede
// preguntarle al disco si están, antes de mandar el HTML — no hay carrera con
// la hidratación porque no hay hidratación involucrada: sale elegido de fábrica.
//
// EL PROBLEMA DE FONDO NO SE ARREGLA ACÁ
// 24 de los 116 productos publicados apuntan a `/images/products/` y varios de
// esos archivos no existen (nestor-c1, apolo-c2, ares-c2, febo-c1 dan 404
// también en producción). Esto evita que se vea roto en la portada; los datos
// hay que corregirlos aparte.
// ────────────────────────────────────────────────────────────────────────────

/**
 * ¿La foto de este producto existe? Solo se puede responder para rutas locales
 * (`/algo.webp`). Una URL remota o un data URI se dan por buenas: no se puede
 * (ni conviene) salir a la red durante el render.
 */
function laFotoExiste(img: string | null | undefined): boolean {
  if (!img) return false;
  if (img.startsWith("data:") || img.startsWith("http")) return true;
  if (!img.startsWith("/")) return true;
  try {
    // `split("?")` por si alguna ruta trae querystring.
    return existsSync(join(process.cwd(), "public", img.split("?")[0]));
  } catch {
    // Ante cualquier problema leyendo el disco, no se descarta el producto:
    // que se vea la foto (y falle si tiene que fallar) es mejor que dejar la
    // portada vacía por un error de permisos.
    return true;
  }
}

/**
 * El primer producto de la lista cuya foto exista. `undefined` si ninguno la
 * tiene — quien llame decide qué hacer (acá: no dibujar esa portada).
 */
export function primeraFotoQueExiste(
  productos: CarouselProduct[] | null | undefined,
): CarouselProduct | undefined {
  return (productos || []).find((p) => laFotoExiste(p?.img));
}
