import { familiaDelNombre, materialDe, normalizar, varianteDe, type Material } from './catalogo';
import type { OjoOves, PlanOves, VentaParaCargaOves } from './carga';
import { conCuponReal, PATRON_CUPON, providerDePromo, type MarcaDePromo, type TipoDePromo } from './promo';

/**
 * EL CUPÓN DE LA PROMO, LO PURO (sin red ni navegador): cómo se arma el pedido
 * de la web de promo de Optovisión desde la venta y el plan de OVES, cómo se
 * elige la línea y el producto contra el catálogo VIVO del sitio, y cómo se lee
 * el cupón de la página que devuelve. El relevamiento del sitio está en
 * docs/promos-optovision-web.md; el navegador vive en cupon-robot.ts.
 *
 * Regla de la casa: nada se inventa. Si un dato obligatorio del sitio no está
 * en la venta (fecha de nacimiento, DNI, adición, DNP de los dos ojos) o no lo
 * puso quien prepara (género), el cupón no se genera y se dice qué falta.
 */

export type ProviderWeb = NonNullable<ReturnType<typeof providerDePromo>>;
export interface LineaWeb { id: number; name: string; enabled?: number | boolean | null }
export interface ProductoWeb { id: number; name: string; order: number; enabled?: number | boolean | null; promotions_product_line_id?: number }

export type TecnologiaWeb = 'TRANSITIONS' | 'XTRACTIVE' | 'XPERIO' | 'BLUE_UV' | 'LISO';
export type TratamientoWeb = 'PREVENCIA' | 'SAPPHIRE' | 'FORTE_UV' | 'TRIO';
export interface RasgosWeb { material: Material | null; tecnologia: TecnologiaWeb; tratamiento: TratamientoWeb | null }

const limpio = (s: string | null | undefined) => normalizar(s).replace(/\s+/g, ' ');

/** Los rasgos de un producto del SITIO por su nombre ("Varilux Comfort Orma Transitions Gens Gris / Café Con Crizal Prevencia"). Puro. */
export function rasgosDeProductoWeb(name: string): RasgosWeb {
    const n = limpio(name).replace(/blueuv/g, 'blue uv').replace(/\bgen s\b/g, 'gens');
    return {
        material: materialDe(n),
        tecnologia: /xtractive/.test(n) ? 'XTRACTIVE' : /transitions/.test(n) ? 'TRANSITIONS' : /xperio/.test(n) ? 'XPERIO' : /blue uv/.test(n) ? 'BLUE_UV' : 'LISO',
        tratamiento: /prevencia/.test(n) ? 'PREVENCIA' : /sapphire/.test(n) ? 'SAPPHIRE' : /forte/.test(n) ? 'FORTE_UV' : /trio easy clean/.test(n) ? 'TRIO' : null,
    };
}

const TRATAMIENTO_WEB: Record<string, TratamientoWeb> = { CRIZAL_PREVENCIA: 'PREVENCIA', CRIZAL_SAPPHIRE: 'SAPPHIRE', CRIZAL_FORTE_UV: 'FORTE_UV' };

/**
 * Los rasgos del cristal VENDIDO ("VARILUX COMFORT - ORMA TRANSITIONS GEN S +
 * CRIZAL 2x1" + el Crizal elegido al preparar) en los términos del sitio.
 * Varilux no tiene producto "liso" en la web de promo: un "ORMA + CRIZAL" va
 * como Blue UV (misma regla que en OVES) y se avisa. Puro.
 */
