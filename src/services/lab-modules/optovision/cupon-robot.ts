import type { Page } from 'playwright';
import { conNavegador, CredencialRechazadaError } from '../portal/navegador';
import { WEB_DE_PROMO, type MarcaDePromo } from './promo';
import { cuponReutilizable, DIAS_CUPON_VIGENTE, elegirLineaWeb, elegirProductoWeb, esCuponDelCliente, esProviderMiPrimer, filasDeLaPromo, ordenDeBusqueda, pedidoDeLaPagina, segundoAdmitido, type FilaHistorial, type LineaWeb, type PedidoDeCupon, type PedidoWeb, type ProductoWeb } from './cupon-web';

/**
 * EL ROBOT DEL CUPÓN: entra a la web de la promo de Optovisión con la cuenta
 * de la óptica, resuelve línea y productos contra el catálogo vivo, busca si el
 * cliente YA tiene cupón de esa promo y, solo cuando se lo piden (al aprobar),
 * llena el formulario y confirma. Lo puro está en cupon-web.ts; el sitio, en
 * docs/promos-optovision-web.md.
 *
 * Reglas:
 *  · Credenciales SOLO del entorno (PROMO_VARILUX_* / PROMO_KODAK_*). Faltan → se avisa en el acto.
 *  · Si el sitio pone un CAPTCHA o el formulario ya no es el relevado, se FRENA
 *    y se dice: el cupón se genera a mano. Nunca se intenta saltar un CAPTCHA.
 *  · Preparar es SOLO LECTURA: se abortan todas las peticiones que no sean GET
 *    (menos el login) y se comprueba el bloqueo con una sonda antes de tocar nada.
 *  · Un cupón de "Mi Primer" se otorga una sola vez por cliente: antes de crear
 *    se busca en el historial por DNI, y lo que se crea se anota en el acto.
 */

const VARIABLES: Record<MarcaDePromo, { user: string; pass: string }> = {
    VARILUX: { user: 'PROMO_VARILUX_USER', pass: 'PROMO_VARILUX_PASSWORD' },
    KODAK: { user: 'PROMO_KODAK_USER', pass: 'PROMO_KODAK_PASSWORD' },
};
export const NOMBRE_WEB_PROMO: Record<MarcaDePromo, string> = { VARILUX: 'web de la promo Varilux', KODAK: 'web de la promo Kodak' };
/** El sitio es moderno, pero el criterio es el de toda la carga: tope ancho, nada aborta por apuro. */
export const ESPERA_WEB_PROMO_MS = 10 * 60_000;
const CADA_MS = 1000;
/** El sitio limita peticiones por minuto (429 visto el 21/10/2026): entre páginas se respira, y ante un 429 se espera un minuto y se repite. */
const PAUSA_ENTRE_PAGINAS_MS = 1200;
const ESPERA_TRAS_429_MS = 65_000;
const REINTENTOS_429 = 3;

export class CredencialPromoFaltanteError extends CredencialRechazadaError {
    constructor(marca: MarcaDePromo) {
        super(NOMBRE_WEB_PROMO[marca], `${VARIABLES[marca].user}/${VARIABLES[marca].pass}`);
        this.name = 'CredencialPromoFaltanteError';
        this.message = `Faltan ${VARIABLES[marca].user}/${VARIABLES[marca].pass} en las variables de entorno: el robot no puede entrar a la ${NOMBRE_WEB_PROMO[marca]} para generar el cupón. Cargarlas en Railway, o generar el cupón a mano y tipearlo al preparar.`;
    }
}
/** El sitio no deja trabajar al robot (CAPTCHA, formulario distinto): el cupón se genera a mano. */
export class SitioDePromoNoAceptaRobotError extends Error { constructor(m: string) { super(m); this.name = 'SitioDePromoNoAceptaRobotError'; } }
/** El sitio rechazó el pedido (validación): no se creó cupón. */
export class CuponRechazadoError extends Error { constructor(m: string) { super(m); this.name = 'CuponRechazadoError'; } }
/** "Mi Primer" ya fue otorgado a este cliente: no se genera otro. */
export class MiPrimerYaOtorgadoError extends Error { constructor(m: string) { super(m); this.name = 'MiPrimerYaOtorgadoError'; } }

