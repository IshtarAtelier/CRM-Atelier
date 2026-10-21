import { familiaDelNombre, materialDe, normalizar, varianteDe, type Material } from './catalogo';
import type { OjoOves, PlanOves, VentaParaCargaOves } from './carga';
import { conCuponReal, cuponLimpio, PATRON_CUPON, providerDePromo, type MarcaDePromo, type TipoDePromo } from './promo';

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

/** La receta de un ojo del plan de OVES, en el formato del sitio; o qué le falta. Puro. */
export function recetaWebDe(ojo: OjoOves | null, lado: 'OD' | 'OI'): { ok: true; receta: RecetaWeb } | { ok: false; faltantes: string[] } {
    if (!ojo) return { ok: false, faltantes: [`receta del ${lado} (la web de la promo pide los dos ojos)`] };
    const faltantes: string[] = [];
    if (!ojo.adic) faltantes.push(`adición ${lado} (la web de la promo solo acepta progresivos)`);
    const dnp = ojo.dnp === null ? null : Math.round(parseFloat(ojo.dnp));
    if (dnp === null || !Number.isFinite(dnp)) faltantes.push(`DNP ${lado}`);
    else if (dnp < 10 || dnp > 40) faltantes.push(`DNP ${lado} (${ojo.dnp}) fuera de lo que acepta la web de la promo (10 a 40)`);
    const adic = ojo.adic ? parseFloat(ojo.adic) : NaN;
    if (ojo.adic && (adic < 0.75 || adic > 3.75)) faltantes.push(`adición ${lado} (${ojo.adic}) fuera de lo que acepta la web de la promo (0.75 a 3.75)`);
    if (faltantes.length) return { ok: false, faltantes };
    return { ok: true, receta: { esferico: sinMas(ojo.esf), cilindrico: ojo.cil ? sinMas(ojo.cil) : '0.00', eje: ojo.cil && ojo.eje ? ojo.eje : '', adicion: ojo.adic!, dnp: String(dnp) } };
}

export interface ClienteWeb {
    nombre: string; apellido: string; dni: string; genero: 'F' | 'M';
    telefono: string | null; email: string | null;
    nacimiento: { iso: string; dia: number; mes0: number; anio: number };
}

/** Nombre y apellido repartidos como los pide el sitio: 1 palabra → las dos iguales; 2 → nombre / apellido; más → la primera / el resto. Puro. */
export function repartirNombre(nombreCompleto: string): { nombre: string; apellido: string } {
    const t = limpio(nombreCompleto).split(' ').filter(Boolean).map(p => p[0].toUpperCase() + p.slice(1));
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
    const nac = cliente?.birthDate ? new Date(cliente.birthDate) : null;
    if (!nac || Number.isNaN(nac.getTime())) faltantes.push('fecha de nacimiento del cliente (en la ficha)');
    const tel = String(cliente?.phone || '').replace(/\D/g, '');
    const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(cliente?.email || '').trim()) ? String(cliente!.email).trim() : null;
    if (faltantes.length) return { ok: false, faltantes };
    // Las fechas de la ficha se guardan a medianoche UTC: se leen en UTC para no correr un día.
    const iso = nac!.toISOString().slice(0, 10);
    return { ok: true, avisos, cliente: { nombre, apellido, dni, genero: g as 'F' | 'M', telefono: tel.length >= 6 && tel.length <= 15 ? tel : null, email, nacimiento: { iso, dia: nac!.getUTCDate(), mes0: nac!.getUTCMonth(), anio: nac!.getUTCFullYear() } } };
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
export function pedidoDeCupon(o: { venta: VentaParaCargaOves; plan: PlanOves; productoCRMSegundo: string | null; genero: string | null | undefined; tratamientoSegundo?: string | null }): { ok: true; pedido: PedidoDeCupon; avisos: string[] } | { ok: false; faltantes: string[] } {
    const faltantes: string[] = [];
    const avisos: string[] = [];
    const provider = providerDePromo(o.plan.promo?.marca, o.plan.promo?.tipo as TipoDePromo | undefined);
    if (!provider) return { ok: false, faltantes: ['la promo de la venta no es Varilux ni Kodak: la web de la promo no la tiene'] };
    const c = clienteWebDe(o.venta.client, o.genero);
    if (!c.ok) faltantes.push(...c.faltantes); else avisos.push(...c.avisos);
    const od = recetaWebDe(o.plan.od, 'OD');
    const oi = recetaWebDe(o.plan.oi, 'OI');
    if (!od.ok) faltantes.push(...od.faltantes);
    if (!oi.ok) faltantes.push(...oi.faltantes);
    const r1 = rasgosDelCristalCRM(o.plan.productoCRM, o.plan.opciones.tratamiento, o.plan.promo?.marca ?? null);
    if (!r1.ok) faltantes.push(r1.motivo); else avisos.push(...r1.avisos);
    let segundo: PedidoDeCupon['segundo'] = null;
    if (o.plan.promo?.tipo !== 'MI_PRIMER') {
        if (!o.productoCRMSegundo) faltantes.push('el 2º par de la promo: la web de la promo pide los dos cristales en el mismo cupón');
        else {
            // El Crizal del 2º par se elige recién al preparar ESE par: para el cupón va el mismo que el 1º (o el de la venta) y se avisa.
            const r2 = rasgosDelCristalCRM(o.productoCRMSegundo, o.tratamientoSegundo ?? o.plan.opciones.tratamiento, o.plan.promo?.marca ?? null);
            if (!r2.ok) faltantes.push(`2º par: ${r2.motivo}`);
            else { avisos.push(...r2.avisos.map(a => `2º par: ${a}`)); segundo = { productoCRM: o.productoCRMSegundo, rasgos: r2.rasgos }; }
            if (!o.tratamientoSegundo) avisos.push('el cupón lleva para el 2º par el mismo Crizal que el 1º; si el 2º va con otro, generá el cupón a mano');
            if (disenoDelCristalCRM(o.plan.productoCRM) !== disenoDelCristalCRM(o.productoCRMSegundo)) faltantes.push(`la web de la promo exige el mismo diseño en los dos pares (${familiaDelNombre(o.plan.productoCRM)} y ${familiaDelNombre(o.productoCRMSegundo)}): confirmá con Optovisión y generá el cupón a mano`);
        }
    }
    if (faltantes.length) return { ok: false, faltantes };
    return { ok: true, avisos, pedido: { provider, cliente: (c as { cliente: ClienteWeb }).cliente, receta: { od: (od as { receta: RecetaWeb }).receta, oi: (oi as { receta: RecetaWeb }).receta }, primero: { productoCRM: o.plan.productoCRM, rasgos: (r1 as { rasgos: RasgosWeb }).rasgos }, segundo } };
}

/** El cupón que el robot obtuvo (generado o reutilizado), como queda en el borrador. */
export interface CuponObtenido { codigo: string; pedidoId: number; provider: string; url: string; pdfUrl: string | null; obtenidoEl: string; reutilizado: boolean }

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

/** ¿Un pedido del sitio es el cupón de ESTE cliente para ESTA promo? Mismo provider y mismo DNI. Puro. */
export function esCuponDelCliente(p: PedidoWeb, o: { provider: string; dni: string }): boolean {
    return p.provider === o.provider && String(p.document_number || '').replace(/\D/g, '') === o.dni.replace(/\D/g, '');
}
