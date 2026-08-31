/**
 * Cómo se dicen las condiciones de pago en las piezas de redes.
 *
 * MISMO CRITERIO QUE `identidad.mjs` CON LOS COLORES: el dato no se escribe acá,
 * se LEE de donde ya vive. El recargo de las cuotas largas de Mercado Pago es
 * `RECARGO_MP_CUOTAS_LARGAS` en `src/lib/constants/descuentos.ts` — la misma
 * constante que usan PricingService, el checkout y la conversión de saldos. Los
 * cuatro generadores tenían el `1.10` tipeado a mano, o sea cinco copias del
 * mismo número esperando divergir.
 *
 * Se lee con regex y no con `import` porque los generadores corren con `node`
 * pelado (ver package.json → social:producto), sin `--experimental-strip-types`.
 *
 * LA REGLA DE COMUNICACIÓN (Ishtar, 31/8/2026 — decisión explícita):
 * el costo financiero de las 12 cuotas se ACLARA SIEMPRE, en toda superficie.
 * Las 12 NUNCA se anuncian "sin interés" — sin interés son solo 3 y 6. Antes de
 * esa fecha acá regía lo contrario ("nunca el %"), y por eso las placas salían
 * mostrando la cuota financiada sin decir que lo estaba. Si aparece otra vez un
 * comentario que diga "nunca el %", está desactualizado.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { RAIZ } from './identidad.mjs';

const DESCUENTOS_TS = path.join(RAIZ, 'src', 'lib', 'constants', 'descuentos.ts');

let cache = null;

/** El % de costo financiero de las 12 cuotas, leído de la constante canónica. */
export async function recargoCuotasLargas() {
    if (cache !== null) return cache;
    const ts = await readFile(DESCUENTOS_TS, 'utf-8');
    const m = ts.match(/RECARGO_MP_CUOTAS_LARGAS\s*=\s*(\d+(?:\.\d+)?)/);
    if (!m) {
        throw new Error(
            'No se pudo leer RECARGO_MP_CUOTAS_LARGAS de src/lib/constants/descuentos.ts. ' +
            'Sin ese número una pieza publicaría una cuota financiada sin su costo: se frena acá.');
    }
    cache = Number(m[1]);
    return cache;
}

/**
 * Todo lo que hace falta para escribir las 12 cuotas en una pieza:
 * el importe (misma fórmula que `PricingService.cuotasMpLargas`) y la frase
 * con la aclaración obligatoria.
 */
export async function cuotasLargas(precioLista) {
    const recargo = await recargoCuotasLargas();
    const factor = 1 + recargo / 100;
    const importe = Math.round((Math.round(precioLista || 0) * factor) / 12);
    const plata = `$${importe.toLocaleString('es-AR')}`;
    return {
        recargo,
        factor,
        importe,
        /** "10% de costo financiero" */
        aclaracion: `${recargo}% de costo financiero`,
        /** "12 cuotas de $12.345 (10% de costo financiero)" */
        texto: `12 cuotas de ${plata} (${recargo}% de costo financiero)`,
    };
}

/** Las 12 cuotas nombradas SIN importe (placas sin precio, captions genéricos). */
export async function textoCuotasLargasSinPrecio() {
    const recargo = await recargoCuotasLargas();
    return `hasta 12 cuotas con Mercado Pago (${recargo}% de costo financiero)`;
}

/** Las únicas cantidades de cuotas que son de verdad sin interés. */
export const CUOTAS_SIN_INTERES = [3, 6];
export const TEXTO_CUOTAS_POR_DEFECTO = '6 cuotas sin interés';

/**
 * Lee el setting `web_promo_installments` sin poder inventar una promesa falsa.
 *
 * Espejo de `leerPromoCuotas()` en `src/lib/promo-cuotas.ts` — la tienda y las
 * placas tienen que interpretar ese texto libre igual, si no la story dice un
 * número y la ficha otro. El texto se carga a mano desde /admin/web: si trae un
 * número que no se vende sin interés (por ejemplo "12 cuotas"), se descarta
 * entero. Dividir el precio de lista por 12 y llamarlo "sin interés" sería, al
 * mismo tiempo, la frase prohibida y el precio equivocado.
 */
export function leerPromoCuotas(textoCrudo) {
    const texto = String(textoCrudo || '').trim();
    const n = Number(texto.match(/\d+/)?.[0]);
    if (texto && Number.isFinite(n) && CUOTAS_SIN_INTERES.includes(n)) {
        return { cantidad: n, texto };
    }
    return { cantidad: 6, texto: TEXTO_CUOTAS_POR_DEFECTO };
}
