// ────────────────────────────────────────────────────────────────────────────
// EL ARMADO DEL PEDIDO PARA SMARTLAB (Grupo Óptico), en UN solo lugar.
//
// Lo que sale de acá es el JSON que viaja en el hash `#ATELIER_DATA=` de la URL
// del portal y que el favorito del vendedor (src/app/admin/smartlab-bookmarklet)
// vuelca campo por campo en el formulario de SmartLab.
//
// Por qué existe: hasta el 3/10/2026 este armado vivía COPIADO en dos pantallas
// (Ventas y Pedidos) y las copias diferían en 161 líneas. Una mandaba la
// receta de la postventa y las medidas A/B/ED/Pte, la otra leía la graduación
// de cada línea; las dos mandaban el NOMBRE del cliente como código interno
// (por eso el cruce con el portal era difuso, por nombre) y las dos mandaban al
// par 2 de un 2x1 el cristal del par 1. Ahora las dos pantallas llaman acá.
//
// Reglas que fija este módulo (las verifica `npm run check:armado-go`):
//  · el código interno es el código corto de la venta (#AB12): con él
//    `lab-modules/espejo.ts` vincula el pedido del portal con certeza;
//  · cada par lleva SU cristal y SUS medidas (`framePosition` / `OrderFrame`);
//  · el tipo de pedido (Stock o Laboratorio) es OBLIGATORIO: antes, sin dato,
//    el favorito marcaba "Stock" en silencio;
//  · lo que falta de la receta se DICE y frena (esférico, eje con cilindro,
//    adición en multifocal); DNP y altura solo avisan, el portal los pide igual;
//  · el teñido sale SOLO de las líneas de teñido: el tono de un fotocromático
//    no es un color a hacer.
//
// Módulo PURO: sin prisma, sin React, sin fetch, sin fechas ni plata.
// ────────────────────────────────────────────────────────────────────────────

import { cristalesPorArmazon, framesDeLaOrden } from '../order-frames';
import { itemsDeTenido, tintItemLabel } from '../crystal-color';

/** Lo que el favorito lee del hash. Las claves son las que espera el bookmarklet: no se renombran. */
export interface PayloadSmartLab {
    tipo_lente: string;
    labType: 'STOCK' | 'LABORATORY';
    codigoInterno: string;
    paciente_nombre: string;
    paciente_apellido: string;
    paciente_fullname: string;
    paciente_telefono: string;
    paciente_email: string;
    od_esfera: string; od_cilindro: string; od_eje: string; od_adicion: string;
    oi_esfera: string; oi_cilindro: string; oi_eje: string; oi_adicion: string;
    od_esfera_cerca: string; od_cilindro_cerca: string; od_eje_cerca: string;
    oi_esfera_cerca: string; oi_cilindro_cerca: string; oi_eje_cerca: string;
    od_dp: string; oi_dp: string; od_dp_cerca: string; oi_dp_cerca: string;
    od_altura: string; oi_altura: string;
    observaciones: string;
    color: string;
    armazon: string;
    forma_armazon: string;
    detalles_armazon: string;
    diametro: string;
    indice: string;
    material: string;
    tratamiento: string;
    tipo_tenido: string;
    color_tenido: string;
    intensidad_tenido: string;
    tipo_aro: string;
    tipo_armazon: string;
    medidaA: string; medidaB: string; medidaED: string; medidaPte: string;
    fuzzy_article: string[];
}

export interface ResultadoArmadoSmartLab {
    ok: boolean;
    payload: PayloadSmartLab | null;
    /** Lo que FRENA: sin esto el pedido no se manda. */
    faltantes: string[];
    /** Lo que conviene revisar en el portal, pero no frena. */
    avisos: string[];
}

