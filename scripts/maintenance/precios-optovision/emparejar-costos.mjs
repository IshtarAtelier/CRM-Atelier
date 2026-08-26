/**
 * Empareja CADA cristal de Optovisión del CRM con su renglón en la lista del
 * laboratorio, y dice cuáles no encuentra y por qué.
 *
 * Para qué: antes de sincronizar costos hay que saber que la equivalencia es
 * correcta producto por producto. Un costo cargado contra el renglón equivocado
 * es peor que un costo viejo — el viejo se nota, el equivocado no.
 *
 * Separa los que no cruzan en DOS motivos, que se arreglan distinto:
 *   · FALTA EN LA LISTA — esa familia todavía no está transcrita del PDF
 *     (o el laboratorio directamente no la ofrece). Se arregla cargando datos.
 *   · NOMBRE — la familia está pero el nombre del producto no deja
 *     reconocerla. Se arregla renombrando el producto.
 *
 * Solo lee (base local). Escribe un HTML.
 *   node scripts/maintenance/precios-optovision/emparejar-costos.mjs salida.html
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

config();

const aquí = dirname(fileURLToPath(import.meta.url));
const datos = JSON.parse(readFileSync(join(aquí, 'varilux-agosto-2026.json'), 'utf8'));
const salida = process.argv[2] || join(aquí, 'emparejamiento.html');

const CALIBRADO = 23000, IVA = 21;
const costoDe = lista => Math.round((lista + CALIBRADO) * (1 + IVA / 100));
const listaDe = costo => costo / (1 + IVA / 100) - CALIBRADO;
const pesos = n => n == null ? '—' : `$${Math.round(n).toLocaleString('es-AR')}`;
const esc = s => String(s ?? '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

/** Familias que SÍ están transcritas, en orden de más específica a más general. */
const FAMILIAS = [
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

/** Familias que el CRM tiene y la lista todavía NO: se nombran para poder
 *  decir "falta cargar la página X" en vez de un "no encontrado" mudo. */
const FALTAN_EN_LISTA = [
    [/eyezen\s*kids/i, 'Eyezen Kids', 12],
    [/eyezen/i, 'Eyezen', 11],
    [/myopilux/i, 'Myopilux', 13],
    [/stellest/i, 'Stellest (control de miopía)', 13],
    [/espace\s*plus/i, 'Espace Plus Digital', 18],
    [/interview/i, 'Essilor Interview', 18],
    [/new\s*editions?/i, 'Essilor New Editions (packs 2x1)', null],
];

const MATERIALES = [
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

const primero = (tabla, texto) => tabla.find(([re]) => re.test(texto));

function tratamientoDe(nombre, precios) {
    const cual = /prevencia/i.test(nombre) ? 'CRIZAL PREVENCIA'
        : /sapphire|saphire/i.test(nombre) ? 'CRIZAL SAPPHIRE'
            : /tr[íi]o|easy\s*clean/i.test(nombre) ? 'TRIO EASY CLEAN'
                : /sin\s*ar|no\s*reflex/i.test(nombre) ? 'SIN AR'
                    : /crizal|rock/i.test(nombre) ? 'CRIZAL FORTE UV'
                        : null;
    if (cual && precios[cual] != null) return { trat: cual, seguro: true };
    if (cual) return { trat: cual, seguro: false, noOfrecido: true };
    return { trat: 'CRIZAL FORTE UV', seguro: false };
}

/**
 * Segunda pasada: los MONOFOCALES de la página 20. No son diseños progresivos,
 * así que no están en `disenos` y la primera pasada los daba por desconocidos.
 * Acá la diferencia clave es que sus precios vienen SIN antirreflejo: si el
 * nombre dice "Con Crizal X" hay que sumarle el tratamiento, y si dice "Sin
 * Crizal" o "SIN AR" el precio es el pelado.
 */
const FAMILIAS_MONO = [
    [/xtractive/i, 'Transitions XTRActive'],
    [/acclimates/i, 'Acclimates'],
    [/transitions/i, 'Transitions Gen S'],
    [/xperio/i, 'Xperio'],
    [/filter\s*system|blue\s*uv/i, 'BlueUV Filter System'],
    [/stock/i, 'Monofocal de stock'],
];

function emparejarMonofocal(nombre) {
    const m = datos.monofocales;
    if (!m) return null;
    const fam = primero(FAMILIAS_MONO, nombre);
    // Sin familia reconocida, el genérico "otros monofocales" se tragaba
    // CUALQUIER producto que dijera Orma/Airwear/Stylis — Eyezen y Myopilux
    // incluidos, que son diseños propios con otro precio. Solo se acepta el
    // genérico si el nombre dice que es un monofocal.
    if (!fam && !/monofocal/i.test(nombre)) return null;
    const familia = fam ? fam[1] : 'Otros monofocales de laboratorio';
    const g = m.grupos.find(x => x.familia === familia);
    if (!g) return null;

    // Material. En la página 20 hay filas de ORMA repetidas que se distinguen
    // por el rango (stock / tallado / colores); el nombre del producto usa esas
    // mismas palabras, así que se aprovechan para elegir la fila correcta.
    const mat = /stylis/i.test(nombre) ? 'STYLIS 1.67'
        : /airwear/i.test(nombre) ? 'AIRWEAR 1.59'
            : /orma/i.test(nombre) ? 'ORMA' : null;
    if (!mat) return null;
    let candidatas = g.filas.filter(f => f.material === mat || f.material === `${mat} (colores)`);
    if (candidatas.length > 1) {
        if (/\(stock\)|de\s*stock/i.test(nombre)) candidatas = candidatas.filter(f => /stock/i.test(f.rango || ''));
        else if (/colores/i.test(nombre)) candidatas = candidatas.filter(f => /colores/i.test(f.material));
        else candidatas = candidatas.filter(f => !/stock/i.test(f.rango || '') && !/colores/i.test(f.material));
    }
    const fila = candidatas[0];
    if (!fila) return null;

    const trat = /prevencia/i.test(nombre) ? 'CRIZAL PREVENCIA'
        : /sapphire|saphire/i.test(nombre) ? 'CRIZAL SAPPHIRE'
            : /tr[íi]o|easy\s*clean/i.test(nombre) ? 'TRIO EASY CLEAN'
                : /sin\s*crizal|sin\s*ar/i.test(nombre) ? null
                    : /crizal/i.test(nombre) ? 'CRIZAL FORTE UV' : null;
    const extra = trat ? (m.tratamientos_sueltos.find(t => t.nombre.replace(' UV', '') === trat.replace(' UV', '')
        || t.nombre === trat)?.precio ?? 0) : 0;

    return {
        familia, material: fila.material,
        tratamiento: trat ? `${trat} (sumado aparte)` : 'sin antirreflejo',
        lista: fila.precio + extra,
        seguro: true,
    };
}

async function main() {
    const productos = await prisma.$queryRaw`
        select id, name, price, cost, is2x1
        from "Product"
        where category = 'Cristal' and laboratory = 'OPTOVISION'
        order by name`;

    const ok = [], porNombre = [], sinLista = [];
    for (const p of productos) {
        const nombre = String(p.name || '');
        const fam = primero(FAMILIAS, nombre);
        if (!fam) {
            // Las familias que sabemos que faltan (Eyezen, Myopilux, Stellest…)
            // se reconocen ANTES de probar el monofocal: son diseños propios
            // con su propio precio, y dejarlas pasar al genérico les cargaría
            // el costo de un monofocal común.
            const faltaConocida = primero(FALTAN_EN_LISTA, nombre);
            const mono = faltaConocida ? null : emparejarMonofocal(nombre);
            if (mono) {
                const nuevo = costoDe(mono.lista);
                ok.push({
                    ...p, ...mono, esPromo: false,
                    costoNuevo: nuevo, listaVieja: p.cost > 0 ? listaDe(p.cost) : null,
                    pct: p.cost > 0 ? (nuevo - p.cost) / p.cost * 100 : null,
                });
                continue;
            }
            const falta = faltaConocida;
            sinLista.push({
                ...p,
                familia: falta ? falta[1] : null,
                pagina: falta ? falta[2] : null,
                motivo: falta ? 'La familia todavía no está cargada de la lista' : 'No se reconoce la familia',
            });
            continue;
        }
        const d = datos.disenos.find(x => x.nombre === fam[1]);
        const mat = primero(MATERIALES, nombre);
        const m = mat ? d?.materiales.find(x => x.material === mat[1]) : null;
        if (!m) {
            porNombre.push({ ...p, familia: fam[1], material: mat?.[1] || null, motivo: mat ? `La familia no ofrece "${mat[1]}"` : 'No se reconoce el material' });
            continue;
        }
        const t = tratamientoDe(nombre, m.precios);
        if (t.noOfrecido) {
            porNombre.push({ ...p, familia: fam[1], material: mat[1], motivo: `La familia no ofrece "${t.trat}"` });
            continue;
        }
        const esPromo = /mi\s*primer/i.test(nombre);
        const lista = (m.precios[t.trat] ?? 0) / (esPromo ? 2 : 1);
        const nuevo = costoDe(lista);
        ok.push({
            ...p, familia: fam[1], material: mat[1], tratamiento: t.trat, seguro: t.seguro, esPromo,
            lista, costoNuevo: nuevo, listaVieja: p.cost > 0 ? listaDe(p.cost) : null,
            pct: p.cost > 0 ? (nuevo - p.cost) / p.cost * 100 : null,
        });
    }

    console.log(`\nCRISTALES DE OPTOVISIÓN EN EL SISTEMA: ${productos.length}\n`);
    console.log(`  ✅ emparejados con la lista .......... ${ok.length}`);
    console.log(`  ⚠️  familia sin cargar de la lista ... ${sinLista.length}`);
    console.log(`  ⚠️  no cruzan por el nombre .......... ${porNombre.length}\n`);

    if (sinLista.length) {
        const porFam = new Map();
        for (const s of sinLista) {
            const k = s.familia || '(no reconocida)';
            if (!porFam.has(k)) porFam.set(k, { n: 0, pagina: s.pagina });
            porFam.get(k).n++;
        }
        console.log(`  FAMILIAS QUE FALTAN CARGAR DE LA LISTA:`);
        for (const [k, v] of [...porFam].sort((a, b) => b[1].n - a[1].n)) {
            console.log(`    ${String(v.n).padStart(3)} productos · ${k}${v.pagina ? `  → página ${v.pagina} del PDF` : ''}`);
        }
    }
    if (porNombre.length) {
        console.log(`\n  NO CRUZAN POR EL NOMBRE:`);
        for (const x of porNombre) console.log(`    ${String(x.name).slice(0, 52).padEnd(54)}${x.motivo}`);
    }

    // Los emparejados cuyo tratamiento se asumió: son los que conviene renombrar.
    const asumidos = ok.filter(x => !x.seguro);
    if (asumidos.length) {
        console.log(`\n  EMPAREJADOS PERO CON EL TRATAMIENTO ASUMIDO (${asumidos.length}) — el nombre no lo dice:`);
        for (const x of asumidos.slice(0, 12)) console.log(`    ${String(x.name).slice(0, 56)}`);
        if (asumidos.length > 12) console.log(`    … y ${asumidos.length - 12} más`);
    }

    const th = 'padding:8px 10px;text-align:left;background:#1e293b;color:#fff;font-weight:700';
    const tabla = (titulo, aclara, filas, cols) => !filas.length ? '' : `
        <h2 style="font-size:21px;margin:26px 0 2px">${esc(titulo)} (${filas.length})</h2>
        <p style="margin:0 0 10px;color:#475569">${aclara}</p>
        <div style="overflow-x:auto;border:1px solid #cbd5e1;border-radius:10px">
        <table style="border-collapse:collapse;width:100%;font-size:14.5px">
            <thead><tr>${cols.map(c => `<th style="${th}${c.der ? ';text-align:right' : ''}">${esc(c.t)}</th>`).join('')}</tr></thead>
            <tbody>${filas.map((f, i) => `<tr style="background:${i % 2 ? '#f8fafc' : '#fff'}">
                ${cols.map(c => `<td style="padding:8px 10px${c.der ? ';text-align:right;white-space:nowrap' : ''}">${c.v(f)}</td>`).join('')}
            </tr>`).join('')}</tbody>
        </table></div>`;

    const html = `<meta charset="utf-8"><title>Costos Optovisión: qué cruza y qué no</title>
<body style="font-family:system-ui,sans-serif;font-size:16px;color:#0f172a;background:#fff;margin:0;padding:28px;max-width:1250px">
<h1 style="font-size:28px;margin:0 0 6px">Costos de Optovisión: qué cruza con la lista y qué no</h1>
<p style="margin:0 0 16px;color:#334155">
  ${productos.length} cristales en el sistema ·
  <strong style="color:#15803d">${ok.length} emparejados</strong> ·
  <strong style="color:#b45309">${sinLista.length} sin lista</strong> ·
  <strong style="color:#b91c1c">${porNombre.length} por el nombre</strong>
</p>
${tabla('Emparejados', 'El costo nuevo sale de la lista del laboratorio + calibrado + IVA. Los marcados en ámbar tienen el tratamiento <strong>asumido</strong> porque el nombre no lo dice: conviene renombrarlos.', ok, [
        { t: 'Producto', v: f => `${f.seguro ? '' : '<span title="tratamiento asumido" style="color:#b45309">▲ </span>'}${esc(String(f.name).slice(0, 44))}` },
        { t: 'Renglón de la lista', v: f => `<span style="color:#475569;font-size:13px">${esc(f.familia)}<br>${esc(f.material)} · ${esc(f.tratamiento)}${f.esPromo ? ' · media lista (promo)' : ''}</span>` },
        { t: 'Costo hoy', der: true, v: f => pesos(f.cost) },
        { t: 'Costo según lista', der: true, v: f => `<strong>${pesos(f.costoNuevo)}</strong>` },
        { t: 'Dif.', der: true, v: f => f.pct == null ? '—' : `<strong style="color:${f.pct > 0 ? '#b91c1c' : '#15803d'}">${f.pct > 0 ? '+' : ''}${f.pct.toFixed(1)}%</strong>` },
    ])}
${tabla('Familias que faltan cargar de la lista', 'Estos productos existen en el sistema pero su familia todavía no se transcribió del PDF. Se arregla cargando esas páginas, no tocando el producto.', sinLista, [
        { t: 'Producto', v: f => esc(String(f.name).slice(0, 54)) },
        { t: 'Familia', v: f => esc(f.familia || '—') },
        { t: 'Dónde está en el PDF', v: f => f.pagina ? `página ${f.pagina}` : '<span style="color:#b91c1c">no figura en la lista</span>' },
        { t: 'Costo hoy', der: true, v: f => pesos(f.cost) },
    ])}
${tabla('No cruzan por el nombre', 'La familia está cargada, pero el nombre del producto no permite reconocer el material o el tratamiento. Se arregla renombrando el producto.', porNombre, [
        { t: 'Producto', v: f => esc(String(f.name).slice(0, 54)) },
        { t: 'Familia', v: f => esc(f.familia || '—') },
        { t: 'Qué pasa', v: f => esc(f.motivo) },
        { t: 'Costo hoy', der: true, v: f => pesos(f.cost) },
    ])}
</body>`;
    writeFileSync(salida, html);
    console.log(`\nInforme escrito en ${salida}`);
}

main()
    .catch(err => { console.error(err); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