/** Lee las credenciales del entorno. Las de Kodak caen a las de Varilux (misma aplicación, misma cuenta); `variables` dice cuáles se usaron. */
export function credencialesPromo(marca: MarcaDePromo, env: Record<string, string | undefined> = process.env): { usuario: string; clave: string; variables: string } {
    const leer = (m: MarcaDePromo) => ({ usuario: (env[VARIABLES[m].user] || '').trim(), clave: (env[VARIABLES[m].pass] || '').trim(), variables: `${VARIABLES[m].user}/${VARIABLES[m].pass}` });
    let c = leer(marca);
    if ((!c.usuario || !c.clave) && marca === 'KODAK') c = leer('VARILUX');
    if (!c.usuario || !c.clave) throw new CredencialPromoFaltanteError(marca);
    return c;
}

const base = (marca: MarcaDePromo) => WEB_DE_PROMO[marca].replace(/\/$/, '');

/** ¿La página tiene un CAPTCHA de verdad (widget o token), no solo el script cargado? Puro sobre el DOM. */
const HAY_CAPTCHA = `(() => !!document.querySelector('.g-recaptcha, iframe[src*="recaptcha/api2/anchor"], iframe[src*="hcaptcha"], textarea[name="g-recaptcha-response"]'))()`;

async function loginPromo(page: Page, marca: MarcaDePromo): Promise<void> {
    const { usuario, clave, variables } = credencialesPromo(marca);
    await page.goto(`${base(marca)}/login`, { waitUntil: 'domcontentloaded' });
    if (!/\/login/.test(page.url())) return; // ya adentro
    if (await page.evaluate(HAY_CAPTCHA)) throw new SitioDePromoNoAceptaRobotError(`la ${NOMBRE_WEB_PROMO[marca]} pide un CAPTCHA para entrar: el cupón se genera a mano`);
    await page.fill('form input[name="email"]', usuario);
    await page.fill('form input[name="password"]', clave);
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => null),
        page.click('form:has(input[name="password"]) button[type="submit"], form:has(input[name="password"]) input[type="submit"]'),
    ]);
    const limite = Date.now() + ESPERA_WEB_PROMO_MS;
    while (Date.now() < limite) {
        if (!/\/login/.test(page.url())) return;
        const cuerpo = (await page.innerText('body').catch(() => '')) || '';
        if (/credenciales|no coinciden|incorrect|inv[aá]lid/i.test(cuerpo)) throw new CredencialRechazadaError(NOMBRE_WEB_PROMO[marca], variables);
        await page.waitForTimeout(CADA_MS);
    }
    throw new Error(`la ${NOMBRE_WEB_PROMO[marca]} no salió del login en ${Math.round(ESPERA_WEB_PROMO_MS / 60_000)} minutos (${page.url()}).`);
}

/** Abre Chromium, entra a la web de la promo y deja la sesión lista. */
export async function conSesionPromo<T>(marca: MarcaDePromo, tarea: (page: Page) => Promise<T>): Promise<T> {
    credencialesPromo(marca);
    return conNavegador(async (page) => {
        await loginPromo(page, marca);
        return tarea(page);
    }, { timeoutMs: ESPERA_WEB_PROMO_MS, timeoutNavegacionMs: ESPERA_WEB_PROMO_MS });
}

/**
 * SOLO LECTURA: se aborta toda petición que no sea GET/HEAD y se prueba el
 * bloqueo con una sonda contra una ruta que no existe antes de tocar nada.
 */
export async function enSoloLecturaWeb<T>(page: Page, tarea: () => Promise<T>): Promise<T> {
    const atajadas: string[] = [];
    const handler = async (route: any) => {
        const q = route.request();
        if (!/^(GET|HEAD|OPTIONS)$/i.test(q.method())) { atajadas.push(q.url()); return route.abort('blockedbyclient'); }
        return route.continue();
    };
    const contexto = page.context();
    await contexto.route('**/*', handler);
    try {
        const paso = await page.evaluate(async () => { try { await fetch('/__sonda_solo_lectura__', { method: 'POST', body: 'x', credentials: 'include' }); return true; } catch { return false; } });
        if (paso || !atajadas.some(a => /__sonda_solo_lectura__/.test(a))) throw new Error('no se pudo poner la web de la promo en solo lectura; no se toca nada.');
        atajadas.length = 0;
        return await tarea();
    } finally {
        await page.goto('about:blank', { waitUntil: 'commit' }).catch(() => null);
        await contexto.unroute('**/*', handler).catch(() => null);
    }
}

