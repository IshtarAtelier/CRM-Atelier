import type { Page } from 'playwright';
import type { GraduacionOjo, PayloadVitolen } from './carga';
import { BASE_VITOLEN } from './pedidos';
import { NOMBRE_VITOLEN } from './portal';
import { idDeBorradorDeUrl, numeroDeTrabajoDe, resumenComparable } from './resumen';

/**
 * EL ROBOT LLENA EL FORMULARIO "Pedido de Laboratorio" del portal de Vitolen
 * con un payload ya armado y aprobado por su forma (carga.ts), campo por campo
 * según docs/vitolen-portal.md, y FRENA antes de "Crear". Devuelve lo que
 * escribió (para la revisión), lo que no pudo automatizar y la captura.
 *
 * Nada se infiere del portal: si una opción no está, si el texto de un
 * material no es el esperado o si un paso no aparece, se corta con error. La
 * persona que revisa tiene que ver exactamente lo que el payload dice.
 *
 * `crearYLeerResumen` y `confirmar` son los dos pasos siguientes del flujo
 * (resumen → aprobación humana → confirmación); se llaman aparte y solo
 * cuando corresponde.
 */

export interface PasoDeLlenado { campo: string; valor: string }

export interface ResultadoLlenado {
    url: string;
    pasos: PasoDeLlenado[];
    /** Lo que quedó para hacer a mano en el portal antes de confirmar. */
    pendientes: string[];
    captura: Buffer;
}

const TIPO_RECETA: Record<PayloadVitolen['ojos'], string> = { AMBOS: '1', OD: '2', OI: '3' };
const CLASE: Record<PayloadVitolen['tipoReceta'], string> = { Monofocal: '1', Bifocal: '2', Ocupacional: '4', Progresivo: '3' };
/** Tipo de armazón de la venta → radio del portal (valor, etiqueta). */
const TIPO_ARMAZON: [RegExp, string, string][] = [
    [/met[aá]l/i, '1', 'Metálico'],
    [/zilo|acetato|pl[aá]stic|inyectad|tr-?90|ultem/i, '2', 'Zilo'],
    [/ranur|nylon|semi/i, '3', 'Ranurado'],
    [/perfor|al aire|rimless|tres piezas|3 piezas/i, '4', 'Perforado'],
];
const ESPERA_PASO_MS = 20_000;

const grad = (n: number | null): string => n === null ? '' : `${n > 0 ? '+' : ''}${n.toFixed(2)}`;
const entero = (n: number | null): string => n === null ? '' : String(Math.round(n));
const medida = (n: number | null): string => n === null ? '' : String(Number.isInteger(n) ? n : Number(n.toFixed(1)));
/** El select de adición usa "1.0", "1.5", "2.25"… */
const adicion = (n: number | null): string | null => n === null ? null : (Number.isInteger(n) ? n.toFixed(1) : String(n));

async function llenarCampo(page: Page, pasos: PasoDeLlenado[], nombre: string, etiqueta: string, valor: string) {
    const selector = `[name="${nombre}"]`;
    if (await page.locator(selector).count() === 0) throw new Error(`El portal de ${NOMBRE_VITOLEN} no muestra el campo "${etiqueta}" (${nombre}).`);
    await page.fill(selector, valor);
    pasos.push({ campo: etiqueta, valor });
}

async function marcarRadio(page: Page, pasos: PasoDeLlenado[], nombre: string, valor: string, etiqueta: string, texto: string) {
    const selector = `input[name="${nombre}"][value="${valor}"]`;
    if (await page.locator(selector).count() === 0) throw new Error(`El portal de ${NOMBRE_VITOLEN} no ofrece "${texto}" en ${etiqueta}.`);
    await page.check(selector);
    pasos.push({ campo: etiqueta, valor: texto });
}

/** El checkbox de "trabajos" cuya etiqueta cumple el patrón (el orden depende del material: se busca por texto). */
async function checkboxPorEtiqueta(page: Page, patron: RegExp): Promise<string | null> {
    return page.evaluate((src) => {
        const re = new RegExp(src, 'i');
        for (const cb of Array.from(document.querySelectorAll<HTMLInputElement>('input[type=checkbox][name*="trabajos_realizados"]'))) {
            const etiqueta = cb.labels?.[0]?.textContent?.replace(/\s+/g, ' ').trim() || '';
            if (re.test(etiqueta)) return cb.getAttribute('name');
        }
        return null;
    }, patron.source);
}

