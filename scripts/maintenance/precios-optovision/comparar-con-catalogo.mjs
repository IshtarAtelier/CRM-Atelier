/**
 * Los cristales Varilux del CRM contra la lista nueva de Optovisión.
 *
 * LA PREGUNTA QUE RESPONDE: ¿cuánto aumentó de verdad el laboratorio, y qué
 * costo y precio deberían quedar?
 *
 * Cómo cruza cada producto con la lista, sin adivinar:
 *  1. Del nombre del producto saca DISEÑO (Comfort Max, XR design, Physio 3.0…)
 *     y MATERIAL (Orma, Airwear 1.59, Stylis 1.67, + Transitions/Xperio…).
 *  2. Del costo cargado despeja el precio de lista VIEJO invirtiendo la fórmula:
 *         lista vieja = costo / (1 + IVA) − calibrado
 *  3. Compara esa lista vieja contra las tres columnas de tratamiento de la
 *     lista nueva y se queda con la MÁS PARECIDA. Así el tratamiento no se
 *     supone: se deduce del número que ya está cargado.
 *
 * Solo lee (la base local por defecto). Escribe un HTML para mirar.
 *   node scripts/maintenance/precios-optovision/comparar-con-catalogo.mjs salida.html
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

config();

const aquí = dirname(fileURLToPath(import.meta.url));
const datos = JSON.parse(readFileSync(join(aquí, 'varilux-agosto-2026.json'), 'utf8'));
const salida = process.argv[2] || join(aquí, 'comparacion.html');

const CALIBRADO = 23000, IVA = 21, MARKUP = 2.4;
const costoDe = lista => Math.round((lista + CALIBRADO) * (1 + IVA / 100));
const listaDe = costo => costo / (1 + IVA / 100) - CALIBRADO;
const pesos = n => n == null ? '—' : `$${Math.round(n).toLocaleString('es-AR')}`;
const esc = s => String(s ?? '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

/** Del nombre del producto al diseño del catálogo. El orden importa: "Comfort
 *  Max" tiene que probarse antes que "Comfort", y "Physio 3.0" antes que
 *  "Physio", si no el más corto se come al más largo. */
const DISEÑOS = [
    // Kodak primero: "KODAK PRECISE" no debe caer en ninguna regla de Varilux.
    [/kodak.*unique/i, 'Kodak Unique DRO'],
    [/kodak.*precise/i, 'Kodak Precise Next'],
    [/kodak.*softwear/i, 'Kodak Softwear'],
    [/kodak.*(sv|monofocal)/i, 'Kodak SV Digital'],
    [/xr\s*design/i, 'Varilux XR design'],
    [/xr\s*pro/i, 'Varilux XR pro'],
    [/comfort\s*max/i, 'Varilux Comfort Max'],
    [/physio\s*3\.0/i, 'Varilux Physio 3.0'],
    [/liberty\s*3\.0/i, 'Varilux Liberty 3.0'],
    [/digitime/i, 'Varilux Digitime'],
    [/comfort/i, 'Varilux Comfort'],
    [/physio/i, 'Varilux Physio'],
];

/** Del nombre al material. También de más específico a más general. */
const MATERIALES = [
    // Los BLUE UV existen solo en Kodak; van primero para que "ORMA BLUE UV"
    // no caiga en el "ORMA" pelado.
    [/stylis.*blue\s*uv/i, 'STYLIS 1.67 BLUE UV'],
    [/airwear.*blue\s*uv/i, 'AIRWEAR 1.59 BLUE UV'],
    [/orma.*blue\s*uv/i, 'ORMA BLUE UV'],
    [/orma.*acclimates/i, 'ORMA ACCLIMATES'],
    [/stylis.*transitions/i, 'STYLIS 1.67 TRANSITIONS GEN S'],
    [/airwear.*transitions/i, 'AIRWEAR 1.59 TRANSITIONS GEN S'],
    [/orma\s*transitions\s*xtractive/i, 'ORMA TRANSITIONS XTRACTIVE'],
    [/orma.*transitions/i, 'ORMA TRANSITIONS GEN S'],
    [/airwear.*xperio/i, 'AIRWEAR 1.59 XPERIO'],
    [/orma.*xperio/i, 'ORMA XPERIO'],
    [/stylis/i, 'STYLIS 1.67'],
    [/airwear/i, 'AIRWEAR 1.59'],
    [/orma/i, 'ORMA'],
];

const primero = (tabla, texto) => (tabla.find(([re]) => re.test(texto)) || [])[1] || null;

