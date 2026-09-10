/**
 * Guardián del tipo de lente. SOLO LEE archivos — sin base y sin red.
 *
 *   node --experimental-strip-types --import ./scripts/checks/_alias.mjs scripts/checks/tipo-de-lente.check.mjs
 *
 * Qué cuida, y por qué (bug del 8/9/2026: el bot le mandó un presupuesto de
 * multifocales a un cliente con receta monofocal):
 *
 *   1. LA REGLA. Hay adición → multifocal. No hay → monofocal. Sin excepciones.
 *   2. QUE NADIE VUELVA A ETIQUETAR "Multifocal" SOLO POR EL ORIGEN. Durante
 *      meses, todo lead entrado por un anuncio de Meta salía etiquetado
 *      'Multifocal' porque esa era la campaña. El bot lee las etiquetas de la
 *      ficha en su contexto, así que arrancaba la charla convencido.
 *   3. QUE NADIE VUELVA A DEFAULTEAR A MULTIFOCAL. `|| 'ADDITION'` significa
 *      "ante la duda, el lente más caro": es el más caro de los dos errores.
 *   4. QUE EL ESPEJO DEL BOT NO SE DESINCRONICE del helper del CRM (el
 *      wa-service es CommonJS y no puede importar el .ts).
 *
 * OJO: el prompt del bot NO vive en el repo, vive en `SystemSetting.bot_prompt`.
 * Este check no puede vigilarlo. Si vuelve a aparecer un "igual se le cotiza"
 * sin receta, se corrige desde /admin/whatsapp.
 */
import { readFileSync } from 'node:fs';
import { tipoDeRecetaSegunNumeros, tipoDeRecetaConDefault } from '../../src/lib/receta/tipo-de-lente.ts';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const espejo = require('../../wa-service/shared/tipo-de-lente.js');

const fallas = [];
const ok = (m) => console.log(`  ✅ ${m}`);
const mal = (m) => { fallas.push(m); console.log(`  ❌ ${m}`); };

// ── 1. La regla ──────────────────────────────────────────────────────────────
console.log('\n1. La regla: la adición manda, no la etiqueta');
const casos = [
    ['sin adición, la IA dijo Multifocal', tipoDeRecetaSegunNumeros({ add: 0 }, 'Multifocal'), 'FAR'],
    ['con adición, la IA dijo Monofocal', tipoDeRecetaSegunNumeros({ add: 2 }, 'Monofocal'), 'ADDITION'],
    ['adición por ojo', tipoDeRecetaSegunNumeros({ additionOD: 1.75 }), 'ADDITION'],
    ['adición negativa (mal leída de una foto)', tipoDeRecetaSegunNumeros({ add: -2 }), 'ADDITION'],
    ['receta vacía', tipoDeRecetaSegunNumeros({}), 'FAR'],
    // Caso real (9/9/2026, receta de Sambran Maximiliano): miopía -7,50/-8,00,
    // columna A.V. con "20/25" y NINGUNA adición. El bot la leyó como
    // multifocal y cotizó $735.000. Un parseFloat("20/25") da 20.
    ['A.V. 20/25 leída como adición', tipoDeRecetaSegunNumeros({ add: 20 }, 'Multifocal'), 'FAR'],
    ['A.V. en decimales (1.0)', tipoDeRecetaSegunNumeros({ add: 1.0 }) === 'ADDITION' ? 'ADDITION' : 'FAR', 'ADDITION'],
    ['adición fuera de rango (15)', tipoDeRecetaSegunNumeros({ add: 15 }), 'FAR'],
    // Las DOS formas válidas de escribir una receta multifocal (regla de
    // Ishtar, 9/9/2026): "Lejos" + columna Add, o "Lejos" y "Cerca" con su
    // graduación cada una. La segunda no tiene columna Add: la adición es la
    // diferencia, y sin esto esa receta se leía como monofocal.
    ['add baja +0.75 (presbicia inicial)', tipoDeRecetaSegunNumeros({ add: 0.75 }), 'ADDITION'],
    ['Lejos -2.00 y Cerca +0.50, sin columna Add', tipoDeRecetaSegunNumeros({ sphereOD: -2, nearSphereOD: 0.5 }), 'ADDITION'],
    ['Lejos -6 y Cerca -4.75, sin columna Add', tipoDeRecetaSegunNumeros({ sphereOD: -6, nearSphereOD: -4.75 }), 'ADDITION'],
    ['Cerca igual a Lejos: no hay adición', tipoDeRecetaSegunNumeros({ sphereOD: -2, nearSphereOD: -2 }), 'FAR'],
    ['diferencia absurda entre lejos y cerca', tipoDeRecetaSegunNumeros({ sphereOD: -2, nearSphereOD: 8 }), 'FAR'],
    ['receta de cerca se respeta', tipoDeRecetaSegunNumeros({}, 'NEAR'), 'NEAR'],
    ['sin dato explícito NO asume multifocal', tipoDeRecetaConDefault({}, undefined), 'FAR'],
    ['elección explícita de un óptico se respeta', tipoDeRecetaConDefault({}, 'ADDITION'), 'ADDITION'],
];
for (const [nombre, real, esperado] of casos) {
    real === esperado ? ok(`${nombre} → ${real}`) : mal(`${nombre} → ${real}, esperado ${esperado}`);
}

