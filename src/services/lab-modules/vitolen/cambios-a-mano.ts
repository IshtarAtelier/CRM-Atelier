import { CATALOGO_VITOLEN } from '../../../lib/laboratorios/vitolen-catalogo';
import type { ResumenLeido } from './resumen';

/**
 * LO QUE ALGUIEN CAMBIÓ A MANO EN EL PORTAL antes de aprobar, y cuánto vale
 * (Ishtar, 15/10/2026: "si es un agregado o cambio de producto, que registre
 * el motivo y que un robot revise en la lista de precios si eso genera otro
 * costo; que solo avise y me deje un mensaje interno, con la justificación").
 *
 * Se compara el resumen que el robot dejó al preparar con el que se relee
 * después de "Modificar". Cada diferencia dice qué cambió y, cuando la lista
 * lo sabe, cuánto cambia el costo:
 *  · cristal (código de lista): precio de lista del nuevo − el del anterior
 *    (L96, por par, sin IVA, con AR);
 *  · antirreflejo (Ultra Hi-Vision): la lista lo incluye; sacarlo descuenta
 *    DESCUENTO_SIN_AR (Mi Primer Hoya: DESCUENTO_SIN_AR_MPH);
 *  · calibrado: el calibrado del lab (LaboratoryConfig);
 *  · otros tratamientos (color, filtros…): la lista no los trae → "a confirmar";
 *  · ángulos, forma, medidas, graduación: sin costo, pero se anotan igual.
 * Nunca bloquea: la aprobación sigue; el aviso llega a la dueña. Puro.
 */
export const DESCUENTO_SIN_AR = 43_000;
export const DESCUENTO_SIN_AR_MPH = 22_000;

export interface CambioAMano {
    campo: string;
    antes: string;
    despues: string;
    /** Diferencia de costo (positivo = sale más caro); null = la lista no lo valúa. */
    costo: number | null;
    detalle: string;
}

export interface PreciosParaValuar {
    /** Calibrado del laboratorio (LaboratoryConfig.calibrado), sin IVA. */
    calibrado: number;
}

/** El precio de lista de un código del catálogo (L96), o null si no está. Puro. */
export function precioDeCodigo(codigo: string | null | undefined): { precio: number | null; nombre: string | null; mph: boolean } {
    const c = String(codigo || '').trim();
    if (!c) return { precio: null, nombre: null, mph: false };
    const cristal = CATALOGO_VITOLEN.find(x => x.codigos.includes(c));
    return { precio: cristal?.precioLista ?? null, nombre: cristal?.nombre ?? null, mph: cristal?.linea.startsWith('mph') ?? false };
}

const lista = (xs: string[]) => xs.map(x => x.trim()).filter(Boolean).sort();
const igual = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
const esAR = (t: string) => /hi-?vision|antirreflejo|\bar\b/i.test(t);

