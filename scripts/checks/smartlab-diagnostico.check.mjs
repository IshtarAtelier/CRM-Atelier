/**
 * ¿Por qué no sincroniza SmartLab (Grupo Óptico)?
 *
 * SOLO LEE del portal. No escribe en ninguna base: reproduce el login y la
 * primera pantalla del scraper (`src/services/smartlab.service.ts`) y dice
 * dónde se rompe.
 *
 * Nació el 7/9/26: `smartlab_down_since` marcaba el 24/8 —catorce días sin
 * sincronizar— y el portal respondía HTTP 200, así que la falla era nuestra.
 * Sin los estados de SmartLab ningún pedido de Grupo Óptico llega a 100%, y sin
 * eso no se crea la notificación LAB_READY que dispara el aviso automático de
 * "pedido listo": los clientes se quedan esperando sin que nadie se entere.
 */
const URL_LOGIN = 'https://grupooptico.dyndns.info/smartlab/auth/authSmartlab/login';

const paso = (t) => console.log(`\n▸ ${t}`);
let browser;
try {
    paso('Abriendo Chromium');
    const { chromium } = await import('playwright');
    browser = await chromium.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
    console.log('  ✅ Chromium arrancó');

    const page = await (await browser.newContext()).newPage();

    paso('Cargando la pantalla de login');
    const res = await page.goto(URL_LOGIN, { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log(`  HTTP ${res?.status()} · ${page.url()}`);

    paso('Buscando los campos de usuario y contraseña');
    await page.waitForSelector('input', { timeout: 10000 });
    const inputs = await page.$$('input');
    console.log(`  campos encontrados: ${inputs.length} ${inputs.length < 2 ? '❌ el scraper espera al menos 2' : '✅'}`);
    for (const [i, el] of inputs.entries()) {
        const tipo = await el.getAttribute('type');
        const nombre = await el.getAttribute('name');
        console.log(`    input ${i}: type=${tipo} name=${nombre}`);
    }

    paso('Entrando (login real) y cronometrando');
    const t0 = Date.now();
    await page.waitForTimeout(1500);
    await inputs[0].fill('pisano.ishtar@gmail.com');
    await inputs[1].fill('atelier');
    const botonesLogin = await page.$$('button, input[type=submit], a');
    let clickeado = false;
    for (const b of botonesLogin) {
        const t = ((await b.innerText().catch(() => '')) || (await b.getAttribute('value')) || '').trim();
        if (/iniciar|ingresar|login/i.test(t)) { await b.click().catch(() => {}); clickeado = true; break; }
    }
    console.log(`  ${clickeado ? '✅ botón clickeado' : '❌ no se encontró el botón'}`);
    try {
        await page.waitForLoadState('networkidle', { timeout: 60000 });
        console.log(`  ✅ cargó tras el login en ${((Date.now() - t0) / 1000).toFixed(1)}s → ${page.url()}`);
        const entro = !/login/i.test(page.url());
        console.log(`  ${entro ? '✅ ENTRÓ al sistema' : '❌ sigue en la pantalla de login (credenciales o portal)'}`);
    } catch (e) {
        console.log(`  ⏱️ NO terminó de cargar en 60s — su sistema está lento o colgado (${e.message.slice(0, 60)})`);
    }

    paso('Buscando el botón de ingresar');
    const botones = await page.$$('button, input[type=submit], a');
    const textos = [];
    for (const b of botones.slice(0, 25)) {
        const t = ((await b.innerText().catch(() => '')) || (await b.getAttribute('value')) || '').trim();
        if (t) textos.push(t);
    }
    const hayBoton = textos.some(t => /iniciar|ingresar|login/i.test(t));
    console.log(`  ${hayBoton ? '✅ hay botón de ingreso' : '❌ NO se encontró botón con "iniciar/ingresar/login"'}`);
    console.log(`  textos vistos: ${textos.slice(0, 12).join(' · ') || '(ninguno)'}`);
} catch (e) {
    console.log(`\n❌ SE ROMPIÓ ACÁ: ${e.message}`);
} finally {
    await browser?.close().catch(() => {});
}
