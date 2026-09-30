import type { Browser, Page } from 'playwright';

/**
 * Un solo lugar para abrir Chromium contra el portal de un laboratorio.
 *
 * Hasta acá el mismo bloque estaba copiado en siete archivos, y el 24/8/2026
 * el único que no seteaba PLAYWRIGHT_BROWSERS_PATH (smartlab.service.ts) dejó
 * catorce días sin sincronizar: el build instala Chromium en
 * `.playwright-browsers` y Playwright lo busca en ~/.cache, vacía en Railway.
 *
 * Garantías: el browser se cierra SIEMPRE (un stall del portal no deja
 * Chromiums colgados que se acumulan tick a tick), y todo lo que espera,
 * espera con tope.
 */

export interface OpcionesNavegador {
    /** Tope por paso (selector, evaluate). Portales lentos: minutos. */
    timeoutMs?: number;
    /** Tope de cada navegación. */
    timeoutNavegacionMs?: number;
    /** Algunos servidores caseros negocian mal HTTP/2 desde el contenedor. */
    sinHttp2?: boolean;
}

const ARGS_BASE = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'];

export async function conNavegador<T>(
    tarea: (page: Page, browser: Browser) => Promise<T>,
    opts: OpcionesNavegador = {},
): Promise<T> {
    const nodePath = await import('path');
    process.env.PLAYWRIGHT_BROWSERS_PATH = nodePath.join(process.cwd(), '.playwright-browsers');
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({
        headless: true,
        args: opts.sinHttp2 ? [...ARGS_BASE, '--disable-http2'] : ARGS_BASE,
    });
    try {
        const page = await browser.newContext().then(c => c.newPage());
        page.setDefaultTimeout(opts.timeoutMs ?? 120_000);
        page.setDefaultNavigationTimeout(opts.timeoutNavegacionMs ?? 60_000);
        return await tarea(page, browser);
    } finally {
        await browser.close().catch(err => console.error('[lab-modulos] No se pudo cerrar el navegador:', err));
    }
}

/**
 * Espera por el RESULTADO de un login, no por un evento: la URL deja de ser
 * la del login, o aparece el cartel de credencial rechazada. Lección del
 * corte de SmartLab del 24/8 al 8/9/2026: esperar un tiempo fijo confundía
 * "clave incorrecta" con "portal lento" y el aviso pedía revisar la red.
 */
export class CredencialRechazadaError extends Error {
    constructor(lab: string, variables: string) {
        super(`CREDENCIAL RECHAZADA por el portal de ${lab}: revisar ${variables} en las variables de entorno y, si están cargadas, pedirle la clave nueva al laboratorio.`);
        this.name = 'CredencialRechazadaError';
    }
}

export async function esperarLogin(page: Page, opts: {
    lab: string;
    variables: string;
    /** Sigue en la pantalla de login mientras la URL cumpla este patrón. */
    urlDeLogin: RegExp;
    /** Texto en pantalla que delata una credencial rechazada. */
    textoDeRechazo: RegExp;
    maxMs?: number;
    cadaMs?: number;
}): Promise<void> {
    const limite = Date.now() + (opts.maxMs ?? 120_000);
    while (Date.now() < limite) {
        if (!opts.urlDeLogin.test(page.url())) return;
        const enPantalla = (await page.innerText('body').catch(() => '')) || '';
        if (opts.textoDeRechazo.test(enPantalla)) throw new CredencialRechazadaError(opts.lab, opts.variables);
        await page.waitForTimeout(opts.cadaMs ?? 3000);
    }
    throw new Error(`El portal de ${opts.lab} no salió de la pantalla de login en ${Math.round((opts.maxMs ?? 120_000) / 1000)} s (${page.url()}).`);
}
