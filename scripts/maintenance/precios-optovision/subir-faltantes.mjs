/**
 * SUBE AL SISTEMA todos los cristales de la lista de Optovisión que todavía no
 * están, con la ficha completa: tipo, marca, modelo, índice, unidad, confección,
 * rangos de esfera / cilindro / adición, costo pelado, costo final y precio.
 *
 * POR QUÉ (Ishtar, 31/8/2026): "revisá subir todos los cristales completos con
 * todo lo que el sistema solicita, no dejes ninguno sin subir" · "lo que no
 * exista en sistema, 2.5".
 *
 * De 201 renglones de la lista, 125 ya estaban cargados y 76 no. Un renglón que
 * no está en el sistema es un cristal que el vendedor NO puede cotizar: existe
 * en el laboratorio, se puede pedir, pero no aparece en el cotizador.
 *
 * CÓMO SE COSTEA. Igual que todo el resto, con el mismo emparejador:
 *   · Diseños (Varilux / Kodak / Eyezen…): columna del Crizal MÁS CARO, salvo
 *     que el renglón no tenga Crizal.
 *   · Monofocales de la pág. 20: pelado + el mejor Crizal, salvo los de stock.
 *   · Sygnus: precio sin AR + Numax ($72.240), que es su antirreflejo.
 *   · Y sobre eso, calibrado $23.000 e IVA 21%.
 * El precio nace en ×2,5 —el piso de la casa— y después se ajusta como cualquier
 * otro desde markup-por-familia o la pantalla de aumentos.
 *
 * NO SE SUBE Varilux XR pro: decisión de Ishtar del 26/8/2026, "no se vende y no
 * se va a vender". Está anotado en el JSON de la lista.
 *
 * Por defecto va contra la base LOCAL y NO escribe.
 *   node scripts/maintenance/precios-optovision/subir-faltantes.mjs
 *   node scripts/maintenance/precios-optovision/subir-faltantes.mjs --aplicar
 *   node scripts/maintenance/precios-optovision/subir-faltantes.mjs --produccion --aplicar
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { datos, costoDe, emparejar } from './emparejador.mjs';

config();

const APLICAR = process.argv.includes('--aplicar');
const PRODUCCION = process.argv.includes('--produccion');
const PISO = 2.5;
const FIRMA = 'Ishtar (alta de cristales que faltaban de la lista)';

const url = PRODUCCION ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
if (!url) { console.error(`Falta ${PRODUCCION ? 'PROD_DATABASE_URL' : 'DATABASE_URL'} en el .env`); process.exit(1); }
if (!PRODUCCION && !/localhost|127\.0\.0\.1/.test(url)) {
    console.error('❌ DATABASE_URL no apunta a localhost. Para tocar producción hace falta --produccion.');
    process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url } } });
const pesos = n => `$${Math.round(n).toLocaleString('es-AR')}`;
const PREVENCIA = datos.monofocales.tratamientos_sueltos.find(t => /PREVENCIA/i.test(t.nombre)).precio;

/**
 * Cómo se llama y se ficha cada familia de la lista. Explícito: el nombre que
 * se genera acá tiene que ser el que después reconoce el emparejador, o el
 * producto queda huérfano en el próximo cambio de lista.
 */