async function dispararCambio(page: Page, selector: string) {
    await page.evaluate((sel) => {
        const s = document.querySelector(sel);
        if (!s) return;
        s.dispatchEvent(new Event('change', { bubbles: true }));
        const jq = (window as any).jQuery;
        if (jq) jq(s).trigger('change');
    }, selector);
}

async function llenarOjo(page: Page, pasos: PasoDeLlenado[], idx: 0 | 1, ojo: GraduacionOjo, payload: PayloadVitolen) {
    const lado = idx === 0 ? 'OD' : 'OI';
    const base = `pedido[lentes_attributes][${idx}]`;
    await llenarCampo(page, pasos, `${base}[esferico]`, `Esférico ${lado}`, grad(ojo.esferico));
    await llenarCampo(page, pasos, `${base}[cilindrico]`, `Cilíndrico ${lado}`, grad(ojo.cilindrico));
    await llenarCampo(page, pasos, `${base}[eje_cilindrico]`, `Eje ${lado}`, ojo.cilindrico ? entero(ojo.eje) : '');
    const add = adicion(ojo.adicion);
    if (add !== null) {
        const sel = `select[name="${base}[adicion]"]`;
        const hay = await page.$eval(sel, (s, v) => Array.from((s as HTMLSelectElement).options).some(o => o.value === v), add).catch(() => false);
        if (!hay) throw new Error(`El portal de ${NOMBRE_VITOLEN} no ofrece la adición ${add} para el ${lado}.`);
        await page.selectOption(sel, add);
        pasos.push({ campo: `Adición ${lado}`, valor: add });
    }
    await llenarCampo(page, pasos, `${base}[dnpl]`, `DNP ${lado}`, medida(ojo.dnp));
    await llenarCampo(page, pasos, `${base}[altura]`, `Altura pupilar ${lado}`, medida(ojo.altura));
    await llenarCampo(page, pasos, `${base}[distancia_vertice]`, `Distancia de vértice ${lado}`, String(payload.distanciaVertice));
    await llenarCampo(page, pasos, `${base}[angulo_pantoscopico]`, `Ángulo pantoscópico ${lado}`, String(payload.anguloPantoscopico));
}

