/**
 * ASIGNA a cada cristal de Optovisión la imagen de marca de su familia
 * (public/images/cristales/marcas/<slug>.jpg), aprobadas por Ishtar el
 * 31/8/2026 ("excelente, subí nomás").
 *
 * REGLAS:
 *   · Solo escribe donde `imagenesCatalogo` está VACÍO. Una foto real cargada a
 *     mano siempre le gana a la imagen genérica de familia.
 *   · El orden de la tabla importa: gana el primer patrón que matchea, así
 *     "MI PRIMER KODAK" cae en su imagen y no en la de Kodak, y "PHYSIO 3.0"
 *     no cae en la de Physio.
 *   · Un producto sin patrón se lista, no se adivina.
 *
 *   node scripts/maintenance/imagenes-cristales/asignar-imagenes.mjs                 # ensayo local
 *   node scripts/maintenance/imagenes-cristales/asignar-imagenes.mjs --produccion --aplicar
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { RAIZ } from '../../social/identidad.mjs';

config();

const APLICAR = process.argv.includes('--aplicar');
const PRODUCCION = process.argv.includes('--produccion');
const FIRMA = 'Ishtar (imágenes de marca en los cristales)';

const url = PRODUCCION ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
if (!url) { console.error('Falta la URL de la base en el .env'); process.exit(1); }
if (!PRODUCCION && !/localhost|127\.0\.0\.1/.test(url)) {
    console.error('❌ DATABASE_URL no apunta a localhost. Para producción hace falta --produccion.');
    process.exit(1);
}
const prisma = new PrismaClient({ datasources: { db: { url } } });

/** name del producto → slug de la imagen. El primero que matchea gana. */
const REGLAS = [
    [/mi\s*primer\s*varilux/i, 'mi-primer-varilux'],
    [/mi\s*primer\s*kodak/i, 'mi-primer-kodak'],
    [/eyezen\s*kids/i, 'eyezen-kids'],
    [/eyezen\s*boost/i, 'eyezen-boost'],
    [/eyezen\s*start/i, 'eyezen-start'],
    [/myopilux/i, 'myopilux'],
    [/stellest/i, 'stellest'],
    [/new\s*editions/i, 'sygnus-new-editions'],
    [/sygnus\s*monofocal\s*one/i, 'sygnus-monofocal-one'],
    [/sygnus\s*bifocal/i, 'sygnus-bifocal'],
    [/sygnus\s*driver/i, 'sygnus-driver'],
    [/kodak\s*precise/i, 'kodak-precise'],
    [/kodak\s*unique/i, 'kodak-unique-dro'],
    [/kodak\s*softwear/i, 'kodak-softwear'],
    [/kodak\s*sv\s*digital/i, 'kodak-sv-digital'],
    [/xr\s*design/i, 'varilux-xr-design'],
    [/comfort\s*max/i, 'varilux-comfort-max'],
    [/physio\s*3\.0/i, 'varilux-physio-3-0'],
    [/physio/i, 'varilux-physio'],
    [/comfort/i, 'varilux-comfort'],
    [/digitime/i, 'varilux-digitime'],
    [/liberty/i, 'varilux-liberty'],
    [/interview/i, 'interview'],
    [/espace\s*plus/i, 'espace-plus'],
    [/blue\s*uv|hd\s*mr7|blc/i, 'blue-uv'],
    [/transitions/i, 'transitions-gen-s'],
    [/xperio/i, 'xperio'],
    [/crizal/i, 'crizal'],
    [/monofocal/i, 'blue-uv'],   // monofocales genéricos: la imagen más neutra
];

const carpeta = path.join(RAIZ, 'public', 'images', 'cristales', 'marcas');

async function main() {
    console.log(`Base: ${PRODUCCION ? '⚠️  PRODUCCIÓN' : 'LOCAL'} · modo: ${APLICAR ? 'APLICAR (escribe)' : 'ENSAYO (no escribe)'}\n`);
    const ps = await prisma.$queryRaw`
        select id, name, "imagenesCatalogo" from "Product"
        where category = 'Cristal' and laboratory = 'OPTOVISION' order by name`;

    const porSlug = {}, sinRegla = [], conFoto = [];
    const asignar = [];
    for (const p of ps) {
        if ((p.imagenesCatalogo?.length ?? 0) > 0) { conFoto.push(p); continue; }
        const regla = REGLAS.find(([re]) => re.test(p.name));
        if (!regla) { sinRegla.push(p); continue; }
        const slug = regla[1];
        if (!existsSync(path.join(carpeta, `${slug}.jpg`))) { sinRegla.push(p); continue; }
        (porSlug[slug] ??= []).push(p);
        asignar.push({ id: p.id, name: p.name, ruta: `/images/cristales/marcas/${slug}.jpg` });
    }

    console.log(`${ps.length} cristales · ${asignar.length} a asignar · ${conFoto.length} ya tenían foto (no se tocan) · ${sinRegla.length} sin regla\n`);
    for (const [slug, items] of Object.entries(porSlug).sort((a, b) => b[1].length - a[1].length)) {
        console.log(`  ${slug.padEnd(24)} ${items.length}`);
    }
    if (sinRegla.length) { console.log('\n  Sin regla (no se tocan):'); sinRegla.forEach(p => console.log(`    ${p.name}`)); }

    if (!APLICAR) { console.log('\nEnsayo: no se escribió nada. Para aplicarlo: --aplicar'); return; }

    for (const a of asignar) {
        await prisma.$executeRaw`
            update "Product" set "imagenesCatalogo" = ${[a.ruta]}, "updatedAt" = now() where id = ${a.id}`;
    }
    // Una sola firma resumida: 200+ filas idénticas en el AuditLog no ayudan a nadie.
    await prisma.$executeRaw`
        insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
        values (gen_random_uuid()::text, ${FIRMA}, 'UPDATE', 'PRODUCT', 'lote:imagenes-marcas',
            ${JSON.stringify({ descripcion: 'Imagen de marca asignada por familia a los cristales de Optovisión', asignados: asignar.length, porFamilia: Object.fromEntries(Object.entries(porSlug).map(([k, v]) => [k, v.length])) })}::jsonb, now())`;
    console.log(`\n✅ ${asignar.length} cristal(es) con su imagen de marca.`);
}

main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