async function main() {
    const productos = await prisma.$queryRaw`
        select id, name, price, cost, is2x1
        from "Product"
        where category = 'Cristal' and laboratory = 'OPTOVISION' and cost > 0
          and (name ilike '%varilux%' or name ilike '%physio%' or name ilike '%comfort%'
               or name ilike '%liberty%' or name ilike '%digitime%' or name ilike '%xr %'
               or name ilike '%kodak%')
        order by name`;

    const filas = [], sinCruzar = [];
    for (const p of productos) {
        const diseño = primero(DISEÑOS, p.name);
        const material = primero(MATERIALES, p.name);
        const d = datos.disenos.find(x => x.nombre === diseño);
        const m = d?.materiales.find(x => x.material === material);
        if (!m) { sinCruzar.push({ ...p, diseño, material }); continue; }

        // EL TRATAMIENTO LO DICE EL NOMBRE, no el número más cercano.
        // Elegir "el que menos difiere" parecía elegante y era una trampa: a
        // varios productos que dicen CRIZAL les asignaba TRÍO EASY CLEAN solo
        // porque el costo cargado estaba más abajo — y así tapaba justo el dato
        // que importa (que el costo real está por debajo de la lista, porque el
        // laboratorio descuenta). Solo se cae al más cercano si el nombre no
        // dice nada.
        const vieja = listaDe(p.cost);
        const porNombre =
            /prevencia/i.test(p.name) ? 'CRIZAL PREVENCIA'
                : /sapphire/i.test(p.name) ? 'CRIZAL SAPPHIRE'
                    : /tr[íi]o|easy\s*clean/i.test(p.name) ? 'TRIO EASY CLEAN'
                        : /crizal/i.test(p.name) ? 'CRIZAL FORTE UV'
                            : null;
        const elegida = porNombre && m.precios[porNombre] != null
            ? { trat: porNombre, nueva: m.precios[porNombre], deNombre: true }
            : Object.entries(m.precios)
                .map(([trat, nueva]) => ({ trat, nueva, dif: Math.abs(nueva - vieja) }))
                .sort((a, b) => a.dif - b.dif)[0];

        // "MI PRIMER VARILUX" es la promo del 50%: su costo es la mitad, así que
        // compararlo contra la lista entera da un "+114%" que no existe.
        const esPromo = /mi\s*primer/i.test(p.name);

        const nuevaComparable = esPromo ? elegida.nueva / 2 : elegida.nueva;
        const costoNuevo = costoDe(nuevaComparable);
        filas.push({
            ...p, diseño, material, tratamiento: elegida.trat, deNombre: !!elegida.deNombre, esPromo,
            listaVieja: vieja, listaNueva: nuevaComparable,
            costoNuevo, precioNuevo: Math.round(costoNuevo * MARKUP),
            pctLista: (nuevaComparable - vieja) / vieja * 100,
        });
    }

    filas.sort((a, b) => b.pctLista - a.pctLista);
    const prom = filas.reduce((a, f) => a + f.pctLista, 0) / (filas.length || 1);
    const mediana = [...filas].sort((a, b) => a.pctLista - b.pctLista)[Math.floor(filas.length / 2)]?.pctLista ?? 0;

    const th = 'padding:8px 10px;text-align:left;background:#1e293b;color:#fff;font-weight:700';
    const html = `<meta charset="utf-8"><title>Varilux: lo cargado vs la lista nueva</title>
<body style="font-family:system-ui,sans-serif;font-size:16px;color:#0f172a;background:#fff;margin:0;padding:28px;max-width:1250px">
<h1 style="font-size:28px;margin:0 0 6px">Varilux: lo que tenés cargado contra la lista nueva</h1>
<p style="margin:0 0 4px;color:#334155">${filas.length} productos cruzados${sinCruzar.length ? ` · ${sinCruzar.length} sin cruzar` : ''} · aumento del laboratorio: <strong>${mediana.toFixed(1)}%</strong> (mediana) · ${prom.toFixed(1)}% (promedio)</p>
<div style="margin:14px 0;padding:14px 16px;background:#f0f9ff;border:1px solid #0284c7;border-radius:10px">
  <strong>El tratamiento sale del NOMBRE del producto</strong> (Prevencia, Sapphire, Trío; y si solo dice
  "Crizal", se toma Forte UV). La "lista vieja" se despeja del costo cargado invirtiendo la fórmula:
  <code>costo ÷ ${(1 + IVA / 100).toFixed(2)} − ${pesos(CALIBRADO)}</code>.
  La columna "dif." es cuánto se aparta el costo cargado de la lista del laboratorio: si es grande y
  negativa, es el <strong>descuento</strong> que hace Optovisión.
  Los <strong>Mi Primer Varilux</strong> son la promo del 50%, así que se comparan contra media lista.
</div>
<div style="overflow-x:auto;border:1px solid #cbd5e1;border-radius:10px">
<table style="border-collapse:collapse;width:100%;font-size:14.5px">
<thead><tr>
  <th style="${th}">Producto</th><th style="${th}">Tratamiento deducido</th>
  <th style="${th};text-align:right">Lista vieja</th><th style="${th};text-align:right">Lista nueva</th>
  <th style="${th};text-align:right">Aumento</th>
  <th style="${th};text-align:right">Costo hoy</th><th style="${th};text-align:right">Costo nuevo</th>
  <th style="${th};text-align:right">Precio hoy</th><th style="${th};text-align:right">Precio nuevo</th>
</tr></thead><tbody>
${filas.map((f, i) => `<tr style="background:${i % 2 ? '#f8fafc' : '#fff'}">
  <td style="padding:8px 10px;font-weight:600">${esc(String(f.name).slice(0, 46))}${f.is2x1 ? ' <span style="color:#b45309;font-size:12px">2x1</span>' : ''}</td>
  <td style="padding:8px 10px;color:#475569;font-size:13px">${esc(f.tratamiento)}<br>
      <span style="color:#94a3b8">dif. ${pesos(Math.abs(f.listaNueva - f.listaVieja))}</span></td>
  <td style="padding:8px 10px;text-align:right;color:#475569">${pesos(f.listaVieja)}</td>
  <td style="padding:8px 10px;text-align:right">${pesos(f.listaNueva)}</td>
  <td style="padding:8px 10px;text-align:right;font-weight:700;color:${f.pctLista > 0 ? '#b91c1c' : '#15803d'}">${f.pctLista > 0 ? '+' : ''}${f.pctLista.toFixed(1)}%</td>
  <td style="padding:8px 10px;text-align:right;color:#475569">${pesos(f.cost)}</td>
  <td style="padding:8px 10px;text-align:right;font-weight:600">${pesos(f.costoNuevo)}</td>
  <td style="padding:8px 10px;text-align:right;color:#475569">${pesos(f.price)}</td>
  <td style="padding:8px 10px;text-align:right;font-weight:700">${pesos(f.precioNuevo)}</td>
</tr>`).join('')}
</tbody></table></div>
${sinCruzar.length ? `<h2 style="font-size:20px;margin-top:26px">No se pudieron cruzar (${sinCruzar.length})</h2>
<ul style="color:#475569">${sinCruzar.map(p => `<li>${esc(p.name)} — diseño: ${esc(p.diseño) || '?'} · material: ${esc(p.material) || '?'}</li>`).join('')}</ul>` : ''}
</body>`;
    writeFileSync(salida, html);

    console.log(`${filas.length} productos cruzados · ${sinCruzar.length} sin cruzar\n`);

    // EL AUMENTO AL CLIENTE. Con el mismo markup, el precio sube exactamente lo
    // mismo que el costo — pero se calcula sobre los precios de verdad, no se
    // asume, porque el redondeo al peso mueve las últimas cifras.
    console.log(`AUMENTO DEL PRECIO FINAL AL CLIENTE (mismo markup ×${MARKUP})\n`);
    const porDiseño = new Map();
    for (const f of filas) {
        if (!porDiseño.has(f.diseño)) porDiseño.set(f.diseño, []);
        porDiseño.get(f.diseño).push(f);
    }
    const pct = f => (f.precioNuevo - f.price) / f.price * 100;
    console.log(`  ${'Diseño'.padEnd(24)}${'n'.padStart(3)}  ${'precio hoy (prom)'.padStart(18)}${'precio nuevo'.padStart(15)}${'sube'.padStart(9)}`);
    for (const [d, fs] of [...porDiseño].sort((a, b) => a[0].localeCompare(b[0]))) {
        const hoy = fs.reduce((a, f) => a + f.price, 0) / fs.length;
        const nuevo = fs.reduce((a, f) => a + f.precioNuevo, 0) / fs.length;
        console.log(`  ${d.padEnd(24)}${String(fs.length).padStart(3)}  ${pesos(hoy).padStart(18)}${pesos(nuevo).padStart(15)}` +
            `${((nuevo - hoy) / hoy * 100).toFixed(1).padStart(8)}%`);
    }
    const todos = filas.map(pct).sort((a, b) => a - b);
    const totalHoy = filas.reduce((a, f) => a + f.price, 0);
    const totalNuevo = filas.reduce((a, f) => a + f.precioNuevo, 0);
    console.log(`\n  En toda la familia Varilux: de ${pesos(totalHoy)} a ${pesos(totalNuevo)} sumando los ${filas.length} precios`);
    console.log(`  El precio al cliente sube entre ${todos[0].toFixed(1)}% y ${todos[todos.length - 1].toFixed(1)}%` +
        ` · mediana ${todos[Math.floor(todos.length / 2)].toFixed(1)}%`);
    console.log(`\n  El que MÁS sube en pesos:`);
    const porPlata = [...filas].sort((a, b) => (b.precioNuevo - b.price) - (a.precioNuevo - a.price));
    for (const f of porPlata.slice(0, 3)) {
        console.log(`    ${String(f.name).slice(0, 46).padEnd(48)}${pesos(f.price)} → ${pesos(f.precioNuevo)}  (+${pesos(f.precioNuevo - f.price)})`);
    }
    console.log(`\nComparación escrita en ${salida}`);
}

main()
    .catch(err => { console.error(err); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
