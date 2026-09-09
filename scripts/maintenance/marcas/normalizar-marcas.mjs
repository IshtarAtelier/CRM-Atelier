/**
 * NORMALIZA el campo `brand` de todo el catálogo.
 *
 * Ishtar, 9/9/2026: "veo que algunas marcas están mal … auditá TODO". Y las tres
 * respuestas que solo podía dar ella, porque no están en ninguna lista:
 *   · "Smart Lens es la marca de cristales de Grupo Óptico"
 *   · Cima / Cimma  → **Cimma**
 *   · Stefanny / Steffany → **Steffani**
 *
 * DOS PROBLEMAS DISTINTOS:
 *
 * 1. DESCRIPCIONES EN LUGAR DE MARCAS. 25 productos tenían en `brand` cosas como
 *    "Bifocal", "Ogranico blanco" o "Policarbonato". Eso no es una marca: es lo
 *    que es el cristal, que ya está en el nombre y en el tipo. Ensucia cualquier
 *    reporte por marca y el filtro de marca del cotizador.
 *
 * 2. LA MISMA MARCA ESCRITA DE VARIAS FORMAS. "Cápsula Escarlata" convivía en
 *    tres versiones, y así el filtro la mostraba tres veces y ninguna traía
 *    todos sus productos.
 *
 * LA REGLA: la marca de un cristal es la del LABORATORIO que lo fabrica —Smart
 * Lens en Grupo Óptico— o la marca comercial real del diseño (Essilor, Kodak,
 * Varilux, Sygnus, Optovision). Nunca el material ni el tipo de lente.
 *
 * Por defecto va contra la base LOCAL y NO escribe.
 *   node scripts/maintenance/marcas/normalizar-marcas.mjs --produccion
 *   node scripts/maintenance/marcas/normalizar-marcas.mjs --produccion --aplicar
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config();

const APLICAR = process.argv.includes('--aplicar');
const PRODUCCION = process.argv.includes('--produccion');
const FIRMA = 'Ishtar (marcas normalizadas)';

/** Todo cristal o tratamiento de estos laboratorios lleva la marca del lab. */
const MARCA_POR_LAB = {
    'GRUPO OPTICO': 'Smart Lens',
    'LA CAMARA': 'La Cámara',
};

/**
 * Marcas mal escritas → la forma correcta. La clave se compara normalizada
 * (minúsculas, sin acentos), así que una sola entrada cubre sus variantes.
 */
const RENOMBRES = {
    'capsula escarlata': 'Cápsula Escarlata',
    'kazzwini': 'Kazwini',
    'kazwini': 'Kazwini',
    'cima': 'Cimma',
    'cimma': 'Cimma',
    'stefanny': 'Steffani',
    'steffany': 'Steffani',
    'philippe r': 'Philippe Rosset',
    'philippe rosset': 'Philippe Rosset',
    'las oreiro': 'Las Oreiro',
    'baush & lomb': 'Bausch & Lomb',
    'baush y lomb': 'Bausch & Lomb',
    'bausch & lomb': 'Bausch & Lomb',
    'hanoveer kids': 'Hannover Kids',
    'hannover': 'Hannover',
};

/**
 * Optovisión: los que tenían una tecnología o un typo en vez de la marca.
 * Transitions y Xperio son tecnologías de Essilor, no marcas de cristal.
 */
const RENOMBRES_OPTOVISION = {
    'transitions': 'Essilor',
    'transitions gens': 'Essilor',
    'orma transitions gen s': 'Essilor',
    'stellest essilor': 'Essilor',
    'opto': 'Optovision',
};

const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

async function main() {
    const url = PRODUCCION ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
    if (!PRODUCCION && !/localhost|127\.0\.0\.1/.test(url ?? '')) {
        console.error('DATABASE_URL no apunta a localhost. Para tocar produccion hace falta --produccion.');
        process.exitCode = 1; return;
    }
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    try {
        console.log(`Base: ${PRODUCCION ? 'PRODUCCION' : 'LOCAL'} | modo: ${APLICAR ? 'APLICAR' : 'ENSAYO'}\n`);
        const ps = await prisma.$queryRaw`
            select id, name, brand, category, laboratory from "Product" order by name`;

        const cambios = [];
        for (const p of ps) {
            const b = norm(p.brand);
            let nueva = null;
            if (MARCA_POR_LAB[p.laboratory]) nueva = MARCA_POR_LAB[p.laboratory];
            else if (p.laboratory === 'OPTOVISION' && RENOMBRES_OPTOVISION[b]) nueva = RENOMBRES_OPTOVISION[b];
            else if (RENOMBRES[b]) nueva = RENOMBRES[b];
            if (nueva && nueva !== p.brand) cambios.push({ p, nueva });
        }

        const porCambio = {};
        for (const c of cambios) (porCambio[`${c.p.brand} -> ${c.nueva}`] ??= []).push(c);

        console.log(`${ps.length} productos | ${cambios.length} a corregir\n`);
        for (const [k, v] of Object.entries(porCambio).sort((a, b) => b[1].length - a[1].length)) {
            console.log(`  ${String(v.length).padStart(4)}  ${k}`);
            v.slice(0, 3).forEach(c => console.log(`          ${String(c.p.name).slice(0, 62)}`));
        }

        // Lo que NO se toca pero conviene mirar: marcas que quedan con un solo
        // producto suelen ser un typo que todavía no se detectó.
        const despues = {};
        for (const p of ps) {
            const c = cambios.find(x => x.p.id === p.id);
            const b = c ? c.nueva : (p.brand || '(vacía)');
            despues[b] = (despues[b] ?? 0) + 1;
        }
        const raras = Object.entries(despues).filter(([, n]) => n === 1).map(([b]) => b).sort();
        console.log(`\n  Marcas que quedan con UN SOLO producto (revisar, suelen ser typos): ${raras.length}`);
        console.log(`    ${raras.join(' · ')}`);

        if (!APLICAR) { console.log('\nEnsayo: no se escribio nada. Para aplicarlo: --aplicar'); return; }

        for (const c of cambios) {
            await prisma.$executeRaw`
                update "Product" set brand = ${c.nueva}, "updatedAt" = now() where id = ${c.p.id}`;
        }
        await prisma.$executeRaw`
            insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
            values (gen_random_uuid()::text, ${FIRMA}, 'UPDATE', 'PRODUCT', 'lote:marcas',
                ${JSON.stringify({ descripcion: 'Marcas normalizadas', total: cambios.length,
                    porCambio: Object.fromEntries(Object.entries(porCambio).map(([k, v]) => [k, v.length])) })}::jsonb, now())`;
        console.log(`\nLISTO: ${cambios.length} marcas corregidas.`);
    } finally { await prisma.$disconnect(); }
}

main().catch(e => { console.error(e); process.exitCode = 1; });
