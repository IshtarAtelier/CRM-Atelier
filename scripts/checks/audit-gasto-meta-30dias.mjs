const API = 'https://graph.facebook.com/v24.0';
const TOKEN = process.env.META_ADS_TOKEN;
const CUENTAS = (process.env.META_AD_ACCOUNT_ID||'').split(',').map(s=>s.trim()).filter(Boolean)
  .map(id=>id.startsWith('act_')?id:`act_${id}`);
const arDate = d => new Date(Date.now()-d*864e5).toLocaleDateString('en-CA',{timeZone:'America/Argentina/Buenos_Aires'});
const RANGO = JSON.stringify({since: arDate(30), until: arDate(1)});

// Parser único (wa-service/shared/ad-tag.js). Acá vivía una quinta copia del
// regex, con el juego de caracteres restringido: leía distinto que la ingestión.
import { createRequire } from 'node:module';
const { parseAdTag } = createRequire(import.meta.url)('../../wa-service/shared/ad-tag.js');
const etiqueta = (t) => parseAdTag(t)?.campaign ?? null;
function implicita(t){ t=String(t||'').toLowerCase();
  if(/mayolens/.test(t))return'myolens'; if(/myofix/.test(t))return'myofix';
  if(/clipon|clip-on|clipones|clippons/.test(t))return'clip';
  if(/remarketing|2x1/.test(t))return'remarketing2x1'; return null; }
const clave = t => etiqueta(t)||implicita(t);

async function blue(){ try{
  const j = await (await fetch('https://mercados.ambito.com/dolar/informal/variacion')).json();
  return Number(String(j.venta).replace('.','').replace(',','.'))||1570;
} catch { return 1570; } }

(async()=>{
  const rate = await blue();
  console.log(`Ventana: ${arDate(30)} → ${arDate(1)}   dólar $${rate}\n`);
  let totalCuentas=0, totalAnuncios=0, totalConEtiqueta=0;
  const objetivos={};

  for (const cuenta of CUENTAS) {
    let u = new URL(`${API}/${cuenta}/insights`);
    u.searchParams.set('fields','spend,account_currency,account_name'); u.searchParams.set('time_range',RANGO);
    u.searchParams.set('access_token',TOKEN);
    const c = (await (await fetch(u)).json()).data?.[0];
    const gc = c ? (c.account_currency==='USD'?Number(c.spend)*rate:Number(c.spend)) : 0;
    totalCuentas += gc;
    console.log(`CUENTA ${cuenta} (${c?.account_name}, ${c?.account_currency}): $${Math.round(gc).toLocaleString('es-AR')}`);
    await new Promise(r=>setTimeout(r,400));

    u = new URL(`${API}/${cuenta}/insights`);
    u.searchParams.set('level','ad');
    u.searchParams.set('fields','ad_name,objective,spend,account_currency');
    u.searchParams.set('limit','100'); u.searchParams.set('time_range',RANGO);
    u.searchParams.set('access_token',TOKEN);
    let next=u.toString(), n=0, pag=0;
    while(next && pag++<20){
      const j = await (await fetch(next)).json();
      if(j.error){ console.error('  ERROR:',j.error.message); break; }
      for(const r of j.data||[]){
        const g = r.account_currency==='USD'?Number(r.spend)*rate:Number(r.spend);
        totalAnuncios += g; n++;
        objetivos[r.objective||'—'] = (objetivos[r.objective||'—']||0)+g;
        if(clave(r.ad_name)) totalConEtiqueta += g;
      }
      next = j.paging?.next||null;
      await new Promise(r=>setTimeout(r,400));
    }
    console.log(`  filas a nivel anuncio: ${n} (${pag-1} página/s)\n`);
  }

  console.log('─'.repeat(64));
  console.log(`(A) Suma de TOTALES DE CUENTA .......... $${Math.round(totalCuentas).toLocaleString('es-AR')}`);
  console.log(`(B) Suma de ANUNCIOS ................... $${Math.round(totalAnuncios).toLocaleString('es-AR')}`);
  console.log(`    diferencia A-B ..................... $${Math.round(totalCuentas-totalAnuncios).toLocaleString('es-AR')}`);
  console.log(`(C) Solo anuncios CON etiqueta ......... $${Math.round(totalConEtiqueta).toLocaleString('es-AR')}`);
  console.log(`    invisible al reporte de ROAS ....... $${Math.round(totalAnuncios-totalConEtiqueta).toLocaleString('es-AR')} (${(100*(1-totalConEtiqueta/totalAnuncios)).toFixed(1)}%)`);
  console.log('\nGasto por OBJETIVO de campana:');
  Object.entries(objetivos).sort((a,b)=>b[1]-a[1])
    .forEach(([k,v])=>console.log(`  ${k.padEnd(28)} $${Math.round(v).toLocaleString('es-AR')}`));
})();