export function rasgosDelCristalCRM(nombreCRM: string, tratamientoCode: string | null | undefined, marca: MarcaDePromo | null): { ok: true; rasgos: RasgosWeb; avisos: string[] } | { ok: false; motivo: string } {
    const n = limpio(nombreCRM);
    const material = materialDe(n);
    if (!material || !['ORMA', 'AIRWEAR', 'STYLIS'].includes(material)) return { ok: false, motivo: `la web de la promo solo tiene Orma, Airwear y Stylis; "${nombreCRM}" no dice cuál es` };
    const variante = varianteDe(n);
    if (variante === 'ACCLIMATES') return { ok: false, motivo: `la web de la promo no tiene Acclimates ("${nombreCRM}"): el cupón se genera a mano` };
    const tratamiento = TRATAMIENTO_WEB[String(tratamientoCode || '')] ?? null;
    if (!tratamiento) return { ok: false, motivo: 'la web de la promo exige un Crizal (Prevencia, Sapphire o Forte UV): elegilo al preparar' };
    const avisos: string[] = [];
    let tecnologia: TecnologiaWeb = variante === 'LISO' ? 'LISO' : variante;
    if (tecnologia === 'LISO' && marca === 'VARILUX') {
        tecnologia = 'BLUE_UV';
        avisos.push(`la web de la promo no tiene "${nombreCRM}" sin Blue UV: el cupón va con Blue UV (como en OVES)`);
    }
    return { ok: true, rasgos: { material, tecnologia, tratamiento }, avisos };
}

/** El diseño (línea) del cristal del CRM, como lo nombra el sitio: "varilux comfort max", "kodak precise". Puro. */
export function disenoDelCristalCRM(nombreCRM: string): string {
    return limpio(nombreCRM).replace(/^mi primer /, '').split(/\s[-·]\s/)[0].trim();
}

/** La línea del sitio que corresponde al cristal: nombre igual, o el del sitio que empieza con el del CRM ("Kodak Precise" → "Kodak Precise Next"). Una sola. Puro. */
export function elegirLineaWeb(lineas: LineaWeb[], nombreCRM: string): { ok: true; linea: LineaWeb } | { ok: false; motivo: string } {
    const diseno = disenoDelCristalCRM(nombreCRM);
    const vivas = lineas.filter(l => l.enabled === undefined || l.enabled === null || !!l.enabled);
    const exactas = vivas.filter(l => limpio(l.name) === diseno);
    const candidatas = exactas.length ? exactas : vivas.filter(l => limpio(l.name).startsWith(`${diseno} `));
    if (candidatas.length === 1) return { ok: true, linea: candidatas[0] };
    if (!candidatas.length) return { ok: false, motivo: `la web de la promo no tiene la línea "${familiaDelNombre(nombreCRM)}" (tiene: ${vivas.map(l => l.name).join(', ') || 'ninguna'})` };
    return { ok: false, motivo: `la web de la promo tiene ${candidatas.length} líneas que calzan con "${familiaDelNombre(nombreCRM)}" (${candidatas.map(l => l.name).join(', ')}): no se elige una sola` };
}

/** El producto de la línea con EXACTAMENTE los rasgos del cristal vendido. Uno solo; con cero o varios no se elige. Puro. */
export function elegirProductoWeb(productos: ProductoWeb[], rasgos: RasgosWeb): { ok: true; producto: ProductoWeb } | { ok: false; motivo: string } {
    const vivos = productos.filter(p => p.enabled === undefined || p.enabled === null || !!p.enabled);
    const iguales = vivos.filter(p => { const r = rasgosDeProductoWeb(p.name); return r.material === rasgos.material && r.tecnologia === rasgos.tecnologia && r.tratamiento === rasgos.tratamiento; });
    if (iguales.length === 1) return { ok: true, producto: iguales[0] };
    const pedido = `${rasgos.material} ${rasgos.tecnologia.replace('_', ' ')} ${rasgos.tratamiento?.replace('_', ' ') ?? ''}`.trim();
    if (!iguales.length) return { ok: false, motivo: `la web de la promo no tiene un producto ${pedido} en esa línea` };
    return { ok: false, motivo: `la web de la promo tiene ${iguales.length} productos ${pedido} en esa línea (${iguales.map(p => p.name).join(' / ')}): no se elige uno solo` };
}

/** La regla del sitio para el 2º par (`canSelectSecondProduct`): misma línea y `order` igual o menor que el del 1º. Puro. */
export function segundoAdmitido(primero: ProductoWeb, segundo: ProductoWeb): boolean {
    return segundo.order <= primero.order;
}

/** Un ojo como lo escribe el formulario del sitio (máscaras `Z0U.00`, `Z0.00`, `0UU`, `0.00`, `00`). */
export interface RecetaWeb { esferico: string; cilindrico: string; eje: string; adicion: string; dnp: string }

const sinMas = (s: string) => s.replace(/^\+/, '');

