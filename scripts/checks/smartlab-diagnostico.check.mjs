/**
 * ¿Por qué no sincroniza SmartLab (Grupo Óptico)?
 *
 * SOLO LEE del portal. No escribe en ninguna base: reproduce el login y la
 * primera pantalla del robot (`src/services/lab-modules/grupo-optico/portal.ts`)
 * y dice dónde se rompe.
 *
 * Nació el 7/9/26: el cron marcaba el 24/8 como inicio del corte —catorce días
 * sin sincronizar— y el portal respondía HTTP 200, así que la falla era nuestra.
 * Sin los estados de SmartLab ningún pedido de Grupo Óptico llega a 100%, y sin
 * eso no se crea la notificación LAB_READY que dispara el aviso automático de
 * "pedido listo": los clientes se quedan esperando sin que nadie se entere.
 *
 * La credencial sale SOLO de SMARTLAB_USER / SMARTLAB_PASSWORD (del entorno o
 * del .env): si faltan, se corta ANTES de abrir el navegador, igual que el
 * robot. Nunca se imprime.
 */
import { config } from 'dotenv';

config();

const URL_LOGIN = 'https://grupooptico.dyndns.info/smartlab/auth/authSmartlab/login';

const paso = (t) => console.log(`\n▸ ${t}`);

paso('Leyendo SMARTLAB_USER / SMARTLAB_PASSWORD del entorno');
const usuario = (process.env.SMARTLAB_USER || '').trim();
const clave = (process.env.SMARTLAB_PASSWORD || '').trim();
if (!usuario || !clave) {
    console.log('  ❌ Faltan SMARTLAB_USER/SMARTLAB_PASSWORD: el robot tampoco entraría. Cargarlas en .env (local) o en Railway.');
    process.exit(1);
}
console.log('  ✅ las dos variables están cargadas (no se muestran)');

let browser;
try {
    paso('Abriendo Chromium');
    const { chromium } = await import('playwright');
    browser = await chromium.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-http2'],
    });
    console.log('  ✅ Chromium arrancó');

    const page = await (await browser.newContext()).newPage();

    paso('Cargando la pantalla de login');
    const res = await page.goto(URL_LOGIN, { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log(`  HTTP ${res?.status()} · ${page.url()}`);

    paso('Buscando los campos de usuario y contraseña');
    await page.waitForSelector('input', { timeout: 10000 });
    const inputs = await page.$$('input');
    console.log(`  campos encontrados: ${inputs.length} ${inputs.length < 2 ? '❌ el robot espera al menos 2' : '✅'}`);
    for (const [i, el] of inputs.entries()) {
        const tipo = await el.getAttribute('type');
        const nombre = await el.getAttribute('name');
        console.log(`    input ${i}: type=${tipo} name=${nombre}`);
    }

    paso('Entrando (login real) — esperando hasta 8 minutos');
    const t0 = Date.now();
    await page.waitForTimeout(1500);
    await inputs[0].fill(usuario);
    await page.waitForTimeout(1500);
    await inputs[1].fill(clave);
    await page.waitForTimeout(1500);
    for (const b of await page.$$('button, input[type=submit], a')) {
        const t = ((await b.innerText().catch(() => '')) || (await b.getAttribute('value')) || '').trim();
        if (/iniciar|ingresar|login/i.test(t)) { await b.click().catch(() => {}); break; }
    }
    console.log('  clic hecho, esperando a que salga del login...');
    let entro = false;
    for (let i = 0; i < 96; i++) {              // 96 x 5s = 8 minutos
        await page.waitForTimeout(5000);
        const url = page.url();
        if (!/\/login|\/auth\//i.test(url)) { entro = true; console.log(`  ✅ ENTRÓ a los ${((Date.now() - t0) / 1000).toFixed(0)}s → ${url}`); break; }
        const enPantalla = (await page.innerText('body').catch(() => '')) || '';
        if (/incorrect|no se pudo iniciar sesi|credenciales inv/i.test(enPantalla)) {
            console.log('  ❌ CREDENCIAL RECHAZADA: el portal dice "usuario o contraseña incorrectos". No es lentitud: pedirle la clave nueva a Grupo Óptico y actualizar las variables.');
            break;
        }
        if (i % 6 === 5) console.log(`     ...${((Date.now() - t0) / 1000).toFixed(0)}s y sigue en el login`);
    }
    if (!entro) console.log(`  ❌ no salió de la pantalla de login`);

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
