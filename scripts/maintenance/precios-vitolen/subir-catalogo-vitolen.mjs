/**
 * Alta del catálogo del laboratorio VITOLEN (Hoya + Pentax), lista L96 de 09/2026.
 *
 * Costo de cada cristal: (pelado de la lista + calibrado) × (1 + IVA), con el
 * calibrado y el IVA leídos de LaboratoryConfig 'VITOLEN' en la base de destino
 * (Configuración → Laboratorios). Sin esa fila, o con la fila en 0/0, no carga.
 * Precio: costo × 2,50, el markup de los Varilux (decisión de Ishtar, 29/9/2026).
 *
 * Solo da de alta: lo que ya existe (mismo nombre, laboratorio VITOLEN) no se
 * toca. Los renglones marcados `aConfirmar` en la lista no se cargan.
 * Ningún cristal sale con 2x1: eso se decide aparte.
 *
 *   node scripts/maintenance/precios-vitolen/subir-catalogo-vitolen.mjs                 # ensayo, base LOCAL
 *   node scripts/maintenance/precios-vitolen/subir-catalogo-vitolen.mjs --csv=salida.csv
 *   node scripts/maintenance/precios-vitolen/subir-catalogo-vitolen.mjs --aplicar       # escribe en LOCAL
 *   node scripts/maintenance/precios-vitolen/subir-catalogo-vitolen.mjs --produccion --aplicar
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const LISTA = path.join(AQUI, 'hoya-pentax-L96-sep-2026.json');
const LABORATORIO = 'VITOLEN';
const MARKUP = 2.5;
const FIRMA = 'Ishtar (alta del laboratorio Vitolen, lista L96)';

const $ = n => '$' + Math.round(n).toLocaleString('es-AR');

export function leerLista() {
    return JSON.parse(readFileSync(LISTA, 'utf8'));
}

/** Arma las fichas a partir de la lista. No toca la base. */
export function armarFichas(lista, lab, markup = MARKUP) {
    const porClave = new Map(lista.lineas.map(l => [l.clave, l]));
    const fichas = [], pendientes = [];
    for (const linea of lista.lineas) {
        const base = linea.rangoHeredadoDe ? porClave.get(linea.rangoHeredadoDe) : null;
        for (const r of linea.renglones) {
            const prefijo = linea.prefijoNombre || `HOYA ${linea.modelo.toUpperCase()}`;
            const name = `${prefijo} - ${r.material.toUpperCase()}${linea.sufijoNombre ? ` ${linea.sufijoNombre}` : ''}`;
            if (r.aConfirmar) { pendientes.push({ name, precio: r.precio, motivo: r.aConfirmar }); continue; }
            const rango = r.esf ? r : base?.renglones.find(b => b.material === r.material);
            const costo = Math.round((r.precio + lab.calibrado) * (1 + lab.iva / 100));
            fichas.push({
                name,
                linea: linea.clave,
                brand: linea.marca,
                model: `${linea.modelo}${linea.variantes ? ` (${linea.variantes})` : ''} - ${r.material}`,
                type: linea.tipo,
                origin: linea.origen,
                lensIndex: r.material.slice(0, 4),
                pelado: r.precio,
                costo,
                precio: Math.ceil(costo * markup),
                esf: rango?.esf ?? null,
                cil: rango?.cil ?? null,
                add: linea.adicion ?? null,
                codigos: r.codigos ?? null,
                pagina: linea.pagina,
            });
        }
    }
    return { fichas, pendientes };
}

