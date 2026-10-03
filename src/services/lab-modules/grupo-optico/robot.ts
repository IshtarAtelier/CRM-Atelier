import type { Page } from 'playwright';
import { API_BASE, clientIdSmartLab, NOMBRE_GRUPO_OPTICO, pedirJsonDesdeLaPagina, urlListadoApi } from './portal';
import { elegirArticulo, TENIDO_TIPO, TIPO_ARO, type ArticuloPortal } from './catalogo';
import type { OjoPlan, PlanDeCarga, ResueltoEnPortal } from './carga';
import { fechaDelPortal, numeroDeFila, type FilaApiSmartLab } from './pedidos';

/**
 * EL ROBOT DE CARGA DE GRUPO ÓPTICO sobre la API del portal SmartLab.
 *
 * Dos momentos, y entre los dos SIEMPRE una persona:
 *  · `resolverEnPortal` (al preparar): SOLO LEE. Pide al portal las listas
 *    vivas (material, color, marca, artículo de cada ojo, tipo de aro,
 *    teñido), comprueba cada id contra su etiqueta y arma lo que la persona
 *    revisa. Si algo no cierra, corta: nunca elige "el primero".
 *  · `crearPedidoEnPortal` (después del OK): el único POST. En SmartLab
 *    "Guardar pedido" crea el pedido en el acto —no hay borrador— y la óptica
 *    no puede anularlo (solo el laboratorio), por eso el OK humano va ANTES.
 */

export interface Etiquetas {
    tipoLente: string;
    material: string;
    color: string;
    marca: string;
    articuloOD: string | null;
    articuloOI: string | null;
    aro: string;
    tenido: string | null;
}

export class PortalNoCoincideError extends Error {
    constructor(motivo: string) {
        super(`${NOMBRE_GRUPO_OPTICO}: ${motivo}`);
        this.name = 'PortalNoCoincideError';
    }
}

const TIPOS: Record<string, string> = { '1': 'Monofocal', '3': 'Bifocal Kri', '4': 'Bifocal Ft', '5': 'Multifocal', '6': 'Ocupacional' };
type Opcion = { value: string; label: string };
const lista = async (page: Page, ruta: string): Promise<Opcion[]> => {
    const r = await pedirJsonDesdeLaPagina<Opcion[]>(page, `${API_BASE}${ruta}`);
    if (!Array.isArray(r)) throw new PortalNoCoincideError(`la lista ${ruta.split('?')[0]} no vino como lista`);
    await page.waitForTimeout(250);
    return r;
};
const q = (o: Record<string, string | number>) => Object.entries(o).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');

