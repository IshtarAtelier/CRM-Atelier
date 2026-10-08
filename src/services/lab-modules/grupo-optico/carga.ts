import { armarPedidoSmartLab, codigoInternoSmartLab, type VentaParaSmartLab } from '../../../lib/grupo-optico/armar-pedido';
import { cristalesPorArmazon, framesDeLaOrden, cantidadDeArmazones } from '../../../lib/order-frames';
import { itemsDeTenido } from '../../../lib/crystal-color';
import { formatearPrecio } from '../../../lib/format-precio';
import { avisoDeRoles, rolesDeDosPares, type RolesDePares } from '../carga/roles-2x1';
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
    /** Nº del pedido del par con cargo (lo exige el par sin cargo de un 2x1). */
    pedidoOrigen?: string | null;
}

export type Rol2x1 = 'CON_CARGO' | 'SIN_CARGO';

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
    /** En un 2x1: qué rol tiene este par (el de mayor valor va con cargo). */
    rol2x1: Rol2x1 | null;
    /** Nº del pedido del par con cargo (solo en el par sin cargo). */
    pedidoOrigen: string | null;
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
export function observacionDelPedido(opts: { es2x1: boolean; sinCargo: boolean; producto: string; pedidoOrigen?: string | null; notas?: string | null; tenido?: Tenido | null }): string {
    const partes: string[] = [];
    if (opts.es2x1) {
        const promo = `Promo 2x1 ${nombreDePromo(opts.producto)}`;
        // "1° par" / "2° par" acá son los de la PROMO (con cargo / sin cargo), no el armazón de la venta.
        partes.push(opts.sinCargo ? `${promo} - 2° par SIN CARGO - 1° par n° ${opts.pedidoOrigen}` : `${promo} - 1° par`);
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
    // Sin laboratorio cargado en el ítem se asume Grupo Óptico (se llama dentro de su carga).
    const esGO = (i: any) => /grupo[\s-]?[oó]ptico/i.test(texto(i?.laboratorySnapshot ?? i?.product?.laboratory) || 'grupo optico');
    const familia = (i: any) => nombreDe(i).split('·')[0].trim().toLowerCase();
    const p1 = ((porPar.get(1) || []) as any[]).filter(esGO);
    const p2 = ((porPar.get(2) || []) as any[]).filter(esGO);
    if (!p1.length || !p2.length || familia(p1[0]) !== familia(p2[0])) return false;
    // La promo la dice el producto ("… 2x1") o la promo aplicada a la venta.
    return /2\s*x\s*1/i.test(nombreDe(p1[0])) || /2\s*x\s*1/i.test(texto(venta.appliedPromoName));
}

/**
 * En un 2x1, qué par va con cargo y cuál sin cargo: el de mayor valor de lista
 * se cobra (Ishtar, 8/10/2026); con el mismo cristal en los dos, el par 1. Puro.
 */
export function rolesDel2x1(venta: VentaParaSmartLab): RolesDePares | null {
    if (!esVenta2x1(venta)) return null;
    const porPar = cristalesPorArmazon(venta);
    const cristales = (pair: number) => ((porPar.get(pair) || []) as any[]).filter(i => /cristal/i.test(texto(i?.product?.category ?? i?.productCategorySnapshot) || 'cristal'));
    return rolesDeDosPares([{ pair: 1, items: cristales(1) }, { pair: 2, items: cristales(2) }]);
}

export function planDeCarga(venta: VentaParaSmartLab, par: number, opciones: OpcionesCarga = {}): ResultadoPlan {
    const faltantes: string[] = [];
    const avisos: string[] = [];
    const pares = cantidadDeArmazones(venta as any);
    if (par < 1 || par > pares) return { ok: false, faltantes: [`la venta no tiene par ${par}`], avisos };

    // Con dos pares, un cristal sin armazón asignado NO se adivina: el reparto
    // "por orden" depende del orden físico de las filas, que cambia con cualquier
    // edición de la venta (auditoría 5, 8/10/2026) — y de eso dependen el rol
    // (con cargo / sin cargo), la graduación y hasta qué ojo va en cada pedido.
    const esCristalDelLab = (i: any) => /cristal/i.test(texto(i?.product?.category ?? i?.productCategorySnapshot))
        && /grupo[\s-]?[oó]ptico/i.test(texto(i?.laboratorySnapshot ?? i?.product?.laboratory) || 'grupo optico');
    if (pares > 1 && (venta.items as any[]).some(i => esCristalDelLab(i) && i.framePosition == null)) {
        faltantes.push('hay cristales sin armazón asignado: indicá en la venta a qué par (armazón 1 o 2) va cada cristal');
    }
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

    // 2x1: el par SIN CARGO (el de menor valor) se prepara con el nº del par con
    // cargo, que va en la observación: es lo que hace que el laboratorio no lo cobre.
    const roles = rolesDel2x1(venta);
    const es2x1 = !!roles;
    const sinCargo = !!roles && par === roles.sinCargo;
    const rol2x1: Rol2x1 | null = roles ? (sinCargo ? 'SIN_CARGO' : 'CON_CARGO') : null;
    const pedidoOrigen = sinCargo ? texto(opciones.pedidoOrigen) || null : null;
    if (sinCargo && !/^80\d{6}$/.test(pedidoOrigen || '')) faltantes.push(`el par sin cargo del 2x1 se carga con el par con cargo (par ${roles!.conCargo}) ya cargado: hace falta su nº de pedido para la observación`);
    const avisoRoles = roles ? avisoDeRoles(roles, formatearPrecio) : null;
    if (avisoRoles) avisos.push(avisoRoles);

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
    // El portal ofrece la DNP de a 0,5 y la altura en enteros (visto en 800 pedidos
    // y en su formulario, 5/10/2026): con otro valor no arma el pedido. No se
    // redondea solo: es la medida del cliente y la corrige quien la tomó.
    const enPaso = (v: string | null, paso: number) => v === null || Math.abs(Number(v) / paso - Math.round(Number(v) / paso)) < 1e-9;
    for (const [lado, o] of [['OD', od], ['OI', oi]] as const) {
        const crudo = (campo: 'dp' | 'altura') => texto(p?.[`${lado.toLowerCase()}_${campo}` as 'od_dp']) || (campo === 'dp' ? o?.dnp : o?.altura);
        if (o && !enPaso(o.dnp, 0.5)) faltantes.push(`DNP ${lado} ${crudo('dp')}: el laboratorio la toma de a 0,5 (corregila en la venta)`);
        if (o && !enPaso(o.altura, 1)) faltantes.push(`altura pupilar ${lado} ${crudo('altura')}: el laboratorio la toma en milímetros enteros (corregila en la venta)`);
    }
    // La altura es del ARMAZÓN: en el 2º par no vale la de la ficha (suele ser la del 1º).
    const frameDelPar = framesDeLaOrden(venta).find(f => f.position === par) ?? null;
    if (multifocal && par > 1) {
        const alturaLinea = (lado: string) => cristales.find((c: any) => texto(c.eye).toUpperCase() === lado)?.heightVal ?? null;
        if (od && frameDelPar?.heightOD == null && alturaLinea('OD') == null) faltantes.push(`altura pupilar OD del armazón ${par} (la de la ficha es la del 1er armazón)`);
        if (oi && frameDelPar?.heightOI == null && alturaLinea('OI') == null) faltantes.push(`altura pupilar OI del armazón ${par} (la de la ficha es la del 1er armazón)`);
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

    const cliente = texto(venta.client?.name);
    const stockSinMedidas = esp.clase === 'STOCK';
    // Las medidas del armazón el portal las ofrece en milímetros enteros: se redondean, y se dice.
    const entero = (v: unknown): string | null => { const n = num(v); return n === null ? null : String(Math.round(n)); };
    if (!stockSinMedidas) {
        const redondeadas = ([['A', frame?.a], ['B', frame?.b], ['ED', frame?.edc], ['puente', frame?.dbl]] as const).filter(([, v]) => { const n = num(v); return n !== null && !Number.isInteger(n); });
        if (redondeadas.length) avisos.push(`medidas del armazón redondeadas a milímetros enteros para el portal: ${redondeadas.map(([n, v]) => `${n} ${v} → ${entero(v)}`).join(', ')}`);
    }
    if (stockSinMedidas && (opciones.forma || frame?.a)) avisos.push('stock: el formulario del portal no lleva medidas ni forma del armazón (no se mandan)');
    return {
        ok: true,
        avisos,
        plan: {
            par, pares, rol2x1, pedidoOrigen, producto, especificacion: esp, lensTypeId, od, oi, tenido,
            // Código + nombre: el código vincula con certeza (espejo.ts), el
            // nombre es lo que lee el laboratorio. Con más de un par, cuál: es lo
            // que distingue un pedido del otro al buscar si ya se creó.
            codigoOptica: codigoInternoSmartLab(venta, par),
            observacion: observacionDelPedido({ es2x1, sinCargo, producto, pedidoOrigen, notas: p?.observaciones, tenido }),
            paciente: cliente,
            armazon: {
                modelo: texto(p?.armazon),
                tipo: tipoArmazon!, aro: opciones.tipoAro ?? 'ENTERO', forma: stockSinMedidas ? null : forma,
                // Stock: el formulario del portal no lleva medidas ni forma del armazón.
                // Laboratorio: enteros, como las ofrece el portal.
                a: stockSinMedidas ? null : entero(frame?.a), b: stockSinMedidas ? null : entero(frame?.b),
                ed: stockSinMedidas ? null : entero(frame?.edc), puente: stockSinMedidas ? null : entero(frame?.dbl),
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
        // Laboratorio: la base la decide el lab (sin elegir). Stock: el formulario del portal pone 4.
        blockBase: stock ? 4 : null,
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
