/**
 * SOLO LOS COSTOS: qué costo tiene hoy cada cristal de Optovisión y cuál le
 * corresponde según la lista del laboratorio. Sin precios ni markups.
 *
 * Marca cada fila con de dónde salió el tratamiento:
 *   ✓ del nombre   — el producto dice SIN AR o Trío y se respeta
 *   ✓ por política — renglón con Crizal → columna MÁS CARA (decisión 26/8/2026:
 *                    se cobra siempre el más caro; el Crizal real es dato de la
 *                    venta, de elección obligatoria)
 *   ? revisar      — el renglón no tiene columnas Crizal o le falta el precio
 *
 * Solo lee. Escribe un HTML.
 *   node scripts/maintenance/precios-optovision/listado-costos.mjs salida.html
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { writeFileSync } from 'node:fs';
import { emparejar } from './emparejador.mjs';

config();

const PRODUCCION = process.argv.includes('--produccion');
const salida = process.argv.find(a => a.endsWith('.html')) || 'costos-optovision.html';
const url = PRODUCCION ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
const prisma = new PrismaClient({ datasources: { db: { url } } });

const pesos = n => n == null ? '—' : `$${Math.round(n).toLocaleString('es-AR')}`;
const esc = s => String(s ?? '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

async function main() {
    const productos = await prisma.$queryRaw`
        select id, name, price, cost, "baseCost", is2x1
        from "Product"
        where category = 'Cristal' and laboratory = 'OPTOVISION'
        order by name`;
    const { ok } = emparejar(productos);
    ok.sort((a, b) => (a.seguro === b.seguro ? 0 : a.seguro ? 1 : -1) || a.name.localeCompare(b.name));

    const dudosos = ok.filter(x => !x.seguro);
    const th = 'padding:8px 10px;text-align:left;background:#1e293b;color:#fff;font-weight:700';
    const fila = (x, i) => `
        <tr style="background:${!x.seguro ? '#fffbeb' : i % 2 ? '#f8fafc' : '#fff'}">
            <td style="padding:8px 10px;font-weight:600">${esc(String(x.name).slice(0, 50))}</td>
            <td style="padding:8px 10px;text-align:right;white-space:nowrap;color:#475569">${pesos(x.cost)}</td>
            <td style="padding:8px 10px;text-align:right;white-space:nowrap;font-weight:700">${pesos(x.costoNuevo)}</td>
            <td style="padding:8px 10px;text-align:right;white-space:nowrap;color:${(x.pct ?? 0) >= 0 ? '#b91c1c' : '#15803d'}">${x.pct == null ? '—' : `${x.pct > 0 ? '+' : ''}${x.pct.toFixed(1)}%`}</td>
            <td style="padding:8px 10px;font-size:13px;color:#475569">${esc(x.tratamiento)}<br>
                <span style="color:${x.seguro ? '#15803d' : '#b45309'}">${x.seguro ? '✓ confirmado' : '? sin confirmar'}</span></td>
        </tr>`;

    const html = `<meta charset="utf-8"><title>Costos de Optovisión</title>
<body style="font-family:system-ui,sans-serif;font-size:16px;color:#0f172a;background:#fff;margin:0;padding:28px;max-width:1050px">
<h1 style="font-size:28px;margin:0 0 6px">Costos de Optovisión</h1>
<p style="margin:0 0 4px;color:#334155">${ok.length} cristales · costo con calibrado e IVA incluidos · sin precios ni markup</p>
${dudosos.length ? `<div style="margin:14px 0;padding:14px 16px;background:#fffbeb;border:1px solid #f59e0b;border-radius:10px">
  <strong>${dudosos.length} en ámbar necesitan una mirada:</strong> su renglón de la lista no tiene columnas
  Crizal (o le falta el precio), así que la política del más caro no les aplica y el tratamiento
  quedó elegido por descarte.
</div>` : ''}
<div style="overflow-x:auto;border:1px solid #cbd5e1;border-radius:10px">
<table style="border-collapse:collapse;width:100%;font-size:14.5px">
<thead><tr>
  <th style="${th}">Producto</th>
  <th style="${th};text-align:right">Costo hoy</th>
  <th style="${th};text-align:right">Costo según lista</th>
  <th style="${th};text-align:right">Dif.</th>
  <th style="${th}">Tratamiento</th>
</tr></thead><tbody>${ok.map(fila).join('')}</tbody></table></div>
</body>`;
    writeFileSync(salida, html);

    const suben = ok.filter(x => x.costoNuevo > x.cost).length;
    console.log(`${ok.length} cristales · ${suben} suben · ${ok.length - suben} bajan o quedan igual`);
    console.log(`${ok.length - dudosos.length} con el tratamiento confirmado · ${dudosos.length} sin confirmar`);
    console.log(`Listado escrito en ${salida}`);
}

main()
    .catch(err => { console.error(err); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
