// ────────────────────────────────────────────────────────────────────────────
// PRUEBA EN VIVO, SOLO LECTURA: ¿el robot entra a OVES y a la web de la promo
// con las credenciales del .env? No toca nada: entra, lee y sale.
//
//   node --env-file=.env scripts/checks/optovision-login-vivo.mjs [oves|promo]
//
// Necesita red hacia los dos sitios y Chromium de Playwright instalado.
// Nunca imprime las claves.
// ────────────────────────────────────────────────────────────────────────────
import { conSesionOves } from '../../src/services/lab-modules/optovision/portal.ts';
import { conSesionPromo, leerHistorial } from '../../src/services/lab-modules/optovision/cupon-robot.ts';

const que = process.argv[2] || 'ambos';
const t0 = Date.now();
const seg = () => `${Math.round((Date.now() - t0) / 1000)} s`;

if (que === 'oves' || que === 'ambos') {
    const r = await conSesionOves(async (page) => {
        const user = (await page.locator('#user').innerText().catch(() => '')).trim();
        return { url: page.url(), user };
    });
    console.log(`OVES: adentro como "${r.user}" (${r.url}) en ${seg()}`);
}
if (que === 'promo' || que === 'ambos') {
    const r = await conSesionPromo('VARILUX', async (page) => {
        const filas = await leerHistorial(page, 'VARILUX');
        return { url: page.url(), filas: filas.length, ultima: filas[0] ? `${filas[0].fecha} ${filas[0].promocion} ${filas[0].codigo} ${filas[0].cliente}` : '—' };
    });
    console.log(`Web de la promo Varilux: adentro, historial con ${r.filas} filas (última: ${r.ultima}) en ${seg()}`);
}