const FAMILIAS = {
    'Varilux XR pro': null,   // decisión de Ishtar: no se vende
    'Varilux XR design': { prefijo: 'XR DESIGN', tipo: 'Cristal Multifocal', marca: 'Varilux', dosXuno: true },
    'Varilux Physio 3.0': { prefijo: 'PHYSIO 3.0', tipo: 'Cristal Multifocal', marca: 'Varilux', dosXuno: true },
    'Varilux Comfort Max': { prefijo: 'COMFORT MAX', tipo: 'Cristal Multifocal', marca: 'Varilux', dosXuno: true },
    'Varilux Liberty 3.0': { prefijo: 'LIBERTY 3.0', tipo: 'Cristal Multifocal', marca: 'Varilux' },
    'Varilux Digitime': { prefijo: 'DIGITIME', tipo: 'Cristal Ocupacional', marca: 'Varilux', adicion: [0.75, 3.5] },
    'Varilux Physio': { prefijo: 'PHYSIO', tipo: 'Cristal Multifocal', marca: 'Varilux', dosXuno: true },
    'Varilux Comfort': { prefijo: 'COMFORT', tipo: 'Cristal Multifocal', marca: 'Varilux', dosXuno: true },
    'Kodak Unique DRO': { prefijo: 'KODAK UNIQUE DRO', tipo: 'Cristal Multifocal', marca: 'Kodak', dosXuno: true },
    'Kodak Precise Next': { prefijo: 'KODAK PRECISE', tipo: 'Cristal Multifocal', marca: 'Kodak', dosXuno: true },
    'Kodak Softwear': { prefijo: 'KODAK SOFTWEAR', tipo: 'Cristal Multifocal', marca: 'Kodak' },
    'Kodak SV Digital': { prefijo: 'KODAK SV DIGITAL', tipo: 'Cristal Monofocal', marca: 'Kodak' },
    'Eyezen Boost': { prefijo: 'EYEZEN BOOST', tipo: 'Cristal Monofocal', marca: 'Essilor', dosXuno: true },
    'Eyezen Start': { prefijo: 'EYEZEN START', tipo: 'Cristal Monofocal', marca: 'Essilor', dosXuno: true },
    'Eyezen Kids': { prefijo: 'EYEZEN KIDS', tipo: 'Cristal Monofocal', marca: 'Essilor', dosXuno: true },
    'Myopilux Kids Lite': { prefijo: 'MYOPILUX KIDS LITE (Control miopico)', tipo: 'Cristal Control Miopico', marca: 'Essilor', adicion: [1.5, 2] },
    'Myopilux Kids Plus': { prefijo: 'MYOPILUX KIDS PLUS (Control miopico)', tipo: 'Cristal Control Miopico', marca: 'Essilor', adicion: [1.5, 2] },
    'Essilor Interview': { prefijo: 'INTERVIEW', tipo: 'Cristal Ocupacional', marca: 'Essilor', adicion: [0.8, 1.3] },
    'Espace Plus Digital': { prefijo: 'ESPACE PLUS DIGITAL', tipo: 'Cristal Ocupacional', marca: 'Essilor' },
};

/** Los monofocales de la pág. 20 que faltan. */
const MONO = {
    'Otros monofocales de laboratorio': { prefijo: 'Monofocal de laboratorio', tipo: 'Cristal Monofocal', marca: 'Essilor' },
    'Monofocal de stock': { prefijo: 'Monofocal de stock', tipo: 'Cristal Monofocal', marca: 'Essilor', stock: true },
};

/** Las líneas Sygnus que no son NEW EDITION. */
const SYGNUS = {
    'Sygnus NEW EDITION': { prefijo: 'ESSILOR NEW EDITIONS', tipo: 'Cristal Multifocal', dosXuno: true, adicion: [0.75, 3.5] },
    'Sygnus Monofocal Digital ONE': { prefijo: 'SYGNUS MONOFOCAL ONE', tipo: 'Cristal Monofocal' },
    'Sygnus Bifocal': { prefijo: 'SYGNUS BIFOCAL', tipo: 'Cristal Bifocal', adicion: [0.75, 4] },
    'Sygnus Driver': { prefijo: 'SYGNUS DRIVER', tipo: 'Cristal Monofocal' },
};

const INDICES = [[/1\.74|alto\s*[íi]ndice/i, '1.74'], [/1\.67|stylis/i, '1.67'],
[/1\.59|airwear|policarbonato/i, '1.59'], [/1\.56|fotosensible\s*blc/i, '1.56'], [/1\.50|orma|org[áa]nico/i, '1.50']];
const indiceDe = t => INDICES.find(([re]) => re.test(t))?.[1] ?? null;

function parsearRango(t) {
    if (!t) return {};
    const m = String(t).match(/([+-]?\d+(?:\.\d+)?)\s*[aA]\s*([+-]?\d+(?:\.\d+)?)/);
    const c = String(t).match(/cil\w*\s*[+-]?(\d+(?:\.\d+)?)/i);
    if (!m) return {};
    return { sphereMin: Math.min(+m[1], +m[2]), sphereMax: Math.max(+m[1], +m[2]),
        cylinderMin: c ? -Math.abs(+c[1]) : null, cylinderMax: c ? Math.abs(+c[1]) : null };
}

