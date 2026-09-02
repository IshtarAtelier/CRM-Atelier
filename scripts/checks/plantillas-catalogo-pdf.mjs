/**
 * Genera un PDF con las 16 plantillas de WhatsApp TAL CUAL las ve el cliente
 * (burbujas estilo WhatsApp, con los datos de ejemplo del catálogo), agrupadas
 * en dos secciones: mensajes de la venta (utilidad) y marketing. SOLO LEE.
 *
 *   node scripts/checks/plantillas-catalogo-pdf.mjs
 *   → deja el archivo en el directorio actual: plantillas-whatsapp-atelier.pdf
 *
 * Para qué: que la dueña y el equipo vean el catálogo completo en una hoja,
 * sin abrir el WhatsApp Manager. La agrupación usa la categoría FINAL que
 * asignó Meta (es la que manda en el precio), no la que pedimos nosotros.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

// El catálogo vive en un .ts: se extrae el objeto literal igual que en
// crear-plantillas.mjs (una sola fuente de verdad, nada duplicado acá).
function cargarCatalogo() {
    const src = readFileSync(new URL('../../src/lib/whatsapp/templates.ts', import.meta.url), 'utf8');
    const inicio = src.indexOf('export const WHATSAPP_TEMPLATES = {');
    const fin = src.indexOf('} as const satisfies', inicio);
    const cuerpo = src.slice(src.indexOf('{', inicio), fin + 1);
    return new Function(`return (${cuerpo})`)();
}

// Categoría final en Meta (24/8/2026): reclasificó varias UTILITY → MARKETING.
const CATEGORIA_META = {
    comprobante_pago: 'UTILITY', estado_pedido: 'UTILITY', factura_electronica: 'UTILITY',
    pedido_enviado: 'UTILITY', pedido_listo: 'UTILITY', pedido_listo_saldo: 'UTILITY',
    // _v2: las que se mandan desde el 1/9/26 (las v1 quedaron con el horario viejo).
    pedido_listo_v2: 'UTILITY', pedido_listo_saldo_v2: 'UTILITY',
    venta_confirmada: 'UTILITY',
    invitacion_local: 'MARKETING', pedido_resena: 'MARKETING', presupuesto: 'MARKETING',
    presupuesto_pdf: 'MARKETING', retomar_conversacion: 'MARKETING', seguimiento_carrito: 'MARKETING',
    seguimiento_lentes: 'MARKETING', seguimiento_presupuesto: 'MARKETING', ultimo_seguimiento: 'MARKETING',
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Negritas de WhatsApp (*texto*) y saltos de línea, como los pinta la app. */
const waHtml = (s) => esc(s).replace(/\*([^*\n]+)\*/g, '<b>$1</b>').replace(/\n/g, '<br>');

function burbuja(def) {
    const cuerpo = def.body.replace(/\{\{(\d+)\}\}/g, (_, i) => def.params[Number(i) - 1]?.example ?? `{{${i}}}`);
    const doc = def.header === 'DOCUMENT'
        ? `<div class="doc">📄 <span>Pedido #A1B2 — Atelier Óptica.pdf</span></div>` : '';
    const botones = (def.buttons || [])
        .map(b => `<div class="btn">${b.type === 'URL' ? '🔗' : '↩️'} ${esc(b.text)}</div>`).join('');
    const params = def.params.map(p => p.label).join(' · ');
    return `
      <div class="card">
        <div class="meta"><code>${def.name}</code><span class="inv">${def.inventario}</span></div>
        <div class="bubble">
          ${doc}
          <div class="txt">${waHtml(cuerpo)}</div>
          ${def.footer ? `<div class="foot">${esc(def.footer)}</div>` : ''}
          <div class="hora">21:47 ✓✓</div>
        </div>
        ${botones ? `<div class="btns">${botones}</div>` : ''}
        <div class="vars">se completa con: ${esc(params)}</div>
      </div>`;
}

function seccion(titulo, sub, defs) {
    return `
      <section>
        <h2>${titulo} <small>${defs.length} plantillas</small></h2>
        <p class="sub">${sub}</p>
        <div class="grid">${defs.map(burbuja).join('')}</div>
      </section>`;
}

const catalogo = Object.values(cargarCatalogo());
const utilidad = catalogo.filter(d => CATEGORIA_META[d.name] === 'UTILITY');
const marketing = catalogo.filter(d => CATEGORIA_META[d.name] === 'MARKETING');

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; color:#1a1a1a; background:#fff; }
  header { padding:28px 36px 18px; border-bottom:3px solid #075E54; }
  h1 { font-size:22px; } h1 small { font-weight:400; color:#666; font-size:14px; display:block; margin-top:4px; }
  section { padding:20px 36px; page-break-before:auto; }
  h2 { font-size:17px; color:#075E54; margin-bottom:2px; }
  h2 small { color:#999; font-weight:400; font-size:12px; }
  .sub { font-size:12px; color:#666; margin-bottom:14px; }
  .grid { display:flex; flex-wrap:wrap; gap:14px; }
  .card { width:335px; page-break-inside:avoid; }
  .meta { display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; }
  .meta code { font-size:11px; color:#075E54; font-weight:700; }
  .inv { font-size:10px; color:#999; }
  .bubble { background:#E1F7CB; border-radius:10px; border-top-left-radius:2px; padding:8px 10px; box-shadow:0 1px 1px rgba(0,0,0,.15); }
  .txt { font-size:12.5px; line-height:1.45; }
  .foot { font-size:11px; color:#7a7a7a; margin-top:6px; }
  .hora { font-size:10px; color:#6ea97e; text-align:right; margin-top:3px; }
  .doc { background:#fff; border-radius:8px; padding:8px 10px; font-size:11.5px; color:#333; margin-bottom:7px; display:flex; gap:6px; align-items:center; border:1px solid #d5e8c2; }
  .btns { margin-top:4px; }
  .btn { background:#fff; border:1px solid #dbe6dd; color:#00a5f4; text-align:center; font-size:12px; padding:6px; border-radius:8px; margin-top:3px; }
  .vars { font-size:10px; color:#999; margin-top:5px; font-style:italic; }
</style></head><body>
  <header>
    <h1>Plantillas de WhatsApp — Atelier Óptica
      <small>Las 16 aprobadas por Meta · así las ve el cliente (con datos de ejemplo) · 24/8/2026</small></h1>
  </header>
  ${seccion('Mensajes de la venta', 'Categoría "utilidad" en Meta: avisos del pedido en curso. Gratis dentro de las 24 h de la última respuesta del cliente; fuera, US$ 0,012 por mensaje (con 1.000 gratis por mes).', utilidad)}
  ${seccion('Marketing', 'Así los clasificó Meta: seguimientos, invitaciones y presupuestos. Fuera de la ventana de 24 h cuestan US$ 0,062 por mensaje. Los seguimientos automáticos siguen APAGADOS: estas plantillas solo salen si alguien las manda.', marketing)}
</body></html>`;

const tmp = new URL('./plantillas-tmp.html', import.meta.url).pathname;
writeFileSync(tmp, html);
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('file://' + tmp);
await page.pdf({ path: 'plantillas-whatsapp-atelier.pdf', format: 'A4', printBackground: true, margin: { top: '0', bottom: '24px' } });
await browser.close();
const { unlinkSync } = await import('node:fs');
unlinkSync(tmp);
console.log(`✔ plantillas-whatsapp-atelier.pdf — ${utilidad.length} de venta + ${marketing.length} de marketing = ${catalogo.length}`);
