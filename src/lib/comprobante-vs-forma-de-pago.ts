/**
 * ¿La forma de pago elegida es la que dice el comprobante? Se responde ANTES de
 * guardar, en la ventana de "Registrar pago", para que el vendedor lo corrija
 * en el momento (pedido de Ishtar, 15/10/2026: "si dice Mercado Pago y
 * seleccionó Pay Way, avisale antes de guardar").
 *
 * Por qué hizo falta: la lectura del comprobante elegía sola la forma de pago y
 * reconocía "Pay Way de Ishtar" por el CUIT 23386152314, que es el MISMO CUIT que
 * imprime el Point de Mercado Pago de Ishtar. Todo ticket de Point caía como
 * Pay Way: en septiembre 2026 fueron 6 de 6 (revisados contra Mercado Pago).
 * El control posterior (receipt-agent) avisaba recién después de guardado.
 *
 * Lógica pura, sin dependencias de servidor: la usan la ruta /api/ocr (que
 * decide plataforma, cuenta y cuotas con los CUIT configurados) y el formulario.
 * Sin certeza no se reclama nada: un dato que no se leyó no genera aviso.
 */
import { plataformaDelMetodo, cuentaDelMetodo, type CuentaDeCobro } from './receipt-references';

/** Lo que el formulario necesita saber del comprobante, ya decidido en el servidor. */
export interface LecturaFormaDePago {
    /** 'MERCADO PAGO' | 'PAY WAY' | 'NARANJA' | 'GO CUOTAS' | null */
    plataforma: string | null;
    cuenta: CuentaDeCobro | null;
    /** Cuotas impresas en el comprobante; null si no figuran (QR y links no las traen). */
    cuotas: number | null;
    /** Es un comprobante de transferencia (no un cobro con tarjeta). */
    esTransferencia: boolean;
}

const NOMBRE_CUENTA: Record<CuentaDeCobro, string> = { ISH: 'Ishtar', YANI: 'Yani' };

/** Cuotas que dice el método ("MERCADO_PAGO_6_YANI" → 6). null si no dice. */
export function cuotasDelMetodo(method: string): number | null {
    const m = (method || '').toUpperCase().match(/_(3|6|12|18)(_|$)/);
    return m ? Number(m[1]) : null;
}

/**
 * La forma de pago que corresponde al comprobante, o null si no hay datos
 * suficientes para elegirla sin adivinar.
 */
export function metodoSegunComprobante(l: LecturaFormaDePago): string | null {
    if (l.plataforma === 'MERCADO PAGO') {
        if (!l.cuenta || !l.cuotas || ![3, 6, 12].includes(l.cuotas)) return null;
        return `MERCADO_PAGO_${l.cuotas}_${l.cuenta}`;
    }
    if (l.plataforma === 'PAY WAY') {
        if (!l.cuenta || !l.cuotas || ![3, 6].includes(l.cuotas)) return null;
        return `PAY_WAY_${l.cuotas}_${l.cuenta}`;
    }
    return null;
}

/**
 * Qué no coincide entre la forma de pago elegida y el comprobante, en palabras
 * para el vendedor. Vacío = todo bien (o nada que se pueda afirmar).
 */
export function diferenciasConElComprobante(method: string, l: LecturaFormaDePago): string[] {
    const avisos: string[] = [];
    const m = (method || '').toUpperCase();
    const esTransferenciaElegida = m.startsWith('TRANSFERENCIA');

    if (l.plataforma && !esTransferenciaElegida) {
        const elegida = plataformaDelMetodo(method);
        if (!elegida) {
            avisos.push(`El comprobante es de ${l.plataforma} y elegiste ${m === 'EFECTIVO' ? 'efectivo' : 'otra forma de pago'}.`);
        } else if (elegida !== l.plataforma) {
            avisos.push(`El comprobante es de ${l.plataforma} y elegiste ${elegida}.`);
        }
    }
    if (l.plataforma && esTransferenciaElegida) {
        avisos.push(`El comprobante es un cobro con ${l.plataforma}, no una transferencia.`);
    }

    // Cuenta y cuotas solo se comparan si la plataforma coincide (si no, el
    // aviso de arriba ya pide cambiar el método entero).
    if (avisos.length === 0 && l.plataforma) {
        const cuentaElegida = cuentaDelMetodo(method);
        if (l.cuenta && cuentaElegida && l.cuenta !== cuentaElegida) {
            avisos.push(`El comprobante es de la cuenta de ${NOMBRE_CUENTA[l.cuenta]} y elegiste la de ${NOMBRE_CUENTA[cuentaElegida]}.`);
        }
        const cuotasElegidas = cuotasDelMetodo(method);
        if (l.cuotas && cuotasElegidas && l.cuotas !== cuotasElegidas) {
            avisos.push(`El comprobante dice ${l.cuotas} cuotas y elegiste ${cuotasElegidas}.`);
        }
    }
    return avisos;
}