export async function resolverEnPortal(page: Page, plan: PlanDeCarga): Promise<{ resuelto: ResueltoEnPortal; etiquetas: Etiquetas }> {
    const clientId = clientIdSmartLab();
    const bloqueo = await pedirJsonDesdeLaPagina<any>(page, `${API_BASE}/system/utilities/isclientblocked?clientId=${clientId}&checked=true`).catch(() => null);
    if (bloqueo && (bloqueo === true || bloqueo?.blocked === true || bloqueo?.isBlocked === true || bloqueo?.blocked === '1')) {
        throw new PortalNoCoincideError('el laboratorio tiene la cuenta BLOQUEADA (suele ser saldo impago): no se pueden cargar pedidos hasta regularizarla');
    }
    const esp = plan.especificacion;
    const stock = esp.clase === 'STOCK';
    const lensTypeId = plan.lensTypeId;

    // Material: el id tiene que existir en la lista Y decir lo que esperamos.
    const materiales = await lista(page, `/data/material/list?${q({ current: 1, rowCount: 100000, lensTypeId, artODStock: stock ? 1 : 0 })}`);
    const materialId = esp.material.materialId;
    const mat = materiales.find(m => String(m.value) === String(materialId));
    if (!mat) throw new PortalNoCoincideError(`el portal no ofrece el material ${esp.material.etiqueta} para ${TIPOS[lensTypeId] ?? lensTypeId}${stock ? ' de stock' : ''}`);
    if (mat.label.trim().toUpperCase() !== esp.material.etiqueta.toUpperCase()) {
        throw new PortalNoCoincideError(`el material ${materialId} del portal ahora dice "${mat.label}" (se esperaba "${esp.material.etiqueta}"): hay que revisar la tabla de equivalencias`);
    }

    // Color
    const colorId = stock ? 1 : esp.colorId;
    let colorEtiqueta = 'Blanco';
    if (!stock) {
        const colores = await lista(page, `/data/color/list?${q({ current: 1, rowCount: 100000, lensTypeId, materialId })}`);
        const col = colores.find(c => String(c.value) === String(colorId));
        if (!col) throw new PortalNoCoincideError(`el material ${mat.label} no viene en ese color en el portal (ofrece: ${colores.map(c => c.label).join(', ')})`);
        colorEtiqueta = col.label;
    }

    // Marca
    const marcas = await lista(page, `/data/brand/list?${q({ current: 1, rowCount: 100000, lensTypeId, materialId, colorId, rightEyeStockArticle: stock ? 1 : 0, clientId, isAdmin: 0 })}`);
    const brandId = stock ? Number(marcas.length === 1 ? marcas[0].value : NaN) : esp.familia.brandId;
    const marca = marcas.find(b => String(b.value) === String(brandId));
    if (!marca) throw new PortalNoCoincideError(`la marca del portal no cierra (ofrece: ${marcas.map(m => m.label).join(', ') || 'ninguna'})`);

    // Artículo de cada ojo, con SU graduación.
    const articulo = async (o: OjoPlan | null, lado: string): Promise<ArticuloPortal | null> => {
        if (!o) return null;
        const consulta = {
            lensTypeId, isStock: stock ? 1 : 0,
            // Stock: el portal busca con un código propio por línea (catalogo.ts).
            materialId: stock && esp.clase === 'STOCK' ? esp.material.codigoArticulos : materialId,
            colorId, brandId,
            // Multifocal: el portal consulta con la graduación de CERCA (visto en su editor).
            spherical: o.esfericoCerca ?? o.esferico,
            cylindrical: o.cilindrico ?? '0.00',
            clientId, isAdmin: 0,
        };
        const arts = await lista(page, `/data/article/list?${q(consulta)}`);
        const r = elegirArticulo(arts, esp);
        if (!r.ok) throw new PortalNoCoincideError(`${lado}: ${r.motivo}`);
        return r.articulo;
    };
    const artOD = await articulo(plan.od, 'OD');
    const artOI = await articulo(plan.oi, 'OI');
    if (!stock && artOD && artOI && artOD.value !== artOI.value) {
        throw new PortalNoCoincideError(`el portal da un artículo distinto para cada ojo (${artOD.label} / ${artOI.label}): se carga a mano`);
    }

    // Tipo de aro: el id es fijo, el artículo cambia entre stock y laboratorio.
    const aros = await lista(page, `/data/typeRim/list?${q({ lensTypeId, isStock: stock ? 1 : 0, materialId, colorId, brandId })}`);
    const aroBuscado = TIPO_ARO[plan.armazon.aro];
    const aro = aros.find(a => String(a.value).split('|')[0] === String(aroBuscado.id));
    if (!aro || aro.label !== aroBuscado.etiqueta) throw new PortalNoCoincideError(`el portal no ofrece "${aroBuscado.etiqueta}" para este cristal (ofrece: ${aros.map(a => a.label).join(', ')})`);

    // Teñido: solo lo ofrece el material que se tiñe; se busca por etiqueta.
    let tinted: ResueltoEnPortal['tinted'] = null;
    let tenidoEtiqueta: string | null = null;
    if (plan.tenido) {
        const tenidos = await pedirJsonDesdeLaPagina<{ value: string; label: string }[]>(page, `${API_BASE}/data/treatment/list?materialId=${materialId}&type=2`);
        const t = (tenidos || []).find(x => x.label === TENIDO_TIPO[plan.tenido!.tipo]);
        if (!t) throw new PortalNoCoincideError(`el material ${mat.label} no acepta "${TENIDO_TIPO[plan.tenido.tipo]}" en el portal`);
        const [id, articleId] = t.value.split('|').map(Number);
        if (!Number.isFinite(id) || !Number.isFinite(articleId)) throw new PortalNoCoincideError(`el teñido "${t.label}" vino sin id en el portal`);
        tinted = { id, articleId };
        tenidoEtiqueta = `${t.label} · ${plan.tenido.color} · grado ${plan.tenido.intensidad}`;
    }

    const [aroId, aroArt] = aro.value.split('|').map(Number);
    void aroId;
    return {
        resuelto: {
            materialId, colorId, brandId,
            articuloOD: artOD ? Number(artOD.value) : null,
            articuloOI: artOI ? Number(artOI.value) : null,
            typeRimArticleId: aroArt,
            tinted, clientId,
        },
        etiquetas: {
            tipoLente: TIPOS[lensTypeId] ?? lensTypeId,
            material: mat.label, color: colorEtiqueta, marca: marca.label,
            articuloOD: artOD?.label ?? null, articuloOI: artOI?.label ?? null,
            aro: aro.label, tenido: tenidoEtiqueta,
        },
    };
}

