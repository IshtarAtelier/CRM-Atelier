import { armarPedidoSmartLab, type VentaParaSmartLab } from '../../../lib/grupo-optico/armar-pedido';
import { cristalesPorArmazon, framesDeLaOrden, cantidadDeArmazones } from '../../../lib/order-frames';
import { itemsDeTenido } from '../../../lib/crystal-color';
import { estiloDeTenidoDelProducto } from '../../../lib/constants/tenido';
import {
    especificacionDe, TENIDO_COLOR, TENIDO_INTENSIDADES, TENIDO_TIPO, TIPO_ARMAZON, TIPO_ARO,
    type Especificacion,
} from './catalogo';

/**
 * EL PEDIDO DE GRUPO ÓPTICO, ARMADO DESDE LA VENTA (puro).
 *
 * Dos pasos, los dos sin navegador ni base:
 *  1. `planDeCarga(venta, par, opciones)`: qué hay que cargar — el producto
 *     traducido al portal (catalogo.ts), la graduación de ESE par, el teñido,
 *     el armazón, el código interno y la observación. Lo que falta, lo dice.
 *  2. `payloadCreateUpdate(plan, resuelto)`: el cuerpo exacto de
 *     `laboratory/order/createupdate`, con los ids que el robot leyó del
 *     portal en el momento (portal.ts → `resolverEnPortal`). El formato es el
 *     de cinco pedidos reales capturados el 3/10/2026 (docs/smartlab-portal.md).
 *
 * El robot nunca elige: si el producto no tiene equivalencia, si el portal no
 * ofrece exactamente un artículo, si falta un dato, no carga y dice por qué.
 */

export type TipoArmazon = keyof typeof TIPO_ARMAZON; // PLASTICO | METALICO
export type TipoAro = keyof typeof TIPO_ARO;          // ENTERO | RANURADO | PERFORADO

/** Lo que pone quien prepara (la venta no lo guarda o puede estar mal). */
export interface OpcionesCarga {
    tipoArmazon?: TipoArmazon | null;
    tipoAro?: TipoAro | null;
    /** Forma del armazón del portal (1 a 9); opcional. */
    forma?: number | null;
    /** Nº del pedido del 1er par (lo exige el 2º par de un 2x1). */
    pedidoOrigen?: string | null;
}

export interface OjoPlan {
    esferico: string;      // "+0.75"
    cilindrico: string | null; // "-1.00" o null
    eje: string;           // "140" (o "0" sin cilindro)
    adicion: number;       // 1.5 (0 en monofocal)
    esfericoCerca: string | null;
    dnp: string | null;
    altura: string | null;
}

export interface Tenido { tipo: keyof typeof TENIDO_TIPO; color: string; colorId: number; intensidad: string }

export interface PlanDeCarga {
    par: number;
    pares: number;
    producto: string;
    especificacion: Especificacion;
    /** "5" Multifocal, "1" Monofocal… (el portal lo manda como string). */
    lensTypeId: string;
    od: OjoPlan | null;
    oi: OjoPlan | null;
    tenido: Tenido | null;
    codigoOptica: string;
    observacion: string;
    paciente: string;
    armazon: { modelo: string; tipo: TipoArmazon; aro: TipoAro; forma: number | null; a: string | null; b: string | null; ed: string | null; puente: string | null };
}

export type ResultadoPlan = { ok: true; plan: PlanDeCarga; avisos: string[] } | { ok: false; faltantes: string[]; avisos: string[] };

