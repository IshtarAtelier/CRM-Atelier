// ────────────────────────────────────────────────────────────────────────────
// 2º PEDIDO DE RESEÑA (Ishtar, 16/10/2026): el robot vuelve a poner UNA vez la
// tarea de reseña delante del vendedor. Garantías que fija este check:
//
//   1. NUNCA le escribe al cliente: ni el service ni la ruta del cron importan
//      nada que mande WhatsApp, y wa-service no puede levantar la tarea sola
//      ('[RESENA]' fuera de los prefijos, 'Sistema' fuera de los creadores).
//   2. Uno solo: nunca un 3º, nunca dos para el mismo 1º (índice único en la
//      migración), solo entre 7 y 30 días después de cerrado el 1º.
//   3. Exclusiones: ya comentó, post-venta abierta, saldo, última venta no
//      entregada, otra venta en curso, reclamo reciente, 1º cerrado por un
//      proceso y no por una persona.
//   4. El mensaje del 2º es otro (recordatorio suave) y usa el mismo link.
//   5. El cruce con Google exige nombre completo y un único cliente.
//
// Corre sin base y sin red. Correr: npm run check:resena-segundo-pedido
// ────────────────────────────────────────────────────────────────────────────

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    decidirSegundoPedido, mensajePedidoResena, esSegundoPedido, descripcionSegundoPedido,
    esTextoDeReclamo, cruzarResenasConClientes, LINK_RESENA_GOOGLE, CREADOR_SEGUNDO_PEDIDO,
    DIAS_PARA_SEGUNDO_PEDIDO, DIAS_MAXIMOS_SEGUNDO_PEDIDO, esTareaDeResena,
} from '../../src/lib/resenas/pedido-resena.ts';

let fallas = 0;
const ok = (desc, fn) => {
    try { fn(); console.log(`  ✅ ${desc}`); }
    catch (e) { fallas++; console.log(`  ❌ ${desc}\n     ${e.message}`); }
};
const leer = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

const AHORA = new Date('2026-10-16T13:00:00Z');
const haceDias = (d) => new Date(AHORA.getTime() - d * 24 * 3600 * 1000);
const base = (extra = {}) => ({
    tarea: { id: 't1', status: 'COMPLETED', completedAt: haceDias(10), completedBy: 'Milena Magallanes', description: 'Solicitar comentario a Ana Pérez', reminderOfTaskId: null },
    ahora: AHORA,
    yaComento: false, yaTieneSegundoPedido: false, tienePedidoDeResenaAbierto: false,
    tienePosventaAbierta: false, tieneSaldo: false, ultimaVentaEntregada: true,
    tieneVentaEnCurso: false, tieneReclamoReciente: false, tieneTelefono: true,
    ...extra,
});
const noCrea = (c) => { const d = decidirSegundoPedido(c); assert.equal(d.crear, false, 'debía NO crear'); return d.motivo; };

