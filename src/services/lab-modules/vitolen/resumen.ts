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
    const m = String(texto || '').match(/Nro de Trabajo\s*:?\s*(\d{5,}L?)\b/i);
    return m ? m[1] : null;
}

/** El estado de la cabecera del borrador/pedido ("Estado Confirmación"). */
export function estadoDeCabecera(texto: string): string | null {
    const m = String(texto || '').match(/\bEstado\s*:?\s*([^\n\t]+?)(?:\t|\n|$)/);
    return m ? m[1].trim() : null;
}

/**
 * Lo que de verdad se aprueba del resumen: desde "Receta" hasta el pie,
 * sin la cabecera (fecha, nº "Por Asignar") ni el menú, con espacios
 * normalizados. Si al confirmar esto cambió, alguien tocó el pedido con
 * "Modificar" y la aprobación ya no vale. Puro.
 */
export function resumenComparable(texto: string): string {
    const t = String(texto || '').replace(/\r/g, '');
    const desde = t.search(/\bReceta\b/);
    const hasta = t.search(/©\s*\d{4}\s*Vitolen|Confirmar\s*$/);
    const recorte = t.slice(desde >= 0 ? desde : 0, hasta > desde ? hasta : undefined);
    return recorte.replace(/\s+/g, ' ').trim();
}

/**
 * Lo que dice el resumen del borrador, campo por campo: para comparar lo que
 * armó el robot con lo que quedó después de un "Modificar" a mano (cristal,
 * tratamientos, montajes, armazón, ángulos). Tolerante: si una sección falta,
 * queda vacía. Puro.
 */
export interface ResumenLeido {
    codigos: { od: string | null; oi: string | null };
    modelos: { od: string | null; oi: string | null };
    tratamientos: string[];
    montajes: string[];
    armazon: { largo: string | null; altura: string | null; diagonal: string | null; eje: string | null; puente: string | null; tipo: string | null; forma: string | null };
    angulos: { od: { vertice: string | null; pantoscopico: string | null; envolvencia: string | null }; oi: { vertice: string | null; pantoscopico: string | null; envolvencia: string | null } };
    graduacion: { od: string | null; oi: string | null };
}

export function leerResumen(texto: string): ResumenLeido {
    const t = String(texto || '').replace(/\r/g, '');
    const lineas = t.split('\n').map(l => l.replace(/\s+$/, ''));
    const celdas = (l: string) => l.split('\t').map(c => c.trim()).filter(Boolean);
    const lente = (ojo: 'OD' | 'OI') => {
        const l = lineas.find(x => new RegExp(`^${ojo}\\t`).test(x) && /\d{4,}\s*-\s*/.test(x));
        if (!l) return { codigo: null, modelo: null };
        const m = l.match(/(\d{4,})\s*-\s*([^\t]+)/);
        return { codigo: m ? m[1] : null, modelo: m ? m[2].trim() : null };
    };
    const grad = (ojo: 'OD' | 'OI') => {
        // "OD\t+2.25\t-0.75\t90\t2.75\t33.00\t25.00\t14\t6\t4"
        const l = lineas.find(x => new RegExp(`^${ojo}\\t[+-]?\\d`).test(x));
        if (!l) return { graduacion: null, vertice: null, pantoscopico: null, envolvencia: null };
        const c = celdas(l).slice(1);
        return { graduacion: c.slice(0, 6).join(' '), vertice: c[6] ?? null, pantoscopico: c[7] ?? null, envolvencia: c[8] ?? null };
    };
    const seccion = (titulo: RegExp) => { const l = lineas.find(x => titulo.test(x)); return l ? celdas(l).slice(1) : []; };
    const medidas = (() => {
        const i = lineas.findIndex(x => /^Medidas\t/.test(x));
        const c = i >= 0 ? celdas(lineas[i + 1] || '') : [];
        const forma = lineas.find(x => /^Forma OD - \d+/.test(x.trim()))?.trim() ?? null;
        return { largo: c[0] ?? null, altura: c[1] ?? null, diagonal: c[2] ?? null, eje: c[3] ?? null, puente: c[4] ?? null, tipo: c[5] ?? null, forma };
    })();
    const od = lente('OD'), oi = lente('OI'), gOD = grad('OD'), gOI = grad('OI');
    return {
        codigos: { od: od.codigo, oi: oi.codigo },
        modelos: { od: od.modelo, oi: oi.modelo },
        tratamientos: seccion(/^Tratamientos\t/),
        montajes: seccion(/^Montajes\t/),
        armazon: medidas,
        angulos: { od: { vertice: gOD.vertice, pantoscopico: gOD.pantoscopico, envolvencia: gOD.envolvencia }, oi: { vertice: gOI.vertice, pantoscopico: gOI.pantoscopico, envolvencia: gOI.envolvencia } },
        graduacion: { od: gOD.graduacion, oi: gOI.graduacion },
    };
}
