/**
 * AUDITA los monofocales de laboratorio de GRUPO ÓPTICO contra su lista.
 *
 * Pedido de Ishtar (9/9/2026), mirando la hoja "MONOFOCAL LABORATORIO" de la
 * lista de agosto: "el primer cuadro que son 8 todos en CNC y otros menos en
 * tallado digital · están todos? · auditá todo y corroborá; si no están, los
 * subimos".
 *
 * QUÉ HACE: para cada fila de la lista y cada método de tallado —CNC y DIGITAL
 * (free-form, la columna ULTRA)— busca el producto que le corresponde y dice si
 * está, si falta, y si el costo cargado coincide con la fórmula de Grupo Óptico:
 *
 *     costo = pelado de lista + $7.272 de calibrado          (NO lleva IVA)
 *
 * Hay filas SIN precio en la columna ULTRA (el Diám. 75 y el Lenticular): esas
 * no existen en digital y no se cuentan como faltantes.
 *
 * IDENTIDAD: el `baseCost` (el pelado) + el índice. El nombre no sirve como
 * llave —se renombró varias veces— pero el pelado sale de un renglón único de
 * la lista.
 *
 * SOLO LEE. No escribe una sola fila.
 *   node scripts/checks/auditoria-monofocales-go.mjs              # base local
 *   node scripts/checks/auditoria-monofocales-go.mjs --produccion
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

config();

const PRODUCCION = process.argv.includes('--produccion');
const CALIBRADO_GO = 7272;

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const LISTA = JSON.parse(readFileSync(
    path.join(AQUI, '..', 'maintenance', 'precios-grupo-optico', 'grupo-optico-agosto-2026.json'), 'utf8'));

const pesos = n => n == null ? '—' : `$${Math.round(n).toLocaleString('es-AR')}`;

async function main() {
    const url = PRODUCCION ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
    if (!url) { console.error('Falta la URL de la base en el .env'); process.exitCode = 1; return; }
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    try {
        console.log(`Base: ${PRODUCCION ? '⚠️  PRODUCCIÓN' : 'LOCAL'} · SOLO LECTURA\n`);

        const productos = await prisma.$queryRaw`
            select id, name, price, cost, "baseCost", "lensIndex", origin, is2x1,
                   "sphereMin", "sphereMax", "cylinderMin", "cylinderMax"
            from "Product"
            where category = 'Cristal' and laboratory = 'GRUPO OPTICO' and "baseCost" is not null
            order by name`;

        // Índice por pelado + índice de refracción: el renglón de la lista es único.
        const porPelado = new Map();
        for (const p of productos) {
            const k = `${Math.round(Number(p.baseCost))}|${p.lensIndex ?? ''}`;
            (porPelado.get(k) ?? porPelado.set(k, []).get(k)).push(p);
        }

        const filas = LISTA.monofocal_laboratorio.filas;
        const esperados = [];
        for (const f of filas) {
            for (const [metodo, pelado] of [['TALLADO CNC', f.cnc], ['TALLADO DIGITAL', f.ultra]]) {
                if (pelado == null) continue;   // no existe en ese método
                esperados.push({ ...f, metodo, pelado });
            }
        }

        const faltan = [], costoMal = [], ok = [];
        for (const e of esperados) {
            const cands = porPelado.get(`${e.pelado}|${e.indice}`) ?? [];
            if (!cands.length) { faltan.push(e); continue; }
            const costoEsperado = e.pelado + CALIBRADO_GO;
            for (const p of cands) {
                if (Math.round(Number(p.cost) || 0) !== costoEsperado) costoMal.push({ ...e, p, costoEsperado });
                else ok.push({ ...e, p });
            }
        }

        console.log(`Lista: ${filas.length} renglones → ${esperados.length} productos esperados`);
        console.log(`  (${esperados.filter(e => e.metodo === 'TALLADO CNC').length} en CNC · ${esperados.filter(e => e.metodo === 'TALLADO DIGITAL').length} en digital)`);
        console.log(`En sistema: ${ok.length} con el costo correcto · ${costoMal.length} con el costo distinto · ${faltan.length} SIN CARGAR\n`);

        if (faltan.length) {
            console.log(`❌ FALTAN ${faltan.length}:`);
            console.log(`   ${'Método'.padEnd(17)}${'Índice'.padEnd(8)}${'Producto'.padEnd(52)}${'pelado'.padStart(11)}${'costo'.padStart(11)}`);
            for (const e of faltan) {
                const ar = e.ar ? ` · ${e.ar}` : '';
                console.log(`   ${e.metodo.padEnd(17)}${String(e.indice).padEnd(8)}${(e.producto + ar).slice(0, 50).padEnd(52)}` +
                    `${pesos(e.pelado).padStart(11)}${pesos(e.pelado + CALIBRADO_GO).padStart(11)}`);
            }
            console.log();
        }
        if (costoMal.length) {
            console.log(`⚠️  ${costoMal.length} con el costo distinto al de la lista:`);
            for (const c of costoMal) {
                console.log(`   ${String(c.p.name).slice(0, 56).padEnd(58)}${pesos(c.p.cost).padStart(12)} → ${pesos(c.costoEsperado)}`);
            }
            console.log();
        }

        // Lo que hay en el sistema y NO sale de ningún renglón de esta hoja: puede
        // ser de otra sección de la lista (multifocales, stock) o algo colgado.
        const usados = new Set([...ok, ...costoMal].map(x => x.p.id));
        const monofocales = productos.filter(p => /monofocal/i.test(p.name || '') && /tallado|cnc|digital|free-form/i.test(p.name || ''));
        const huerfanos = monofocales.filter(p => !usados.has(p.id));
        if (huerfanos.length) {
            console.log(`❓ ${huerfanos.length} monofocal(es) de tallado en el sistema que NO matchean ningún renglón de esta hoja:`);
            huerfanos.forEach(p => console.log(`   ${String(p.name).slice(0, 60).padEnd(62)} pelado ${pesos(p.baseCost)} · idx ${p.lensIndex ?? '—'}`));
        }
    } finally { await prisma.$disconnect(); }
}

main().catch(e => { console.error(e); process.exitCode = 1; });