/**
 * Hasta qué adición acepta la web de cada promo: la doble hasta 3.75 (regla
 * `lens:0.75,3.75,0.25` del formulario); "Mi Primer" hasta 1.50 (presbicia
 * inicial: "El campo OD Adición debe ser un número entre 0.75 y 1.50", visto
 * en vivo el 21/10/2026 con una venta real de add 1.75).
 */
export const ADICION_MAXIMA_WEB: Record<TipoDePromo, number> = { DOBLE: 3.75, MI_PRIMER: 1.5 };

/** La receta de un ojo del plan de OVES, en el formato del sitio; o qué le falta. Puro. */
export function recetaWebDe(ojo: OjoOves | null, lado: 'OD' | 'OI', tipo: TipoDePromo = 'DOBLE'): { ok: true; receta: RecetaWeb; avisos: string[] } | { ok: false; faltantes: string[] } {
    if (!ojo) return { ok: false, faltantes: [`receta del ${lado} (la web de la promo pide los dos ojos)`] };
    const faltantes: string[] = [];
    if (!ojo.adic) faltantes.push(`adición ${lado} (la web de la promo solo acepta progresivos)`);
    const dnp = ojo.dnp === null ? null : Math.round(parseFloat(ojo.dnp));
    if (dnp === null || !Number.isFinite(dnp)) faltantes.push(`DNP ${lado}`);
    else if (dnp < 10 || dnp > 40) faltantes.push(`DNP ${lado} (${ojo.dnp}) fuera de lo que acepta la web de la promo (10 a 40)`);
    const adic = ojo.adic ? parseFloat(ojo.adic) : NaN;
    const maxAdic = ADICION_MAXIMA_WEB[tipo];
    if (ojo.adic && (adic < 0.75 || adic > maxAdic)) faltantes.push(`adición ${lado} (${ojo.adic}) fuera de lo que acepta la web de ${tipo === 'MI_PRIMER' ? 'Mi Primer' : 'la promo'} (0.75 a ${maxAdic.toFixed(2)}): generá el cupón a mano si Optovisión lo acepta igual`);
    if (faltantes.length) return { ok: false, faltantes };
    const avisos = dnp !== null && Number(ojo.dnp) !== dnp ? [`DNP ${lado} ${ojo.dnp} va como ${dnp} en la web de la promo (solo acepta enteros)`] : [];
    return { ok: true, avisos, receta: { esferico: sinMas(ojo.esf), cilindrico: ojo.cil ? sinMas(ojo.cil) : '0.00', eje: ojo.cil && ojo.eje ? ojo.eje : '', adicion: ojo.adic!, dnp: String(dnp) } };
}

export interface ClienteWeb {
    nombre: string; apellido: string; dni: string; genero: 'F' | 'M';
    telefono: string | null; email: string | null;
    nacimiento: { iso: string; dia: number; mes0: number; anio: number };
}

/** Nombre y apellido repartidos como los pide el sitio (tal cual están en la ficha, acentos incluidos): 1 palabra → las dos iguales; 2 → nombre / apellido; más → la primera / el resto. Puro. */
export function repartirNombre(nombreCompleto: string): { nombre: string; apellido: string } {
    const t = String(nombreCompleto || '').trim().split(/\s+/).filter(Boolean).map(p => p[0].toUpperCase() + p.slice(1));
    if (!t.length) return { nombre: '', apellido: '' };
    if (t.length === 1) return { nombre: t[0], apellido: t[0] };
    if (t.length === 2) return { nombre: t[0], apellido: t[1] };
    return { nombre: t[0], apellido: t.slice(1).join(' ') };
}