export async function llenarFormulario(page: Page, payload: PayloadVitolen): Promise<ResultadoLlenado> {
    const pasos: PasoDeLlenado[] = [];
    const pendientes: string[] = [];

    await page.goto(`${BASE_VITOLEN}/ventas/pedidos_laboratorio/new`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[name="pedido[nro_caso]"]', { timeout: ESPERA_PASO_MS });

    await llenarCampo(page, pasos, 'pedido[nro_caso]', 'Nro de Caso Interno', payload.nroCasoInterno);
    await marcarRadio(page, pasos, 'pedido[tipo_receta_id]', TIPO_RECETA[payload.ojos], 'Receta', payload.ojos === 'AMBOS' ? 'Ambos Ojos' : payload.ojos === 'OD' ? 'Ojo Derecho' : 'Ojo Izquierdo');
    await marcarRadio(page, pasos, 'pedido[extension_attributes][clase_lente_id]', CLASE[payload.tipoReceta], 'Clase de lente', payload.tipoReceta);

    // Diseño: el logo. Solo aparecen los de la clase elegida.
    await page.waitForSelector('a.familia-item', { timeout: ESPERA_PASO_MS });
    if (!payload.portalDiseno) throw new Error(`El diseño "${payload.diseno}" no tiene logo relevado en el portal de ${NOMBRE_VITOLEN}.`);
    const logo = page.locator(`a.familia-item[data-id="${payload.portalDiseno.dataId}"]`);
    if (await logo.count() === 0) throw new Error(`El portal de ${NOMBRE_VITOLEN} no muestra el diseño ${payload.portalDiseno.nombre} para ${payload.tipoReceta}.`);
    await logo.first().click();
    pasos.push({ campo: 'Diseño', valor: payload.portalDiseno.nombre });

    // Material por ojo: se marca por id, pero antes se comprueba que el texto
    // de esa opción sea el esperado (un cambio de ids en el portal corta acá).
    const selOD = 'select[name="pedido[lentes_attributes][0][rubro_id]"]';
    await page.waitForFunction((sel) => { const s = document.querySelector(sel) as HTMLSelectElement | null; return !!s && s.options.length > 1; }, selOD, { timeout: ESPERA_PASO_MS });
    for (const [idx, ojo] of [[0, payload.od], [1, payload.oi]] as [0 | 1, GraduacionOjo | null][]) {
        if (!ojo) continue;
        if (!ojo.portalMaterial) throw new Error(`El ${idx === 0 ? 'OD' : 'OI'} no tiene material del portal resuelto en el payload.`);
        const sel = `select[name="pedido[lentes_attributes][${idx}][rubro_id]"]`;
        const deshabilitado = await page.$eval(sel, s => (s as HTMLSelectElement).disabled).catch(() => true);
        if (deshabilitado) {
            // Con "Ambos Ojos" el portal copia el OD al OI: solo vale si son iguales.
            // Si no, se corta: nada que cambie el producto sigue como "pendiente".
            if (idx === 1 && payload.od?.portalMaterial?.id === ojo.portalMaterial.id) continue;
            throw new Error(`El portal de ${NOMBRE_VITOLEN} no deja elegir el material del ${idx === 0 ? 'OD' : 'OI'} (${ojo.portalMaterial.texto}): se carga a mano.`);
        }
        const texto = await page.$eval(sel, (s, id) => Array.from((s as HTMLSelectElement).options).find(o => o.value === id)?.textContent?.trim() ?? null, ojo.portalMaterial.id);
        if (texto !== ojo.portalMaterial.texto) {
            throw new Error(`El portal de ${NOMBRE_VITOLEN} cambió el material ${ojo.portalMaterial.id}: se esperaba "${ojo.portalMaterial.texto}" y muestra "${texto ?? 'nada'}".`);
        }
        await page.selectOption(sel, ojo.portalMaterial.id);
        await dispararCambio(page, sel);
        pasos.push({ campo: `Material ${idx === 0 ? 'OD' : 'OI'}`, valor: texto });
    }

    // Con el material elegido aparece el resto (graduación, promos, armazón, trabajos).
    await page.waitForSelector('input[name="pedido[lentes_attributes][0][esferico]"]', { timeout: ESPERA_PASO_MS });
    await page.waitForSelector('input[type=checkbox][name*="trabajos_realizados"]', { timeout: ESPERA_PASO_MS });

    if (payload.od) await llenarOjo(page, pasos, 0, payload.od, payload);
    if (payload.oi) await llenarOjo(page, pasos, 1, payload.oi, payload);

    if (payload.pedidoOrigen) {
        pendientes.push(`promo del 2º par: antes de aprobar, abrir "Modificar" en el portal y asociar el pedido origen ${payload.pedidoOrigen} con la promoción HOYALUX (el robot todavía no lo hace)`);
    }

    // Armazón
    await marcarRadio(page, pasos, 'pedido[armazones_attributes][0][tipo_medida_id]', '2', 'Armazón', 'Medidas');
    const nForma = payload.armazon.forma?.match(/\d+/)?.[0];
    if (nForma) {
        const tarjeta = page.getByText(`Forma OD - ${nForma}`, { exact: true }).first();
        if (await tarjeta.count() === 0) throw new Error(`El portal de ${NOMBRE_VITOLEN} no muestra la tarjeta "Forma OD - ${nForma}".`);
        await tarjeta.locator('xpath=..').click();
        pasos.push({ campo: 'Forma', valor: `Forma OD - ${nForma}` });
    } else {
        pendientes.push('forma del armazón: elegir la tarjeta a mano');
    }
    await llenarCampo(page, pasos, 'pedido[armazones_attributes][0][largo]', 'Largo (A)', medida(payload.armazon.largo));
    await llenarCampo(page, pasos, 'pedido[armazones_attributes][0][altura]', 'Altura (B)', medida(payload.armazon.alto));
    await llenarCampo(page, pasos, 'pedido[armazones_attributes][0][diagonal_mayor]', 'Diagonal mayor (ED)', medida(payload.armazon.diagonalMayor));
    await llenarCampo(page, pasos, 'pedido[armazones_attributes][0][eje]', 'Eje de la diagonal', entero(payload.armazon.ejeDiagonal));
    await llenarCampo(page, pasos, 'pedido[armazones_attributes][0][puente]', 'Puente (DBL)', medida(payload.armazon.puente));
    const tipo = TIPO_ARMAZON.find(([re]) => re.test(payload.armazon.tipo || ''));
    if (tipo) await marcarRadio(page, pasos, 'pedido[armazones_attributes][0][tipo_armazon_id]', tipo[1], 'Tipo de armazón', tipo[2]);
    else pendientes.push(`tipo de armazón: la venta dice "${payload.armazon.tipo || 'nada'}" y el portal pide Metálico / Zilo / Ranurado / Perforado`);
    await marcarRadio(page, pasos, 'pedido[armazones_attributes][0][funcionalidad_id]', '1', 'Funcionalidad', 'Aro Convencional');
    await llenarCampo(page, pasos, 'pedido[armazones_attributes][0][caracteristicas]', 'Características', payload.armazon.caracteristicas);

    // Trabajos: por etiqueta, porque el orden lo decide el material.
    // (Rails pone un input hidden con el mismo nombre delante de cada checkbox.)
    // Lo que cambia el producto (antirreflejo, calibrado) se marca o se corta;
    // nunca queda como "pendiente" que alguien puede no leer.
    const ar = await checkboxPorEtiqueta(page, /recomendado|hi-?vision|antirreflejo/);
    if (ar) {
        await page.setChecked(`input[type=checkbox][name="${ar}"]`, payload.tratamientos.antirreflejo);
        pasos.push({ campo: 'Antirreflejo', valor: payload.tratamientos.antirreflejo ? 'sí (el recomendado del portal)' : 'no' });
    } else if (payload.tratamientos.antirreflejo) {
        throw new Error(`El portal de ${NOMBRE_VITOLEN} no muestra el casillero del antirreflejo para este material: se carga a mano.`);
    }
    const calibrado = await checkboxPorEtiqueta(page, /^calibrado$/);
    if (calibrado) {
        await page.setChecked(`input[type=checkbox][name="${calibrado}"]`, payload.montajes.calibrado);
        pasos.push({ campo: 'Calibrado', valor: payload.montajes.calibrado ? 'sí' : 'no' });
    } else if (payload.montajes.calibrado) {
        throw new Error(`El portal de ${NOMBRE_VITOLEN} no muestra el casillero "Calibrado": se carga a mano.`);
    }

    await llenarCampo(page, pasos, 'pedido[observaciones]', 'Observaciones', payload.observaciones);

    const captura = await page.screenshot({ fullPage: true });
    return { url: page.url(), pasos, pendientes, captura };
}

export interface ResumenDelPortal {
    url: string;
    texto: string;
    captura: Buffer;
    /** Id del borrador que el portal creó (`/ventas/pedidos_laboratorio/<id>`); null si lo rechazó. */
    portalDraftId: string | null;
    /** Lo que el portal objetó (líneas con el error y su campo); null si aceptó. */
    rechazo: string[] | null;
}

/**
 * Aprieta "Crear". Comprobado el 3/10/2026: el portal CREA un borrador con id
 * propio ("Nro de Trabajo: Por Asignar", estado Confirmación, no figura en el
 * listado) y muestra su resumen con Modificar / Cancelar / Confirmar. Si
 * rechaza (un campo vacío), vuelve al formulario con los errores y no crea
 * nada. NO confirma. Devuelve siempre la captura: un rechazo también se mira.
 */
export async function crearYLeerResumen(page: Page): Promise<ResumenDelPortal> {
    const boton = page.locator('input[type=submit][value="Crear"], button:has-text("Crear")').first();
    if (await boton.count() === 0) throw new Error(`El portal de ${NOMBRE_VITOLEN} no muestra el botón "Crear".`);
    await boton.click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2500);
    const texto = (await page.innerText('body').catch(() => '')) || '';
    const portalDraftId = idDeBorradorDeUrl(page.url());
    const lineas = texto.split('\n').map(l => l.trim()).filter(Boolean);
    const rechazo = portalDraftId ? [] : lineas.filter(l => /no puede estar en blanco|es obligatorio|inv[aá]lid|no es v[aá]lid|debe ser|error/i.test(l)).slice(0, 12);
    return { url: page.url(), texto, captura: await page.screenshot({ fullPage: true }), portalDraftId, rechazo: rechazo.length ? rechazo : null };
}