/** El Crizal más caro de un renglón de diseño (política del 26/8/2026). */
function mejorCrizal(precios) {
    const cs = Object.entries(precios).filter(([k, v]) => k.startsWith('CRIZAL') && v > 0);
    if (!cs.length) return null;
    return cs.sort((a, b) => b[1] - a[1])[0];
}

async function main() {
    console.log(`Base: ${PRODUCCION ? '⚠️  PRODUCCIÓN' : 'LOCAL'} · modo: ${APLICAR ? 'APLICAR (escribe)' : 'ENSAYO (no escribe)'}\n`);

    // QUÉ RENGLÓN YA ESTÁ CUBIERTO. No se puede preguntar por el nombre: el
    // catálogo llama "KODAK UNIQUE DRO - ORMA 2x1" a lo que este script
    // nombraría "KODAK UNIQUE DRO - ORMA + CRIZAL 2x1", y comparar textos daría
    // 139 altas cuando faltan 76 — o sea, 63 duplicados.
    // La pregunta correcta es qué RENGLÓN de la lista cubre cada producto, y eso
    // lo sabe el emparejador. Se compara familia + material, que es la identidad
    // real del cristal.
    const existentes = await prisma.$queryRaw`
        select id, name, price, cost, "baseCost", is2x1 from "Product"
        where category = 'Cristal' and laboratory = 'OPTOVISION'`;
    const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const { ok: yaEmparejados } = emparejar(existentes);
    const cubierto = new Set(yaEmparejados.map(p => `${norm(p.familia)}|${norm(p.material)}`));
    const yaEsta = new Set(existentes.map(x => norm(x.name)));
    /** ¿Ese renglón de la lista ya lo cubre algún producto? */
    const cubre = (familia, material) => cubierto.has(`${norm(familia)}|${norm(material)}`);

    const nuevos = [], saltados = [];

    // ── Diseños (Varilux, Kodak, Eyezen, Myopilux, Interview, Espace) ────────
    for (const d of datos.disenos) {
        const cfg = FAMILIAS[d.nombre];
        if (cfg === null) { saltados.push(`${d.nombre}: decisión de Ishtar, no se vende`); continue; }
        if (!cfg) { saltados.push(`${d.nombre}: sin configurar en este script`); continue; }
        for (const m of d.materiales) {
            const crizal = mejorCrizal(m.precios);
            if (!crizal) { saltados.push(`${d.nombre} · ${m.material}: el renglón no tiene Crizal`); continue; }
            if (cubre(d.nombre, m.material)) continue;
            const nombre = `${cfg.prefijo} - ${m.material}${cfg.dosXuno ? ' + CRIZAL 2x1' : ' + CRIZAL'}`;
            if (yaEsta.has(norm(nombre))) continue;
            nuevos.push({
                nombre, tipo: cfg.tipo, marca: cfg.marca, modelo: cfg.prefijo,
                indice: indiceDe(m.material), lista: crizal[1], ...parsearRango(m.rango),
                adicionMin: cfg.adicion?.[0] ?? null, adicionMax: cfg.adicion?.[1] ?? null,
                dosXuno: !!cfg.dosXuno, origen: 'LABORATORIO', de: `${d.nombre} · ${m.material} · ${crizal[0]}`,
            });
        }
    }

    // ── Monofocales de la pág. 20 ────────────────────────────────────────────
    for (const g of datos.monofocales.grupos) {
        const cfg = MONO[g.familia];
        if (!cfg) continue;
        for (const f of g.filas) {
            const extra = cfg.stock ? 0 : PREVENCIA;
            const suf = cfg.stock ? '' : ' — CON CRIZAL PREVENCIA';
            if (cubre(g.familia, f.material)) continue;
            const nombre = `${cfg.prefijo} ${f.material}${suf}`;
            if (yaEsta.has(norm(nombre))) continue;
            nuevos.push({
                nombre, tipo: cfg.tipo, marca: cfg.marca, modelo: cfg.prefijo,
                indice: indiceDe(f.material), lista: f.precio + extra, ...parsearRango(f.rango),
                adicionMin: null, adicionMax: null, dosXuno: false,
                origen: cfg.stock ? 'STOCK' : 'LABORATORIO', de: `pág. 20 · ${g.familia} · ${f.material}`,
            });
        }
    }

    // ── Sygnus (todas las líneas; el Numax es su antirreflejo) ───────────────
    const numax = datos.sygnus.numax;
    for (const fam of datos.sygnus.familias) {
        const cfg = SYGNUS[fam.familia];
        if (!cfg) { saltados.push(`${fam.familia}: sin configurar`); continue; }
        for (const f of fam.filas) {
            if (cubre(fam.familia, `${f.material} + AR Numax`)) continue;
            const nombre = `${cfg.prefijo} - ${f.material} + AR Numax${cfg.dosXuno ? ' 2x1' : ''}`;
            if (yaEsta.has(norm(nombre))) continue;
            nuevos.push({
                nombre, tipo: cfg.tipo, marca: 'Sygnus', modelo: cfg.prefijo,
                indice: f.indice ?? indiceDe(f.material), lista: f.precio + numax, ...parsearRango(f.rangos ?? f.rango),
                adicionMin: cfg.adicion?.[0] ?? null, adicionMax: cfg.adicion?.[1] ?? null,
                dosXuno: !!cfg.dosXuno, origen: 'LABORATORIO', de: `Sygnus · ${fam.familia} · ${f.material} + Numax`,
            });
        }
    }

    for (const n of nuevos) { n.costo = costoDe(n.lista); n.precio = Math.ceil(n.costo * PISO); }

    console.log(`${nuevos.length} cristales para dar de alta (precio a ×${PISO})\n`);
    const porModelo = {};
    for (const n of nuevos) (porModelo[n.modelo] ??= []).push(n);
    for (const [mod, lista] of Object.entries(porModelo)) {
        console.log(`━━ ${mod} (${lista.length})`);
        for (const n of lista) {
            console.log(`   ${String(n.nombre).slice(0, 54).padEnd(56)}pelado ${pesos(n.lista).padStart(10)} → costo ${pesos(n.costo).padStart(10)} → ${pesos(n.precio)}`);
        }
        console.log('');
    }
    if (saltados.length) { console.log('  No se suben:'); saltados.forEach(s => console.log(`     · ${s}`)); }

    if (!APLICAR) { console.log('\nEnsayo: no se escribió nada. Para aplicarlo: --aplicar'); return; }

    for (const n of nuevos) {
        const [{ id }] = await prisma.$queryRaw`select gen_random_uuid()::text as id`;
        await prisma.$executeRaw`
            insert into "Product" (id, name, category, laboratory, origin, type, brand, model, "lensIndex", "unitType",
                price, cost, "baseCost", is2x1, "sphereMin", "sphereMax", "cylinderMin", "cylinderMax",
                "additionMin", "additionMax", "createdAt", "updatedAt")
            values (${id}, ${n.nombre}, 'Cristal', 'OPTOVISION', ${n.origen}, ${n.tipo}, ${n.marca}, ${n.modelo},
                ${n.indice}, 'PAR', ${n.precio}, ${n.costo}, ${Math.round(n.lista)}, ${n.dosXuno},
                ${n.sphereMin ?? null}, ${n.sphereMax ?? null}, ${n.cylinderMin ?? null}, ${n.cylinderMax ?? null},
                ${n.adicionMin}, ${n.adicionMax}, now(), now())`;
        await prisma.$executeRaw`
            insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
            values (gen_random_uuid()::text, ${FIRMA}, 'UPDATE', 'PRODUCT', ${id},
                ${JSON.stringify({ creado: n.nombre, segunLaLista: n.de, pelado: Math.round(n.lista), costo: n.costo, precio: n.precio })}::jsonb, now())`;
    }
    console.log(`\n✅ ${nuevos.length} cristal(es) dados de alta con la ficha completa.`);
}

main()
    .catch(err => { console.error(err); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