/** Los datos del cliente que pide el sitio, desde la ficha del CRM; el género lo pone quien prepara (el CRM no lo guarda). Puro. */
export function clienteWebDe(cliente: VentaParaCargaOves['client'], genero: string | null | undefined): { ok: true; cliente: ClienteWeb; avisos: string[] } | { ok: false; faltantes: string[] } {
    const faltantes: string[] = [];
    const avisos: string[] = [];
    const { nombre, apellido } = repartirNombre(cliente?.name || '');
    if (!nombre) faltantes.push('nombre del cliente');
    if (limpio(cliente?.name).split(' ').length > 2) avisos.push(`el nombre del cliente se repartió como nombre "${nombre}" y apellido "${apellido}" para la web de la promo`);
    const dni = String(cliente?.dni || '').replace(/\D/g, '');
    if (!/^\d{7,8}$/.test(dni)) faltantes.push('DNI del cliente (7 u 8 dígitos, en la ficha)');
    const g = String(genero || '').trim().toUpperCase();
    if (g !== 'F' && g !== 'M') faltantes.push('género del cliente (F/M): se elige al preparar, la web de la promo lo exige');
    // La ficha guarda la fecha a medianoche UTC (Date); un string "YYYY-MM-DD…" se lee por su día, sin pasar por la zona local.
    const crudo = cliente?.birthDate;
    const nac = crudo instanceof Date ? crudo : typeof crudo === 'string' && /^\d{4}-\d{2}-\d{2}/.test(crudo) ? new Date(`${crudo.slice(0, 10)}T00:00:00.000Z`) : crudo ? new Date(crudo) : null;
    if (!nac || Number.isNaN(nac.getTime())) faltantes.push('fecha de nacimiento del cliente (en la ficha)');
    const telefono = telefonoParaLaWeb(cliente?.phone);
    if (cliente?.phone && !telefono) avisos.push(`el teléfono de la ficha (${cliente.phone}) no entra en el formato de la web de la promo: el cupón va sin teléfono (no es obligatorio)`);
    const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(cliente?.email || '').trim()) ? String(cliente!.email).trim() : null;
    if (faltantes.length) return { ok: false, faltantes };
    // Las fechas de la ficha se guardan a medianoche UTC: se leen en UTC para no correr un día.
    const iso = nac!.toISOString().slice(0, 10);
    return { ok: true, avisos, cliente: { nombre, apellido, dni, genero: g as 'F' | 'M', telefono, email, nacimiento: { iso, dia: nac!.getUTCDate(), mes0: nac!.getUTCMonth(), anio: nac!.getUTCFullYear() } } };
}

/** Todo lo que el robot escribe en la web de la promo. Se guarda en el borrador tal cual. */
export interface PedidoDeCupon {
    provider: ProviderWeb;
    cliente: ClienteWeb;
    receta: { od: RecetaWeb; oi: RecetaWeb };
    /** El cristal del 1er par (y del 2º en las promos dobles), para resolver línea y producto en vivo. */
    primero: { productoCRM: string; rasgos: RasgosWeb };
    segundo: { productoCRM: string; rasgos: RasgosWeb } | null;
}

/**
 * Arma el pedido del cupón desde la venta y los planes de OVES (el del 1er par
 * siempre; el del 2º en las promos dobles). Puro.
 */
