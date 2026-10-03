import type { Page } from 'playwright';
import { conNavegador, CredencialRechazadaError, esperarLogin, type OpcionesNavegador } from '../portal/navegador';
import { FILAS_POR_PAGINA, seguirPaginando, type FilaApiSmartLab } from './pedidos';

/**
 * SESIÓN EN EL PORTAL DE GRUPO ÓPTICO (SmartLab): abrir Chromium, entrar con
 * SMARTLAB_USER / SMARTLAB_PASSWORD y dejar la página del listado cargada.
 *
 * Es EL ÚNICO login contra ese portal. Hasta el 3/10/2026 había dos copias
 * (smartlab.service.ts para los estados y grupo-optico.provider.ts para los
 * costos), cada una con su regex de rechazo y las dos con la clave vieja
 * escrita en el código como respaldo: cambiarla en Railway no servía de nada,
 * y sin variables el robot entraba con una clave que ya no existía.
 *
 * El portal es un dyndns casero: lento (minutos por paso mientras migran de
 * servidor, 9/2026), negocia mal HTTP/2 desde el contenedor y tira errores
 * transitorios de red. Por eso los 5 minutos por paso, `sinHttp2` y los
 * reintentos del login. Una credencial rechazada NO se reintenta: se corta en
 * el acto diciendo qué hay que tocar (lección del corte del 24/8 al 8/9/2026,
 * quince días buscando un problema de red que no existía).
 *
 * Los pedidos se leen de la API JSON interna del portal (la que usa su propia
 * página), pedida DESDE la página con `fetch` para que comparta la sesión. El
 * servicio viejo raspaba la tabla HTML (`table tbody tr`: nº, cliente, fecha
 * "dd-mm-yy", sector y una barra de progreso) y después buscaba cada nº del
 * CRM con el buscador, 7 s por pedido; queda como historia, la API trae lo
 * mismo en una pasada.
 */

export const LAB_GRUPO_OPTICO = 'GRUPO_OPTICO';
export const NOMBRE_GRUPO_OPTICO = 'Grupo Óptico';
export const ROBOT_GRUPO_OPTICO = 'Robot Grupo Óptico';
export const PORTAL_BASE = 'https://grupooptico.dyndns.info';
export const API_BASE = `${PORTAL_BASE}/smartlab-api-v2/public/index.php`;
export const URL_LOGIN = `${PORTAL_BASE}/smartlab/auth/authSmartlab/login`;
export const URL_LISTADO = `${PORTAL_BASE}/smartlab/laboratory/list`;
const VARIABLES = 'SMARTLAB_USER/SMARTLAB_PASSWORD';
/** Cinco minutos por paso: un pase lento que TERMINA vale más que uno rápido que aborta (Ishtar, 7/9/2026). */
export const ESPERA_SMARTLAB_MS = 300_000;
const URL_DE_LOGIN = /\/login|\/auth\//i;
const TEXTO_DE_RECHAZO = /incorrect|no se pudo iniciar sesi|credenciales inv/i;
const INTENTOS_LOGIN = 3;
const PAUSA_ENTRE_INTENTOS_MS = 20_000;
/** Tope de páginas de la API por lectura (3.000 pedidos: la era CRM entera entra de sobra). */
export const MAX_PAGINAS_API = 30;
const PAUSA_ENTRE_PAGINAS_MS = 400;

/** Sin variables no hay nada que intentar: se avisa en el acto, como con una clave rechazada. */
export class CredencialFaltanteError extends CredencialRechazadaError {
    constructor() {
        super(NOMBRE_GRUPO_OPTICO, VARIABLES);
        this.name = 'CredencialFaltanteError';
        this.message = `Faltan ${VARIABLES} en las variables de entorno: el robot de ${NOMBRE_GRUPO_OPTICO} no puede entrar al portal. Cargarlas en Railway (o en .env para una prueba local).`;
    }
}

/** Lee las credenciales del entorno. Lanza ANTES de abrir el navegador si faltan. */
export function credencialesSmartLab(): { usuario: string; clave: string } {
    const usuario = (process.env.SMARTLAB_USER || '').trim();
    const clave = (process.env.SMARTLAB_PASSWORD || '').trim();
    if (!usuario || !clave) throw new CredencialFaltanteError();
    return { usuario, clave };
}

/** El id de la óptica en la API del portal (no es un secreto: va en la URL de su propia página). */
export function clientIdSmartLab(): string {
    return (process.env.SMARTLAB_CLIENT_ID || '2462').trim();
}

/** La URL de una página del listado en la API JSON del portal (100 por página, de más nuevo a más viejo). */
export function urlListadoApi(current: number, clientId = clientIdSmartLab()): string {
    return `${API_BASE}/laboratory/order/list?rowPerPage=${FILAS_POR_PAGINA}&current=${current}` +
        `&isClient=1&isSeller=0&userId=${encodeURIComponent(clientId)}&sellerId=0` +
        `&search=&invoiceNumber=&sector=0&client=null&invoice=0&lensType=0&calibratedBy=0&zone=0`;
}