console.log('\n1. Nunca le escribe al cliente');
ok('el service y el cron no importan nada que mande WhatsApp', () => {
    for (const p of ['src/services/review-request.service.ts', 'src/app/api/cron/resena-segundo-pedido/route.ts', 'src/lib/resenas/pedido-resena.ts']) {
        // Solo código: los comentarios nombran wa-service para explicar la regla.
        const f = leer(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
        assert.ok(!/sendWhatsApp|whatsapp\/send|templateSpec|wa-service|sendMessage|sendEmail|resend|fetch\(/i.test(f), `${p} toca un canal de envío`);
    }
});
ok("wa-service no puede mandar la tarea solo ('[RESENA]' y 'Sistema' fuera de las listas blancas)", () => {
    const cfg = leer('wa-service/followups/config.js');
    const pref = cfg.match(/AUTO_SENDABLE_TASK_PREFIXES\s*=\s*\[([\s\S]*?)\]/)?.[1] ?? '';
    const creadores = cfg.match(/AUTO_SENDABLE_TASK_CREATORS\s*=\s*\[([\s\S]*?)\]/)?.[1] ?? '';
    assert.ok(pref && creadores, 'no se encontraron las listas blancas en config.js');
    const sinComentarios = (s) => s.replace(/\/\/.*$/gm, '');
    assert.ok(!/RESE[ÑN]A|COMENTARIO/i.test(sinComentarios(pref)), 'un prefijo de reseña quedó en AUTO_SENDABLE_TASK_PREFIXES');
    assert.ok(!new RegExp(`'${CREADOR_SEGUNDO_PEDIDO}'\\s*[,\\]]`).test(creadores + ']'), `'${CREADOR_SEGUNDO_PEDIDO}' quedó en AUTO_SENDABLE_TASK_CREATORS`);
});
ok('la descripción del 2º no arranca con un prefijo [XXX] de envío automático', () => {
    assert.ok(!descripcionSegundoPedido('Ana').startsWith('['));
});

console.log('\n2. Uno solo, y en su ventana');
ok('caso limpio: crea', () => assert.deepEqual(decidirSegundoPedido(base()), { crear: true }));
ok('un 2º pedido nunca genera un 3º', () => {
    noCrea(base({ tarea: { ...base().tarea, reminderOfTaskId: 'x' } }));
    noCrea(base({ tarea: { ...base().tarea, description: descripcionSegundoPedido('Ana') } }));
});
ok('ya tuvo su 2º pedido: no crea', () => noCrea(base({ yaTieneSegundoPedido: true })));
ok('pedido de reseña abierto: no crea', () => noCrea(base({ tienePedidoDeResenaAbierto: true })));
ok(`antes de ${DIAS_PARA_SEGUNDO_PEDIDO} días: no crea`, () => noCrea(base({ tarea: { ...base().tarea, completedAt: haceDias(DIAS_PARA_SEGUNDO_PEDIDO - 1) } })));
ok(`después de ${DIAS_MAXIMOS_SEGUNDO_PEDIDO} días: no crea`, () => noCrea(base({ tarea: { ...base().tarea, completedAt: haceDias(DIAS_MAXIMOS_SEGUNDO_PEDIDO + 1) } })));
ok('1º pendiente (no cerrado): no crea', () => noCrea(base({ tarea: { ...base().tarea, status: 'PENDING' } })));
ok('1º cerrado por Sistema/Bot o sin firma: no crea', () => {
    for (const by of ['Sistema', 'Sistema (cierre venta)', 'Bot', null]) noCrea(base({ tarea: { ...base().tarea, completedBy: by } }));
    noCrea(base({ tarea: { ...base().tarea, completedAt: null } }));
});
ok('la migración trae el índice ÚNICO sobre reminderOfTaskId', () => {
    const m = leer('prisma/migrations/20261016_resena_segundo_pedido/migration.sql');
    assert.match(m, /CREATE UNIQUE INDEX[^;]*"reminderOfTaskId"/);
    assert.match(leer('prisma/schema.prisma'), /reminderOfTaskId\s+String\?\s+@unique/);
});
ok('el service crea con reminderOfTaskId y createdBy del 1º, y solo mira tareas sin reminder', () => {
    const s = leer('src/services/review-request.service.ts');
    assert.match(s, /reminderOfTaskId: t\.id/);
    assert.match(s, /createdBy: CREADOR_SEGUNDO_PEDIDO/);
    assert.match(s, /reminderOfTaskId: null/);
    assert.match(s, /P2002/);
});

console.log('\n3. Exclusiones');
for (const [campo, valor] of [
    ['yaComento', true], ['tienePosventaAbierta', true], ['tieneSaldo', true],
    ['ultimaVentaEntregada', false], ['tieneVentaEnCurso', true], ['tieneReclamoReciente', true], ['tieneTelefono', false],
]) ok(`${campo}=${valor}: no crea`, () => noCrea(base({ [campo]: valor })));
ok('el saldo sale de PricingService, no de una resta', () => {
    const s = leer('src/services/review-request.service.ts');
    assert.match(s, /PricingService\.calculateOrderFinancials/);
    assert.ok(!/total\s*-\s*.*paid/.test(s));
});
ok('detecta reclamos en notas', () => {
    for (const t of ['[RECLAMO POST-VENTA] Registrado por Bot', 'Está enojada por la demora', 'dice que no ve bien de lejos', 'le da dolor de cabeza', 'se le rompió, armazón roto', 'queja por la atención']) assert.ok(esTextoDeReclamo(t), t);
    for (const t of ['Retiró sus anteojos, muy contenta', 'Pagó el saldo en efectivo', 'Consulta por lentes de sol']) assert.ok(!esTextoDeReclamo(t), t);
});

console.log('\n4. El mensaje lo arma el CRM y el 2º es otro');
ok('1º y 2º llevan el link de reseña; el 2º es distinto y no insiste con "favor enorme"', () => {
    const m1 = mensajePedidoResena({ nombre: 'Ana Pérez', productos: 'multifocales' });
    const m2 = mensajePedidoResena({ nombre: 'Ana Pérez', productos: 'multifocales', segundo: true });
    assert.ok(m1.includes(LINK_RESENA_GOOGLE) && m2.includes(LINK_RESENA_GOOGLE));
    assert.notEqual(m1, m2);
    assert.ok(m2.startsWith('Hola Ana!'));
    assert.ok(!/favor enorme/i.test(m2));
    assert.ok(/si ya la dejaste/i.test(m2));
});
ok('reconoce la tarea del 2º y la del 1º', () => {
    assert.ok(esSegundoPedido(descripcionSegundoPedido('Ana')));
    assert.ok(!esSegundoPedido('Solicitar comentario a Ana'));
    assert.ok(esTareaDeResena({ type: 'TASK', description: descripcionSegundoPedido('Ana') }));
});
ok('las tres pantallas usan el helper (no hay copia del mensaje)', () => {
    for (const p of ['src/components/dashboard/ReviewRequestsPanel.tsx', 'src/components/dashboard/TasksPanel.tsx', 'src/components/contacts/TaskManager.tsx']) {
        const f = leer(p);
        assert.ok(!f.includes('g.page/r/'), `${p} tiene el link copiado a mano`);
        assert.ok(f.includes('abrirChatPedidoResena'), `${p} no usa abrirChatPedidoResena`);
    }
});

console.log('\n5. Cruce con Google');
ok('nombre completo y único', () => {
    const clientes = [{ id: 'a', name: 'Ana María Pérez' }, { id: 'b', name: 'Juan Gómez' }, { id: 'c', name: 'Juan Gómez Ruiz' }];
    assert.deepEqual(cruzarResenasConClientes(['Ana Perez'], clientes), [{ autor: 'Ana Perez', clientId: 'a' }]);
    assert.deepEqual(cruzarResenasConClientes(['Juan Gómez'], clientes), [], 'homónimo: no marca');
    assert.deepEqual(cruzarResenasConClientes(['Ana'], clientes), [], 'solo nombre: no marca');
});
ok('las reseñas de respaldo (rating 0) no se cruzan', () => {
    assert.match(leer('src/services/review-request.service.ts'), /if \(!data\?\.rating\)/);
});

console.log('\n6. El robot está registrado en el scheduler interno');
ok('instrumentation dispara resena-segundo-pedido una vez por día', () => {
    const f = leer('src/instrumentation.ts');
    assert.match(f, /dispararSimple\('resena-segundo-pedido'/);
    assert.match(f, /maybeRunResenaSegundo\(\)\.catch/);
});

console.log(fallas ? `\n❌ ${fallas} falla(s)` : '\n✅ Todo en orden');
process.exit(fallas ? 1 : 0);