export function pedidoDeCupon(o: { venta: VentaParaCargaOves; plan: PlanOves; productoCRMSegundo: string | null; genero: string | null | undefined }): { ok: true; pedido: PedidoDeCupon; avisos: string[] } | { ok: false; faltantes: string[] } {
    const faltantes: string[] = [];
    const avisos: string[] = [];
    const provider = providerDePromo(o.plan.promo?.marca, o.plan.promo?.tipo as TipoDePromo | undefined);
    if (!provider) return { ok: false, faltantes: ['la promo de la venta no es Varilux ni Kodak: la web de la promo no la tiene'] };
    const c = clienteWebDe(o.venta.client, o.genero);
    if (!c.ok) faltantes.push(...c.faltantes); else avisos.push(...c.avisos);
    const tipo = (o.plan.promo?.tipo ?? 'DOBLE') as TipoDePromo;
    const od = recetaWebDe(o.plan.od, 'OD', tipo);
    const oi = recetaWebDe(o.plan.oi, 'OI', tipo);
    if (!od.ok) faltantes.push(...od.faltantes); else avisos.push(...od.avisos);
    if (!oi.ok) faltantes.push(...oi.faltantes); else avisos.push(...oi.avisos);
    const r1 = rasgosDelCristalCRM(o.plan.productoCRM, o.plan.opciones.tratamiento, o.plan.promo?.marca ?? null);
    if (!r1.ok) faltantes.push(r1.motivo); else avisos.push(...r1.avisos);
    let segundo: PedidoDeCupon['segundo'] = null;
    if (o.plan.promo?.tipo !== 'MI_PRIMER') {
        if (!o.productoCRMSegundo) faltantes.push('el 2º par de la promo: la web de la promo pide los dos cristales en el mismo cupón');
        else {
            // El Crizal del 2º par se elige recién al preparar ESE par: para el cupón va el mismo que el 1º y se avisa (al preparar el 2º se compara con lo que lleva el cupón).
            const r2 = rasgosDelCristalCRM(o.productoCRMSegundo, o.plan.opciones.tratamiento, o.plan.promo?.marca ?? null);
            if (!r2.ok) faltantes.push(`2º par: ${r2.motivo}`);
            else { avisos.push(...r2.avisos.map(a => `2º par: ${a}`)); segundo = { productoCRM: o.productoCRMSegundo, rasgos: r2.rasgos }; }
            avisos.push('el cupón lleva para el 2º par el mismo Crizal que el 1º; si el 2º va con otro, el bloque lo avisa al preparar ese par');
            if (disenoDelCristalCRM(o.plan.productoCRM) !== disenoDelCristalCRM(o.productoCRMSegundo)) faltantes.push(`la web de la promo exige el mismo diseño en los dos pares (${familiaDelNombre(o.plan.productoCRM)} y ${familiaDelNombre(o.productoCRMSegundo)}): confirmá con Optovisión y generá el cupón a mano`);
        }
    }
    if (faltantes.length) return { ok: false, faltantes };
    return { ok: true, avisos, pedido: { provider, cliente: (c as { cliente: ClienteWeb }).cliente, receta: { od: (od as { receta: RecetaWeb }).receta, oi: (oi as { receta: RecetaWeb }).receta }, primero: { productoCRM: o.plan.productoCRM, rasgos: (r1 as { rasgos: RasgosWeb }).rasgos }, segundo } };
}

/** El cupón que el robot obtuvo (generado o reutilizado), como queda en el borrador. */
export interface CuponObtenido {
    codigo: string; pedidoId: number; provider: string; url: string; pdfUrl: string | null; obtenidoEl: string; reutilizado: boolean;
    /** Con qué productos del sitio se hizo (para compararlo si se reutiliza). */
    productos?: ProductosDelCupon | null;
    /** El voucher PDF del sitio guardado en NUESTRO storage (la ficha lo enlaza y el mail lo adjunta); null si no se pudo bajar. */
    voucherUrl?: string | null;
    voucherKey?: string | null;
}

/**
 * El plan aprobado, ya con el cupón real: la revisión se hizo con la marca
 * "(lo genera el robot al aprobar)" en la observación, y el plan que se arma
 * al confirmar lleva el cupón. Se comparan en los mismos términos. Puro.
 */
export function planConCupon(plan: PlanOves, cupon: string | null): PlanOves {
    if (!plan.cuponAutomatico || !cupon) return plan;
    return { ...plan, cupon, cuponAutomatico: false, observacion: conCuponReal(plan.observacion, cupon), opciones: { ...plan.opciones, cupon, cuponAutomatico: false } };
}
/** El formulario aprobado (con la marca) en los términos del que se llena al confirmar (con el cupón). Puro. */
export function formularioConCupon(formulario: Record<string, string>, cupon: string | null): Record<string, string> {
    if (!cupon) return formulario;
    return Object.fromEntries(Object.entries(formulario).map(([k, v]) => [k, conCuponReal(v, cupon)]));
}

/** El pedido como lo devuelve el sitio en `/pedidos/<id>` (embebido en `:order="…"`). */
export interface PedidoWeb {
    id: number; provider: string; code: string; code_used_at: string | null;
    document_number: string | null; first_name: string | null; last_name: string | null;
    created_at: string | null; promotions_product_line_id: number | null; first_product_id: number | null; second_product_id: number | null;
}

