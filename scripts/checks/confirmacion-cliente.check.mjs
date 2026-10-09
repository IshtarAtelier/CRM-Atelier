// ────────────────────────────────────────────────────────────────────────────
// LA RESPUESTA DEL CLIENTE A LA CONFIRMACIÓN DE SU PEDIDO (Ishtar, 8/10/2026).
//
// Fija: (1) qué cuenta como "OK" y qué como "observación", igual en la app y en
// el bot; (2) que el mensaje pide el OK con suavidad y avisa las 24 h;
// (3) que las 24 h sin respuesta se dan por confirmadas; (4) que Ventas lo
// muestra y pregunta antes de procesar.
//
// Puro: sin base y sin red. Corre en CI.
// ────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { leerRespuestaDeConfirmacion, estadoConfirmacionCliente, HORAS_PARA_CONFIRMACION_TACITA } from '../../src/lib/confirmacion-cliente.ts';
const require = createRequire(import.meta.url);
const bot = require('../../wa-service/shared/confirmacion-cliente.js');

let ok = 0; const fallas = [];
const check = (n, c, extra = '') => { if (c) { ok++; console.log(`  ✓ ${n}`); } else { fallas.push(n); console.log(`  ✗ ${n} ${extra}`); } };
const leer = (f) => readFileSync(new URL(f, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

console.log('\nQué cuenta como OK (la app y el bot dicen lo mismo)');
const casos = [
    ['OK', 'OK'], ['ok', 'OK'], ['Ok!', 'OK'], ['Sí', 'OK'], ['si', 'OK'], ['Dale', 'OK'], ['Perfecto', 'OK'], ['Listo', 'OK'], ['Confirmo', 'OK'],
    ['Si, está todo bien', 'OK'], ['Ok gracias', 'OK'], ['Todo bien', 'OK'], ['Está perfecto', 'OK'], ['Muchas gracias', 'OK'], ['👍', 'OK'], ['👍🏼👍🏼', 'OK'], ['[Reacción] 👍', 'OK'],
    ['Si pero el armazón era el negro', 'OBSERVACION'], ['No, el teñido va gris', 'OBSERVACION'], ['¿Cuándo estaría?', 'OBSERVACION'],
    ['Ok pero me pasaron otro precio', 'OBSERVACION'], ['Hola', 'OBSERVACION'], ['Esperá que lo miro', 'OBSERVACION'], ['no', 'OBSERVACION'],
];
for (const [t, esperado] of casos) {
    const app = leerRespuestaDeConfirmacion({ content: t, type: 'TEXT' });
    const b = bot.leerRespuestaDeConfirmacion({ content: t, type: 'TEXT' });
    check(`"${t}" → ${esperado}`, app === esperado && b === esperado, `(app ${app}, bot ${b})`);
}
check('un audio es observación (alguien lo escucha)', leerRespuestaDeConfirmacion({ content: '', type: 'AUDIO' }) === 'OBSERVACION' && bot.leerRespuestaDeConfirmacion({ content: '', type: 'AUDIO' }) === 'OBSERVACION');

console.log('\nLo que ve Milena');
const D = 86400e3, H = 3600e3, now = Date.now();
check('respondió OK → verde', estadoConfirmacionCliente({ clientConfirmation: 'OK', clientConfirmedAt: new Date(now - 2 * H), labSentAt: new Date(now - 3 * H) }).tono === 'verde');
check('sin respuesta, hace 3 h → ámbar "esperando"', estadoConfirmacionCliente({ labSentAt: new Date(now - 3 * H) }).estado === 'ESPERANDO');
check('tácita → gris y lo dice', /24 h sin respuesta/.test(estadoConfirmacionCliente({ clientConfirmation: 'TACITA', labSentAt: new Date(now - 2 * D) }).texto));
check('observación → rojo con el texto', /«el armazón/.test(estadoConfirmacionCliente({ clientConfirmation: 'OBSERVACION', clientConfirmationText: 'el armazón era el negro', clientConfirmedAt: new Date(now - H), labSentAt: new Date(now - 2 * H) }).texto));
check(`las 24 h son ${HORAS_PARA_CONFIRMACION_TACITA}`, HORAS_PARA_CONFIRMACION_TACITA === 24);

console.log('\nEl mensaje y el circuito');
const sc = leer('../../src/lib/sale-confirmation.ts');
check('el WhatsApp pide el OK antes de fabricar, con suavidad', sc.includes('Antes de que tu pedido pase a fabricación') && sc.includes('respondenos *OK* y lo mandamos a fabricar'));
check('el WhatsApp avisa las 24 h y la responsabilidad', sc.includes('Si en 24 horas no recibimos tu respuesta, lo tomamos como confirmado') && sc.includes('bajo tu responsabilidad'));
check('ya no dice "ya salió a fabricación"', !sc.includes('ya salió a fabricación'));
check('el mail dice lo mismo', sc.includes('Antes de que tu pedido pase a fabricación, abajo está el detalle') && (sc.match(/Si en 24 horas no recibimos tu respuesta/g) || []).length >= 2);
check('la plantilla corta nueva solo si Meta la aprobó', sc.includes("fila?.status === 'APPROVED' ? 'venta_confirmada_v2' : 'venta_confirmada'"));
const tpl = leer('../../src/lib/whatsapp/templates.ts');
check('venta_confirmada_v2 existe en el catálogo y pide el OK', tpl.includes("name: 'venta_confirmada_v2'") && /venta_confirmada_v2[\s\S]{0,900}respondé OK/.test(tpl));
const cron = leer('../../src/app/api/cron/confirmacion-completa/route.ts');
check('el cron marca las tácitas a las 24 h', cron.includes('confirmacionesTacitas()'));
const inbound = leer('../../wa-service/transport/inbound.js');
check('el bot registra la respuesta al llegar', inbound.includes('registrarRespuestaAConfirmacion(prisma'));
const ventas = leer('../../src/app/admin/ventas/page.tsx');
check('Ventas muestra la señal y pregunta antes de procesar', ventas.includes('estadoConfirmacionCliente(order)') && ventas.includes("if (next === 'IN_PROGRESS')") && ventas.includes('window.confirm(pregunta)'));
const api = leer('../../src/app/api/orders/route.ts');
check('el listado trae los campos', (api.match(/clientConfirmation: true/g) || []).length >= 2);

console.log(`\n${ok} ok, ${fallas.length} fallas`);
if (fallas.length) { console.log('FALLAS:', fallas.join(' · ')); process.exit(1); }
