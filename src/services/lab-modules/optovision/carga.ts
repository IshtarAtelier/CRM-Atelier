import { cantidadDeArmazones, cristalesPorArmazon, framesDeLaOrden } from '../../../lib/order-frames';
import { codigoCortoDeVenta, esCristalDeLab, esDeLab, esNumeroDeLab } from '../../../lib/laboratorios/identidad';
import { avisoDeRoles, rolesDeDosPares, type RolesDePares } from '../../../lib/laboratorios/roles-2x1';
import { itemsDeTenido } from '../../../lib/crystal-color';
import { estiloDeTenidoDelProducto } from '../../../lib/constants/tenido';
import { precioConSigno } from '../../../lib/format-precio';
import { especificacionDe, familiaDelNombre, FORMAS_OVES, SERVICIO_CALIBRADO, SERVICIO_COLORACION, SERVICIO_OTROS_NINGUNO, SERVICIO_TRATAMIENTO, TIPO_ARMAZON_OVES, type Eleccion, type EspecificacionOves } from './catalogo';
import { marcaDePromo, observacionPrimerPar, observacionSegundoPar, type MarcaDePromo } from './promo';

/**
 * EL PEDIDO DE OPTOVISIÓN, ARMADO DESDE LA VENTA (puro, sin base ni navegador).
 *
 * Devuelve exactamente lo que el robot va a escribir en el formulario de OVES
 * (docs/oves-portal.md, sección "Formulario de nuevo pedido"), campo por
 * campo, o la lista de lo que falta. Nada se inventa: si un dato obligatorio
 * no está en la venta ni lo puso quien prepara, el pedido no se prepara y se
 * dice qué falta. Lo que la persona aprueba después es este plan, más la
 * captura del formulario real del portal.
 *
 * Lo que la venta NO guarda y elige quien prepara (visto en producción el
 * 19/10/2026: `labCrizal`, `labFrameType` y `labEdgeInStore` vienen vacíos en
 * las 45 ventas recientes): el Crizal, el calibrado, el tipo y la forma del
 * armazón, si se manda el armazón, y el cupón de la promo.
 */

export type LentesOves = 'AO' | 'OD' | 'OI';
export type RolPromo = 'PRIMER_PAR' | 'SEGUNDO_PAR' | null;

export interface OjoOves {
    esf: string;             // "-0.50"
    cil: string | null;      // "-1.50"
    eje: string | null;      // "90"
    adic: string | null;     // "2.00" (select del portal, de 0.75 a 4.00)
    dnp: string | null;      // "34.0"
    altura: string | null;   // "30.0"
}

export interface PlanOves {
    par: number;
    pares: number;
    /** Qué promo de Optovisión aplica a la venta, si alguna. */
    promo: { tipo: 'DOBLE' | 'MI_PRIMER'; marca: MarcaDePromo | null } | null;
    rolPromo: RolPromo;
    /** El nº web del 1er par (va en la observación del 2º). */
    pedidoOrigen: string | null;
    /** El cupón de la web de la promo (va en la observación del 1er par). */
    cupon: string | null;
    clase: EspecificacionOves['clase'];
    /** El producto del CRM tal como se vendió. */
    productoCRM: string;
    /** El producto de OVES: lo que se escribe en "Producto" (label) y lo que el portal guarda (value). */
    producto: { label: string; value: string; linea: string; cod: string };
    familia: string;
    tipo: EspecificacionOves['tipo'];
    lentes: LentesOves;
    od: OjoOves | null;
    oi: OjoOves | null;
    /** Descripción EXACTA de la opción de cada servicio del formulario. */
    servicios: { tratamiento: string; calibrado: string; coloracion: string; otros: string };
    armazon: { forma: number | null; tipo: string | null; tipoEtiqueta: string | null; a: string | null; b: string | null; ed: string | null; puente: string | null; envia: 'Si' | 'No'; marca: string };
    diametro: string | null;
    /** "Referencia Cliente (nro u otro)": código corto + nombre + par. */
    pedinterno: string;
    paciente: string;
    observacion: string;
    /** Lo que eligió quien prepara, para re-armar igual al confirmar. */
    opciones: OpcionesCargaOves;
}