const desescapar = (s: string) => s.replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** Lee el pedido embebido en la página de detalle del sitio. Null si la página no lo trae o el cupón no tiene forma de cupón. Puro. */
export function pedidoDeLaPagina(html: string): PedidoWeb | null {
    const m = html.match(/:order="([^"]*)"/);
    if (!m) return null;
    let j: any;
    try { j = JSON.parse(desescapar(m[1])); } catch { return null; }
    if (!j || typeof j !== 'object' || !j.id) return null;
    // Tal cual lo escribe el sitio (sin "limpiar": un código con espacios no es un cupón).
    const code = String(j.code ?? '').trim();
    if (!PATRON_CUPON.test(code)) return null;
    return {
        id: Number(j.id), provider: String(j.provider || ''), code, code_used_at: j.code_used_at ?? null,
        document_number: j.document_number == null ? null : String(j.document_number), first_name: j.first_name ?? null, last_name: j.last_name ?? null,
        created_at: j.created_at ?? null, promotions_product_line_id: j.promotions_product_line_id ?? null, first_product_id: j.first_product_id ?? null, second_product_id: j.second_product_id ?? null,
    };
}

/** Una fila del historial del sitio (`/pedidos`). */
export interface FilaHistorial { fecha: string; promocion: string; codigo: string; cliente: string; detalleUrl: string | null; pdfUrl: string | null }

/** Las filas del historial que pueden ser de este cliente: comparten nombre y apellido (sin acentos, en cualquier orden). Puro. */
export function filasDelCliente(filas: FilaHistorial[], nombreCompleto: string): FilaHistorial[] {
    const buscado = limpio(nombreCompleto).split(' ').filter(p => p.length > 1);
    if (!buscado.length) return [];
    return filas.filter(f => { const t = limpio(f.cliente).split(' '); return buscado.every(p => t.includes(p)) || t.filter(p => p.length > 1).every(p => buscado.includes(p)); });
}

/** ¿Un pedido del sitio es de ESTE cliente para ESTA promo? Mismo provider y mismo DNI (usado o no). Puro. */
export function esCuponDelCliente(p: PedidoWeb, o: { provider: string; dni: string }): boolean {
    return p.provider === o.provider && String(p.document_number || '').replace(/\D/g, '') === o.dni.replace(/\D/g, '');
}

/** Un cupón del historial sirve para ESTA venta si no fue usado y es reciente (antes de ese plazo es de otra compra). */
export const DIAS_CUPON_VIGENTE = 60;

/**
 * ¿Un cupón del cliente se puede reutilizar para esta venta? Sin usar
 * (`code_used_at` vacío) y de los últimos `DIAS_CUPON_VIGENTE` días: uno
 * consumido por Optovisión en una compra anterior ya no vale, y escribirlo en
 * OVES haría que cobren los dos pares. Puro.
 */
export function cuponReutilizable(p: PedidoWeb, ahora: Date = new Date()): boolean {
    if (p.code_used_at) return false;
    // El sitio escribe microsegundos ("…46.000000Z"): se recorta a milisegundos para no depender de cómo lo tome el motor.
    const creado = p.created_at ? new Date(String(p.created_at).replace(/(\.\d{3})\d+Z$/, '$1Z')) : null;
    if (!creado || Number.isNaN(creado.getTime())) return false;
    return ahora.getTime() - creado.getTime() <= DIAS_CUPON_VIGENTE * 86_400_000;
}

/** "Mi Primer" se otorga UNA vez por cliente: si el DNI ya tiene un pedido de esa promo que no se puede reutilizar, no se genera otro. Puro. */
export const esProviderMiPrimer = (provider: string) => provider === providerDePromo('VARILUX', 'MI_PRIMER') || provider === providerDePromo('KODAK', 'MI_PRIMER');

/** La fecha de una fila del historial (dd/MM/yyyy). Null si no se entiende. Puro. */
export function fechaDelHistorial(s: string): Date | null {
    const m = String(s || '').match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (!m) return null;
    const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
    return Number.isNaN(d.getTime()) ? null : d;
}

/** Cuántos detalles del historial se abren como mucho en la promo doble (son GET baratos, pero son minutos). En Mi Primer no hay tope: es una vez en la vida y hay que verlos todos. */
export const MAX_DETALLES_HISTORIAL = 120;

/**
 * En qué orden abrir los detalles del historial buscando el DNI: de la fila
 * más NUEVA a la más vieja (el sitio no documenta su orden, y los cupones que
 * sirven son los recientes), las que se parecen al nombre primero. Con `dias`
 * solo las de ese plazo (promo doble: 60 días); sin `dias`, todas (Mi Primer,
 * que se otorga una vez en la vida). Las filas sin fecha legible van al final. Puro.
 */
