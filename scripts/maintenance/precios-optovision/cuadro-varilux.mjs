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

/**
 * LA CADENA COMPLETA, de lo que factura el lab a lo que paga el cliente:
 *
 *   costo final = (precio de lista + calibrado) × (1 + IVA)      ← lens-cost.ts
 *   precio      = costo final × markup
 *
 * Los tres números NO son inventados:
 *   · calibrado 23.000 e IVA 21% salen de LaboratoryConfig, fila "Optovision".
 *   · markup 2,40 es el que tienen HOY 112 de los 121 cristales de Optovisión
 *     del catálogo (medido sobre la base, no supuesto). Los 9 restantes son
 *     packs 2x1, que tienen su propia lógica de precio.
 * Se pueden pisar: --calibrado 23000 --iva 21 --markup 2.4
 */
const num = (bandera, x) => {
    const i = process.argv.indexOf(bandera);
    return i !== -1 && process.argv[i + 1] ? Number(process.argv[i + 1]) : x;
};
const CALIBRADO = num('--calibrado', 23000);
const IVA = num('--iva', 21);
const MARKUP = num('--markup', 2.4);

const costoFinal = lista => Math.round((lista + CALIBRADO) * (1 + IVA / 100));
const precioVenta = lista => Math.round(costoFinal(lista) * MARKUP);
/** En un 2x1 el segundo par solo cuesta el calibrado, con su IVA. */
const COSTO_SEGUNDO_PAR = Math.round(CALIBRADO * (1 + IVA / 100));