const num = (v: unknown): number | null => {
    if (v === null || v === undefined || v === '') return null;
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
};
const conSigno = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}`;
const medida = (v: unknown): string | null => { const n = num(v); return n === null ? null : String(Number.isInteger(n) ? n : Number(n.toFixed(1))); };
const texto = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());

/** Quién es cada familia del portal como "promo" en la observación ("Smart Free"). Puro. */
function nombreDePromo(producto: string): string {
    const m = producto.match(/smart\s+(free|one|new|pro|exclusive|drive|ai ?lens)/i);
    return m ? `Smart ${m[1][0].toUpperCase()}${m[1].slice(1).toLowerCase()}` : producto.split('·')[0].trim();
}

/**
 * La observación del pedido. En un 2x1 el laboratorio la lee para no cobrar el
 * 2º par: así la escribía el equipo a mano, y la regla de Ishtar (3/10/2026)
 * es que el 2º par diga que va SIN CARGO y el nº de operación del 1º. Puro.
 */
export function observacionDelPedido(opts: { es2x1: boolean; par: number; producto: string; pedidoOrigen?: string | null; notas?: string | null; tenido?: Tenido | null }): string {
    const partes: string[] = [];
    if (opts.es2x1) {
        const promo = `Promo 2x1 ${nombreDePromo(opts.producto)}`;
        partes.push(opts.par === 1 ? `${promo} - 1° par` : `${promo} - 2° par SIN CARGO - 1° par n° ${opts.pedidoOrigen}`);
    }
    // El teñido ya viene escrito en las notas del armado ("Teñido Compacto · Gris · grado 4").
    if (opts.tenido && !/teñido/i.test(texto(opts.notas))) partes.push(`Teñido ${TENIDO_TIPO[opts.tenido.tipo]} ${opts.tenido.color} grado ${opts.tenido.intensidad}`);
    if (texto(opts.notas)) partes.push(texto(opts.notas).replace(/\s*\n\s*/g, ' '));
    return partes.join(' | ');
}

/**
 * ¿La venta es una 2x1 DEL LABORATORIO? Los dos primeros pares tienen que ser
 * cristales de Grupo Óptico vendidos como 2x1 y de la misma familia. Una promo
 * 2x1 propia de la óptica (armazones) o un 2º par de otro laboratorio no es la
 * promo de Grupo Óptico, y escribir "2° par SIN CARGO" ahí confundiría al lab. Puro.
 */
export function esVenta2x1(venta: VentaParaSmartLab): boolean {
    if (cantidadDeArmazones(venta as any) < 2) return false;
    const porPar = cristalesPorArmazon(venta);
    const nombreDe = (i: any) => texto(i?.product?.name ?? i?.productNameSnapshot);
    const esGO2x1 = (i: any) => /grupo[\s-]?[oó]ptico/i.test(texto(i?.laboratorySnapshot ?? i?.product?.laboratory) || 'grupo optico') && /2\s*x\s*1/i.test(nombreDe(i));
    const familia = (i: any) => nombreDe(i).split('·')[0].trim().toLowerCase();
    const p1 = ((porPar.get(1) || []) as any[]).filter(esGO2x1);
    const p2 = ((porPar.get(2) || []) as any[]).filter(esGO2x1);
    return p1.length > 0 && p2.length > 0 && familia(p1[0]) === familia(p2[0]);
}

export function planDeCarga(venta: VentaParaSmartLab, par: number, opciones: OpcionesCarga = {}): ResultadoPlan {
    const faltantes: string[] = [];
    const avisos: string[] = [];
    const pares = cantidadDeArmazones(venta as any);
    if (par < 1 || par > pares) return { ok: false, faltantes: [`la venta no tiene par ${par}`], avisos };

    const cristales = (cristalesPorArmazon(venta).get(par) || []) as any[];
    const producto = texto(cristales[0]?.product?.name ?? cristales[0]?.productNameSnapshot);
    const nombres = [...new Set(cristales.map(c => texto(c.product?.name ?? c.productNameSnapshot)))];
    if (nombres.length > 1) faltantes.push(`el par ${par} mezcla dos cristales distintos (${nombres.join(' y ')}): el portal carga un producto por pedido`);

    // Teñido del par: solo las líneas de teñido (nunca el tono de un fotocromático).
    // Con dos pares, un teñido sin armazón asignado NO se adivina: en las ventas
    // viejas el teñido del par de sol no tenía posición, y tomarlo como del 1º
    // habría mandado el par de sol sin color y el par de ver teñido.
    const tenidos = itemsDeTenido(venta.items as any[]);
    if (pares > 1 && tenidos.some((i: any) => i.framePosition == null)) {
        faltantes.push('hay un teñido sin armazón asignado: indicá en la venta a qué par va (el de sol)');
    }
    const huerfano = tenidos.find((i: any) => i.framePosition != null && (i.framePosition < 1 || i.framePosition > pares));
    if (huerfano) faltantes.push(`hay un teñido asignado al armazón ${huerfano.framePosition}, que la venta no tiene: reasignalo`);
    const lineaTenido = tenidos.find((i: any) => (pares > 1 ? i.framePosition : (i.framePosition ?? 1)) === par);
    let tenido: Tenido | null = null;
    if (lineaTenido) {
        const estilo = (lineaTenido.crystalColorType as Tenido['tipo'] | null) || estiloDeTenidoDelProducto((lineaTenido as any).product) || null;
        const color = texto(lineaTenido.crystalColor);
        const intensidad = texto(lineaTenido.crystalColorNote);
        if (!estilo || !TENIDO_TIPO[estilo]) faltantes.push(`teñido del par ${par}: falta el estilo (compacto, degradé o según muestra)`);
        if (!TENIDO_COLOR[color]) faltantes.push(`teñido del par ${par}: el color "${color || 'sin elegir'}" no es uno de los del laboratorio`);
        if (!TENIDO_INTENSIDADES.includes(intensidad)) faltantes.push(`teñido del par ${par}: falta el grado (0.5 a 4)`);
        if (estilo && TENIDO_TIPO[estilo] && TENIDO_COLOR[color] && TENIDO_INTENSIDADES.includes(intensidad)) {
            tenido = { tipo: estilo, color, colorId: TENIDO_COLOR[color], intensidad };
        }
    }

    const colorItem = cristales.map(c => texto(c.crystalColor)).find(Boolean) || null;
    const res = especificacionDe(producto, { colorItem, conTenido: !!lineaTenido });
    if (!res.ok) { faltantes.push(res.motivo); return { ok: false, faltantes, avisos }; }
    const esp = res.especificacion;
    if (esp.clase === 'LAB' && esp.pasoATenible) avisos.push(`par ${par} con teñido: se carga en Orgánico Blanco 1.49 (el único que el laboratorio tiñe), misma familia ${esp.familia.nombre}`);

    // Stock o laboratorio lo dice el PRODUCTO; si la venta dice otra cosa, se avisa.
    const labType = texto(venta.labType).toUpperCase();
    const clase = esp.clase === 'STOCK' ? 'STOCK' : 'LABORATORY';
    if (labType && labType !== clase) faltantes.push(`la venta dice ${labType === 'STOCK' ? 'Stock' : 'Laboratorio'} pero el cristal "${producto}" es de ${clase === 'STOCK' ? 'stock' : 'laboratorio'}`);

    // Receta, medidas y validaciones de siempre: el armado único (armar-pedido.ts).
    const armado = armarPedidoSmartLab({ ...venta, labType: clase }, par);
    faltantes.push(...armado.faltantes);
    avisos.push(...armado.avisos);

    // 2x1: el 2º par se prepara con el nº del 1º (va en la observación).
    const es2x1 = esVenta2x1(venta);
    const pedidoOrigen = texto(opciones.pedidoOrigen) || null;
    if (es2x1 && par === 2 && !/^80\d{6}$/.test(pedidoOrigen || '')) faltantes.push('el 2º par de un 2x1 se carga con el 1º ya cargado (hace falta su nº de pedido para la observación)');

    const p = armado.payload;
    const lensTypeId = esp.clase === 'STOCK' ? '1' : String(esp.familia.lensTypeId);
    const multifocal = lensTypeId !== '1';
    const ojo = (lado: 'od' | 'oi'): OjoPlan | null => {
        if (!p) return null;
        const esf = num(p[`${lado}_esfera` as const]);
        if (esf === null) return null;
        const cil = num(p[`${lado}_cilindro` as const]);
        const add = num(p[`${lado}_adicion` as const]);
        return {
            esferico: conSigno(esf),
            cilindrico: cil ? conSigno(cil).replace(/^\+/, '+') : null,
            eje: cil ? texto(p[`${lado}_eje` as const]) || '0' : '0',
            adicion: multifocal ? (add ?? 0) : 0,
            esfericoCerca: multifocal && add !== null ? conSigno(esf + add) : null,
            dnp: medida(p[`${lado}_dp` as const]),
            altura: medida(p[`${lado}_altura` as const]),
        };
    };
    const od = ojo('od');
    const oi = ojo('oi');
    if (p && !od && !oi) faltantes.push('ningún ojo con graduación');
    // La altura es del ARMAZÓN: en el 2º par no vale la de la ficha (suele ser la del 1º).
    const frameDelPar = framesDeLaOrden(venta).find(f => f.position === par) ?? null;
    if (multifocal && par > 1) {
        if (od && frameDelPar?.heightOD == null) faltantes.push(`altura pupilar OD del armazón ${par} (la de la ficha es la del 1er armazón)`);
        if (oi && frameDelPar?.heightOI == null) faltantes.push(`altura pupilar OI del armazón ${par} (la de la ficha es la del 1er armazón)`);
    }
    if (multifocal) for (const [lado, o] of [['OD', od], ['OI', oi]] as const) {
        if (o && !o.altura) faltantes.push(`altura pupilar ${lado} del par ${par} (el multifocal no se calibra sin ella)`);
        if (o && !o.dnp) faltantes.push(`DNP ${lado} del par ${par}`);
    }

    const frame = framesDeLaOrden(venta).find(f => f.position === par) ?? null;
    const tipoDeVenta: TipoArmazon | null = p?.tipo_armazon === 'METALICO' ? 'METALICO' : p?.tipo_armazon === 'PLÁSTICO' ? 'PLASTICO' : null;
    const tipoArmazon = opciones.tipoArmazon ?? tipoDeVenta;
    if (!tipoArmazon) faltantes.push('tipo de armazón (plástico o metálico): se elige al preparar');
    const forma = opciones.forma ?? null;
    if (forma !== null && !(Number.isInteger(forma) && forma >= 1 && forma <= 9)) faltantes.push('la forma del armazón va de 1 a 9');

    if (faltantes.length) return { ok: false, faltantes, avisos };

    const codigo = `#${String(venta.id).slice(-4).toUpperCase()}`;
    const cliente = texto(venta.client?.name);
    return {
        ok: true,
        avisos,
        plan: {
            par, pares, producto, especificacion: esp, lensTypeId, od, oi, tenido,
            // Código + nombre: el código vincula con certeza (espejo.ts), el
            // nombre es lo que lee el laboratorio. Con más de un par, cuál: es lo
            // que distingue un pedido del otro al buscar si ya se creó.
            codigoOptica: `${codigo} ${cliente}${pares > 1 ? ` ${par}°par` : ''}`.trim(),
            observacion: observacionDelPedido({ es2x1, par, producto, pedidoOrigen, notas: p?.observaciones, tenido }),
            paciente: cliente,
            armazon: {
                modelo: texto(p?.armazon),
                tipo: tipoArmazon!, aro: opciones.tipoAro ?? 'ENTERO', forma,
                a: medida(frame?.a), b: medida(frame?.b), ed: medida(frame?.edc), puente: medida(frame?.dbl),
            },
        },
    };
}

