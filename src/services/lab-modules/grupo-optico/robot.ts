import type { Page } from 'playwright';
import { API_BASE, clientIdSmartLab, NOMBRE_GRUPO_OPTICO, pedirJsonDesdeLaPagina, urlListadoApi } from './portal';
import { elegirArticulo, TENIDO_TIPO, TIPO_ARO, type ArticuloPortal } from './catalogo';
import type { OjoPlan, PlanDeCarga, ResueltoEnPortal } from './carga';
import { numeroDeFila, parDeFila, type FilaApiSmartLab } from './pedidos';
import { hostDeLaBase } from '../../../lib/cron-scheduler';

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

/** Hay un pedido con el código de la venta y no se sabe de qué par es: no se adopta ni se crea otro. */
export class PedidoAmbiguoError extends Error {
    constructor(numero: string) {
        super(`En el portal hay un pedido de esta venta (nº ${numero}) que no dice de qué par es (¿cargado a mano?): no se adopta ni se crea otro. Revisalo en el portal y cargá el nº en la venta; el par que falte se prepara después.`);
        this.name = 'PedidoAmbiguoError';
    }
}

/**
 * ¿Ya existe en el portal el pedido de ESTE par de ESTA venta? (Una carga que
 * se cortó después del POST, o una a mano con el favorito.) Se busca por el
 * código de la venta (#XXXX) en el "Código interno"; el par sale del código y
 * si no, de la observación (`parDeFila`). Sin ventana de fecha: lo cargado a
 * mano antes también cuenta. Se descartan anulados y nº de otro par. En una
 * venta de varios pares, uno sin par marcado es AMBIGUO (auditoría 2, N1). Puro.
 */