// ── 2. Nadie etiqueta por el origen ──────────────────────────────────────────
console.log('\n2. Nadie vuelve a etiquetar "Multifocal" por el canal de entrada');
for (const archivo of ['wa-service/tools.js', 'wa-service/index.js']) {
    const src = readFileSync(new URL(`../../${archivo}`, import.meta.url), 'utf8');
    // Solo llamadas reales, no los comentarios que explican por qué se sacó.
    const llamadas = src.split('\n').filter(l =>
        /addTagToClient\(\s*\{[^}]*tagName:\s*['"](Multifocal|Monofocal|Bifocal)['"]/.test(l));
    llamadas.length === 0
        ? ok(`${archivo}: sin auto-etiquetado de tipo de lente`)
        : mal(`${archivo}: vuelve a etiquetar el tipo de lente automáticamente → ${llamadas[0].trim().slice(0, 90)}`);
}

// ── 3. Nadie defaultea a multifocal ──────────────────────────────────────────
console.log('\n3. Nadie vuelve a asumir multifocal ante la duda');
for (const archivo of ['src/services/contact.service.ts', 'src/components/contacts/PrescriptionManager.tsx', 'src/app/api/bot/prescriptions/route.ts']) {
    const src = readFileSync(new URL(`../../${archivo}`, import.meta.url), 'utf8');
    const malas = src.split('\n').filter(l =>
        /prescriptionType[^\n]*(\|\|\s*['"]ADDITION['"])/.test(l) && !l.trim().startsWith('//') && !l.trim().startsWith('*'));
    malas.length === 0
        ? ok(`${archivo}: sin default a 'ADDITION'`)
        : mal(`${archivo}: volvió el default a multifocal → ${malas[0].trim().slice(0, 90)}`);
}

// ── 4. El espejo del bot no se desincroniza ──────────────────────────────────
console.log('\n4. El espejo del wa-service dice lo mismo que el helper del CRM');
const paridad = [
    [{ add: 0 }, 'Multifocal', 'Monofocal'],
    [{ add: 2 }, 'Monofocal', 'Multifocal'],
    [{ add: null }, null, 'Monofocal'],
];
for (const [datos, declarado, esperadoEspejo] of paridad) {
    const delEspejo = espejo.interesSegunReceta(declarado, datos.add);
    const delCrm = tipoDeRecetaSegunNumeros(datos, declarado) === 'ADDITION' ? 'Multifocal' : 'Monofocal';
    delEspejo === esperadoEspejo && delEspejo === delCrm
        ? ok(`add=${datos.add} declarado=${declarado} → ${delEspejo} en los dos`)
        : mal(`add=${datos.add} declarado=${declarado}: espejo dice ${delEspejo}, CRM dice ${delCrm}`);
}

console.log('');
if (fallas.length) {
    console.error(`❌ ${fallas.length} problema(s). El tipo de lente lo decide la ADICIÓN, nunca una etiqueta ni un default.`);
    process.exit(1);
}
console.log('✅ El tipo de lente sale de la receta en todos los caminos.');