/** Un ítem de la venta tal como llega a las pantallas (con producto o con snapshots). */
export interface ItemParaSmartLab {
    eye?: string | null;
    quantity?: number | null;
    framePosition?: number | null;
    sphereVal?: number | null; cylinderVal?: number | null; axisVal?: number | null;
    additionVal?: number | null; pdVal?: number | null; heightVal?: number | null;
    crystalColor?: string | null; crystalColorType?: string | null; crystalColorNote?: string | null;
    product?: { name?: string | null; category?: string | null; type?: string | null; brand?: string | null; lensIndex?: string | number | null } | null;
    productNameSnapshot?: string | null;
    productCategorySnapshot?: string | null;
    productTypeSnapshot?: string | null;
    productBrandSnapshot?: string | null;
    productLensIndexSnapshot?: string | null;
}

/** Lo que el armado lee de la venta. Todo opcional: lo que falte se dice, no se inventa. */
export interface VentaParaSmartLab {
    id: string;
    client?: { name?: string | null } | null;
    items?: ItemParaSmartLab[] | null;
    frames?: unknown[] | null;
    appliedPromoName?: string | null;
    prescription?: Record<string, unknown> | null;
    labType?: string | null;
    labPdOd?: number | string | null; labPdOi?: number | string | null;
    labNearPdOd?: number | string | null; labNearPdOi?: number | string | null;
    labHeightOD?: number | string | null; labHeightOI?: number | string | null;
    labMaterial?: string | null; labTreatment?: string | null; labColor?: string | null;
    labDiameter?: string | null; labNotes?: string | null; labFrameType?: string | null;
    frameSource?: string | null; userFrameBrand?: string | null; userFrameModel?: string | null;
    postSaleOrderOption?: string | null; postSaleRxData?: string | null;
    [extra: string]: unknown;
}

/**
 * Contacto que se carga en la ficha del paciente del portal: es el de la
 * ÓPTICA, no el del cliente —el laboratorio se comunica con nosotros, nunca con
 * el paciente—. Hoy el favorito no vuelca estos dos campos; se mantienen en el
 * payload porque las dos copias viejas los mandaban y nada garantiza que el
 * portal no los lea del hash.
 */
const TELEFONO_CONTACTO_PORTAL = '3541215971';
const EMAIL_CONTACTO_PORTAL = 'pisano.ishtar@gmail.com';

/** Los dos valores que acepta el portal; cualquier otra cosa es "sin dato". */
const TIPOS_DE_PEDIDO = ['STOCK', 'LABORATORY'] as const;

const num = (v: unknown): number | null => {
    if (v === null || v === undefined || v === '') return null;
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
};
const entero = (v: unknown): number | null => {
    const n = num(v);
    return n === null ? null : Math.round(n);
};
const texto = (v: unknown): string => (v === null || v === undefined ? '' : String(v).trim());

/** "+1.25" / "-0.75" / "0.00": el formato que el portal muestra en sus desplegables. */
function fmtDioptria(v: number | null, conSigno: boolean): string {
    if (v === null) return '';
    const s = v.toFixed(2);
    return conSigno && v >= 0 ? `+${s}` : s;
}

function productoDe(it: ItemParaSmartLab) {
    return it.product || {
        name: it.productNameSnapshot,
        category: it.productCategorySnapshot,
        type: it.productTypeSnapshot,
        brand: it.productBrandSnapshot,
        lensIndex: it.productLensIndexSnapshot,
    };
}

const CATEGORIAS_ARMAZON = ['Armazón de Receta', 'Lentes de Sol', 'FRAME', 'SUNGLASS'];
function esArmazon(it: ItemParaSmartLab): boolean {
    const cat = texto(productoDe(it)?.category);
    return CATEGORIAS_ARMAZON.includes(cat);
}
function esTratamiento(it: ItemParaSmartLab): boolean {
    const p = productoDe(it);
    return texto(p?.category) === 'Tratamiento' || texto(p?.type).includes('Tratamiento');
}

