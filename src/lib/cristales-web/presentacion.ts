import { UMBRAL_EXPLICAR_SALTO_PRECIO } from '@/lib/constants/cristales-web';
import { INFORMACION_OPCIONES } from './informacion';
import type { OpcionCristalWeb } from './claves';

/**
 * Cómo se le presenta cada opción de cristal al cliente en el configurador.
 * Solo texto y reglas de lectura: el precio sigue saliendo de `calculo.ts` y
 * los datos de la opción de la base (WebLensOption + producto vinculado).
 *
 * Por qué existe (informe 15/10/2026, hallazgos 3 y 4): la card decía
 * "Básico (Sin Protección)" —suena a opción mala— y mostraba jerga de óptica
 * ("Antirreflex Premium", "Policarbonato", "20% más delgado") como primer
 * texto. La jerga no se borra: pasa a un plegable "¿qué es esto?".
 */

/**
 * Título sin el paréntesis aclaratorio: "Básico (Sin Protección)" → "Básico",
 * "Antirreflex (Evita Brillos)" → "Antirreflex". Lo que iba entre paréntesis
 * no se pierde: `detalleTecnico` lo pone primero en el plegable.
 *
 * Lo correcto a mediano plazo es corregir la etiqueta en /admin/web →
 * Cristales; esto garantiza que mientras tanto la tienda no diga "sin
 * protección" aunque la base siga diciéndolo.
 */
export function tituloComercial(etiqueta: string): string {
    return etiqueta.replace(/\s*\([^)]*\)\s*$/, '').trim() || etiqueta;
}

function aclaracionDeEtiqueta(etiqueta: string): string | null {
    const m = etiqueta.match(/\(([^)]+)\)\s*$/);
    if (!m) return null;
    const t = m[1].trim();
    return t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : null;
}

/** La frase en lenguaje llano que va a la vista en la card, si la hay. */
export function paraQuien(o: Pick<OpcionCristalWeb, 'clave'>): string | null {
    return INFORMACION_OPCIONES[o.clave]?.paraQuien ?? null;
}

/**
 * Lo que va adentro de "¿qué es esto?": la aclaración del título, la
 * descripción cargada en /admin/web, los destacados y el "qué es" del área de
 * cristales. Vacío si no hay nada que explicar (y entonces no hay plegable).
 */
export function detalleTecnico(o: Pick<OpcionCristalWeb, 'clave' | 'etiqueta' | 'descripcion' | 'destacados'>): string[] {
    const lineas: string[] = [];
    const acl = aclaracionDeEtiqueta(o.etiqueta);
    if (acl) lineas.push(acl);
    if (o.descripcion) lineas.push(o.descripcion);
    for (const d of o.destacados ?? []) if (d) lineas.push(d);
    const info = INFORMACION_OPCIONES[o.clave]?.queEs;
    if (info) lineas.push(info);
    return Array.from(new Set(lineas.map(l => l.trim()).filter(Boolean)));
}

/**
 * Cuando una opción suma más de `UMBRAL_EXPLICAR_SALTO_PRECIO`, una línea que
 * diga por qué, armada con lo que dice el producto vinculado (su nombre en el
 * sistema) y la descripción de la opción. Nada tipeado en la pantalla: si el
 * día de mañana se vincula otro producto, la explicación cambia sola.
 *
 * Null si el precio no supera el umbral o no hay con qué explicarlo.
 */
export function explicacionSaltoPrecio(o: Pick<OpcionCristalWeb, 'clave' | 'precio' | 'nombreProducto' | 'descripcion'>): string | null {
    if (o.precio === null || o.precio <= UMBRAL_EXPLICAR_SALTO_PRECIO) return null;
    const partes: string[] = [];
    if (o.nombreProducto) partes.push(o.nombreProducto);
    const detalle = o.descripcion?.trim() || INFORMACION_OPCIONES[o.clave]?.queEs;
    if (detalle) partes.push(detalle.replace(/\.$/, ''));
    if (partes.length === 0) return null;
    return `Por qué cuesta más: ${partes.join(' — ')}.`;
}