export function ordenDeBusqueda(filas: FilaHistorial[], nombreCompleto: string, dias: number | null, ahora: Date = new Date()): FilaHistorial[] {
    const conFecha = filas.map(f => ({ f, t: fechaDelHistorial(f.fecha)?.getTime() ?? null }));
    const vigentes = dias === null ? conFecha : conFecha.filter(x => x.t === null || ahora.getTime() - x.t <= dias * 86_400_000);
    const porFecha = (a: { t: number | null }, b: { t: number | null }) => (b.t ?? -Infinity) - (a.t ?? -Infinity);
    const parecidas = new Set(filasDelCliente(vigentes.map(x => x.f), nombreCompleto));
    const primero = vigentes.filter(x => parecidas.has(x.f)).sort(porFecha);
    const resto = vigentes.filter(x => !parecidas.has(x.f)).sort(porFecha);
    const orden = [...primero, ...resto].map(x => x.f);
    return dias === null ? orden : orden.slice(0, MAX_DETALLES_HISTORIAL);
}

/**
 * La columna "Promoción" del historial dice de qué promo es cada fila (visto el
 * 20/10/2026: VDD = Doble Disfrute, MPV = Mi Primer Varilux, K2x1 = Kodak 2x1).
 * Sirve para abrir SOLO los detalles de la promo buscada: abrir los 59 del
 * historial seguidos hizo que el sitio contestara 429 (probado el 21/10). Si
 * la promo no tiene etiqueta conocida (Mi Primer Kodak), se abren todas.
 */
export const ETIQUETA_HISTORIAL: Partial<Record<ProviderWeb, string>> = { varilux: 'VDD', 'mi-primer-varilux': 'MPV', kodak: 'K2x1' };
export function filasDeLaPromo(filas: FilaHistorial[], provider: string): FilaHistorial[] {
    const tag = ETIQUETA_HISTORIAL[provider as ProviderWeb];
    return tag ? filas.filter(f => limpio(f.promocion) === limpio(tag)) : filas;
}

/** Los productos con los que se hizo un cupón (ids del sitio), para compararlos con lo que se carga hoy. */
export interface ProductosDelCupon { linea: number | null; primero: number | null; segundo: number | null }

/** Si el cupón que se va a reutilizar se hizo con OTRO producto que el que el sitio resuelve hoy para esta venta, avisa (fuerte). Puro. */
export function avisoDeCuponDistinto(cupon: string, productos: ProductosDelCupon | null | undefined, hoy: { linea: { id: number; name: string }; primero: { id: number; name: string }; segundo: { id: number; name: string } | null }): string | null {
    if (!productos) return null;
    const dif: string[] = [];
    if (productos.linea !== null && productos.linea !== hoy.linea.id) dif.push(`línea (hoy ${hoy.linea.name})`);
    if (productos.primero !== null && productos.primero !== hoy.primero.id) dif.push(`1er par (hoy ${hoy.primero.name})`);
    if (hoy.segundo && productos.segundo !== null && productos.segundo !== hoy.segundo.id) dif.push(`2º par (hoy ${hoy.segundo.name})`);
    return dif.length ? `OJO: el cupón ${cupon} ya existía y se hizo con otro producto que el de esta venta: ${dif.join(', ')}. Optovisión puede cobrar la diferencia; si corresponde, corregí el cupón a mano en la web de la promo antes de aprobar.` : null;
}

/**
 * El teléfono como lo acepta el sitio (máscara `00U 0000-0000`, 10 u 11
 * dígitos): se saca el 54 / 549 del formato de WhatsApp. Si no entra, va
 * VACÍO (el sitio no lo exige) en vez de trabar el cupón. Puro.
 */
export function telefonoParaLaWeb(crudo: string | null | undefined): string | null {
    let d = String(crudo || '').replace(/\D/g, '');
    if (d.length > 11 && d.startsWith('549')) d = d.slice(3);
    else if (d.length > 11 && d.startsWith('54')) d = d.slice(2);
    return d.length === 10 || d.length === 11 ? d : null;
}