/** "Cristal Multifocal" → Multifocal; si el tipo no lo dice, el nombre. Nombres tal cual los botones del portal. */
export function tipoDeLenteSmartLab(productType: string | null | undefined, productName: string | null | undefined): string {
    const t = texto(productType).toLowerCase();
    const n = texto(productName).toLowerCase();
    const dice = (s: string) => t.includes(s) || n.includes(s);
    if (dice('multi') || dice('progresiv')) return 'Multifocal';
    if (dice('bifo') && dice('kri')) return 'Bifocal Kri';
    if (dice('bifo')) return 'Bifocal Ft';
    if (dice('ocupa') || dice('intermedio')) return 'Ocupacional';
    return 'Monofocal';
}

/** La receta de la postventa (opción "DIFFERENT"): pisa a la de la venta y a la de las líneas, par por par. */
function recetaDePostventa(order: VentaParaSmartLab, pairNum: number): Record<string, unknown> | null {
    if (order.postSaleOrderOption !== 'DIFFERENT' || !order.postSaleRxData) return null;
    try {
        const rxData = JSON.parse(String(order.postSaleRxData));
        const activa = pairNum === 2 ? rxData?.rx2 : rxData?.rx1;
        return activa && typeof activa === 'object' ? activa : null;
    } catch {
        return null;
    }
}

