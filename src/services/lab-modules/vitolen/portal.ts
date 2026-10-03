import type { Page } from 'playwright';
import { conNavegador, esperarLogin, CredencialRechazadaError, type OpcionesNavegador } from '../portal/navegador';
import { BASE_VITOLEN, extraerHtmlDeRespuestaJs, leerPaginador, parsearListado, urlListado, type FilaListado, type PeriodoListado } from './pedidos';

/**
 * SESIÓN EN EL PORTAL DE VITOLEN (docs/vitolen-portal.md): abrir Chromium,
 * entrar con VITOLEN_USER / VITOLEN_PASSWORD y pedir páginas DESDE ADENTRO de
 * la página. Lo último no es capricho: el certificado del portal viene sin la
 * cadena intermedia, Chromium la completa solo pero `fetch` de Node y
 * `page.request` fallan con "unable to verify the first certificate".
 */

export const LAB_VITOLEN = 'VITOLEN';
export const NOMBRE_VITOLEN = 'Vitolen';
export const ROBOT_VITOLEN = 'Robot Vitolen';
const VARIABLES = 'VITOLEN_USER / VITOLEN_PASSWORD';
const URL_DE_LOGIN = /\/session/;
/** Nunca vimos el cartel real (la clave siempre fue buena): si Vitolen usa otra frase, ajustar acá. */
const TEXTO_DE_RECHAZO = /inv[aá]lid|incorrect|no coincide|no v[aá]lid/i;

/** Sin variables no hay nada que intentar, y hay que avisar en el acto como con una clave rechazada. */
export class CredencialFaltanteError extends CredencialRechazadaError {
    constructor() {
        super(NOMBRE_VITOLEN, VARIABLES);
        this.name = 'CredencialFaltanteError';
        this.message = `Faltan ${VARIABLES} en las variables de entorno: el módulo de ${NOMBRE_VITOLEN} no puede entrar al portal.`;
    }
}

export function credencialesVitolen(): { usuario: string; clave: string } {
    const usuario = (process.env.VITOLEN_USER || '').trim();
    const clave = (process.env.VITOLEN_PASSWORD || '').trim();
    if (!usuario || !clave) throw new CredencialFaltanteError();
    return { usuario, clave };
}

export async function conSesionVitolen<T>(tarea: (page: Page) => Promise<T>, opts: OpcionesNavegador = {}): Promise<T> {
    const { usuario, clave } = credencialesVitolen();
    return conNavegador(async (page) => {
        await page.goto(`${BASE_VITOLEN}/session/new`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('input[type=password]');
        const campoUsuario = await page.$('input[type=text], input:not([type]), input[type=email]');
        const campoClave = await page.$('input[type=password]');
        if (!campoUsuario || !campoClave) throw new Error(`El portal de ${NOMBRE_VITOLEN} no mostró el formulario de login (${page.url()}).`);
        await campoUsuario.fill(usuario);
        await campoClave.fill(clave);
        const boton = await page.$('input[type=submit], button[type=submit]');
        if (boton) await boton.click(); else await campoClave.press('Enter');
        await esperarLogin(page, { lab: NOMBRE_VITOLEN, variables: VARIABLES, urlDeLogin: URL_DE_LOGIN, textoDeRechazo: TEXTO_DE_RECHAZO, maxMs: 60_000, cadaMs: 2000 });
        return tarea(page);
    }, { timeoutMs: 60_000, timeoutNavegacionMs: 60_000, ...opts });
}

export interface RespuestaDeLaPagina { status: number; contentType: string; cuerpo: string }

/** GET con la sesión del navegador, ejecutado dentro de la página (ver arriba por qué). */
export async function pedirDesdeLaPagina(page: Page, ruta: string, accept = 'text/javascript'): Promise<RespuestaDeLaPagina> {
    const url = ruta.startsWith('http') ? ruta : `${BASE_VITOLEN}${ruta}`;
    return page.evaluate(async ({ url, accept }) => {
        const r = await fetch(url, { credentials: 'include', headers: { 'X-Requested-With': 'XMLHttpRequest', Accept: accept } });
        return { status: r.status, contentType: r.headers.get('content-type') || '', cuerpo: await r.text() };
    }, { url, accept });
}

export interface ListadoLeido {
    filas: FilaListado[];
    paginasLeidas: number;
    /** Lo que el paginador dijo que había en total (null si no lo dijo). */
    total: number | null;
}

/**
 * Lee el listado completo del período: la primera página y las que el
 * paginador anuncie. Si una página no trae la tabla, se corta con error (no se
 * devuelve un listado a medias como si fuera entero).
 */
export async function leerListado(page: Page, periodo: PeriodoListado): Promise<ListadoLeido> {
    const filas: FilaListado[] = [];
    const vistas = new Set<number>();
    const pendientes = [1];
    let total: number | null = null;
    while (pendientes.length) {
        const n = pendientes.shift()!;
        if (vistas.has(n)) continue;
        vistas.add(n);
        const r = await pedirDesdeLaPagina(page, urlListado(periodo, n));
        if (r.status !== 200) throw new Error(`El listado de ${NOMBRE_VITOLEN} respondió ${r.status} en la página ${n}.`);
        const html = extraerHtmlDeRespuestaJs(r.cuerpo);
        if (html === null) throw new Error(`La respuesta del listado de ${NOMBRE_VITOLEN} (página ${n}) no trajo la tabla de pedidos.`);
        filas.push(...parsearListado(html));
        const pag = leerPaginador(html);
        if (pag.total !== null) total = pag.total;
        for (const p of pag.paginas) if (!vistas.has(p)) pendientes.push(p);
    }
    return { filas, paginasLeidas: vistas.size, total };
}