/**
 * ¿Ya existe en el portal el pedido de este borrador? (Una confirmación que se
 * cortó después del POST.) Se busca por el código de la venta en el "Código
 * interno" entre los pedidos cargados desde que se aprobó. Puro sobre las filas.
 */
export function pedidoYaCreado(filas: FilaApiSmartLab[], codigoOptica: string, desde: Date): string | null {
    const buscado = codigoOptica.toUpperCase().replace(/\s+/g, ' ').trim();
    const encontrados = filas.filter(f => {
        const cod = String(f.CodigoOptica || '').toUpperCase().replace(/\s+/g, ' ').trim();
        const fecha = fechaDelPortal(f.FechaRegistro);
        return cod === buscado && String(f.Anulado ?? '0') !== '1' && fecha && fecha.getTime() >= desde.getTime() - 5 * 60_000;
    });
    return encontrados.length ? numeroDeFila(encontrados[0]) : null;
}

export async function buscarPedidoYaCreado(page: Page, codigoOptica: string, desde: Date): Promise<string | null> {
    const res = await pedirJsonDesdeLaPagina<{ rows?: FilaApiSmartLab[] }>(page, urlListadoApi(1));
    return pedidoYaCreado(Array.isArray(res?.rows) ? res.rows : [], codigoOptica, desde);
}

/**
 * ¿Este server puede crear pedidos REALES en el laboratorio? Solo producción.
 * Un `npm run dev` con la credencial real (para probar la ficha) tiene que
 * poder preparar —que solo lee— pero nunca mandar un pedido a fabricar. Para
 * habilitarlo a propósito fuera de producción: SMARTLAB_PERMITIR_CARGA=1. Puro.
 */
export function puedeCrearPedidosReales(env: Record<string, string | undefined> = process.env): boolean {
    return env.NODE_ENV === 'production' || env.SMARTLAB_PERMITIR_CARGA === '1';
}

