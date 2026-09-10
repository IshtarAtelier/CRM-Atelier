import { config } from 'dotenv';
config();
const S = process.env.CRON_SECRET;
const hora = () => new Date().toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
console.log(`[${hora()}] Disparando el retroactivo completo de Grupo Óptico...`);
const t = Date.now();
const r = await fetch(`https://atelieroptica.com.ar/api/cron/lab-invoices?secret=${S}&days=35`, { signal: AbortSignal.timeout(1700000) });
const txt = await r.text();
console.log(`[${hora()}] HTTP ${r.status} en ${((Date.now()-t)/60000).toFixed(1)} min`);
try {
  const j = JSON.parse(txt);
  const go = j.GRUPO_OPTICO || {};
  console.log(`\nGRUPO ÓPTICO: ok=${go.ok}`);
  if (go.ok) {
    console.log(`  páginas=${go.pages} vistos=${go.seen} registrados=${go.registered} anulados=${go.anulados}`);
    console.log(`  sin venta=${go.unmatched} sobrecostos=${go.overcost} con costo=${go.withCost}`);
  } else console.log(`  ${String(go.error).slice(0, 220)}`);
  console.log(`\nOPTOVISION: ok=${j.OPTOVISION?.ok} pdfs=${j.OPTOVISION?.pdfs}`);
  console.log(`recheck: ${JSON.stringify(j.recheck)}`);
  console.log(`salud (días sin correr): ${JSON.stringify(j.health)}`);
  console.log(`fuentes caídas: ${JSON.stringify(j.stale)}`);
} catch { console.log(txt.slice(0, 500)); }
