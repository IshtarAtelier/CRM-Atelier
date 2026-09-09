/**
 * AUDITORÍA FINAL del catálogo de cristales y tratamientos. SOLO LEE.
 *
 * Es el chequeo que Ishtar pidió el 9/9/2026 ("auditá TODO, que no quede ningún
 * dato sin subir, que sea perfecto") convertido en algo repetible: cada vez que
 * se toca el catálogo se corre esto y tiene que dar todo en cero.
 *
 *   node scripts/checks/auditoria-catalogo-cristales.mjs --produccion
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config();

const PRODUCCION = process.argv.includes('--produccion');
const PISO_MARKUP = 2.5;

const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const pesos = n => n == null ? '—' : `$${Math.round(Number(n)).toLocaleString('es-AR')}`;

async function main() {
    const url = PRODUCCION ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    try {
        console.log(`Base: ${PRODUCCION ? 'PRODUCCION' : 'LOCAL'} · SOLO LECTURA\n`);
        const ps = await prisma.$queryRaw`
            select id, name, category, type, brand, laboratory, origin, "lensIndex",
                   "baseCost", cost, price, "sphereMin", "sphereMax", "cylinderMin", "cylinderMax",
                   "additionMin", "additionMax"
            from "Product" where category in ('Cristal', 'Tratamiento') order by name`;

        const cristales = ps.filter(p => p.category === 'Cristal');
        const tratam = ps.filter(p => p.category === 'Tratamiento');
        const vivos = cristales.filter(p => !/^\s*\[archivado\]/i.test(p.name || ''));
        console.log(`${cristales.length} cristales (${vivos.length} activos, ${cristales.length - vivos.length} archivados) · ${tratam.length} tratamientos\n`);

        const fallas = [];
        const marcar = (t, lista, detalle = p => p.name) => {
            console.log(`${lista.length === 0 ? 'OK  ' : 'FALLA'}  ${String(lista.length).padStart(4)}  ${t}`);
            if (lista.length) { fallas.push(t); lista.slice(0, 12).forEach(p => console.log(`          ${detalle(p)}`)); }
        };

        marcar('nombres duplicados',
            Object.values(ps.reduce((a, p) => ((a[norm(p.name)] ??= []).push(p), a), {})).filter(v => v.length > 1).flat());
        marcar('sin laboratorio', ps.filter(p => !p.laboratory));
        marcar('cristales sin origen (stock / laboratorio)', vivos.filter(p => !p.origin));
        marcar('costo o precio en cero', ps.filter(p => !(Number(p.cost) > 0) || !(Number(p.price) > 0)));
        marcar('markup por debajo de x2,5', ps.filter(p => Number(p.cost) > 0 && Number(p.price) / Number(p.cost) < PISO_MARKUP),
            p => `${p.name} — x${(Number(p.price) / Number(p.cost)).toFixed(2)} (${pesos(p.cost)} -> ${pesos(p.price)})`);
        marcar('rangos invertidos (min > max)', vivos.filter(p =>
            (p.sphereMin != null && p.sphereMax != null && Number(p.sphereMin) > Number(p.sphereMax)) ||
            (p.cylinderMin != null && p.cylinderMax != null && Number(p.cylinderMin) > Number(p.cylinderMax)) ||
            (p.additionMin != null && p.additionMax != null && Number(p.additionMin) > Number(p.additionMax))));
        marcar('cristales sin rango de esfera', vivos.filter(p => p.sphereMin == null || p.sphereMax == null));
        marcar('cristales sin rango de cilindro', vivos.filter(p => p.cylinderMin == null || p.cylinderMax == null));
        marcar('multifocales, bifocales u ocupacionales sin adición',
            vivos.filter(p => /multifocal|bifocal|ocupacional|progresiv|pro-line/i.test(p.name) && (p.additionMin == null || p.additionMax == null)));
        marcar('cristales sin costo pelado (no se pueden recalcular ni cruzar contra factura)',
            vivos.filter(p => p.baseCost == null));
        marcar('cristales sin índice (los sol neutros no llevan, es correcto)',
            vivos.filter(p => !p.lensIndex && !/sol neutro/i.test(p.name)));
        marcar('nombre o marca con espacios de más', ps.filter(p => p.name !== String(p.name).trim() || (p.brand && p.brand !== String(p.brand).trim())));

        console.log(`\n${fallas.length === 0 ? '✅ TODO EN CERO' : `❌ ${fallas.length} chequeo(s) con hallazgos`}`);
    } finally { await prisma.$disconnect(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