export function armarPedidoSmartLab(order: VentaParaSmartLab, pairNum: number = 1): ResultadoArmadoSmartLab {
    const faltantes: string[] = [];
    const avisos: string[] = [];
    const items: ItemParaSmartLab[] = Array.isArray(order?.items) ? order.items : [];
    const etiquetaPar = pairNum === 1 ? '' : ` del par ${pairNum}`;

    // ── Los cristales de ESTE par ──────────────────────────────────────────
    // Mismo reparto que usan la ficha, el PDF y la validación: por
    // `framePosition`, y si la venta vieja no lo tiene, por orden (el primer
    // OD/OI es el par 1). Antes el par 2 mandaba `lensItems[0]`: el cristal
    // del par 1 fabricado dos veces.
    const cristales = (cristalesPorArmazon(order).get(pairNum) || []) as ItemParaSmartLab[];
    if (cristales.length === 0) {
        faltantes.push(pairNum === 1 ? 'cristales en la venta' : `cristales propios del par ${pairNum} (ninguna línea de cristal está asignada a ese armazón)`);
        return { ok: false, payload: null, faltantes, avisos };
    }

    const lensProduct = productoDe(cristales[0]);
    const lensName = texto(lensProduct?.name).toLowerCase();
    const tipo_lente = tipoDeLenteSmartLab(lensProduct?.type, lensProduct?.name);
    const necesitaAdicion = tipo_lente !== 'Monofocal';

    let lensIndex = texto(lensProduct?.lensIndex);
    if (!lensIndex && lensName) {
        const m = lensName.match(/\b(1\.\d{2})\b/) || lensName.match(/\b(1\.\d)\b/);
        if (m) lensIndex = m[1];
    }

    // ── Tipo de pedido: obligatorio ────────────────────────────────────────
    const labType = texto(order.labType).toUpperCase() as PayloadSmartLab['labType'];
    if (!TIPOS_DE_PEDIDO.includes(labType)) faltantes.push('tipo de pedido (Stock o Laboratorio)');

    // ── Receta ─────────────────────────────────────────────────────────────
    const rx = (order.prescription || {}) as Record<string, unknown>;
    const post = recetaDePostventa(order, pairNum);
    // Postventa > línea del cristal > ficha de receta. La postventa es la
    // receta NUEVA (la línea guarda la original); la línea le gana a la ficha
    // porque es lo que se cotizó para ese ojo.
    const valor = (postKey: string, item: ItemParaSmartLab | null, itemKey: keyof ItemParaSmartLab, rxKeys: string[]): number | null => {
        if (post && post[postKey] !== undefined) return num(post[postKey]);
        const deLinea = item ? num(item[itemKey]) : null;
        if (deLinea !== null) return deLinea;
        for (const k of rxKeys) {
            const v = num(rx[k]);
            if (v !== null) return v;
        }
        return null;
    };

    // Qué ojos lleva el par: los que tienen línea. Sin ojo cargado (ventas
    // viejas o carga suelta) se mandan los dos.
    const conOjo = cristales.some(c => texto(c.eye));
    const itemDe = (lado: 'OD' | 'OI') => conOjo ? (cristales.find(c => texto(c.eye).toUpperCase() === lado) ?? null) : cristales[0];
    const lados = (['OD', 'OI'] as const).filter(l => itemDe(l) !== null);

    const frame = framesDeLaOrden(order).find(f => f.position === pairNum) ?? null;
    const dp = (lado: 'OD' | 'OI') => {
        if (post && post[lado === 'OD' ? 'pdOd' : 'pdOi'] !== undefined) return num(post[lado === 'OD' ? 'pdOd' : 'pdOi']);
        return num(lado === 'OD' ? order.labPdOd : order.labPdOi)
            ?? num(itemDe(lado)?.pdVal)
            ?? num(rx[lado === 'OD' ? 'distanceOD' : 'distanceOI']);
    };
    const altura = (lado: 'OD' | 'OI') => {
        if (post && post[lado === 'OD' ? 'heightOD' : 'heightOI'] !== undefined) return num(post[lado === 'OD' ? 'heightOD' : 'heightOI']);
        // La altura es del ARMAZÓN (cada par tiene la suya): primero la fila del
        // armazón de este par, después la línea del cristal, al final la ficha.
        return num(lado === 'OD' ? frame?.heightOD : frame?.heightOI)
            ?? num(itemDe(lado)?.heightVal)
            ?? num(rx[lado === 'OD' ? 'heightOD' : 'heightOI']);
    };

    const ojo = (lado: 'OD' | 'OI') => {
        const item = itemDe(lado);
        const vacio = { esfera: '', cilindro: '', eje: '', adicion: '', esferaCerca: '', cilindroCerca: '', ejeCerca: '', dp: '', dpCerca: '', altura: '' };
        if (!item) return vacio;
        const sufijo = lado === 'OD' ? 'OD' : 'OI';
        const esfera = valor(`sphere${sufijo}`, item, 'sphereVal', [`sphere${sufijo}`]);
        if (esfera === null) faltantes.push(`esférico ${lado}${etiquetaPar}`);
        const cilindro = valor(`cylinder${sufijo}`, item, 'cylinderVal', [`cylinder${sufijo}`]);
        const ejeNum = valor(`axis${sufijo}`, item, 'axisVal', [`axis${sufijo}`]);
        const eje = entero(ejeNum);
        if (cilindro && eje === null) faltantes.push(`eje ${lado}${etiquetaPar} (hay cilindro sin eje)`);
        const adicion = valor(`addition${sufijo}`, item, 'additionVal', [`addition${sufijo}`, 'addition']);
        if (necesitaAdicion && adicion === null) faltantes.push(`adición ${lado}${etiquetaPar} (${tipo_lente.toLowerCase()})`);

        const dpL = dp(lado);
        if (dpL === null) avisos.push(`DNP ${lado}${etiquetaPar}: no está cargada, el portal la va a pedir`);
        const alt = altura(lado);
        if (alt === null && necesitaAdicion) avisos.push(`altura pupilar ${lado}${etiquetaPar}: no está cargada, el portal la va a pedir`);

        return {
            esfera: fmtDioptria(esfera, true),
            cilindro: fmtDioptria(cilindro, false),
            eje: eje === null ? '' : String(eje),
            adicion: fmtDioptria(adicion, true),
            esferaCerca: fmtDioptria(num(rx[`nearSphere${sufijo}`]), true),
            cilindroCerca: fmtDioptria(num(rx[`nearCylinder${sufijo}`]), false),
            ejeCerca: texto(entero(rx[`nearAxis${sufijo}`])),
            dp: dpL === null ? '' : String(dpL),
            dpCerca: texto(num(lado === 'OD' ? order.labNearPdOd : order.labNearPdOi) ?? num(rx[`nearDistance${sufijo}`])),
            altura: alt === null ? '' : String(alt),
        };
    };
    const od = ojo('OD');
    const oi = ojo('OI');

    // ── Material, tratamiento, color, diámetro (la postventa puede pisarlos) ──
    let material = texto(post?.material ?? order.labMaterial);
    let tratamiento = texto(post?.treatment ?? order.labTreatment);
    const color = texto(post?.color ?? order.labColor);
    const diameter = texto(post?.diameter ?? order.labDiameter);

    if (!material && lensName) {
        if (lensName.includes('poli')) material = 'Policarbonato';
        else if (lensName.includes('orga') || lensName.includes('orgá')) material = 'Orgánico';
        else if (lensName.includes('alto') || lensName.includes('1.6') || lensName.includes('1.7')) material = 'Alto Índice';
        else if (lensName.includes('vidrio') || lensName.includes('mineral')) material = 'Mineral';
    }
    const tratamientoDeNombre = (n: string): string => {
        if (n.includes('blue') || n.includes('block') || n.includes('filtro azul') || n.includes('filtro de luz')) return 'Filtro Azul';
        if (n.includes('anti') || n.includes('ar')) return 'Antirreflejo';
        if (n.includes('foto') || n.includes('transition')) return 'Fotocromático';
        return '';
    };
    if (!tratamiento && lensName) tratamiento = tratamientoDeNombre(lensName);

    // ── Teñido ─────────────────────────────────────────────────────────────
    // Las líneas de tratamiento sin armazón asignado valen para todos los
    // pares (un antirreflejo); una línea de TEÑIDO sin posición es del par 1,
    // igual que los cristales: no se presta al par 2.
    const tratamientos = items.filter(i => esTratamiento(i) && (i.framePosition == null || i.framePosition === pairNum));
    let tipo_tenido = '';
    let color_tenido = '';
    let intensidad_tenido = '';
    for (const item of tratamientos) {
        const tName = texto(productoDe(item)?.name).toLowerCase();
        if (!tratamiento) tratamiento = tratamientoDeNombre(tName);
        if (!(tName.includes('teñi') || tName.includes('tinte') || tName.includes('color'))) continue;
        if ((item.framePosition ?? 1) !== pairNum) continue;

        if (tName.includes('degrade') || tName.includes('degradé') || tName.includes('bicolor') || tName.includes('fume')) tipo_tenido = 'Degradé';
        else if (tName.includes('doble')) tipo_tenido = 'Doble Degradé';
        else tipo_tenido = 'Pleno';

        if (tName.includes('gris')) color_tenido = 'Gris';
        else if (tName.includes('marr') || tName.includes('cafe')) color_tenido = 'Marrón';
        else if (tName.includes('verde') || tName.includes('g15') || tName.includes('g-15')) color_tenido = 'Verde G15';
        else if (tName.includes('rosa') || tName.includes('pink')) color_tenido = 'Rosa';
        else if (tName.includes('azul') || tName.includes('blue')) color_tenido = 'Azul';
        else if (tName.includes('ama')) color_tenido = 'Amarillo';
        else if (tName.includes('naran')) color_tenido = 'Naranja';
        else if (tName.includes('rojo') || tName.includes('red')) color_tenido = 'Rojo';

        if (tName.includes('10')) intensidad_tenido = '10%';
        else if (tName.includes('25')) intensidad_tenido = '25%';
        else if (tName.includes('50')) intensidad_tenido = '50%';
        else if (tName.includes('75')) intensidad_tenido = '75%';
        else if (tName.includes('85')) intensidad_tenido = '85%';
    }

    // El color cargado en la LÍNEA de teñido manda sobre lo que diga el nombre
    // del producto. Mira SOLO las líneas de teñido (`itemsDeTenido`): desde que
    // el fotocromático guarda su tono, "el primer ítem con crystalColor" podía
    // ser un Transitions, y su color se habría ido a fábrica como un teñido a
    // hacer que el laboratorio no tiene cómo detectar.
    const tenidoDelPar = itemsDeTenido(items).find(i => (i.framePosition ?? 1) === pairNum && (i.crystalColor || i.crystalColorNote));
    if (tenidoDelPar) {
        if (tenidoDelPar.crystalColor) color_tenido = texto(tenidoDelPar.crystalColor);
        if (!tipo_tenido) {
            // "Según muestra" y "Compacto" son Pleno en el desplegable del portal.
            tipo_tenido = tenidoDelPar.crystalColorType === 'DEGRADE' ? 'Degradé' : 'Pleno';
        }
        // El grado (0.5 a 4) es el de la lista de SmartLab (`INTENSIDADES_TENIDO`).
        if (tenidoDelPar.crystalColorNote) intensidad_tenido = texto(tenidoDelPar.crystalColorNote);
    }

    // ── Armazón de ESTE par ────────────────────────────────────────────────
    const armazones = items.filter(esArmazon);
    const armazonDelPar = armazones.some(a => a.framePosition != null)
        ? armazones.find(a => (a.framePosition ?? 1) === pairNum) ?? null
        : armazones[Math.min(pairNum - 1, Math.max(armazones.length - 1, 0))] ?? null;
    const armazonProd = armazonDelPar ? productoDe(armazonDelPar) : null;
    const frameInfo = armazonDelPar
        ? `Armazón ${texto(armazonProd?.brand)} ${texto(armazonProd?.name)}`.replace(/\s+/g, ' ').trim()
        : order.frameSource === 'USUARIO'
            ? `Armazón del cliente ${texto(order.userFrameBrand)} ${texto(order.userFrameModel)}`.replace(/\s+/g, ' ').trim()
            : '';

    // El tipo de armazón sale del que SE MANDA (antes miraba siempre el primero).
    const pista = `${texto(order.labFrameType)} ${texto(armazonProd?.name)}`.toLowerCase();
    let tipo_armazon = '';
    if (pista.includes('acetato') || pista.includes('plást') || pista.includes('plast') || pista.includes('pasta') || pista.includes('nylon')) tipo_armazon = 'PLÁSTICO';
    else if (pista.includes('metal') || pista.includes('metál') || pista.includes('titanio') || pista.includes('acero')) tipo_armazon = 'METALICO';

    const detallesArmazon = texto(frame?.details);
    const clientName = texto(order.client?.name);
    const partesNombre = clientName.split(/\s+/).filter(Boolean);
    const apellido = partesNombre.pop() || '';
    const nombre = partesNombre.join(' ') || apellido;

    const observaciones = [
        texto(post?.notes ?? rx.notes),
        texto(order.labNotes),
        // El grado y el estilo del teñido, con palabras: el desplegable del
        // portal no siempre tiene el grado exacto y así queda escrito igual.
        tenidoDelPar ? `Teñido ${tintItemLabel(tenidoDelPar)}` : '',
    ].filter(Boolean).join(' | ');

    const payload: PayloadSmartLab = {
        tipo_lente,
        labType,
        // El código corto de la venta: es lo que `espejo.ts` usa para vincular
        // el pedido del portal con certeza. El nombre va aparte, en paciente_*.
        codigoInterno: `#${String(order.id).slice(-4).toUpperCase()}`,
        paciente_nombre: nombre,
        paciente_apellido: apellido,
        paciente_fullname: clientName,
        paciente_telefono: TELEFONO_CONTACTO_PORTAL,
        paciente_email: EMAIL_CONTACTO_PORTAL,
        od_esfera: od.esfera, od_cilindro: od.cilindro, od_eje: od.eje, od_adicion: od.adicion,
        oi_esfera: oi.esfera, oi_cilindro: oi.cilindro, oi_eje: oi.eje, oi_adicion: oi.adicion,
        od_esfera_cerca: od.esferaCerca, od_cilindro_cerca: od.cilindroCerca, od_eje_cerca: od.ejeCerca,
        oi_esfera_cerca: oi.esferaCerca, oi_cilindro_cerca: oi.cilindroCerca, oi_eje_cerca: oi.ejeCerca,
        od_dp: od.dp, oi_dp: oi.dp, od_dp_cerca: od.dpCerca, oi_dp_cerca: oi.dpCerca,
        od_altura: od.altura, oi_altura: oi.altura,
        observaciones,
        color,
        armazon: [frameInfo, detallesArmazon].filter(Boolean).join(' - '),
        forma_armazon: texto(frame?.shape),
        detalles_armazon: detallesArmazon,
        diametro: diameter,
        indice: lensIndex,
        material,
        tratamiento,
        tipo_tenido,
        color_tenido,
        intensidad_tenido,
        tipo_aro: 'Calibrado Aro Entero',
        tipo_armazon,
        medidaA: texto(frame?.a),
        medidaB: texto(frame?.b),
        medidaED: texto(frame?.edc),
        medidaPte: texto(frame?.dbl),
        fuzzy_article: [
            lensName.includes('pro') ? 'pro' : '',
            lensName.includes('free') ? 'free' : '',
            lensName.includes('exclusive') ? 'exclusive' : '',
            lensName.includes('drive') ? 'drive' : '',
            lensName.includes('ailens') ? 'ailens' : '',
            lensName.includes('super') ? 'super' : '',
            lensName.includes('asfer') || lensName.includes('asfér') ? 'asfer' : '',
            lensName.includes('org') ? 'org' : '',
            lensName.includes('poli') ? 'poli' : '',
            (lensName.includes('blue') || tratamiento === 'Filtro Azul') ? 'blue' : '',
            (lensName.includes('ar') || tratamiento === 'Antirreflejo') ? 'c/ar' : '',
            lensIndex ? String(lensIndex) : '',
        ].filter(Boolean),
    };

    if (lados.length === 1) avisos.push(`el par ${pairNum} lleva un solo ojo (${lados[0]})`);

    const ok = faltantes.length === 0;
    return { ok, payload: ok ? payload : null, faltantes, avisos };
}

