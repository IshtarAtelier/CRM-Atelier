import type { Page } from 'playwright';
import { conNavegador, CredencialRechazadaError, type OpcionesNavegador } from '../portal/navegador';

/**
 * SESIÓN EN OVES, el portal de pedidos de Optovisión (docs/oves-portal.md).
 *
 * Es una app de una sola página (PHP + jQuery de 2010): el login manda el
 * usuario y el MD5 de la clave por un RPC propio, y todo lo demás son GET/POST
 * a `include/suggest.php`. Lento (2–4 s por consulta de catálogo, minutos
 * cuando se traba) y viejo: por eso cada paso tiene media hora de techo y nada
 * se "ajusta" para que el log quede corto (Ishtar, 16/10/2026).
 *
 * Una ventana por sesión: lo controla con BroadcastChannel ENTRE pestañas del
 * mismo navegador, así que el Chromium del robot no choca con una persona en
 * su Chrome. Lo que sí es uno solo es el turno del portal (portal/turno.ts):
 * dos robots a la vez serían dos pedidos.
 *
 * Credenciales SOLO del entorno (`OVES_USER` / `OVES_PASSWORD`, Railway y
 * .env): nunca en el código. Sin ellas, se avisa en el acto.
 */

export const LAB_OPTOVISION = 'OPTOVISION';
export const NOMBRE_OPTOVISION = 'Optovisión';
export const ROBOT_OPTOVISION = 'Robot Optovisión';
export const PORTAL_BASE = 'http://www.optovision.com.ar/oves/lab/';
export const URL_SUGGEST = `${PORTAL_BASE}include/suggest.php`;
const VARIABLES = 'OVES_USER/OVES_PASSWORD';
/** Treinta minutos por paso, como Grupo Óptico: una pasada lenta que TERMINA vale más que una rápida que aborta. */
export const ESPERA_OVES_MS = 30 * 60_000;
const INTENTOS_LOGIN = 3;
const PAUSA_ENTRE_INTENTOS_MS = 30_000;
/** Cada cuánto se mira si el login terminó (el portal lo resuelve por JavaScript, sin navegación). */
const CADA_MS = 3000;

export class CredencialFaltanteError extends CredencialRechazadaError {
    constructor() {
        super(NOMBRE_OPTOVISION, VARIABLES);
        this.name = 'CredencialFaltanteError';
        this.message = `Faltan ${VARIABLES} en las variables de entorno: el robot de ${NOMBRE_OPTOVISION} no puede entrar a OVES. Cargarlas en Railway (o en .env para una prueba local).`;
    }
}

/** Lee las credenciales del entorno. Lanza ANTES de abrir el navegador si faltan. */
export function credencialesOves(): { usuario: string; clave: string } {
    const usuario = (process.env.OVES_USER || '').trim();
    const clave = (process.env.OVES_PASSWORD || '').trim();
    if (!usuario || !clave) throw new CredencialFaltanteError();
    return { usuario, clave };
}

/** ¿La página muestra la app logueada? El cartel "Bienvenido <usuario>…" y el menú superior visibles. Puro sobre el DOM. */
const ESTADO_LOGIN = `(() => {
    const vis = (id) => { const e = document.getElementById(id); return !!e && e.offsetParent !== null; };
    const resp = (document.getElementById('respuesta')?.innerText || '').trim();
    const user = (document.getElementById('user')?.innerText || '').trim();
    return { logueado: vis('topmenu') && /bienvenido/i.test(user), rechazo: resp, formulario: vis('formlogin'), user };
})()`;

/**
 * Entra a OVES con la página ya abierta: llena `usr` y `pwd` y aprieta el botón
 * de ingresar (la app calcula el MD5 sola). Espera POR EL RESULTADO: el menú
 * logueado, o el cartel de rechazo en `#respuesta`. Una credencial rechazada
 * se corta en el acto (lección de SmartLab: quince días buscando un problema
 * de red que era la clave).
 */