export function cambiosAMano(antes: ResumenLeido, despues: ResumenLeido, precios: PreciosParaValuar): CambioAMano[] {
    const cambios: CambioAMano[] = [];

    // Cristal, por ojo (código de lista).
    for (const ojo of ['od', 'oi'] as const) {
        const a = antes.codigos[ojo], d = despues.codigos[ojo];
        if ((a || d) && a !== d) {
            const pa = precioDeCodigo(a), pd = precioDeCodigo(d);
            const costo = pa.precio != null && pd.precio != null ? pd.precio - pa.precio : null;
            cambios.push({
                campo: `Cristal ${ojo.toUpperCase()}`,
                antes: `${a ?? '—'}${pa.nombre ? ` (${pa.nombre})` : ''}`,
                despues: `${d ?? '—'}${pd.nombre ? ` (${pd.nombre})` : ''}`,
                costo,
                detalle: costo === null ? 'la lista L96 no tiene precio para alguno de los dos códigos: a confirmar con Vitolen'
                    : `lista ${fmt(pa.precio!)} → ${fmt(pd.precio!)} por par (sin IVA)`,
            });
        }
    }

    // Tratamientos: el AR se valúa; el resto se anota "a confirmar".
    const ta = lista(antes.tratamientos), td = lista(despues.tratamientos);
    if (!igual(ta, td)) {
        const sacados = ta.filter(t => !td.includes(t)), puestos = td.filter(t => !ta.includes(t));
        const mph = precioDeCodigo(despues.codigos.od ?? antes.codigos.od).mph;
        const descuentoAr = mph ? DESCUENTO_SIN_AR_MPH : DESCUENTO_SIN_AR;
        let costo: number | null = 0;
        const partes: string[] = [];
        for (const t of sacados) { if (esAR(t)) { costo! -= descuentoAr; partes.push(`sin ${t}: −${fmt(descuentoAr)}`); } else { costo = null; partes.push(`sin ${t}: la lista no lo valúa`); } }
        for (const t of puestos) { if (esAR(t)) { if (costo !== null) costo += descuentoAr; partes.push(`con ${t}: +${fmt(descuentoAr)}`); } else { costo = null; partes.push(`con ${t}: la lista no lo valúa, a confirmar con Vitolen`); } }
        cambios.push({ campo: 'Tratamientos', antes: ta.join(', ') || 'ninguno', despues: td.join(', ') || 'ninguno', costo, detalle: partes.join(' · ') });
    }

    // Montajes: el calibrado tiene precio en la configuración del lab.
    const ma = lista(antes.montajes), md = lista(despues.montajes);
    if (!igual(ma, md)) {
        const teniaCal = ma.some(m => /calibrad/i.test(m)), tieneCal = md.some(m => /calibrad/i.test(m));
        const otros = [...ma, ...md].some(m => !/calibrad/i.test(m));
        const costo = otros ? null : teniaCal === tieneCal ? 0 : tieneCal ? precios.calibrado : -precios.calibrado;
        cambios.push({
            campo: 'Montajes', antes: ma.join(', ') || 'ninguno', despues: md.join(', ') || 'ninguno', costo,
            detalle: otros ? 'un montaje que la lista no valúa: a confirmar con Vitolen' : tieneCal === teniaCal ? '' : tieneCal ? `se agregó el calibrado: +${fmt(precios.calibrado)}` : `se sacó el calibrado: −${fmt(precios.calibrado)}`,
        });
    }

    // Lo que no cuesta pero cambia el pedido.
    const sinCosto: [string, string | null, string | null][] = [
        ['Forma', antes.armazon.forma, despues.armazon.forma],
        ['Tipo de armazón', antes.armazon.tipo, despues.armazon.tipo],
        ['Medidas (largo/altura/diag./eje/puente)', medidas(antes), medidas(despues)],
        ['Graduación OD', antes.graduacion.od, despues.graduacion.od],
        ['Graduación OI', antes.graduacion.oi, despues.graduacion.oi],
        ['Vértice / pantoscópico / envolvencia OD', angulos(antes, 'od'), angulos(despues, 'od')],
        ['Vértice / pantoscópico / envolvencia OI', angulos(antes, 'oi'), angulos(despues, 'oi')],
    ];
    for (const [campo, a, d] of sinCosto) if ((a || d) && a !== d) cambios.push({ campo, antes: a ?? '—', despues: d ?? '—', costo: 0, detalle: 'sin cambio de costo' });

    return cambios;
}

const medidas = (r: ResumenLeido) => [r.armazon.largo, r.armazon.altura, r.armazon.diagonal, r.armazon.eje, r.armazon.puente].map(x => x ?? '—').join(' / ');
const angulos = (r: ResumenLeido, ojo: 'od' | 'oi') => [r.angulos[ojo].vertice, r.angulos[ojo].pantoscopico, r.angulos[ojo].envolvencia].map(x => x ?? '—').join(' / ');
const fmt = (n: number) => `$ ${Math.round(Math.abs(n)).toLocaleString('es-AR')}`;

/** El costo extra total (solo lo que la lista valúa); `aConfirmar` si algún cambio quedó sin precio. Puro. */
export function impactoDeCambios(cambios: CambioAMano[]): { costoExtra: number; aConfirmar: boolean } {
    return {
        costoExtra: cambios.reduce((t, c) => t + (c.costo ?? 0), 0),
        aConfirmar: cambios.some(c => c.costo === null),
    };
}

/** Una línea por cambio, para la ficha, el AuditLog y el mensaje. Puro. */
export function lineasDeCambios(cambios: CambioAMano[]): string[] {
    return cambios.map(c => `${c.campo}: ${c.antes} → ${c.despues}${c.detalle ? ` (${c.detalle})` : ''}`);
}