/** EL ÚNICO POST: crea el pedido. Devuelve el nº que asignó el portal. */
export async function crearPedidoEnPortal(page: Page, payload: Record<string, unknown>): Promise<{ numero: string; mensaje: string }> {
    if (!puedeCrearPedidosReales()) {
        throw new Error('Este servidor no es producción: no crea pedidos reales en el laboratorio (para probar a propósito: SMARTLAB_PERMITIR_CARGA=1). No se mandó nada.');
    }
    const r: any = await page.evaluate(async ({ url, body }) => {
        const res = await fetch(url, {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(180_000),
        });
        const t = await res.text();
        let j: any = null; try { j = JSON.parse(t); } catch { /* texto */ }
        return { status: res.status, json: j, texto: t.slice(0, 500) };
    }, { url: `${API_BASE}/laboratory/order/createupdate`, body: payload });
    if (r.status === 400) throw new PortalNoCoincideError(`el portal rechazó el pedido: ${r.json?.error || r.texto}`);
    if (r.status !== 200 && r.status !== 201) throw new Error(`${NOMBRE_GRUPO_OPTICO} respondió ${r.status} al crear el pedido: ${r.texto}`);
    const numero = String(r.json?.orderId ?? '').trim();
    if (!/^\d{6,}$/.test(numero)) throw new Error(`${NOMBRE_GRUPO_OPTICO} no devolvió el nº de pedido (${r.texto})`);
    return { numero, mensaje: String(r.json?.message || '') };
}

/** El pedido tal como lo guardó el portal (para comprobar que quedó lo aprobado). */
export function leerPedido(page: Page, numero: string): Promise<any> {
    return pedirJsonDesdeLaPagina(page, `${API_BASE}/data/laboratoryorder/get?id=${encodeURIComponent(numero)}`);
}

/**
 * Lo que el portal guardó contra lo que se aprobó: artículo de cada ojo,
 * material, tipo de lente y graduación de lejos. Devuelve las diferencias
 * (vacío = quedó igual). Puro.
 */
export function diferenciasConLoAprobado(guardado: any, payload: Record<string, any>): string[] {
    const dif: string[] = [];
    const n = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v));
    const igual = (a: unknown, b: unknown) => n(a) === n(b) || (n(a) === null && n(b) === 0) || (n(a) === 0 && n(b) === null);
    if (!igual(guardado?.right_eye_article_id, payload.rightEyeArticle)) dif.push(`artículo OD: quedó ${guardado?.right_eye_article_id}, se aprobó ${payload.rightEyeArticle}`);
    if (!igual(guardado?.left_eye_article_id, payload.leftEyeArticle)) dif.push(`artículo OI: quedó ${guardado?.left_eye_article_id}, se aprobó ${payload.leftEyeArticle}`);
    if (!igual(guardado?.IdMaterial, payload.materialId)) dif.push(`material: quedó ${guardado?.IdMaterial}, se aprobó ${payload.materialId}`);
    if (!igual(guardado?.IdTipoLente, payload.lensTypeId)) dif.push(`tipo de lente: quedó ${guardado?.IdTipoLente}, se aprobó ${payload.lensTypeId}`);
    if (!igual(guardado?.OjoDerEsfericoLejos, payload.rightEyeFarSpherical)) dif.push(`esférico OD: quedó ${guardado?.OjoDerEsfericoLejos}, se aprobó ${payload.rightEyeFarSpherical}`);
    if (!igual(guardado?.OjoIzqEsfericoLejos, payload.leftEyeFarSpherical)) dif.push(`esférico OI: quedó ${guardado?.OjoIzqEsfericoLejos}, se aprobó ${payload.leftEyeFarSpherical}`);
    if (!igual(guardado?.tinted_id, payload.tintedId)) dif.push(`teñido: quedó ${guardado?.tinted_id}, se aprobó ${payload.tintedId}`);
    return dif;
}

/** El PDF del pedido que emite el portal (el mismo que abre al guardar). */
export async function bajarPdfDelPedido(page: Page, numero: string): Promise<Buffer | null> {
    const r = await page.evaluate(async (u) => {
        const res = await fetch(u, { credentials: 'include', signal: AbortSignal.timeout(120_000) });
        if (!res.ok) return null;
        const buf = new Uint8Array(await res.arrayBuffer());
        let s = '';
        for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + 0x8000)));
        return btoa(s);
    }, `${API_BASE}/laboratory/order/print?id=${encodeURIComponent(numero)}`).catch(() => null);
    if (!r) return null;
    const bytes = Buffer.from(r, 'base64');
    return bytes.subarray(0, 4).toString() === '%PDF' ? bytes : null;
}
