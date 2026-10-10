/**
 * Quién es una PERSONA del equipo y quién un remitente automático: UNA sola
 * definición. Sin base ni red (también en CI).
 *
 *   npm run check:remitentes
 *
 * Por qué (auditoría del 10/10/2026): había cuatro listas a mano y ninguna
 * coincidía. "Sistema Atelier" (1.121 mensajes en 60 días) y las campañas
 * ("Campaña Novedades Sep26") eran PERSONAS para el bot: una confirmación de
 * venta lo apagaba como si hubiera contestado una vendedora, y en el historial
 * el modelo leía "[Lo escribió Campaña Novedades Sep26, del equipo]".
 *
 * Qué fija:
 *  - el espejo de src (`src/lib/whatsapp/remitentes.ts`) dice lo mismo que el
 *    del wa-service (`wa-service/shared/remitentes.js`);
 *  - los remitentes reales de producción caen donde corresponde;
 *  - nadie vuelve a escribir la lista a mano en una consulta.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const cjs = require('../../wa-service/shared/remitentes.js');
const ts = await import('../../src/lib/whatsapp/remitentes.ts');

let fallas = 0;
const ok = (m) => console.log(`  ✅ ${m}`);
const mal = (m) => { fallas++; console.log(`  ❌ ${m}`); };
const check = (m, cond) => (cond ? ok(m) : mal(m));
const mismos = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

console.log('\nLas dos copias dicen lo mismo');
check('REMITENTES_BOT', mismos([...cjs.REMITENTES_BOT], [...ts.REMITENTES_BOT]));
check('REMITENTES_SISTEMA', mismos([...cjs.REMITENTES_SISTEMA], [...ts.REMITENTES_SISTEMA]));
check('PREFIJO_CAMPANIA', cjs.PREFIJO_CAMPANIA === ts.PREFIJO_CAMPANIA);
check('NOMBRES_NO_HUMANOS', mismos([...cjs.NOMBRES_NO_HUMANOS], [...ts.NOMBRES_NO_HUMANOS]));
check('TIPO_REMITENTE', JSON.stringify(cjs.TIPO_REMITENTE) === JSON.stringify(ts.TIPO_REMITENTE));
check('whereSalienteHumano()', JSON.stringify(cjs.whereSalienteHumano()) === JSON.stringify(ts.whereSalienteHumano()));

console.log('\nLos remitentes que existen en producción (60 días al 10/10/2026)');
const REALES = [
    ['Teléfono', 'HUMAN'], ['Celular', 'HUMAN'], ['Matias Turchi', 'HUMAN'], ['Milena Magallanes', 'HUMAN'],
    ['Ishtar', 'HUMAN'], ['Humano (Sincronizado)', 'HUMAN'], ['CRM', 'HUMAN'],
    ['Bot', 'BOT'], ['Auto-respondedor', 'BOT'], ['Meta (Auto-Reply)', 'BOT'],
    ['Sistema', 'SYSTEM'], ['Sistema Atelier', 'SYSTEM'], ['CRM Automático', 'SYSTEM'],
    ['Campaña MP 12 Cuotas', 'CAMPAIGN'], ['Campaña Novedades Sep26', 'CAMPAIGN'],
    ['Campaña Seguimiento Armazones', 'CAMPAIGN'], ['Campaña Tienda SoyCliente', 'CAMPAIGN'],
];
for (const [n, tipo] of REALES) {
    const a = cjs.tipoDeRemitente(n);
    const b = ts.tipoDeRemitente(n);
    check(`"${n}" → ${tipo}${a !== tipo || b !== tipo ? ` (wa-service: ${a}, src: ${b})` : ''}`, a === tipo && b === tipo);
}
check('sin firma no se asume una persona', cjs.tipoDeRemitente(null) === null && !cjs.esRemitenteHumano(''));
check('una campaña NUEVA cae sola por el prefijo', cjs.tipoDeRemitente('Campaña Navidad 2026') === 'CAMPAIGN');

console.log('\nNadie escribe la lista a mano');
const raiz = fileURLToPath(new URL('../../', import.meta.url));
const PERMITIDOS = new Set(['wa-service/shared/remitentes.js', 'src/lib/whatsapp/remitentes.ts']);
// Una lista literal ('Bot', 'Sistema'…) o el `notIn` a secas del wa-service,
// que deja pasar las campañas (usar whereSalienteHumano()).
const LISTA_A_MANO = /\[\s*'Bot'\s*,\s*'Sistema|notIn:\s*\[\s*'Bot'|senderName:\s*\{\s*notIn:\s*(?:\[\.\.\.)?(?:NOMBRES_NO_HUMANOS|REMITENTES_NO_HUMANOS)/;
const encontrados = [];
function recorrer(dir) {
    for (const nombre of readdirSync(dir)) {
        if (nombre === 'node_modules' || nombre.startsWith('.')) continue;
        const ruta = join(dir, nombre);
        const st = statSync(ruta);
        if (st.isDirectory()) recorrer(ruta);
        else if (/\.(js|ts|tsx|mjs)$/.test(nombre)) {
            const rel = relative(raiz, ruta);
            if (PERMITIDOS.has(rel)) continue;
            const src = readFileSync(ruta, 'utf8');
            if (LISTA_A_MANO.test(src)) encontrados.push(rel);
        }
    }
}
recorrer(join(raiz, 'src'));
recorrer(join(raiz, 'wa-service'));
check(`ninguna lista de remitentes escrita a mano en src/ ni wa-service/${encontrados.length ? ` — ${encontrados.join(', ')}` : ''}`, encontrados.length === 0);

console.log('');
if (fallas) { console.log(`❌ ${fallas} falla(s).`); process.exit(1); }
console.log('✅ Remitentes: una sola definición.');