async function pedirJson<T>(page: Page, ruta: string): Promise<T> {
    let r: any;
    for (let intento = 0; ; intento++) {
        r = await page.evaluate(async ({ u, t }) => {
            const res = await fetch(u, { credentials: 'include', headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(t) });
            if (!res.ok) return { __error: res.status };
            const texto = await res.text();
            try { return JSON.parse(texto); } catch { return { __texto: texto.slice(0, 200) }; }
        }, { u: ruta, t: ESPERA_WEB_PROMO_MS });
        if (r?.__error !== 429 || intento >= REINTENTOS_429) break;
        console.warn(`[Optovisión] la web de la promo contestó 429 a ${ruta}: se espera ${Math.round(ESPERA_TRAS_429_MS / 1000)} s y se repite (${intento + 1}/${REINTENTOS_429}).`);
        await page.waitForTimeout(ESPERA_TRAS_429_MS);
    }
    if (r?.__error) throw new Error(`la web de la promo respondió ${r.__error} a ${ruta}`);
    if (r?.__texto !== undefined) throw new Error(`la web de la promo no devolvió JSON en ${ruta}: ${r.__texto}`);
    return r as T;
}

export interface ResolucionCupon {
    provider: string;
    linea: { id: number; name: string };
    primero: { id: number; name: string; order: number };
    segundo: { id: number; name: string; order: number } | null;
}

/** Línea y producto(s) del cupón contra el catálogo VIVO del sitio. Lanza con el motivo si no se puede elegir uno solo. */
export async function resolverEnWeb(page: Page, marca: MarcaDePromo, pedido: PedidoDeCupon): Promise<ResolucionCupon> {
    const lineas = await pedirJson<LineaWeb[]>(page, `${base(marca)}/api/promotions/lines?provider=${pedido.provider}`);
    const l = elegirLineaWeb(lineas, pedido.primero.productoCRM);
    if (!l.ok) throw new Error(l.motivo);
    const productos = await pedirJson<ProductoWeb[]>(page, `${base(marca)}/api/promotions/lines/${l.linea.id}/products?provider=${pedido.provider}`);
    const p1 = elegirProductoWeb(productos, pedido.primero.rasgos);
    if (!p1.ok) throw new Error(`1er par: ${p1.motivo}`);
    let segundo: ResolucionCupon['segundo'] = null;
    if (pedido.segundo) {
        const p2 = elegirProductoWeb(productos, pedido.segundo.rasgos);
        if (!p2.ok) throw new Error(`2º par: ${p2.motivo}`);
        if (!segundoAdmitido(p1.producto, p2.producto)) throw new Error(`la web de la promo no admite "${p2.producto.name}" como 2º par de "${p1.producto.name}" (para el sitio vale más que el 1º, que el CRM elige por precio de lista): generá el cupón a mano en el sitio y tipealo al preparar`);
        segundo = { id: p2.producto.id, name: p2.producto.name, order: p2.producto.order };
    }
    return { provider: pedido.provider, linea: { id: l.linea.id, name: l.linea.name }, primero: { id: p1.producto.id, name: p1.producto.name, order: p1.producto.order }, segundo };
}