/**
 * Entra al portal con la página ya abierta. Llena los dos primeros inputs,
 * aprieta el botón de ingresar y espera POR EL RESULTADO (la URL deja de ser
 * la del login, o aparece el cartel de rechazo), no por un evento: el login
 * se resuelve por JavaScript y `waitForNavigation` fallaba logins que entraban.
 */
export async function loginSmartLab(page: Page): Promise<void> {
    const { usuario, clave } = credencialesSmartLab();
    await page.goto(URL_LOGIN, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input');
    const inputs = await page.$$('input');
    if (inputs.length < 2) throw new Error(`El portal de ${NOMBRE_GRUPO_OPTICO} no mostró los campos de login (${page.url()}).`);
    await page.waitForTimeout(1500);
    await inputs[0].fill(usuario);
    await page.waitForTimeout(800);
    await inputs[1].fill(clave);
    await page.waitForTimeout(800);

    let apretado = false;
    for (const btn of await page.$$('button')) {
        const t = ((await btn.innerText().catch(() => '')) || '').toLowerCase();
        if (t.includes('iniciar') || t.includes('ingresar') || t.includes('login')) {
            await btn.click({ delay: 200 });
            apretado = true;
            break;
        }
    }
    if (!apretado) await inputs[1].press('Enter', { delay: 200 }).catch(() => {});

    await esperarLogin(page, {
        lab: NOMBRE_GRUPO_OPTICO, variables: VARIABLES,
        urlDeLogin: URL_DE_LOGIN, textoDeRechazo: TEXTO_DE_RECHAZO,
        maxMs: ESPERA_SMARTLAB_MS, cadaMs: 5000,
    });
}

/**
 * Abre el navegador, entra y deja cargada la página del listado (la app tiene
 * que estar cargada para que `fetch` desde adentro comparta la sesión). Las
 * fallas de red se reintentan con pausa; una credencial rechazada o faltante
 * se corta en el acto.
 */
export async function conSesionSmartLab<T>(tarea: (page: Page) => Promise<T>, opts: OpcionesNavegador = {}): Promise<T> {
    credencialesSmartLab();
    return conNavegador(async (page) => {
        let ultimoError: unknown = null;
        for (let intento = 1; intento <= INTENTOS_LOGIN; intento++) {
            try {
                await loginSmartLab(page);
                await page.goto(URL_LISTADO, { waitUntil: 'domcontentloaded' });
                ultimoError = null;
                if (intento > 1) console.log(`[Grupo Óptico] Portal OK en el intento ${intento}.`);
                break;
            } catch (err) {
                if (err instanceof CredencialRechazadaError) throw err;
                ultimoError = err;
                console.warn(`[Grupo Óptico] Login falló (intento ${intento}/${INTENTOS_LOGIN}):`, (err as Error)?.message || err);
                if (intento < INTENTOS_LOGIN) await new Promise(r => setTimeout(r, PAUSA_ENTRE_INTENTOS_MS));
            }
        }
        if (ultimoError) throw ultimoError;
        return tarea(page);
    }, { sinHttp2: true, timeoutMs: ESPERA_SMARTLAB_MS, timeoutNavegacionMs: ESPERA_SMARTLAB_MS, ...opts });
}

/** GET JSON con la sesión del navegador, desde adentro de la página, con tope. */
export async function pedirJsonDesdeLaPagina<T = any>(page: Page, url: string, timeoutMs = 180_000): Promise<T> {
    const res: any = await page.evaluate(async ({ u, t }) => {
        // AbortSignal.timeout: un fetch que el portal nunca responde colgaría
        // el evaluate (y el navegador) para siempre.
        const r = await fetch(u, { credentials: 'include', signal: AbortSignal.timeout(t) });
        if (!r.ok) return { __error: r.status };
        return await r.json();
    }, { u: url, t: timeoutMs });
    if (res?.__error) throw new Error(`La API de ${NOMBRE_GRUPO_OPTICO} respondió ${res.__error} (${url.slice(0, 80)}…)`);
    return res as T;
}

export interface LecturaApi {
    rows: FilaApiSmartLab[];
    paginasLeidas: number;
    /** true si se cortó por el tope de páginas (la ventana no se cubrió entera). */
    truncada: boolean;
}

/**
 * Los pedidos del portal desde `desde` hasta hoy: página por página hasta que
 * una venga incompleta o su pedido más viejo quede fuera de la ventana. Una
 * sola sesión; pausa entre páginas para no castigar al portal.
 */
export async function leerPedidosApi(page: Page, desde: Date): Promise<LecturaApi> {
    const rows: FilaApiSmartLab[] = [];
    let paginasLeidas = 0;
    let truncada = false;
    for (let current = 1; current <= MAX_PAGINAS_API; current++) {
        const res = await pedirJsonDesdeLaPagina<{ rows?: FilaApiSmartLab[] }>(page, urlListadoApi(current));
        const pagina = Array.isArray(res?.rows) ? res.rows : [];
        paginasLeidas = current;
        rows.push(...pagina);
        if (!seguirPaginando(pagina, desde)) break;
        if (current === MAX_PAGINAS_API) truncada = true;
        await page.waitForTimeout(PAUSA_ENTRE_PAGINAS_MS);
    }
    return { rows, paginasLeidas, truncada };
}