export interface OpcionesCargaOves extends Eleccion {
    /** `code` de lib/constants/crizal.ts (CRIZAL_FORTE_UV…) o 'NUMAX' / 'SIN_AR'. */
    tratamiento?: string | null;
    calibrado?: keyof typeof SERVICIO_CALIBRADO | null;
    tipoArmazon?: string | null;   // '1'..'5' (tipoarm)
    forma?: number | null;         // armazonLente
    enviaArmazon?: 'Si' | 'No' | null;
    cupon?: string | null;
    pedidoOrigen?: string | null;
}

export type ResultadoPlan = { ok: true; plan: PlanOves; avisos: string[] } | { ok: false; faltantes: string[]; avisos: string[]; aMano?: string | null };

/** Lo que el armado necesita de la venta: un recorte plano, sin Prisma (venta.ts lo lee). */
export interface VentaParaCargaOves {
    id: string;
    labStatus?: string | null;
    labNotes?: string | null;
    labCrizal?: string | null;
    labFrameType?: string | null;
    labDiameter?: string | null;
    labEdgeInStore?: boolean | null;
    labPrismOD?: string | null;
    labPrismOI?: string | null;
    appliedPromoName?: string | null;
    userFrameBrand?: string | null;
    userFrameModel?: string | null;
    labFrameDetails?: string | null;
    labPdOd?: number | null; labPdOi?: number | null;
    labHeightOD?: number | null; labHeightOI?: number | null;
    frameA?: string | null; frameB?: string | null; frameDbl?: string | null; frameEdc?: string | null;
    frameA2?: string | null; frameB2?: string | null; frameDbl2?: string | null; frameEdc2?: string | null;
    labFrameShape?: string | null; labFrameShape2?: string | null; labFrameDetails2?: string | null;
    labHeightOD2?: number | null; labHeightOI2?: number | null;
    frames?: { position: number; shape: string | null; a: string | null; b: string | null; dbl: string | null; edc: string | null; details: string | null; heightOD: number | null; heightOI: number | null }[];
    client?: { name: string | null } | null;
    prescription?: {
        sphereOD: number | null; cylinderOD: number | null; axisOD: number | null;
        sphereOI: number | null; cylinderOI: number | null; axisOI: number | null;
        addition: number | null; additionOD: number | null; additionOI: number | null;
        pd: number | null; distanceOD: number | null; distanceOI: number | null;
        heightOD: number | null; heightOI: number | null;
    } | null;
    items: {
        eye: string | null; quantity?: number | null; framePosition: number | null; price: number;
        productNameSnapshot: string | null; productTypeSnapshot: string | null; productCategorySnapshot: string | null; laboratorySnapshot: string | null;
        product?: { name: string | null; category: string | null; type: string | null; price: number | null; laboratory?: string | null } | null;
        sphereVal: number | null; cylinderVal: number | null; axisVal: number | null; additionVal: number | null; pdVal: number | null; heightVal: number | null;
        crystalColor: string | null; crystalColorType?: string | null; crystalColorNote?: string | null;
    }[];
}

type Item = VentaParaCargaOves['items'][number];

const num = (v: unknown): number | null => {
    if (v === null || v === undefined || v === '') return null;
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
};
const texto = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());
/** Graduación como la escribe el portal: signo y dos decimales ("-0.50", "+2.00"). */
const conSigno = (n: number) => `${n > 0 ? '+' : n < 0 ? '-' : ''}${Math.abs(n).toFixed(2)}`;
/** Medida con un decimal, como la pide el portal ("34.0"). */
const unDecimal = (n: number) => n.toFixed(1);

const esCristalOpto = (i: Item) => esCristalDeLab(i, 'OPTOVISION');
const nombreDe = (i: Item) => texto(i.product?.name ?? i.productNameSnapshot);

