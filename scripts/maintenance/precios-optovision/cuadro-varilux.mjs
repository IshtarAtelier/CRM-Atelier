/**
 * El cuadro de precios Varilux de Optovisión, en una tabla mirable.
 *
 * Lee `varilux-agosto-2026.json` (la lista transcrita del PDF del laboratorio)
 * y escribe un HTML con todos los diseños, materiales y tratamientos juntos —
 * que en el PDF están repartidos en cuatro páginas y con los nombres de cada
 * diseño puestos como logo, no como texto.
 *
 * NO lee ni escribe la base. Solo transforma el JSON.
 *   node scripts/maintenance/precios-optovision/cuadro-varilux.mjs salida.html
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const aquí = dirname(fileURLToPath(import.meta.url));
const datos = JSON.parse(readFileSync(join(aquí, 'varilux-agosto-2026.json'), 'utf8'));
const salida = process.argv[2] || join(aquí, 'cuadro-varilux.html');

/** El primero de la lista es el tope de gama; se muestra aparte, apagado. */
const EXCLUIDO = 'Varilux XR pro';

const pesos = n => n == null ? '—' : `$${n.toLocaleString('es-AR')}`;
const esc = s => String(s ?? '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

const TRAT = datos.tratamientos;

function tabla(d) {
    const usados = TRAT.filter(t => d.materiales.some(m => m.precios[t] != null));
    const th = 'padding:8px 10px;text-align:right;background:#1e293b;color:#fff;font-weight:700;white-space:nowrap';
    const filas = d.materiales.map((m, i) => `
        <tr style="background:${i % 2 ? '#f8fafc' : '#fff'}">
            <td style="padding:8px 10px;font-weight:600">${esc(m.material)}</td>
            ${usados.map(t => `<td style="padding:8px 10px;text-align:right;white-space:nowrap">${pesos(m.precios[t])}</td>`).join('')}
        </tr>`).join('');
    const apagado = d.nombre === EXCLUIDO;
    return `
    <section style="margin:32px 0;${apagado ? 'opacity:.55' : ''}">
        <h2 style="font-size:22px;margin:0 0 2px">${esc(d.nombre)}
            ${apagado ? '<span style="font-size:15px;font-weight:400;color:#b45309"> — lo dejamos afuera por ahora</span>' : ''}
        </h2>
        <p style="margin:0 0 10px;color:#475569">${esc(d.gama)} · página ${d.pagina} del PDF${d.nota ? ` · ${esc(d.nota)}` : ''}</p>
        <div style="overflow-x:auto;border:1px solid #cbd5e1;border-radius:10px">
        <table style="border-collapse:collapse;width:100%;font-size:15px">
            <thead><tr>
                <th style="${th};text-align:left">Material</th>
                ${usados.map(t => `<th style="${th}">${esc(t)}</th>`).join('')}
            </tr></thead>
            <tbody>${filas}</tbody>
        </table></div>
    </section>`;
}

/**
 * Los Crizal son DOS cosas distintas y mezclarlas confunde: el tratamiento RX
 * suelto (lo que cuesta agregarle Crizal a una lente hecha a medida — así viene
 * en la factura, renglón aparte) y la lente de stock que ya viene con Crizal
 * puesto, que es una lente entera y no un tratamiento.
 */
function crizal() {
    const c = datos.crizal;
    if (!c) return '';
    const th = 'padding:8px 10px;text-align:left;background:#1e293b;color:#fff;font-weight:700';
    const bloque = (titulo, aclara, filas, conRango) => `
        <h3 style="font-size:19px;margin:22px 0 2px">${esc(titulo)}</h3>
        <p style="margin:0 0 10px;color:#475569">${esc(aclara)}</p>
        <div style="overflow-x:auto;border:1px solid #cbd5e1;border-radius:10px">
        <table style="border-collapse:collapse;width:100%;font-size:15px">
            <thead><tr><th style="${th}">Crizal</th>
                <th style="${th};text-align:right">Precio</th>
                ${conRango ? `<th style="${th}">Rango de fabricación</th>` : ''}
            </tr></thead>
            <tbody>${filas.map((f, i) => `<tr style="background:${i % 2 ? '#f8fafc' : '#fff'}">
                <td style="padding:8px 10px;font-weight:600">${esc(f.nombre)}</td>
                <td style="padding:8px 10px;text-align:right;white-space:nowrap">${pesos(f.precio)}</td>
                ${conRango ? `<td style="padding:8px 10px;color:#475569">${esc(f.rango || '')}</td>` : ''}
            </tr>`).join('')}</tbody>
        </table></div>`;
    return `
    <section style="margin:36px 0;padding-top:20px;border-top:2px solid #cbd5e1">
        <h2 style="font-size:22px;margin:0">Crizal</h2>
        <p style="margin:2px 0 0;color:#475569">Página 22 del PDF.</p>
        ${bloque('Tratamiento RX', 'Lo que cuesta agregarle el Crizal a una lente que se fabrica a medida. En la factura del laboratorio va como renglón aparte de la lente.', c.tratamiento_rx, false)}
        ${bloque('Lentes de stock con Crizal', 'Acá el Crizal ya viene puesto: es una LENTE entera, no un tratamiento. No se suma a las de arriba.', c.lentes_de_stock, true)}
    </section>`;
}

const ordenados = [...datos.disenos].sort((a, b) =>
    (a.nombre === EXCLUIDO ? 1 : 0) - (b.nombre === EXCLUIDO ? 1 : 0));

const html = `<meta charset="utf-8"><title>Costos Varilux — Optovisión</title>
<body style="font-family:system-ui,sans-serif;font-size:16px;color:#0f172a;background:#fff;margin:0;padding:28px;max-width:1200px">
<h1 style="font-size:28px;margin:0 0 6px">Costos Varilux — Optovisión</h1>
<p style="margin:0 0 4px;color:#334155">Lista del laboratorio, ${esc(datos.vigencia)}. ${datos.disenos.length} diseños.</p>
<div style="margin:16px 0;padding:14px 16px;background:#fffbeb;border:1px solid #f59e0b;border-radius:10px">
  <strong>Ojo antes de cargar estos números como costo:</strong> son <strong>precios de lista y sin IVA</strong>.
  En la factura Optovisión aplica descuentos (se vieron 15%, 20% y 23,5% según el renglón) y después suma el IVA.
  El costo real de un par sale de la factura, no de esta lista.
</div>
${ordenados.map(tabla).join('')}
${crizal()}
<p style="margin-top:28px;color:#64748b;font-size:14px">
  Fuente: ${esc(datos.fuente)}. Cada número verificado contra el texto del PDF y contra la imagen de la página.
</p>
</body>`;

writeFileSync(salida, html);
console.log(`Cuadro escrito en ${salida}`);
console.log(`${datos.disenos.length} diseños · ${datos.disenos.reduce((a, d) => a + d.materiales.length, 0)} combinaciones material×diseño`);
