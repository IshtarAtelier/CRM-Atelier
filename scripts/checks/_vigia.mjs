/** Espera a que la credencial de SmartLab funcione y ahi dispara el retroactivo. */
import { config } from 'dotenv';
config();
const S = process.env.CRON_SECRET;
const BASE = 'https://atelieroptica.com.ar';
const hora = () => new Date().toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });

const LIMITE = Date.now() + 55 * 60 * 1000;
let intento = 0;
while (Date.now() < LIMITE) {
  intento++;
  try {
    // La prueba REAL es la conciliación: dice si Grupo Óptico entró o no.
    // El sync de estados puede contestar 200 con "already_running" sin haber
    // entrado a ningún lado — eso hizo que la corrida anterior cantara victoria.
    const r = await fetch(`${BASE}/api/cron/lab-invoices?secret=${S}&days=35`, { signal: AbortSignal.timeout(1700000) });
    const txt = await r.text();
    const rechazado = txt.includes('CREDENCIAL RECHAZADA');
    let go = null;
    try { go = JSON.parse(txt).GRUPO_OPTICO; } catch {}
    if (r.ok && go?.ok === true) {
      console.log(`\n[${hora()}] ✅ GRUPO ÓPTICO ENTRÓ. Retroactivo de costos: ${JSON.stringify(go).slice(0, 400)}`);
      const s = await fetch(`${BASE}/api/cron/smartlab-sync?secret=${S}`, { signal: AbortSignal.timeout(1700000) });
      console.log(`[${hora()}] sync de estados HTTP ${s.status}: ${(await s.text()).slice(0, 300)}`);
      break;
    }
    console.log(`[${hora()}] intento ${intento}: ${rechazado ? 'credencial todavia rechazada' : `sin entrar — ${String(go?.error || txt).slice(0, 140)}`}`);
  } catch (e) {
    console.log(`[${hora()}] intento ${intento}: ${String(e.message).split('\n')[0]}`);
  }
  await new Promise(s => setTimeout(s, 120000));
}
console.log(`[${hora()}] vigía terminado`);
