/**
 * ¿Cada costo de la base es el que da LA fórmula? SOLO LEE.
 *
 * El costo de un cristal se calculaba en cuatro lugares que no coincidían (la
 * pantalla de alta, el importador de listas, el recálculo de Configuración y
 * una docena de scripts con 7272, 23000 y 1,21 escritos a mano). Este control
 * es la red: toma cada producto con pelado, le aplica computeFinalLensCost
 * (src/lib/lens-cost.ts) con la configuración REAL del laboratorio
 * (LaboratoryConfig) y lista todo lo que no coincide. No importa qué pantalla
 * o qué script lo tocó: si se separó de la fórmula, aparece acá.
 *
 *   npm run check:costos                       # base local
 *   npm run check:costos -- --produccion       # producción (solo lee)
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { computeFinalLensCost, findLabConfig } from '@/lib/lens-cost';

config();
const PRODUCCION = process.argv.includes('--produccion');
const f = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;

const prisma = new PrismaClient({ datasources: { db: { url: PRODUCCION ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL } } });
try {
    const labs = await prisma.$queryRaw<any[]>`select name, calibrado, iva from "LaboratoryConfig"`;
    const ps = await prisma.$queryRaw<any[]>`
        select name, laboratory, category, "baseCost", cost from "Product"
        where "baseCost" is not null and category in ('Cristal', 'Tratamiento') and laboratory is not null`;
    const mal: string[] = [];
    let revisados = 0, sinConfig = 0;
    for (const p of ps) {
        const lab = findLabConfig(labs.map(l => ({ name: l.name, calibrado: Number(l.calibrado), iva: Number(l.iva) })), p.laboratory);
        if (!lab || (!lab.calibrado && !lab.iva)) { sinConfig++; continue; }
        revisados++;
        const esperado = computeFinalLensCost(Number(p.baseCost), lab, { skipCalibrado: p.category === 'Tratamiento' });
        if (Math.abs(esperado - Math.round(Number(p.cost))) > 1) {
            mal.push(`  ${p.laboratory.padEnd(13)} ${String(p.name).slice(0, 58).padEnd(60)} tiene ${f(Number(p.cost))}, la fórmula da ${f(esperado)}`);
        }
    }
    console.log(`Base: ${PRODUCCION ? 'PRODUCCIÓN' : 'LOCAL'} · ${revisados} costos revisados contra la fórmula · ${sinConfig} de labs sin configuración (no se pueden verificar)`);
    if (mal.length) { console.log(`\n❌ ${mal.length} costo(s) que no dan la fórmula:`); mal.slice(0, 40).forEach(l => console.log(l)); process.exitCode = 1; }
    else console.log('✅ todos los costos dan la fórmula');
} finally { await prisma.$disconnect(); }