/** Los cristales de Optovisión de la venta, por par (el repartidor único de la venta, lib/order-frames). Puro. */
export function cristalesPorPar(venta: Pick<VentaParaCargaOves, 'items'>): Map<number, Item[]> {
    const pares = new Map<number, Item[]>();
    for (const [par, items] of cristalesPorArmazon(venta as any)) {
        const deOpto = (items as Item[]).filter(esCristalOpto);
        if (deOpto.length) pares.set(par, deOpto);
    }
    return pares;
}

/**
 * ¿La venta es una promo doble de Optovisión (Doble Disfrute Varilux / 2x1
 * Kodak / 2x1 Sygnus)? Dos pares de cristales de Optovisión de la misma
 * familia, vendidos como 2x1 (el producto lo dice o la promo aplicada). Puro.
 */
export function esPromoDobleDeOptovision(venta: VentaParaCargaOves): boolean {
    if (cantidadDeArmazones(venta as any) < 2) return false;
    const porPar = cristalesPorPar(venta);
    const p1 = porPar.get(1) ?? [], p2 = porPar.get(2) ?? [];
    if (!p1.length || !p2.length) return false;
    if (familiaDelNombre(nombreDe(p1[0])) !== familiaDelNombre(nombreDe(p2[0]))) return false;
    const dice2x1 = (s: string) => /\b2\s*x\s*1\b/i.test(s);
    return dice2x1(nombreDe(p1[0])) || dice2x1(nombreDe(p2[0])) || dice2x1(texto(venta.appliedPromoName));
}

/** En la promo doble, qué par va 1º (el de mayor valor, con cargo) y cuál 2º (roles-2x1.ts). Puro. */
export function rolesDeLaPromo(venta: VentaParaCargaOves): RolesDePares | null {
    if (!esPromoDobleDeOptovision(venta)) return null;
    const porPar = cristalesPorPar(venta);
    return rolesDeDosPares([{ pair: 1, items: porPar.get(1) ?? [] }, { pair: 2, items: porPar.get(2) ?? [] }]);
}

/** Qué promo de Optovisión aplica a la venta y de qué marca es. Puro. */
export function promoDeVenta(venta: VentaParaCargaOves): PlanOves['promo'] {
    const porPar = cristalesPorPar(venta);
    const primero = porPar.get(1)?.[0] ?? [...porPar.values()][0]?.[0];
    if (!primero) return null;
    const marca = marcaDePromo(nombreDe(primero)) ?? marcaDePromo(familiaDelNombre(nombreDe(primero)));
    if (esPromoDobleDeOptovision(venta)) return { tipo: 'DOBLE', marca };
    if (/^mi primer /i.test(nombreDe(primero).normalize('NFD').replace(/[̀-ͯ]/g, ''))) return { tipo: 'MI_PRIMER', marca };
    return null;
}

export function rolDe(roles: RolesDePares | null, pair: number): RolPromo {
    if (!roles) return null;
    return pair === roles.sinCargo ? 'SEGUNDO_PAR' : pair === roles.conCargo ? 'PRIMER_PAR' : null;
}

/**
 * La observación del pedido: la promo como la pide Optovisión (promo.ts), la
 * coloración (el formulario solo dice pleno/degradé/muestra: el tono y el
 * grado van acá, como los escribe el equipo: "Coloracion Sepia 3") y las notas
 * de la venta. Puro.
 */
export function observacionDelPedido(o: { promo: PlanOves['promo']; rolPromo: RolPromo; cupon: string | null; pedidoOrigen: string | null; familia: string; tenido: { color: string; grado: string } | null; notas: string | null }): string {
    const partes: string[] = [];
    if (o.promo) {
        const nombre = o.promo.tipo === 'MI_PRIMER' ? `Mi Primer ${o.promo.marca === 'KODAK' ? 'Kodak' : 'Varilux'}` : o.promo.marca === 'VARILUX' ? 'Doble Disfrute Varilux' : o.promo.marca === 'KODAK' ? '2x1 Kodak' : `2x1 ${o.familia}`;
        if (o.rolPromo === 'SEGUNDO_PAR') partes.push(`Promo ${nombre} - ${observacionSegundoPar(o.pedidoOrigen) ?? 'Segundo par promo (FALTA el nº del 1er par)'}`);
        else partes.push(`Promo ${nombre} - ${observacionPrimerPar(o.cupon) ?? 'Primer par de Promo (FALTA el cupón)'}`);
    }
    if (o.tenido) partes.push(`Coloracion ${o.tenido.color}${o.tenido.grado ? ` ${o.tenido.grado}` : ''}`);
    if (texto(o.notas)) partes.push(texto(o.notas).replace(/\s*\n\s*/g, ' '));
    return partes.join('. ');
}