export function pedidoYaCreado(filas: FilaApiSmartLab[], codigoVenta: string, par: number | null, excluir: Set<string> = new Set(), nombreCliente: string | null = null): { numero: string; ambiguo: boolean } | null {
    const codigo = codigoVenta.toUpperCase().replace(/^#?/, '#');
    const re = new RegExp(`(^|\\s)${codigo}(\\s|$)`, 'i');
    // El código corto (#XXXX, 4 letras del id) puede repetirse entre ventas: si la
    // fila trae un nombre al lado del código, tiene que ser el de ESTE cliente
    // (robot y favorito escriben "#XXXX Nombre Apellido N°par"; auditoría total, 8/10/2026).
    const normal = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const palabrasCliente = normal(nombreCliente || '').split(/\s+/).filter(w => w.length >= 3);
    const esDeEsteCliente = (codigoOptica: string) => {
        const resto = normal(codigoOptica).replace(normal(codigo), ' ').replace(/\b\d\s*°?\s*par\b/g, ' ').trim();
        if (!resto || palabrasCliente.length === 0) return true;
        return palabrasCliente.some(w => resto.includes(w));
    };
    let ambiguo: string | null = null;
    for (const f of filas) {
        if (!re.test(String(f.CodigoOptica || ''))) continue;
        if (String(f.Anulado ?? '0') === '1') continue;
        if (!esDeEsteCliente(String(f.CodigoOptica || ''))) {
            // El código es el de esta venta pero al lado hay OTRO nombre: puede ser
            // otra venta con el mismo código corto, o esta misma cargada a mano con
            // una nota ("#L4AU sol"). No se adopta ni se crea otro: lo mira una persona.
            const num = numeroDeFila(f);
            if (num && !excluir.has(num) && !ambiguo) ambiguo = num;
            continue;
        }
        if (String(f.Anulado ?? '0') === '1') continue;
        const num = numeroDeFila(f);
        if (!num || excluir.has(num)) continue;
        if (par === null) return { numero: num, ambiguo: false };
        const parDeEse = parDeFila(f);
        if (parDeEse === par) return { numero: num, ambiguo: false };
        if (parDeEse === null && !ambiguo) ambiguo = num;
    }
    return ambiguo ? { numero: ambiguo, ambiguo: true } : null;
}

export async function buscarPedidoYaCreado(page: Page, codigoVenta: string, par: number | null, excluir: Set<string> = new Set(), nombreCliente: string | null = null): Promise<string | null> {
    // Las dos primeras páginas (200 pedidos, de más nuevo a más viejo) cubren lo
    // que pudo cargarse para una venta que todavía espera su pedido.
    for (let current = 1; current <= 2; current++) {
        const res = await pedirJsonDesdeLaPagina<{ rows?: FilaApiSmartLab[] }>(page, urlListadoApi(current));
        // Una respuesta sin filas NO es "no existe": es la sesión o la API rota. Se corta.
        if (!Array.isArray(res?.rows) || (current === 1 && res.rows.length === 0)) {
            throw new Error(`${NOMBRE_GRUPO_OPTICO}: el listado del portal vino vacío o roto; no se puede comprobar si el pedido ya existe, así que no se crea nada.`);
        }
        const r = pedidoYaCreado(res.rows, codigoVenta, par, excluir, nombreCliente);
        if (r?.ambiguo) throw new PedidoAmbiguoError(r.numero);
        if (r) return r.numero;
        if (res.rows.length < 100) break;
    }
    return null;
}

/**
 * ¿Este server puede crear pedidos REALES en el laboratorio? Misma señal que
 * los crons (lib/cron-scheduler.ts): producción Y la base fuera de esta
 * máquina. Un `npm run dev` —o un `npm start` local, que corre con
 * NODE_ENV=production— con la credencial real tiene que poder preparar (que
 * solo lee) pero nunca mandar un pedido a fabricar. Para probar a propósito
 * fuera de producción: SMARTLAB_PERMITIR_CARGA=1. Puro.
 */
export function puedeCrearPedidosReales(env: Record<string, string | undefined> = process.env): boolean {
    if (env.SMARTLAB_PERMITIR_CARGA === '1') return true;
    if (env.NODE_ENV !== 'production') return false;
    const host = hostDeLaBase(env.DATABASE_URL);
    return !!host && !HOSTS_LOCALES.has(host);
}

const HOSTS_LOCALES = new Set(['localhost', '127.0.0.1', '[::1]', '::1', '0.0.0.0', 'host.docker.internal']);

/** El portal CONTESTÓ que no crea el pedido (HTTP 400: datos que no acepta). No hay nada creado. */
export class PedidoRechazadoError extends Error {
    constructor(msg: string) { super(msg); this.name = 'PedidoRechazadoError'; }
}
/** El portal contestó con otro error (HTTP `status`). OJO: solo un 4xx prueba que no creó nada (ver `pruebaDeQueNoSeCreo`). */
export class PortalRespondioError extends Error {
    status: number;
    constructor(status: number, msg: string) { super(msg); this.name = 'PortalRespondioError'; this.status = status; }
}

/**
 * ¿Este error PRUEBA que el portal NO creó el pedido? Solo un 4xx (el portal
 * rechazó el pedido o la petición antes de tocar nada). Un 5xx (502/504 del
 * proxy) puede llegar DESPUÉS de que PHP hizo el INSERT, y un timeout o un
 * corte de red no dicen nada: el envío queda incierto, `envioIniciadoEl` se
 * conserva y el reintento busca el pedido en el portal antes de crear otro.
 * Es la barrera contra el pedido duplicado que la óptica no puede anular
 * (auditoría 2, I2). Puro: `npm run check:carga-go`.
 */
export function pruebaDeQueNoSeCreo(err: unknown): boolean {
    if (err instanceof PedidoRechazadoError) return true;
    if (err instanceof PortalRespondioError) return err.status >= 400 && err.status < 500;
    return false;
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
    if (r.status === 400) throw new PedidoRechazadoError(`el portal rechazó el pedido: ${r.json?.error || r.texto}`);
    if (r.status !== 200 && r.status !== 201) throw new PortalRespondioError(r.status, `${NOMBRE_GRUPO_OPTICO} respondió ${r.status} al crear el pedido: ${r.texto}`);
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