export async function loginOves(page: Page): Promise<void> {
    const { usuario, clave } = credencialesOves();
    await page.goto(PORTAL_BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#formlogin #usr', { state: 'attached' });
    // La app decide sola si muestra el login (tras `x_checkLogin`): se espera a que lo muestre o a que ya esté adentro.
    const limiteInicial = Date.now() + ESPERA_OVES_MS;
    while (Date.now() < limiteInicial) {
        const e = await page.evaluate(ESTADO_LOGIN) as { logueado: boolean; formulario: boolean };
        if (e.logueado) return;
        if (e.formulario) break;
        await page.waitForTimeout(CADA_MS);
    }
    await page.fill('#formlogin #usr', usuario);
    await page.waitForTimeout(500);
    await page.fill('#formlogin #pwd', clave);
    await page.waitForTimeout(500);
    const boton = page.locator('#formlogin input[type=image]').first();
    if (await boton.count()) await boton.click(); else await page.press('#formlogin #pwd', 'Enter');

    const limite = Date.now() + ESPERA_OVES_MS;
    while (Date.now() < limite) {
        await page.waitForTimeout(CADA_MS);
        const e = await page.evaluate(ESTADO_LOGIN) as { logueado: boolean; rechazo: string; formulario: boolean };
        if (e.logueado) return;
        if (e.rechazo && /incorrect|inv[aá]lid|no existe|error|rechaz|bloquead/i.test(e.rechazo)) throw new CredencialRechazadaError(NOMBRE_OPTOVISION, VARIABLES);
    }
    throw new Error(`El portal de ${NOMBRE_OPTOVISION} no terminó el login en ${Math.round(ESPERA_OVES_MS / 60_000)} minutos.`);
}

/**
 * Abre Chromium, entra a OVES y deja la app cargada. Las fallas de red se
 * reintentan con pausa; una credencial rechazada o faltante se corta en el acto.
 */
export async function conSesionOves<T>(tarea: (page: Page) => Promise<T>, opts: OpcionesNavegador = {}): Promise<T> {
    credencialesOves();
    return conNavegador(async (page) => {
        let ultimoError: unknown = null;
        for (let intento = 1; intento <= INTENTOS_LOGIN; intento++) {
            try {
                await loginOves(page);
                ultimoError = null;
                if (intento > 1) console.log(`[Optovisión] OVES OK en el intento ${intento}.`);
                break;
            } catch (err) {
                if (err instanceof CredencialRechazadaError) throw err;
                ultimoError = err;
                console.warn(`[Optovisión] Login en OVES falló (intento ${intento}/${INTENTOS_LOGIN}):`, (err as Error)?.message || err);
                if (intento < INTENTOS_LOGIN) await new Promise(r => setTimeout(r, PAUSA_ENTRE_INTENTOS_MS));
            }
        }
        if (ultimoError) throw ultimoError;
        return tarea(page);
    }, { sinHttp2: true, timeoutMs: ESPERA_OVES_MS, timeoutNavegacionMs: ESPERA_OVES_MS, ...opts });
}

/** GET JSON a `include/suggest.php?opc=…` con la sesión del navegador, desde adentro de la página, con tope. */
export async function pedirJsonOves<T = any>(page: Page, consulta: Record<string, string>, timeoutMs = 15 * 60_000): Promise<T> {
    const url = `${URL_SUGGEST}?${Object.entries(consulta).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`;
    const res: any = await page.evaluate(async ({ u, t }) => {
        const r = await fetch(u, { credentials: 'include', signal: AbortSignal.timeout(t) });
        if (!r.ok) return { __error: r.status };
        const texto = await r.text();
        try { return JSON.parse(texto); } catch { return { __texto: texto.slice(0, 300) }; }
    }, { u: url, t: timeoutMs });
    if (res?.__error) throw new Error(`OVES respondió ${res.__error} (${consulta.opc})`);
    if (res?.__texto !== undefined) throw new Error(`OVES no devolvió JSON para ${consulta.opc}: ${res.__texto}`);
    return res as T;
}