/** "Referencia Cliente (nro u otro)": `#XXXX Nombre N°par`, como el equipo y los otros dos robots; a lo sumo 30 letras (el buscador del portal corta ahí). Puro. */
export function referenciaDelPedido(orderId: string, cliente: string, pair: number, pares: number): string {
    const codigo = codigoCortoDeVenta(orderId);
    const sufijo = pares > 1 ? ` ${pair}° par` : '';
    const largoNombre = Math.max(0, 30 - codigo.length - 1 - sufijo.length);
    const nombre = texto(cliente).replace(/\s+/g, ' ').slice(0, largoNombre).trim();
    return `${codigo}${nombre ? ` ${nombre}` : ''}${sufijo}`;
}

export function tipoArmazonDeVenta(textoVenta: string | null | undefined): { value: string; label: string } | null {
    const t = texto(textoVenta);
    if (!t) return null;
    const m = TIPO_ARMAZON_OVES.find(x => x.crm.test(t));
    return m ? { value: m.value, label: m.label } : null;
}

export function planDeCarga(venta: VentaParaCargaOves, par: number, opciones: OpcionesCargaOves = {}): ResultadoPlan {
    const faltantes: string[] = [];
    const avisos: string[] = [];
    const pares = cantidadDeArmazones(venta as any);
    if (par < 1 || par > pares) return { ok: false, faltantes: [`la venta no tiene par ${par}`], avisos };

    // Con dos pares, un cristal sin armazón asignado no se adivina (regla de todos los módulos).
    if (pares > 1 && venta.items.some(i => esCristalOpto(i) && i.framePosition == null)) faltantes.push('hay cristales sin armazón asignado: indicá en la venta a qué par (armazón 1 o 2) va cada cristal');
    const fueraDeRango = venta.items.find(i => esCristalOpto(i) && i.framePosition != null && (i.framePosition < 1 || i.framePosition > pares));
    if (fueraDeRango) faltantes.push(`hay un cristal asignado al armazón ${fueraDeRango.framePosition}, que la venta no tiene: reasignalo`);
    const cristales = cristalesPorPar(venta).get(par) ?? [];
    if (!cristales.length) return { ok: false, faltantes: [...faltantes, `la venta no tiene cristales de Optovisión para el par ${par}`], avisos };
    const productoCRM = nombreDe(cristales[0]);
    const nombres = [...new Set(cristales.map(nombreDe))];
    if (nombres.length > 1) faltantes.push(`el par ${par} mezcla dos cristales distintos (${nombres.join(' y ')}): OVES carga un producto por pedido`);

    // Teñido del par (solo las líneas de teñido, nunca el tono de un fotocromático).
    const tenidos = itemsDeTenido(venta.items as any[]) as Item[];
    if (pares > 1 && tenidos.some(i => i.framePosition == null)) faltantes.push('hay un teñido sin armazón asignado: indicá en la venta a qué par va (el de sol)');
    const lineaTenido = tenidos.find(i => (pares > 1 ? i.framePosition : (i.framePosition ?? 1)) === par) ?? null;
    let tenido: { estilo: keyof typeof SERVICIO_COLORACION; color: string; grado: string } | null = null;
    if (lineaTenido) {
        const estilo = (estiloDeTenidoDelProducto(lineaTenido.product ?? { name: lineaTenido.productNameSnapshot }) || (lineaTenido.crystalColorType as string | null) || '').toUpperCase();
        const color = texto(lineaTenido.crystalColor);
        if (!(estilo in SERVICIO_COLORACION) || estilo === 'SIN') faltantes.push(`teñido del par ${par}: falta el estilo (pleno, degradé o según muestra)`);
        if (!color) faltantes.push(`teñido del par ${par}: falta el color`);
        if (estilo in SERVICIO_COLORACION && color) tenido = { estilo: estilo as keyof typeof SERVICIO_COLORACION, color, grado: texto(lineaTenido.crystalColorNote) };
    }

    // Producto: la equivalencia declarada (catalogo.ts). El color del Transitions / Xperio sale del ítem.
    const colorItem = cristales.map(c => texto(c.crystalColor)).find(Boolean) || null;
    const res = especificacionDe(productoCRM, { color: colorItem, eleccion: opciones });
    if (!res.ok) {
        faltantes.push(res.motivo);
        return { ok: false, faltantes, avisos, aMano: res.aMano ? res.motivo : null };
    }
    const esp = res.especificacion;
    avisos.push(...esp.avisos);

    // Promo: roles (el caro es el 1º), cupón y nº del 1º.
    const promo = promoDeVenta(venta);
    const roles = rolesDeLaPromo(venta);
    const rolPromo: RolPromo = promo?.tipo === 'MI_PRIMER' ? 'PRIMER_PAR' : rolDe(roles, par);
    const avisoRoles = roles ? avisoDeRoles(roles, precioConSigno) : null;
    if (avisoRoles) avisos.push(avisoRoles);
    const cupon = texto(opciones.cupon) || null;
    const pedidoOrigen = texto(opciones.pedidoOrigen) || null;
    if (rolPromo === 'PRIMER_PAR' && !cupon) faltantes.push(`es el 1er par de la promo ${promo?.marca === 'KODAK' ? 'Kodak' : 'Varilux'}: hace falta el cupón de la web de la promo (sin él Optovisión cobra los dos pares)`);
    if (rolPromo === 'SEGUNDO_PAR' && !esNumeroDeLab(pedidoOrigen || '', 'OPTOVISION')) faltantes.push(`es el 2º par de la promo: se carga con el 1er par (par ${roles!.conCargo}) ya cargado, porque lleva su nº en la observación`);

    // Tratamiento: lo que dice el producto; si es "+ CRIZAL", cuál lo dice la venta (labCrizal) o quien prepara.
    let tratamiento: string | null = null;
    if (esp.tratamiento === 'NUMAX') tratamiento = SERVICIO_TRATAMIENTO.NUMAX;
    else if (esp.tratamiento === 'SIN' || esp.tratamiento === 'INCLUIDO') tratamiento = SERVICIO_TRATAMIENTO.SIN_AR;
    else {
        const code = texto(opciones.tratamiento) || texto(venta.labCrizal);
        if (!code) faltantes.push('el cristal lleva Crizal: elegí cuál (Forte UV, Prevencia o Sapphire)');
        else if (!SERVICIO_TRATAMIENTO[code] || code === 'NUMAX') faltantes.push(`el Crizal "${code}" no es uno de los conocidos`);
        else tratamiento = SERVICIO_TRATAMIENTO[code];
    }
    if (esp.tratamiento === 'INCLUIDO') avisos.push('el producto ya trae su tratamiento de fábrica: el pedido va "sin tratamiento" como servicio aparte');

    // Calibrado: lo elige quien prepara; la venta solo sabe si el cristal se calibra en el local.
    const calibradoClave = opciones.calibrado ?? (venta.labEdgeInStore ? 'SIN' : null);
    if (!calibradoClave) faltantes.push('calibrado (común, perforado, ranurado o sin calibrar): se elige al preparar');
    const calibrado = calibradoClave ? SERVICIO_CALIBRADO[calibradoClave] : null;
    if (calibradoClave && !calibrado) faltantes.push(`el calibrado "${calibradoClave}" no es uno de los del portal`);

    // Receta por ojo: la línea del cristal, o la receta de la venta.
    const rx = venta.prescription;
    const multifocal = esp.tipo !== 'MONOFOCAL';
    const frame = venta.frames?.find(f => f.position === par) ?? framesDeLaOrden(venta as any).find((f: any) => f.position === par) ?? null;
    const ojo = (lado: 'OD' | 'OI'): OjoOves | null => {
        const item = cristales.find(c => texto(c.eye).toUpperCase() === lado) ?? (cristales.length === 1 && !cristales[0].eye ? cristales[0] : null);
        if (!item) return null;
        const esf = num(item.sphereVal) ?? num(lado === 'OD' ? rx?.sphereOD : rx?.sphereOI);
        if (esf === null) faltantes.push(`esférico ${lado}`);
        const cil = num(item.cylinderVal) ?? num(lado === 'OD' ? rx?.cylinderOD : rx?.cylinderOI);
        const eje = num(item.axisVal) ?? num(lado === 'OD' ? rx?.axisOD : rx?.axisOI);
        if (cil && eje === null) faltantes.push(`eje ${lado} (hay cilindro sin eje)`);
        const add = num(item.additionVal) ?? num(lado === 'OD' ? rx?.additionOD : rx?.additionOI) ?? num(rx?.addition);
        if (multifocal && add === null) faltantes.push(`adición ${lado}`);
        const dnp = num(item.pdVal) ?? num(lado === 'OD' ? venta.labPdOd : venta.labPdOi) ?? num(lado === 'OD' ? rx?.distanceOD : rx?.distanceOI) ?? (num(rx?.pd) != null ? Math.round(num(rx?.pd)! / 2 * 2) / 2 : null);
        if (dnp === null) faltantes.push(`DNP ${lado}`);
        // La altura es del ARMAZÓN: en el 2º par no vale la de la ficha (suele ser la del 1º).
        const alturaDelPar = num(item.heightVal) ?? num(lado === 'OD' ? frame?.heightOD : frame?.heightOI);
        const altura = alturaDelPar ?? (par === 1 ? num(lado === 'OD' ? venta.labHeightOD : venta.labHeightOI) ?? num(lado === 'OD' ? rx?.heightOD : rx?.heightOI) : null);
        // OVES la exige también en monofocales de tallado digital (regla OBLIG del Eyezen Start, 19/10/2026).
        if (altura === null) faltantes.push(par > 1 ? `altura pupilar ${lado} del armazón ${par} (la de la ficha es la del 1er armazón)` : `altura pupilar ${lado}`);
        return { esf: conSigno(esf ?? 0), cil: cil ? conSigno(cil) : null, eje: cil ? String(Math.round(eje ?? 0)) : null, adic: multifocal && add !== null ? add.toFixed(2) : null, dnp: dnp === null ? null : unDecimal(dnp), altura: altura === null ? null : unDecimal(altura) };
    };
    const od = ojo('OD');
    const oi = ojo('OI');
    if (!od && !oi) faltantes.push('ningún ojo con cristal');
    if (texto(venta.labPrismOD) || texto(venta.labPrismOI)) faltantes.push('la venta tiene prismas: el robot no los carga, cargá este pedido a mano en OVES');

    // Armazón: medidas de la venta; tipo y forma, de la venta o de quien prepara.
    const tipoArmazon = (opciones.tipoArmazon ? TIPO_ARMAZON_OVES.find(t => t.value === String(opciones.tipoArmazon)) ?? null : null) ?? tipoArmazonDeVenta(venta.labFrameType);
    if (!tipoArmazon) faltantes.push('tipo de armazón (Zilo/Acetato, Metal, Montura al aire, Hilo Nylon o Hilo de Acero): se elige al preparar');
    const forma = opciones.forma ?? null;
    if (forma !== null && !(FORMAS_OVES as readonly number[]).includes(Number(forma))) faltantes.push(`la forma del armazón tiene que ser una de las del portal (${FORMAS_OVES.join(', ')})`);
    const medida = (v: unknown): string | null => { const n = num(v); return n === null ? null : unDecimal(n); };
    const a = medida(frame?.a), b = medida(frame?.b), ed = medida(frame?.edc), puente = medida(frame?.dbl);
    for (const [nombre, valor] of [['A', a], ['B', b], ['puente', puente]] as const) if (valor === null) faltantes.push(`medida del armazón ${par}: ${nombre}`);
    const marcaArmazon = [venta.userFrameBrand, venta.userFrameModel, frame?.details].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    const envia: 'Si' | 'No' = opciones.enviaArmazon ?? (marcaArmazon ? 'Si' : 'No');

    if (faltantes.length) return { ok: false, faltantes, avisos };

    const cliente = texto(venta.client?.name);
    const plan: PlanOves = {
        par, pares, promo, rolPromo, pedidoOrigen: rolPromo === 'SEGUNDO_PAR' ? pedidoOrigen : null, cupon: rolPromo === 'PRIMER_PAR' ? cupon : null,
        clase: esp.clase, productoCRM,
        producto: { label: esp.producto.label, value: esp.producto.value, linea: esp.producto.linea, cod: esp.producto.cod },
        familia: esp.familia, tipo: esp.tipo,
        lentes: od && oi ? 'AO' : od ? 'OD' : 'OI',
        od, oi,
        servicios: { tratamiento: tratamiento!, calibrado: calibrado!, coloracion: tenido ? SERVICIO_COLORACION[tenido.estilo] : SERVICIO_COLORACION.SIN, otros: SERVICIO_OTROS_NINGUNO },
        armazon: { forma: forma === null ? null : Number(forma), tipo: tipoArmazon!.value, tipoEtiqueta: tipoArmazon!.label, a, b, ed, puente, envia, marca: envia === 'Si' ? marcaArmazon : '' },
        diametro: medida(venta.labDiameter),
        pedinterno: referenciaDelPedido(venta.id, cliente, par, pares),
        paciente: cliente,
        observacion: observacionDelPedido({ promo, rolPromo, cupon, pedidoOrigen, familia: esp.familia, tenido: tenido ? { color: tenido.color, grado: tenido.grado } : null, notas: venta.labNotes ?? null }),
        opciones: { ...opciones, cupon, pedidoOrigen },
    };
    return { ok: true, plan, avisos };
}