/** El historial del sitio (todas las filas, el sitio no pagina). */
export async function leerHistorial(page: Page, marca: MarcaDePromo): Promise<FilaHistorial[]> {
    await page.goto(`${base(marca)}/pedidos`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('table', { state: 'attached' });
    return page.evaluate(() => [...document.querySelectorAll('table tbody tr')].map(tr => {
        const td = [...tr.children] as HTMLElement[];
        const link = (i: number) => (td[i]?.querySelector('a') as HTMLAnchorElement | null)?.href ?? null;
        return { fecha: td[0]?.innerText.trim() ?? '', promocion: td[1]?.innerText.trim() ?? '', codigo: td[2]?.innerText.trim() ?? '', cliente: td[3]?.innerText.trim() ?? '', detalleUrl: link(4), pdfUrl: link(5) };
    }));
}

/**
 * Un cupón YA generado para este cliente y esta promo, por DNI (el nombre del
 * historial solo ordena la búsqueda; se recorre de la fila más nueva a la más
 * vieja, y en la promo doble solo las de los últimos 60 días: cupon-web.ts
 * `ordenDeBusqueda`). Devuelve el más nuevo que se pueda REUTILIZAR (sin usar
 * y reciente). Si la promo es "Mi Primer" y el DNI ya tiene un cupón que no se
 * puede reutilizar, lanza: esa promo es una vez por cliente y no se genera otro.
 */
/** El voucher PDF del sitio, con la sesión del navegador. Null si no hay link o no se pudo bajar (no frena nada). */
export async function bajarVoucher(page: Page, pdfUrl: string | null): Promise<Buffer | null> {
    if (!pdfUrl) return null;
    try {
        const r = await page.context().request.get(pdfUrl, { timeout: ESPERA_WEB_PROMO_MS });
        if (!r.ok() || !/pdf/i.test(r.headers()['content-type'] || '')) return null;
        return Buffer.from(await r.body());
    } catch { return null; }
}

export interface CuponDelSitio { pedido: PedidoWeb; url: string; pdfUrl: string | null; voucher: Buffer | null }

export async function buscarCuponExistente(page: Page, marca: MarcaDePromo, pedido: PedidoDeCupon): Promise<CuponDelSitio | null> {
    const filas = filasDeLaPromo((await leerHistorial(page, marca)).filter(f => f.detalleUrl), pedido.provider);
    const orden = ordenDeBusqueda(filas, `${pedido.cliente.nombre} ${pedido.cliente.apellido}`, esProviderMiPrimer(pedido.provider) ? null : DIAS_CUPON_VIGENTE);
    const delCliente: CuponDelSitio[] = [];
    for (const f of orden) {
        // Despacio: el sitio limita las peticiones por minuto (429 el 21/10/2026 abriendo 59 detalles seguidos).
        await page.waitForTimeout(PAUSA_ENTRE_PAGINAS_MS);
        await page.goto(f.detalleUrl!, { waitUntil: 'domcontentloaded' });
        if (await page.evaluate(() => /429|too many requests|demasiadas/i.test(document.title + ' ' + document.body.innerText.slice(0, 300)))) {
            await page.waitForTimeout(ESPERA_TRAS_429_MS);
            await page.goto(f.detalleUrl!, { waitUntil: 'domcontentloaded' });
        }
        const p = pedidoDeLaPagina(await page.content());
        if (!p || !esCuponDelCliente(p, { provider: pedido.provider, dni: pedido.cliente.dni })) continue;
        if (cuponReutilizable(p)) return { pedido: p, url: f.detalleUrl!, pdfUrl: f.pdfUrl, voucher: await bajarVoucher(page, f.pdfUrl) };
        delCliente.push({ pedido: p, url: f.detalleUrl!, pdfUrl: f.pdfUrl, voucher: null });
    }
    if (delCliente.length && esProviderMiPrimer(pedido.provider)) {
        const c = delCliente[0].pedido;
        throw new MiPrimerYaOtorgadoError(`este cliente (DNI ${pedido.cliente.dni}) ya tiene un cupón de Mi Primer en la ${NOMBRE_WEB_PROMO[marca]} (${c.code}, ${c.code_used_at ? 'usado' : `del ${String(c.created_at).slice(0, 10)}`}): la promo es una vez por cliente y no se genera otro. Confirmá con Optovisión qué corresponde y cargá el pedido con el cupón que te digan`);
    }
    return null;
}

async function esperarOpcion(page: Page, selector: string, value: string): Promise<void> {
    const limite = Date.now() + ESPERA_WEB_PROMO_MS;
    while (Date.now() < limite) {
        const hay = await page.evaluate(({ s, v }) => { const el = document.querySelector(s) as HTMLSelectElement | null; return !!el && !el.disabled && [...el.options].some(o => o.value === v); }, { s: selector, v: value });
        if (hay) return;
        await page.waitForTimeout(CADA_MS);
    }
    throw new Error(`la web de la promo no ofreció la opción ${value} en ${selector}`);
}

/** Llena un campo con máscara y comprueba lo que quedó (la máscara puede reescribirlo). */
async function llenarYLeer(page: Page, name: string, valor: string): Promise<string> {
    const sel = `form input[name="${name}"]`;
    await page.fill(sel, '');
    await page.type(sel, valor, { delay: 20 });
    await page.dispatchEvent(sel, 'blur').catch(() => null);
    return page.inputValue(sel);
}

const digitos = (s: string) => s.replace(/\D/g, '');

/**
 * Llena el formulario del sitio con el pedido y lo confirma. Devuelve el
 * pedido creado (con el cupón) leído de la página de detalle. ESCRIBE en el
 * sitio: se llama solo al aprobar, y quien llama anota el cupón en el acto.
 */
export async function generarCupon(page: Page, marca: MarcaDePromo, pedido: PedidoDeCupon, resolucion: ResolucionCupon, opts: { ensayo?: boolean } = {}): Promise<CuponDelSitio | { ensayo: true; captura: Buffer; quedo: Record<string, string> }> {
    const c = pedido.cliente;
    await page.goto(`${base(marca)}/pedidos/crear?provider=${pedido.provider}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('form input[name="first_name"]', { state: 'visible' });
    if (await page.evaluate(HAY_CAPTCHA)) throw new SitioDePromoNoAceptaRobotError(`la ${NOMBRE_WEB_PROMO[marca]} pide un CAPTCHA en el pedido: el cupón se genera a mano`);
    const esperado: Record<string, string> = {};
    const anotar = (k: string, v: string) => { esperado[k] = v; };

    await page.fill('form input[name="first_name"]', c.nombre); anotar('first_name', c.nombre);
    await page.fill('form input[name="last_name"]', c.apellido); anotar('last_name', c.apellido);
    await llenarYLeer(page, 'document_number_input', c.dni); anotar('document_number', c.dni);
    await page.selectOption('form select[name="gender"]', c.genero); anotar('gender', c.genero);
    if (c.telefono) { await llenarYLeer(page, 'phone', c.telefono); anotar('phone', c.telefono); }
    if (c.email) { await page.fill('form input[name="email"]', c.email); anotar('email', c.email); }
    // Nacimiento: tres selects sin nombre (Día / Mes 0–11 / Año) que alimentan el oculto `birthdate`.
    for (const [texto, valor] of [['Día', String(c.nacimiento.dia)], ['Mes', String(c.nacimiento.mes0)], ['Año', String(c.nacimiento.anio)]] as const) {
        const sel = page.locator('form select').filter({ has: page.locator('option', { hasText: new RegExp(`^${texto}$`) }) }).first();
        if (!(await sel.count())) throw new SitioDePromoNoAceptaRobotError(`la ${NOMBRE_WEB_PROMO[marca]} ya no tiene el selector "${texto}" de la fecha de nacimiento: el cupón se genera a mano`);
        await sel.selectOption(valor);
    }
    anotar('birthdate', c.nacimiento.iso);
    // Laboratorio: la opción que DICE Optovisión, nunca un id fijo.
    const labValue = await page.evaluate(() => { const el = document.querySelector('form select[name="lab_id"]') as HTMLSelectElement | null; const o = el && [...el.options].find(o => /optovisi/i.test(o.text)); return o?.value ?? null; });
    if (!labValue) throw new SitioDePromoNoAceptaRobotError(`la ${NOMBRE_WEB_PROMO[marca]} no lista a Optovisión como laboratorio: el cupón se genera a mano`);
    await page.selectOption('form select[name="lab_id"]', labValue); anotar('lab_id', labValue);
    for (const lado of ['od', 'oi'] as const) {
        const r = pedido.receta[lado];
        for (const [campo, valor] of [['esferico', r.esferico], ['cilindrico', r.cilindrico], ['eje', r.eje], ['adicion', r.adicion], ['dnp', r.dnp]] as const) {
            if (valor === '') continue;
            await llenarYLeer(page, `${lado}_${campo}`, valor);
            anotar(`${lado}_${campo}`, valor);
        }
    }
    await page.selectOption('form select[name="promotions_product_line_id"]', String(resolucion.linea.id)); anotar('promotions_product_line_id', String(resolucion.linea.id));
    await esperarOpcion(page, 'form select[name="first_product_id"]', String(resolucion.primero.id));
    await page.selectOption('form select[name="first_product_id"]', String(resolucion.primero.id)); anotar('first_product_id', String(resolucion.primero.id));
    if (resolucion.segundo) {
        await esperarOpcion(page, 'form select[name="second_product_id"]', String(resolucion.segundo.id));
        await page.selectOption('form select[name="second_product_id"]', String(resolucion.segundo.id)); anotar('second_product_id', String(resolucion.segundo.id));
    }
    // Lo que quedó, campo por campo, tiene que ser lo pedido (la máscara o Vue pueden haberlo cambiado). Si no, no se confirma.
    const quedo: Record<string, string> = await page.evaluate(() => Object.fromEntries([...(document.querySelector('form input[name="first_name"]')!.closest('form')!.elements as any as HTMLInputElement[])].filter(e => e.name).map(e => [e.name, e.value])));
    const dif = Object.entries(esperado).filter(([k, v]) => {
        const q = quedo[k] ?? '';
        if (/^(od|oi)_(esferico|cilindrico|adicion)$/.test(k)) return Number(q.replace(',', '.')) !== Number(v);
        if (k === 'document_number' || k === 'phone' || /dnp|eje/.test(k)) return digitos(q) !== digitos(v);
        return q.trim() !== v.trim();
    }).map(([k, v]) => `${k}: pedido "${v}", quedó "${quedo[k] ?? ''}"`);
    if (dif.length) throw new SitioDePromoNoAceptaRobotError(`el formulario de la ${NOMBRE_WEB_PROMO[marca]} no quedó como se pidió (${dif.slice(0, 4).join(' · ')}): el cupón se genera a mano`);

    // La validación del sitio marca los campos ANTES de confirmar (vee-validate): si ya hay un error visible, no se aprieta nada.
    const invalidos: string[] = await page.evaluate(() => [...document.querySelectorAll('form .invalid-feedback, form .is-invalid')].filter(e => (e as HTMLElement).offsetParent !== null).map(e => ((e as HTMLElement).innerText || (e as HTMLElement).getAttribute('name') || '').trim()).filter(Boolean));
    if (invalidos.length) throw new CuponRechazadoError(`la ${NOMBRE_WEB_PROMO[marca]} no acepta el pedido tal como está (${[...new Set(invalidos)].slice(0, 4).join(' · ')}); no se creó cupón`);
    const boton = page.locator('form button[type="submit"]', { hasText: /confirmar/i }).first();
    if (!(await boton.count())) throw new SitioDePromoNoAceptaRobotError(`la ${NOMBRE_WEB_PROMO[marca]} no tiene el botón "Confirmar pedido": el cupón se genera a mano`);
    // ENSAYO: todo llenado y verificado, pero sin confirmar (prueba de punta a punta sin crear un cupón).
    if (opts.ensayo) return { ensayo: true, captura: await page.screenshot({ fullPage: true, type: 'png' }), quedo };
    await boton.click();
    // El envío es un POST clásico: éxito = redirección a /pedidos/<id>; rechazo = sigue en /pedidos/crear con los errores.
    const limite = Date.now() + ESPERA_WEB_PROMO_MS;
    while (Date.now() < limite) {
        await page.waitForTimeout(CADA_MS);
        const url = page.url();
        if (/\/pedidos\/\d+(\?|$)/.test(url)) {
            const html = await page.content();
            const creado = pedidoDeLaPagina(html);
            if (!creado) throw new Error(`la ${NOMBRE_WEB_PROMO[marca]} mostró ${url} pero no se pudo leer el cupón (puede estar creado): Reintentar lo busca en el historial por DNI antes de generar otro`);
            if (!esCuponDelCliente(creado, { provider: pedido.provider, dni: c.dni })) throw new Error(`la ${NOMBRE_WEB_PROMO[marca]} mostró el pedido ${creado.id} (cupón ${creado.code}) pero no es de este cliente/promo: revisá el historial del sitio`);
            const pdf = html.match(/href="([^"]*\/pedidos\/\d+\/pdf[^"]*)"/);
            const pdfUrl = pdf ? pdf[1].replace(/&amp;/g, '&') : null;
            return { pedido: creado, url, pdfUrl, voucher: await bajarVoucher(page, pdfUrl) };
        }
        // Solo errores VISIBLES: un texto de error escondido en la plantilla no prueba un rechazo.
        const errores: string[] = await page.evaluate(() => [...document.querySelectorAll('.is-invalid, .invalid-feedback, .alert-danger')].filter(e => (e as HTMLElement).offsetParent !== null).map(e => ((e as HTMLElement).getAttribute('name') || (e as HTMLElement).innerText || '').trim()).filter(Boolean));
        if (errores.length) throw new CuponRechazadoError(`la ${NOMBRE_WEB_PROMO[marca]} no aceptó el pedido (${[...new Set(errores)].slice(0, 5).join(' · ')}); no se creó cupón`);
        if (await page.evaluate(HAY_CAPTCHA)) throw new SitioDePromoNoAceptaRobotError(`la ${NOMBRE_WEB_PROMO[marca]} pidió un CAPTCHA al confirmar: el cupón se genera a mano`);
    }
    throw new Error(`la ${NOMBRE_WEB_PROMO[marca]} no respondió al confirmar en ${Math.round(ESPERA_WEB_PROMO_MS / 60_000)} minutos (el cupón puede estar creado): Reintentar lo busca en el historial por DNI antes de generar otro`);
}