async function main() {
    config();
    const APLICAR = process.argv.includes('--aplicar');
    const PRODUCCION = process.argv.includes('--produccion');
    const csv = process.argv.find(a => a.startsWith('--csv='))?.slice(6);

    const url = PRODUCCION ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
    if (!url) { console.error('Falta la URL de la base en el .env'); process.exitCode = 1; return; }
    if (!PRODUCCION && !/localhost|127\.0\.0\.1/.test(url)) {
        console.error('❌ DATABASE_URL no apunta a localhost. Para producción hace falta --produccion.');
        process.exitCode = 1; return;
    }
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    try {
        console.log(`Base: ${PRODUCCION ? '⚠️  PRODUCCIÓN' : 'LOCAL'} · modo: ${APLICAR ? 'APLICAR (escribe)' : 'ENSAYO'}`);

        const labs = await prisma.$queryRaw`
            select name, calibrado, iva from "LaboratoryConfig" where upper(name) = ${LABORATORIO}`;
        const lab = labs[0];
        if (!lab || (!lab.calibrado && !lab.iva)) {
            console.error(`❌ No hay calibrado ni IVA cargados para ${LABORATORIO} en esta base.`);
            console.error('   Darlo de alta en Configuración → Laboratorios y volver a correr.');
            process.exitCode = 1; return;
        }
        const lista = leerLista();
        console.log(`Lista ${lista.lista} · calibrado ${$(lab.calibrado)} · IVA ${lab.iva}% · markup ×${MARKUP}\n`);

        const { fichas, pendientes } = armarFichas(lista, lab);
        const repetidos = fichas.map(f => f.name).filter((n, i, a) => a.indexOf(n) !== i);
        if (repetidos.length) {
            console.error('❌ Nombres repetidos en la lista:', repetidos.join(' | '));
            process.exitCode = 1; return;
        }

        const yaEstan = await prisma.$queryRaw`
            select id, name, "baseCost" from "Product" where upper(laboratory) = ${LABORATORIO}`;
        const existentes = new Map(yaEstan.map(p => [String(p.name).trim().toUpperCase(), p]));
        const altas = fichas.filter(f => !existentes.has(f.name.toUpperCase()));
        const distintos = fichas.filter(f => {
            const e = existentes.get(f.name.toUpperCase());
            return e && Math.round(e.baseCost ?? -1) !== f.pelado;
        });

        for (const clave of [...new Set(fichas.map(f => f.linea))]) {
            const g = fichas.filter(f => f.linea === clave);
            console.log(`━━ ${clave} · ${g[0].type} · ${g.length} cristales`);
            for (const f of g) {
                const marca = existentes.has(f.name.toUpperCase()) ? ' (ya está)' : '';
                console.log(`   ${f.name.padEnd(62)} lista ${$(f.pelado).padStart(9)} → costo ${$(f.costo).padStart(9)} → precio ${$(f.precio).padStart(11)}${marca}`);
            }
        }
        console.log(`\nEn la lista: ${fichas.length} · ya cargados: ${fichas.length - altas.length} · altas: ${altas.length}`);
        if (pendientes.length) {
            console.log(`\nSIN CARGAR, a confirmar con el laboratorio (${pendientes.length}):`);
            for (const p of pendientes) console.log(`   ${p.name} (${$(p.precio)}): ${p.motivo}`);
        }
        if (distintos.length) {
            console.log(`\n⚠️  Ya cargados con otro pelado (${distintos.length}), no se tocan:`);
            for (const f of distintos) console.log(`   ${f.name}`);
        }

        if (csv) {
            const filas = [['linea', 'nombre', 'tipo', 'indice', 'lista_sin_iva', 'costo_final', 'precio', 'esf_min', 'esf_max', 'cil', 'add_min', 'add_max', 'codigos', 'pagina_pdf']];
            for (const f of fichas) filas.push([f.linea, f.name, f.type, f.lensIndex, f.pelado, f.costo, f.precio,
                f.esf?.[0] ?? '', f.esf?.[1] ?? '', f.cil ?? '', f.add?.[0] ?? '', f.add?.[1] ?? '', f.codigos ?? '', f.pagina]);
            writeFileSync(csv, filas.map(r => r.map(c => `"${String(c).replaceAll('"', '""')}"`).join(';')).join('\n') + '\n');
            console.log(`\nListado guardado en ${csv}`);
        }

        if (!APLICAR) { console.log('\nEnsayo: no se escribió nada. Para aplicarlo: --aplicar'); return; }

        for (const a of altas) {
            const id = randomUUID();
            await prisma.$executeRaw`
                insert into "Product" (id, name, category, laboratory, type, brand, model, "lensIndex", "unitType",
                    origin, price, cost, "baseCost", is2x1, "sphereMin", "sphereMax", "cylinderMin", "cylinderMax",
                    "additionMin", "additionMax", "imagenesCatalogo", "publishToWeb", "createdAt", "updatedAt")
                values (${id}, ${a.name}, 'Cristal', ${LABORATORIO}, ${a.type}, ${a.brand}, ${a.model},
                    ${a.lensIndex}, 'PAR', ${a.origin}, ${a.precio}, ${a.costo}, ${a.pelado}, false,
                    ${a.esf?.[0] ?? null}, ${a.esf?.[1] ?? null}, ${a.cil != null ? -a.cil : null}, ${a.cil ?? null},
                    ${a.add?.[0] ?? null}, ${a.add?.[1] ?? null}, '{}', false, now(), now())`;
            await prisma.$executeRaw`
                insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
                values (gen_random_uuid()::text, ${FIRMA}, 'CREATE', 'PRODUCT', ${id},
                    ${JSON.stringify({ producto: a.name, lista: lista.lista, pagina: a.pagina, pelado: a.pelado,
                        calibrado: lab.calibrado, iva: lab.iva, costo: a.costo, markup: MARKUP, precio: a.precio,
                        codigos: a.codigos })}::jsonb, now())`;
        }
        console.log(`\n✅ ${altas.length} cristal(es) dados de alta en ${LABORATORIO}.`);
    } finally { await prisma.$disconnect(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch(err => { console.error(err); process.exitCode = 1; });
}