/**
 * La HUELLA de lo que se aprobó: si la venta cambia después de aprobar
 * (receta, producto, servicios, armazón, promo), rearmar el plan da otra
 * huella y no se manda nada. Puro.
 */
export function huellaDelPlan(p: PlanOves): string {
    return JSON.stringify({ clase: p.clase, producto: p.producto.value, lentes: p.lentes, od: p.od, oi: p.oi, servicios: p.servicios, armazon: p.armazon, diametro: p.diametro, pedinterno: p.pedinterno, paciente: p.paciente, observacion: p.observacion, rolPromo: p.rolPromo, pedidoOrigen: p.pedidoOrigen, cupon: p.cupon });
}

/** Qué cambió entre dos planes, en palabras. Puro. */
export function diferenciasDePlan(aprobado: PlanOves, hoy: PlanOves): string[] {
    const j = (v: unknown) => JSON.stringify(v ?? null);
    const campos: [string, unknown, unknown][] = [
        ['producto', aprobado.producto.value, hoy.producto.value], ['OD', aprobado.od, hoy.od], ['OI', aprobado.oi, hoy.oi], ['servicios', aprobado.servicios, hoy.servicios],
        ['armazón', aprobado.armazon, hoy.armazon], ['observación', aprobado.observacion, hoy.observacion], ['referencia', aprobado.pedinterno, hoy.pedinterno],
        ['paciente', aprobado.paciente, hoy.paciente], ['promo', [aprobado.rolPromo, aprobado.pedidoOrigen, aprobado.cupon], [hoy.rolPromo, hoy.pedidoOrigen, hoy.cupon]],
    ];
    return campos.filter(([, x, y]) => j(x) !== j(y)).map(([n]) => n);
}

/** Un ítem de la venta es de Optovisión (para el listado y la ficha). */
export const esItemDeOptovision = (i: { laboratorySnapshot?: string | null; product?: { laboratory?: string | null } | null }) => esDeLab(i, 'OPTOVISION');
