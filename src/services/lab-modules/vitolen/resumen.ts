/**
 * Lo puro de la pantalla del borrador del portal de Vitolen
 * (`/ventas/pedidos_laboratorio/<id>`, docs/vitolen-portal.md). Lo prueba
 * `npm run check:lab-modulos`.
 */

/** El id del borrador a partir de la URL a la que redirige "Crear". */
export function idDeBorradorDeUrl(url: string): string | null {
    const m = String(url || '').match(/\/ventas\/pedidos_laboratorio\/(\d+)(?:[/?#]|$)/);
    return m ? m[1] : null;
}

/**
 * El nº de trabajo que muestra la cabecera ("Nro de Trabajo 6981382L"). Antes
 * de confirmar dice "Por Asignar": null.
 */
export function numeroDeTrabajoDe(texto: string): string | null {
    const m = String(texto || '').match(/Nro de Trabajo\s+(\d{5,}L?)\b/i);
    return m ? m[1] : null;
}

/** El estado de la cabecera del borrador/pedido ("Estado Confirmación"). */
export function estadoDeCabecera(texto: string): string | null {
    const m = String(texto || '').match(/\bEstado\s+([^\n\t]+?)(?:\t|\n|$)/);
    return m ? m[1].trim() : null;
}
