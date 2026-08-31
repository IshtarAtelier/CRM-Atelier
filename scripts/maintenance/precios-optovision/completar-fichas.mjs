/**
 * COMPLETA los campos de ficha que se pueden deducir del NOMBRE del cristal:
 * `type` (monofocal / multifocal / control miópico / ocupacional), `lensIndex`
 * (el índice sale del material) y `model` (la familia o diseño).
 *
 * POR QUÉ SE PUEDE DEDUCIR: el nombre del producto en este catálogo sigue el
 * formato de la lista de Optovisión — "FAMILIA - MATERIAL + tratamiento". El
 * material dice el índice (ORMA=1.50, AIRWEAR=1.59, STYLIS=1.67) y la familia
 * dice el diseño. No se INVENTA nada: si una regla no matchea, el producto
 * queda como está y se lista para revisar a mano.
 *
 * QUÉ NO TOCA:
 *   · Campos que ya tienen valor — solo rellena vacíos (null o "").
 *   · `price`, `cost`, `baseCost` — la plata no se toca acá.
 *   · Los rangos de esfera / cilindro / adición: NO se deducen del nombre. Un
 *     rango inventado hace que el vendedor acepte una receta que el laboratorio
 *     después rechaza. Esos hay que pedirlos al laboratorio.
 *
 * NOTA sobre `model` (30/8/2026): el catálogo viene con dos convenciones —
 * ~60 cristales viejos tienen el NOMBRE COMPLETO copiado en `model` (no aporta
 * información) y los "Mi Primer" nuevos tienen la FAMILIA. Este script rellena
 * los vacíos con la FAMILIA, que es lo que `model` significa en el resto del
 * sistema (marca + modelo, como en los armazones). Los que ya tienen el nombre
 * completo NO se reescriben: normalizarlos es una decisión aparte de Ishtar.
 *
 * Por defecto va contra la base LOCAL y NO escribe.
 *   node scripts/maintenance/precios-optovision/completar-fichas.mjs
 *   node scripts/maintenance/precios-optovision/completar-fichas.mjs --aplicar
 *   node scripts/maintenance/precios-optovision/completar-fichas.mjs --produccion --aplicar
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config();

const APLICAR = process.argv.includes('--aplicar');
const PRODUCCION = process.argv.includes('--produccion');
const FIRMA = 'Ishtar (completar fichas de cristales)';

const url = PRODUCCION ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
if (!url) { console.error(`Falta ${PRODUCCION ? 'PROD_DATABASE_URL' : 'DATABASE_URL'} en el .env`); process.exit(1); }
if (!PRODUCCION && !/localhost|127\.0\.0\.1/.test(url)) {
    console.error('❌ DATABASE_URL no apunta a localhost. Para tocar producción hace falta --produccion.');
    process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url } } });
const vacio = v => v == null || String(v).trim() === '';

// ── FAMILIA (→ `model`) ─────────────────────────────────────────────────────
// Tabla explícita, en orden de más específica a más general — mismo criterio
// que emparejador.mjs. Explícita a propósito: un título automático a partir
// del nombre acierta el 80% y falla justo en los raros.
const FAMILIAS = [
    [/mi\s*primer\s*varilux\s*comfort\s*max/i, 'Mi Primer Varilux Comfort Max'],
    [/mi\s*primer\s*varilux\s*physio\s*3\.0/i, 'Mi Primer Varilux Physio 3.0'],
    [/mi\s*primer\s*varilux\s*physio/i, 'Mi Primer Varilux Physio'],
    [/mi\s*primer\s*varilux\s*xr\s*design/i, 'Mi Primer Varilux XR Design'],
    [/mi\s*primer\s*varilux\s*comfort/i, 'Mi Primer Varilux Comfort'],
    [/mi\s*primer\s*kodak\s*precise/i, 'Mi Primer Kodak Precise'],
    [/mi\s*primer\s*kodak\s*unique\s*dro/i, 'Mi Primer Kodak Unique DRO'],
    [/essilor\s*new\s*editions/i, 'Essilor New Editions'],
    [/kodak\s*unique\s*dro/i, 'Kodak Unique DRO'],
    [/kodak\s*precise/i, 'Kodak Precise'],
    [/kodak\s*softwear/i, 'Kodak Softwear'],
    [/myopilux\s*kids\s*lite/i, 'Myopilux Kids Lite'],
    [/myopilux\s*kids\s*plus/i, 'Myopilux Kids Plus'],
    [/stellest/i, 'Stellest'],
    [/eyezen\s*boost/i, 'Eyezen Boost'],
    [/eyezen\s*kids/i, 'Eyezen Kids'],
    [/eyezen\s*start/i, 'Eyezen Start'],
    [/eyezen/i, 'Eyezen'],
    [/espace\s*plus\s*digital/i, 'Espace Plus Digital'],
    [/interview/i, 'Interview'],
    [/xr\s*design/i, 'Varilux XR Design'],
    [/xr\s*pro/i, 'Varilux XR Pro'],
    [/comfort\s*max/i, 'Varilux Comfort Max'],
    [/physio\s*3\.0/i, 'Varilux Physio 3.0'],
    [/liberty\s*3\.0/i, 'Varilux Liberty 3.0'],
    [/digitime/i, 'Varilux Digitime'],
    [/comfort/i, 'Varilux Comfort'],
    [/physio/i, 'Varilux Physio'],
    // Monofocales y lentes sueltas: la "familia" es el tratamiento que las define.
    [/blue\s*uv|filter\s*system/i, 'Blue UV Filter System'],
    [/xperio/i, 'Monofocal Xperio'],
    [/transitions\s*gen\s*s/i, 'Monofocal Transitions Gen S'],
];

// ── TIPO ────────────────────────────────────────────────────────────────────
// Se usa el vocabulario que YA existe en el catálogo, no uno nuevo.
const TIPOS = [
    [/myopilux|stellest|control\s*mi[oó]pic/i, 'Cristal Control Miopico'],
    [/interview|espace\s*plus|ocupacional/i, 'Cristal Ocupacional'],
    [/comfort|physio|xr\s*design|xr\s*pro|liberty|digitime|precise|unique\s*dro|softwear|new\s*editions|multifocal|progresiv/i, 'Cristal Multifocal'],
    [/bifocal/i, 'Cristal Bifocal'],
    [/monofocal|blue\s*uv|filter\s*system|xperio|transitions|eyezen|orma|airwear|stylis/i, 'Cristal Monofocal'],
];

// ── ÍNDICE ──────────────────────────────────────────────────────────────────
// El material manda. Se busca primero el número explícito del nombre y, si no
// está, el nombre del material.
const INDICES = [
    [/1\.74|alto\s*[íi]ndice/i, '1.74'],
    [/1\.67|stylis/i, '1.67'],
    [/1\.59|airwear|policarbonato|poli\b/i, '1.59'],
    [/1\.56/i, '1.56'],
    [/1\.50|orma|org[áa]nico/i, '1.50'],
];

const primero = (tabla, texto) => tabla.find(([re]) => re.test(texto))?.[1] ?? null;

async function main() {
    console.log(`Base: ${PRODUCCION ? '⚠️  PRODUCCIÓN' : 'LOCAL'} · modo: ${APLICAR ? 'APLICAR (escribe)' : 'ENSAYO (no escribe)'}\n`);

    const productos = await prisma.$queryRaw`
        select id, name, type, brand, model, "lensIndex"
        from "Product"
        where category = 'Cristal' and laboratory = 'OPTOVISION'
        order by name`;

    const cambios = [], sinResolver = [];
    for (const p of productos) {
        const nombre = String(p.name || '');
        const set = {};
        if (vacio(p.type)) { const v = primero(TIPOS, nombre); if (v) set.type = v; }
        if (vacio(p.lensIndex)) { const v = primero(INDICES, nombre); if (v) set.lensIndex = v; }
        if (vacio(p.model)) { const v = primero(FAMILIAS, nombre); if (v) set.model = v; }

        const faltaAun = (vacio(p.type) && !set.type) || (vacio(p.lensIndex) && !set.lensIndex) || (vacio(p.model) && !set.model);
        if (faltaAun) sinResolver.push({ ...p, set });
        if (Object.keys(set).length) cambios.push({ ...p, set });
    }

    console.log(`${productos.length} cristales · ${cambios.length} con algo para completar\n`);
    for (const c of cambios) {
        const detalle = Object.entries(c.set).map(([k, v]) => `${k}="${v}"`).join('  ');
        console.log(`  ${String(c.name).slice(0, 52).padEnd(54)}${detalle}`);
    }

    if (sinResolver.length) {
        console.log(`\n  ⚠️  ${sinResolver.length} que ninguna regla resolvió del todo (quedan como están):`);
        for (const s of sinResolver) {
            const falta = [vacio(s.type) && !s.set.type && 'tipo', vacio(s.lensIndex) && !s.set.lensIndex && 'índice',
            vacio(s.model) && !s.set.model && 'modelo'].filter(Boolean).join(', ');
            console.log(`     ${String(s.name).slice(0, 56).padEnd(58)}sigue sin: ${falta}`);
        }
    }

    if (!APLICAR) { console.log('\nEnsayo: no se escribió nada. Para aplicarlo: --aplicar'); return; }

    for (const c of cambios) {
        const { type, lensIndex, model } = c.set;
        await prisma.$executeRaw`
            update "Product" set
                type = coalesce(${type ?? null}, type),
                "lensIndex" = coalesce(${lensIndex ?? null}, "lensIndex"),
                model = coalesce(${model ?? null}, model),
                "updatedAt" = now()
            where id = ${c.id}`;
        await prisma.$executeRaw`
            insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
            values (gen_random_uuid()::text, ${FIRMA}, 'UPDATE', 'PRODUCT', ${c.id},
                ${JSON.stringify({ producto: c.name, completado: c.set })}::jsonb, now())`;
    }
    console.log(`\n✅ ${cambios.length} ficha(s) completadas. No se tocó ni un precio ni un costo.`);
}

main()
    .catch(err => { console.error(err); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