const pesos = n => n == null ? '—' : `$${n.toLocaleString('es-AR')}`;
const esc = s => String(s ?? '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

const TRAT = datos.tratamientos;

function tabla(d) {
    const usados = TRAT.filter(t => d.materiales.some(m => m.precios[t] != null));
    const th = 'padding:8px 10px;text-align:right;background:#1e293b;color:#fff;font-weight:700;white-space:nowrap';
    const celda = lista => lista == null ? '<td style="padding:8px 10px">—</td>' : `
        <td style="padding:8px 10px;text-align:right;white-space:nowrap">
            <div style="font-weight:700;font-size:16px">${pesos(precioVenta(lista))}</div>
            <div style="font-size:12.5px;color:#64748b">costo ${pesos(costoFinal(lista))}</div>
            <div style="font-size:12.5px;color:#94a3b8">lista ${pesos(lista)}</div>
        </td>`;
    const filas = d.materiales.map((m, i) => `
        <tr style="background:${i % 2 ? '#f8fafc' : '#fff'}">
            <td style="padding:8px 10px;font-weight:600">${esc(m.material)}</td>
            ${usados.map(t => celda(m.precios[t])).join('')}
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
 * Sygnus es una lista aparte dentro del mismo PDF, con otras columnas (índice,
 * diámetro, rangos) y también SIN antirreflejo. Se muestra igual que los
 * monofocales: pelado y con Crizal Forte UV.
 */
function sygnus() {
    const s = datos.sygnus;
    if (!s) return '';
    const forte = datos.monofocales?.tratamientos_sueltos?.find(t => /FORTE/.test(t.nombre))?.precio ?? 0;
    const th = 'padding:8px 10px;text-align:left;background:#1e293b;color:#fff;font-weight:700';
    const total = s.familias.reduce((a, f) => a + f.filas.length, 0);
    return `
    <section style="margin:36px 0;padding-top:20px;border-top:2px solid #cbd5e1">
        <h2 style="font-size:22px;margin:0">Sygnus — páginas ${s.paginas.join(' y ')}</h2>
        <p style="margin:2px 0 14px;color:#475569">
            ${s.familias.length} familias · ${total} lentes. También <strong>sin antirreflejo</strong>:
            la columna de la derecha ya le suma Crizal Forte UV (${pesos(forte)}).
        </p>
        ${s.familias.map(f => `
            <h3 style="font-size:18px;margin:20px 0 2px">${esc(f.familia)}</h3>
            <p style="margin:0 0 8px;color:#475569">${esc(f.tipo)}${f.nota ? ` · ${esc(f.nota)}` : ''}</p>
            <div style="overflow-x:auto;border:1px solid #cbd5e1;border-radius:10px">
            <table style="border-collapse:collapse;width:100%;font-size:14.5px">
                <thead><tr>
                    <th style="${th}">Producto / material</th>
                    <th style="${th};text-align:center">Índice</th>
                    <th style="${th};text-align:center">ø</th>
                    <th style="${th}">Rango</th>
                    <th style="${th};text-align:right">Lista sin AR</th>
                    <th style="${th};text-align:right">Precio pelado</th>
                    <th style="${th};text-align:right">Precio con Forte UV</th>
                </tr></thead>
                <tbody>${f.filas.map((r, i) => `
                    <tr style="background:${i % 2 ? '#f8fafc' : '#fff'}">
                        <td style="padding:8px 10px;font-weight:600">${esc(r.material)}</td>
                        <td style="padding:8px 10px;text-align:center;color:#475569">${esc(r.ne)}</td>
                        <td style="padding:8px 10px;text-align:center;color:#475569">${r.diametro}</td>
                        <td style="padding:8px 10px;color:#475569;font-size:13px">${esc(r.rango)}</td>
                        <td style="padding:8px 10px;text-align:right;white-space:nowrap;color:#475569">${pesos(r.precio)}</td>
                        <td style="padding:8px 10px;text-align:right;white-space:nowrap">
                            <div style="font-weight:700">${pesos(precioVenta(r.precio))}</div>
                            <div style="font-size:12px;color:#64748b">costo ${pesos(costoFinal(r.precio))}</div>
                        </td>
                        <td style="padding:8px 10px;text-align:right;white-space:nowrap">
                            <div style="font-weight:700">${pesos(precioVenta(r.precio + forte))}</div>
                            <div style="font-size:12px;color:#64748b">costo ${pesos(costoFinal(r.precio + forte))}</div>
                        </td>
                    </tr>`).join('')}</tbody>
            </table></div>`).join('')}
    </section>`;
}

/**
 * Los monofocales de la página 20 vienen SIN antirreflejo: no se les puede
 * aplicar la misma cuenta que a los progresivos sin antes sumarles el
 * tratamiento. Por eso acá el precio de venta se muestra en DOS variantes —
 * pelado y con Crizal Forte UV, que es el que llevan casi todos— en vez de
 * uno solo que estaría mal en la mitad de los casos.
 */
function monofocales() {
    const m = datos.monofocales;
    if (!m) return '';
    const forte = m.tratamientos_sueltos.find(t => /FORTE/.test(t.nombre))?.precio ?? 0;
    const th = 'padding:8px 10px;text-align:left;background:#1e293b;color:#fff;font-weight:700';
    const fila = (f, i) => `
        <tr style="background:${i % 2 ? '#f8fafc' : '#fff'}">
            <td style="padding:8px 10px;font-weight:600">${esc(f.material)}</td>
            <td style="padding:8px 10px;text-align:right;white-space:nowrap;color:#475569">${pesos(f.precio)}</td>
            <td style="padding:8px 10px;text-align:right;white-space:nowrap">
                <div style="font-weight:700">${pesos(precioVenta(f.precio))}</div>
                <div style="font-size:12.5px;color:#64748b">costo ${pesos(costoFinal(f.precio))}</div>
            </td>
            <td style="padding:8px 10px;text-align:right;white-space:nowrap">
                <div style="font-weight:700">${pesos(precioVenta(f.precio + forte))}</div>
                <div style="font-size:12.5px;color:#64748b">costo ${pesos(costoFinal(f.precio + forte))}</div>
            </td>
            <td style="padding:8px 10px;color:#475569;font-size:13.5px">${esc(f.rango || '')}</td>
        </tr>`;
    return `
    <section style="margin:36px 0;padding-top:20px;border-top:2px solid #cbd5e1">
        <h2 style="font-size:22px;margin:0">Monofocales y protección — página ${m.pagina}</h2>
        <div style="margin:10px 0 16px;padding:12px 14px;background:#fffbeb;border:1px solid #f59e0b;border-radius:10px">
            <strong>Estos vienen SIN antirreflejo.</strong> Los progresivos de arriba ya lo traen incluido;
            estos no. Por eso se muestran las dos columnas: pelado, y con Crizal Forte UV (${pesos(forte)}),
            que es el que llevan casi todos. Si va con otro tratamiento, se cambia ese número:
            ${m.tratamientos_sueltos.map(t => `${esc(t.nombre)} ${pesos(t.precio)}`).join(' · ')}.
        </div>
        ${m.grupos.map(g => `
            <h3 style="font-size:18px;margin:20px 0 2px">${esc(g.familia)}</h3>
            <p style="margin:0 0 8px;color:#475569">${esc(g.grupo)}</p>
            <div style="overflow-x:auto;border:1px solid #cbd5e1;border-radius:10px">
            <table style="border-collapse:collapse;width:100%;font-size:15px">
                <thead><tr>
                    <th style="${th}">Material</th>
                    <th style="${th};text-align:right">Lista sin AR</th>
                    <th style="${th};text-align:right">Precio pelado</th>
                    <th style="${th};text-align:right">Precio con Crizal Forte UV</th>
                    <th style="${th}">Rango</th>
                </tr></thead>
                <tbody>${g.filas.map(fila).join('')}</tbody>
            </table></div>`).join('')}
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
<div style="margin:16px 0;padding:16px;background:#f0f9ff;border:1px solid #0284c7;border-radius:10px">
  <div style="font-size:18px;font-weight:700;margin-bottom:6px">Cómo se arma cada número</div>
  <div style="font-family:ui-monospace,monospace;font-size:15px;line-height:1.8">
    costo = (lista + ${pesos(CALIBRADO)} de calibrado) × ${(1 + IVA / 100).toFixed(2)} &nbsp;(IVA ${IVA}%)<br>
    <strong>precio = costo × ${MARKUP}</strong> &nbsp;(el markup que hoy tienen 112 de los 121 cristales de Optovisión)
  </div>
  <div style="margin-top:10px">
    En un <strong>2x1</strong>, el segundo par solo cuesta el calibrado con IVA:
    <strong>${pesos(COSTO_SEGUNDO_PAR)}</strong>.
  </div>
</div>
<div style="margin:16px 0;padding:14px 16px;background:#fffbeb;border:1px solid #f59e0b;border-radius:10px">
  <strong>Lo único que puede mover estos números:</strong> la columna "lista" es el precio de lista del
  laboratorio, y en la factura Optovisión aplica descuentos (se vieron 15%, 20% y 23,5% según el renglón).
  Si el descuento es real y sostenido, el costo verdadero es más bajo que el de acá — y entonces el
  precio calculado queda alto. Conviene compararlo contra una factura antes de dar la lista por buena.
</div>
${ordenados.map(tabla).join('')}
${monofocales()}
${sygnus()}
${crizal()}
<p style="margin-top:28px;color:#64748b;font-size:14px">
  Fuente: ${esc(datos.fuente)}. Cada número verificado contra el texto del PDF y contra la imagen de la página.
</p>
</body>`;

writeFileSync(salida, html);
const cuenta = datos.disenos.reduce((a, d) => a + d.materiales.length, 0)
    + (datos.sygnus?.familias.reduce((a, f) => a + f.filas.length, 0) || 0)
    + (datos.monofocales?.grupos.reduce((a, g) => a + g.filas.length, 0) || 0)
    + (datos.crizal ? datos.crizal.tratamiento_rx.length + datos.crizal.lentes_de_stock.length : 0);
console.log(`Cuadro escrito en ${salida}`);
console.log(`${datos.disenos.length} diseños progresivos · ${datos.sygnus?.familias.length || 0} familias Sygnus`);
console.log(`${cuenta} filas de precio en total`);