/** Lo que el robot leyó del portal en el momento (ids verificados por etiqueta). */
export interface ResueltoEnPortal {
    materialId: number;
    colorId: number;
    brandId: number;
    articuloOD: number | null;
    articuloOI: number | null;
    typeRimArticleId: number;
    tinted: { id: number; articleId: number } | null;
    clientId: string;
}

/**
 * El cuerpo de `laboratory/order/createupdate` para un pedido NUEVO. Mismas
 * claves, tipos y formatos que mandó el propio portal en los cinco pedidos
 * capturados el 3/10/2026. Puro.
 */
export function payloadCreateUpdate(plan: PlanDeCarga, r: ResueltoEnPortal): Record<string, unknown> {
    const stock = plan.especificacion.clase === 'STOCK';
    const ojo = (o: OjoPlan | null, articulo: number | null) => o ? {
        NearSpherical: o.esfericoCerca, NearCylindrical: null, NearAxis: '0',
        FarSpherical: o.esferico, FarCylindrical: o.cilindrico, FarAxis: o.eje,
        PupillaryHeight: o.altura, InterpupillaryDistance: o.dnp, FilmHeight: null,
        Article: articulo, StockArticle: stock ? '1' : '0', Addition: o.adicion,
        Prism: null, PrismBase: null, PrismAxis: null,
    } : {
        NearSpherical: null, NearCylindrical: null, NearAxis: '0', FarSpherical: null, FarCylindrical: null, FarAxis: '0',
        PupillaryHeight: null, InterpupillaryDistance: null, FilmHeight: null, Article: null, StockArticle: stock ? '1' : '0',
        Addition: 0, Prism: null, PrismBase: null, PrismAxis: null,
    };
    const der = ojo(plan.od, r.articuloOD);
    const izq = ojo(plan.oi, r.articuloOI);
    const conPrefijo = (pre: string, o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [`${pre}${k}`, v]));
    return {
        lensTypeId: plan.lensTypeId,
        ...conPrefijo('rightEye', der),
        ...conPrefijo('leftEye', izq),
        materialId: r.materialId,
        colorId: r.colorId,
        calibrated: '1',
        // La base la decide el laboratorio (el portal acepta null: "-1" = sin elegir).
        blockBase: null,
        frameType: TIPO_ARMAZON[plan.armazon.tipo],
        typeRimId: String(TIPO_ARO[plan.armazon.aro].id),
        typeRimArticleId: r.typeRimArticleId,
        calibratedCrystalPass: '0',
        treatmentId: null,
        treatmentArticleId: null,
        frameWait: false,
        frameBrought: true,
        rightEyeCrystalBrought: false,
        leftEyeCrystalBrought: false,
        opticsCode: plan.codigoOptica,
        opticsComment: plan.observacion || ' ',
        tintedId: r.tinted?.id ?? null,
        tintedArticleId: r.tinted?.articleId ?? null,
        tintedColor: plan.tenido?.colorId ?? null,
        tintedIntensity: plan.tenido ? Number(plan.tenido.intensidad) : null,
        frameModel: plan.armazon.modelo,
        diameter: null,
        bridge: plan.armazon.puente,
        bridgeA: plan.armazon.a,
        bridgeB: plan.armazon.b,
        bridgeED: plan.armazon.ed,
        angleED: null,
        frameShape: plan.armazon.forma,
        brandId: r.brandId,
        clientId: r.clientId,
        patientId: null,
        sellerId: null,
        warrantyPatientName: plan.paciente,
        crystalPassDescription: 'NULL',
        additionDifference: false,
        signDifference: false,
        isClient: true,
        userId: r.clientId,
        orderId: null,
        isEdit: false,
        giftClaimId: null,
        prismEnabled: false,
        noFrameAllowed: false,
        action: 'insert',
        isExpress: false,
        ownRightEyeChecked: false,
        ownLeftEyeChecked: false,
    };
}