const urlBorrador = (portalDraftId: string) => `${BASE_VITOLEN}/ventas/pedidos_laboratorio/${portalDraftId}`;

/** Abre el borrador y comprueba que siga sin confirmar ("Por Asignar"). */
async function abrirBorrador(page: Page, portalDraftId: string): Promise<string> {
    await page.goto(urlBorrador(portalDraftId), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const texto = (await page.innerText('body').catch(() => '')) || '';
    if (!/Pedido de Laboratorio/i.test(texto)) throw new Error(`El portal de ${NOMBRE_VITOLEN} no muestra el borrador ${portalDraftId} (${page.url()}).`);
    return texto;
}

/** El borrador del portal ya no muestra lo que la persona aprobó (alguien usó "Modificar"). */
export class ResumenCambiadoError extends Error {
    readonly texto: string;
    readonly captura: Buffer;
    readonly url: string;
    constructor(texto: string, captura: Buffer, url: string) {
        super(`El pedido en el portal de ${NOMBRE_VITOLEN} cambió después de la aprobación: hay que revisarlo de nuevo.`);
        this.name = 'ResumenCambiadoError';
        this.texto = texto;
        this.captura = captura;
        this.url = url;
    }
}

/**
 * Confirma el borrador ya aprobado por una persona (`PUT …/confirmar`) y
 * devuelve el nº de trabajo que asignó el portal. Si el borrador ya tenía
 * número (una confirmación anterior que no se alcanzó a leer), no vuelve a
 * confirmar: lo devuelve. Si `resumenAprobado` viene, se compara con lo que
 * el portal muestra HOY y, si difiere, no se confirma (ResumenCambiadoError).
 */
export async function confirmar(page: Page, portalDraftId: string, resumenAprobado?: string | null): Promise<{ portalNumber: string; url: string; captura: Buffer; yaEstaba: boolean }> {
    const antes = await abrirBorrador(page, portalDraftId);
    const previo = numeroDeTrabajoDe(antes);
    if (previo) return { portalNumber: previo, url: page.url(), captura: await page.screenshot({ fullPage: true }), yaEstaba: true };
    if (resumenAprobado && resumenComparable(antes) !== resumenComparable(resumenAprobado)) {
        throw new ResumenCambiadoError(antes, await page.screenshot({ fullPage: true }), page.url());
    }

    const boton = page.locator('form[action$="/confirmar"] input[type=submit], form[action$="/confirmar"] button').first();
    if (await boton.count() === 0) throw new Error(`El borrador ${portalDraftId} de ${NOMBRE_VITOLEN} no muestra el botón "Confirmar".`);
    await boton.click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2500);
    const texto = (await page.innerText('body').catch(() => '')) || '';
    const portalNumber = numeroDeTrabajoDe(texto);
    if (!portalNumber) throw new Error(`El portal de ${NOMBRE_VITOLEN} no mostró el nº de trabajo después de confirmar el borrador ${portalDraftId} (${page.url()}).`);
    return { portalNumber, url: page.url(), captura: await page.screenshot({ fullPage: true }), yaEstaba: false };
}