/** La URL del portal con el pedido en el hash, lista para `window.open`. */
export function urlSmartLabConPedido(payload: PayloadSmartLab): string {
    return `https://grupooptico.dyndns.info/smartlab/laboratory/new#ATELIER_DATA=${encodeURIComponent(JSON.stringify(payload))}`;
}

/**
 * El alert de pasos que ven las dos pantallas, con los avisos adentro si los
 * hay. Un solo texto para que Ventas y Pedidos digan exactamente lo mismo.
 */
export function textoPasosSmartLab(avisos: string[]): string {
    const base = '✅ ¡Datos copiados al sistema!\n\nPASOS A SEGUIR:\n1️⃣ Se abrirá la web de SmartLab.\n2️⃣ Hacé clic en tu favorito ⭐ "🤖 Atelier → SmartLab".\n3️⃣ ¡No toques nada un segundo! El sistema elegirá el lente y llenará todo.\n\n⚠️ IMPORTANTE:\nSi la página te tira error "404", es porque se cerró tu sesión de SmartLab. Iniciá sesión manualmente y volvé a tocar este botón amarillo.';
    if (avisos.length === 0) return base;
    return `${base}\n\n👀 REVISÁ EN EL PORTAL:\n• ${avisos.join('\n• ')}`;
}

/** El alert que frena: qué falta cargar en la venta antes de mandar. */
export function textoFaltantesSmartLab(faltantes: string[]): string {
    return `No se puede mandar a SmartLab todavía:\n• ${faltantes.join('\n• ')}`;
}
