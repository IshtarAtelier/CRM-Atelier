// ────────────────────────────────────────────────────────────────────────────
// "MÁS ADELANTE" PAUSA UNA SOLA VEZ (bug del 9 al 19/10/2026).
//
// El motor de seguimientos corre cada hora y relee la respuesta del cliente al
// último toque. Pausar no cambia esa condición (lastInboundAt > lastFollowUpAt),
// así que cada tick volvía a pausar "30 días desde AHORA": 69 contactos, 5.749
// notas iguales en la ficha y en el AuditLog, y una pausa que se corría una
// hora por hora y no vencía nunca — el seguimiento no volvía jamás.
//
// Fija:
//   1. la pausa se cuenta desde el MENSAJE del cliente, no desde el tick;
//   2. releer el mismo mensaje no vuelve a pausar (ni nota ni auditoría);
//   3. una pausa ya vencida no se re-aplica, y una sacada a mano tampoco;
//   4. un mensaje NUEVO de "más adelante" sí extiende;
//   5. el código de verdad usa esa decisión (cierre.ts y la ruta del cron).
//
// Puro: sin base y sin red. Corre en CI.
//   npm run check:posponer
// ────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { decidirPosponer, pausaPorRespuesta, PAUSA_POSPONER_DIAS } from '../../src/lib/embudo/respuesta.ts';

let ok = 0; const fallas = [];
const check = (nombre, cond, extra = '') => { if (cond) { ok++; console.log(`  ✓ ${nombre}`); } else { fallas.push(nombre); console.log(`  ✗ ${nombre} ${extra}`); } };

const H = 3600e3, D = 24 * H;
const respuestaAt = new Date('2026-10-15T14:06:00.000Z');
const esperado = respuestaAt.getTime() + PAUSA_POSPONER_DIAS * D;

console.log('\nLa pausa se ancla al mensaje');
check('hasta = mensaje + 30 días', pausaPorRespuesta(respuestaAt).getTime() === esperado);

console.log('\nSimulación: el cron corre cada hora durante 10 días sobre el mismo mensaje');
let pausadoHasta = null, aplicaciones = 0, registrada = false;
const hastas = new Set();
for (let tick = 0; tick < 240; tick++) {
    const now = respuestaAt.getTime() + H + tick * H;
    const d = decidirPosponer({ respuestaAt, followUpPausedUntil: pausadoHasta, now, yaRegistrada: registrada });
    if (d.aplicar) { aplicaciones++; pausadoHasta = d.hasta; registrada = true; hastas.add(d.hasta.getTime()); }
}
check('pausa UNA sola vez en 240 ticks', aplicaciones === 1, `(aplicó ${aplicaciones})`);
check('el hasta no se corre', hastas.size === 1 && pausadoHasta.getTime() === esperado);

console.log('\nCasos borde');
let d = decidirPosponer({ respuestaAt, followUpPausedUntil: null, now: esperado + H, yaRegistrada: false });
check('pausa ya vencida: no se re-aplica', !d.aplicar && d.motivo === 'pausa-vencida');
d = decidirPosponer({ respuestaAt, followUpPausedUntil: null, now: respuestaAt.getTime() + 5 * D, yaRegistrada: true });
check('pausa sacada a mano: no se vuelve a poner cada hora', !d.aplicar && d.motivo === 'ya-registrada');
d = decidirPosponer({ respuestaAt, followUpPausedUntil: new Date(esperado + 3 * D), now: respuestaAt.getTime() + H, yaRegistrada: false });
check('pausa más larga ya puesta: no se acorta ni se anota', !d.aplicar && d.motivo === 'ya-pausado');
d = decidirPosponer({ respuestaAt, followUpPausedUntil: null, now: respuestaAt.getTime() + H, yaRegistrada: false });
check('primera vez: aplica', d.aplicar && d.hasta.getTime() === esperado);

console.log('\nUn mensaje NUEVO de "más adelante" sí extiende');
const nuevo = new Date(respuestaAt.getTime() + 12 * D);
d = decidirPosponer({ respuestaAt: nuevo, followUpPausedUntil: new Date(esperado), now: nuevo.getTime() + H, yaRegistrada: false });
check('extiende hasta mensaje nuevo + 30', d.aplicar && d.hasta.getTime() === nuevo.getTime() + PAUSA_POSPONER_DIAS * D);

console.log('\nEl código de verdad usa la decisión');
const cierre = readFileSync(new URL('../../src/lib/seguimientos/cierre.ts', import.meta.url), 'utf8');
const ruta = readFileSync(new URL('../../src/app/api/cron/seguimientos/route.ts', import.meta.url), 'utf8');
const cuerpo = cierre.slice(cierre.indexOf('export async function posponerSeguimiento'));
check('cierre.ts decide con decidirPosponer antes de escribir', cuerpo.includes('decidirPosponer(') && cuerpo.indexOf('decidirPosponer(') < cuerpo.indexOf('whatsAppChat.update'));
check('cierre.ts sale sin escribir si no aplica', /if \(!decision\.aplicar\) return null;/.test(cuerpo));
check('cierre.ts no calcula la pausa desde el reloj', !/Date\.now\(\)\)?\s*\+\s*PAUSA_POSPONER_DIAS/.test(cuerpo) && !/now\s*\+\s*PAUSA_POSPONER_DIAS/.test(cuerpo));
check('el AuditLog guarda respuestaAt (para reconocer el mensaje)', cuerpo.includes('respuestaAt: respuestaIso'));
check('la ruta pasa respuestaAt del mensaje del cliente', /posponerSeguimiento\(\{[^}]*respuestaAt/.test(ruta) && ruta.includes('suyos[suyos.length - 1].createdAt'));

console.log(`\n${ok} ok, ${fallas.length} fallas`);
if (fallas.length) { console.error('FALLA:', fallas.join(' · ')); process.exit(1); }