/**
 * Cancela un borrador que una persona rechazó: el link "Cancelar" del portal
 * (DELETE con diálogo de confirmación). Se niega si ya tiene nº de trabajo:
 * un pedido confirmado se anula hablando con el laboratorio, no desde acá.
 */
export async function cancelarBorrador(page: Page, portalDraftId: string): Promise<{ url: string; captura: Buffer }> {
    const texto = await abrirBorrador(page, portalDraftId);
    if (numeroDeTrabajoDe(texto)) throw new Error(`El pedido ${portalDraftId} de ${NOMBRE_VITOLEN} ya está confirmado: no se cancela desde el sistema.`);
    const link = page.locator('a[data-method="delete"]:has-text("Cancelar")').first();
    if (await link.count() === 0) throw new Error(`El borrador ${portalDraftId} de ${NOMBRE_VITOLEN} no muestra el link "Cancelar".`);
    page.once('dialog', d => { d.accept().catch(() => null); });
    await link.click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2500);
    const captura = await page.screenshot({ fullPage: true });
    // No se da por cancelado hasta verlo: el borrador tiene que haber dejado de existir.
    const res = await page.goto(urlBorrador(portalDraftId), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    const despues = (await page.innerText('body').catch(() => '')) || '';
    if (res?.status() !== 404 && /Pedido de Laboratorio/i.test(despues) && /Por Asignar/i.test(despues)) {
        throw new Error(`El borrador ${portalDraftId} de ${NOMBRE_VITOLEN} sigue en el portal después de "Cancelar".`);
    }
    return { url: page.url(), captura };
}
