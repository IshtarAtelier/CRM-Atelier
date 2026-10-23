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
/** Fuera de producción el robot prepara pero no graba; para probar a propósito: OVES_PERMITIR_CARGA=1 (carga/produccion.ts). */
export const VARIABLE_PERMISO_OVES = 'OVES_PERMITIR_CARGA';
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
    // El "Bienvenido" vive al lado de #user, no adentro (21/10/2026): logueado = menú visible + usuario con nombre.
    return { logueado: vis('topmenu') && user.length > 0, rechazo: resp, formulario: vis('formlogin'), formaDeCompra: vis('frmcli'), user };
})()`;

/**
 * La pantalla "Forma de compra" que OVES muestra tras el login cuando la
 * sesión es nueva (vista el 21/10/2026; en el Chrome de la óptica no aparece
 * porque la sesión ya la tenía resuelta): pares / piezas, LABORATORIO / STOCK
 * y el lugar de entrega. Se elige lo que usa la óptica —pares, laboratorio y
 * el único lugar de entrega— y se confirma; la app pasa sola a /oves/lab/.
 */
async function elegirFormaDeCompra(page: Page): Promise<void> {
    const lugares = await page.evaluate(() => {
        const marcar = (sel: string) => { const el = document.querySelector(sel) as HTMLInputElement | null; if (el) { el.checked = true; el.dispatchEvent(new Event('click', { bubbles: true })); } };
        marcar('#frmcli input[name="unidad"][value="2"]');
        marcar('#frmcli #tipopedidoLab');
        const s = document.getElementById('lugarEntregaLab') as HTMLSelectElement | null;
        if (!s) return [];
        const reales = [...s.options].filter(o => o.value !== '-1');
        s.disabled = false;
        if (reales.length === 1) { s.value = reales[0].value; s.dispatchEvent(new Event('change', { bubbles: true })); }
        return reales.map(o => o.text.trim());
    });
    if (lugares.length !== 1) throw new Error(`${NOMBRE_OPTOVISION} pide elegir el lugar de entrega y hay ${lugares.length} (${lugares.join(' / ') || 'ninguno'}): el robot solo sabe elegir cuando es uno solo.`);
    await page.click('#frmcli input[type=image]');
}

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
    // La app arranca en /oves/lab/ y, apenas muestra el login, salta a /oves/ y redibuja el
    // formulario EN BLANCO (visto el 21/10/2026: el robot mandaba usuario vacío y el MD5 de
    // una clave vacía, y el portal decía "Usuario o Contraseña erronea"). Se deja asentar la
    // página y se comprueba que lo escrito siga ahí antes de apretar Ingresar.
    await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => null);
    let escrito = false;
    for (let intento = 0; intento < 6 && !escrito; intento++) {
        await page.fill('#formlogin #usr', usuario);
        await page.fill('#formlogin #pwd', clave);
        await page.waitForTimeout(1500);
        const q = await page.evaluate(() => ({ usr: (document.getElementById('usr') as HTMLInputElement | null)?.value ?? '', pwdLargo: (document.getElementById('pwd') as HTMLInputElement | null)?.value.length ?? 0 })).catch(() => ({ usr: '', pwdLargo: 0 }));
        escrito = q.usr.toUpperCase() === usuario.toUpperCase() && q.pwdLargo === clave.length;
    }
    if (!escrito) throw new Error(`El formulario de login de ${NOMBRE_OPTOVISION} se vacía solo y no se pudo dejar escrito (${page.url()}).`);
    const boton = page.locator('#formlogin input[type=image]').first();
    if (await boton.count()) await boton.click(); else await page.press('#formlogin #pwd', 'Enter');

    const limite = Date.now() + ESPERA_OVES_MS;
    let formaElegida = false;
    while (Date.now() < limite) {
        await page.waitForTimeout(CADA_MS);
        const e = await page.evaluate(ESTADO_LOGIN).catch(() => null) as { logueado: boolean; rechazo: string; formulario: boolean; formaDeCompra: boolean } | null;
        if (!e) continue; // en medio de una navegación (la app salta a /oves/lab/ al confirmar la forma de compra)
        if (e.logueado) return;
        if (e.formaDeCompra && !formaElegida) { formaElegida = true; await elegirFormaDeCompra(page); continue; }
        if (e.rechazo && /incorrect|inv[aá]lid|no existe|error|rechaz|bloquead/i.test(e.rechazo)) {
            // El cartel del portal va en el mensaje (nunca lleva la clave): es lo que distingue "clave mal" de otro aviso.
            const err = new CredencialRechazadaError(NOMBRE_OPTOVISION, VARIABLES);
            err.message += ` El portal dijo: "${e.rechazo.slice(0, 200)}".`;
            throw err;
        }
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
