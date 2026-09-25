/**
 * EL cálculo del precio de un ítem configurado. Uno solo, puro, compartido.
 *
 * Lo llama el configurador en el navegador (para mostrar) y el checkout en el
 * servidor (para cobrar), con el mismo mapa de opciones que publica
 * GET /api/web/pricing. Antes eran dos implementaciones espejo
 * (calculateTotal en LensConfigurator y recalculateItemPrice en
 * checkout-pricing) que divergieron con plata real de por medio. Si esta
 * función cambia, cambian las dos puntas a la vez y el guard del checkout no
 * tiene de qué quejarse.
 *
 * Sin números de respaldo: una opción que no está disponible es un error,
 * nunca un precio inventado.
 */
import {
    claveDeCristal,
    claveDeTenido,
    tieneCristales,
    type EstiloTenidoWeb,
    type LensConfig,
    type MapaOpciones,
    type MotivoNoDisponible,
    type OpcionCristalWeb,
} from './claves';

export interface DetalleCristal {
    clave: OpcionCristalWeb['clave'];
    etiqueta: string;
    /** Precio del par (lista). */
    precio: number;
    productId: string;
    is2x1: boolean;
}

export interface DetalleTenido extends DetalleCristal {
    tono: string;
    estilo: EstiloTenidoWeb;
}

export type ResultadoCalculo =
    | {
          ok: true;
          /** Lo que paga el cliente por el ítem: armazón + cristales + teñido (0 si es el 2º par bonificado). */
          total: number;
          armazon: number;
          cristal: DetalleCristal | null;
          tenido: DetalleTenido | null;
          /** Segundo par sin cargo del 2x1 Varilux. */
          bonificado2x1: boolean;
      }
    | { ok: false; error: string; clave?: string };

export function motivoLegible(motivo: MotivoNoDisponible | null): string {
    switch (motivo) {
        case 'SIN_PRODUCTO': return 'sin producto vinculado';
        case 'ARCHIVADO': return 'el producto vinculado está archivado';
        case 'SIN_PRECIO': return 'el producto vinculado no tiene precio';
        case 'INACTIVA': return 'la opción está desactivada';
        default: return 'no disponible';
    }
}

function detalle(o: OpcionCristalWeb): DetalleCristal | { error: string } {
    if (!o.disponible || o.precio === null || !o.productId) {
        return { error: `"${o.etiqueta}" no está disponible por ahora (${motivoLegible(o.motivo)}).` };
    }
    return { clave: o.clave, etiqueta: o.etiqueta, precio: o.precio, productId: o.productId, is2x1: o.is2x1 };
}

export function calcularConfiguracion(args: {
    /** Precio del armazón que se cobra (con oferta o mayorista ya resuelto). */
    basePrice: number;
    lensConfig: LensConfig | null | undefined;
    opciones: MapaOpciones;
}): ResultadoCalculo {
    const { basePrice, lensConfig, opciones } = args;
    const armazon = Math.max(0, Number(basePrice) || 0);

    if (!tieneCristales(lensConfig)) {
        return { ok: true, total: armazon, armazon, cristal: null, tenido: null, bonificado2x1: false };
    }

    const cristalClave = claveDeCristal(lensConfig);
    if (cristalClave.error) return { ok: false, error: cristalClave.error };

    let cristal: DetalleCristal | null = null;
    if (cristalClave.clave) {
        const o = opciones[cristalClave.clave];
        if (!o) return { ok: false, error: 'Esa opción de cristal ya no existe en la tienda.', clave: cristalClave.clave };
        const d = detalle(o);
        if ('error' in d) return { ok: false, error: d.error, clave: o.clave };
        cristal = d;
    }

    const tenidoClave = claveDeTenido(lensConfig);
    if (tenidoClave.error) return { ok: false, error: tenidoClave.error };
    let tenido: DetalleTenido | null = null;
    if (tenidoClave.clave) {
        const o = opciones[tenidoClave.clave];
        if (!o) return { ok: false, error: 'Ese estilo de teñido ya no existe en la tienda.', clave: tenidoClave.clave };
        const d = detalle(o);
        if ('error' in d) return { ok: false, error: d.error, clave: o.clave };
        tenido = { ...d, tono: tenidoClave.tono!, estilo: tenidoClave.estilo! };
    }

    // Segundo par del 2x1 Varilux: armazón y cristales sin cargo. El servidor
    // ya validó el apareo con un Varilux pago antes de llegar acá.
    if (lensConfig!.secondPair2x1) {
        return { ok: true, total: 0, armazon: 0, cristal, tenido, bonificado2x1: true };
    }

    const total = armazon + (cristal?.precio ?? 0) + (tenido?.precio ?? 0);
    return { ok: true, total, armazon, cristal, tenido, bonificado2x1: false };
}

/**
 * Cuánto va en cada ojo cuando el precio es por PAR. Misma regla que el
 * mostrador (`armarParesDeCristal` en promo-utils): redondeo, no truncado.
 */
export function precioPorOjo(precioPar: number): number {
    return Math.round((Number(precioPar) || 0) / 2);
}
