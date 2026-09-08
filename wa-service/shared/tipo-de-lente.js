/**
 * Espejo de `src/lib/receta/tipo-de-lente.ts` para el wa-service (CommonJS).
 *
 * La regla óptica: una receta lleva multifocal si y solo si tiene ADICIÓN.
 * Sin adición, el lente es monofocal. Punto.
 *
 * Existe acá porque el bot escribe el campo `interest` de la ficha con el
 * `tipoDeLente` que dijo el modelo leyendo una foto, y ese texto vuelve a
 * entrar a su propio contexto en la charla siguiente ("Interés: Multifocal").
 * Un error de lectura se convertía así en una verdad que el bot repetía y
 * sobre la que cotizaba. Reportado por Ishtar el 8/9/2026.
 *
 * Si se cambia la regla, se cambia en los DOS lados (acá y en el .ts).
 */

/** ¿Hay adición? Se mira el valor absoluto: de una foto puede salir con signo. */
function tieneAdicion(add) {
    if (add === null || add === undefined || add === '') return false;
    const n = typeof add === 'number' ? add : parseFloat(String(add).replace(',', '.'));
    return Number.isFinite(n) && Math.abs(n) > 0;
}

/**
 * El interés que corresponde para la ficha, según los números y no según la
 * etiqueta que escribió el modelo. Devuelve uno de los valores que acepta el
 * CRM ('Monofocal' | 'Multifocal'), o el declarado si no habla de focos
 * (ej. 'Lentes de Contacto', que la adición no distingue).
 */
function interesSegunReceta(tipoDeLenteDeclarado, add) {
    const declarado = String(tipoDeLenteDeclarado || '').trim();
    const hablaDeFocos = /mono|multi|bifocal|progres/i.test(declarado);
    // Un interés que no es sobre focos (contacto, solar) no se toca: la
    // adición no dice nada sobre eso.
    if (declarado && !hablaDeFocos) return declarado;
    return tieneAdicion(add) ? 'Multifocal' : 'Monofocal';
}

module.exports = { tieneAdicion, interesSegunReceta };
