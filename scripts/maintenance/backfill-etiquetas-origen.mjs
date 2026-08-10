#!/usr/bin/env node
// ────────────────────────────────────────────────────────────────────────────
// QUÉ HACE
// Les pone a los clientes YA EXISTENTES las etiquetas visibles de origen que el
// sistema hoy administra solo al crear/editar la ficha:
//   · la del CANAL   (`Client.contactSource`) → "Google Maps", "Calle", "Meta Ads"…
//   · la del ANUNCIO (`Client.adTag`)         → "Meta · ishvarilux", "Google · verano"
// y desconecta las administradas que ya no corresponden (el cliente que pasó de
// Meta a Google Ads y quedó con las dos pegadas).
//
// Hasta el 9/8/2026 el espejo canal→etiqueta cubría 3 de los 9 canales y el
// apodo del anuncio no generaba NINGUNA etiqueta: vivía solo como columna,
// invisible en el buscador y en los filtros de etiquetas.
//
// QUÉ NO TOCA
// Las etiquetas de negocio ("Multifocal", "Bot Lead", "Sin Seguimiento",
// "Ocusis", "VIP"…). El portero es `esEtiquetaAdministrada()` de
// `src/lib/contact-tags.ts` — el MISMO que usa `syncContactTags()` en el
// service, así que script y app no pueden opinar distinto sobre qué es suyo.
// Acá solo vive la mecánica de recorrer en lote; ninguna decisión.
//
// CONTRA QUÉ BASE PEGA
//   sin flags → DATABASE_URL del .env (docker local: postgres@localhost:5432)
//   --prod    → PROD_DATABASE_URL del .env (Railway). NUNCA sin OK explícito.
//
// USO (dry-run por defecto: sin --commit no escribe una sola fila)
//   node --experimental-strip-types scripts/maintenance/backfill-etiquetas-origen.mjs
//   node --experimental-strip-types scripts/maintenance/backfill-etiquetas-origen.mjs --commit
//   node --experimental-strip-types scripts/maintenance/backfill-etiquetas-origen.mjs --prod            (dry-run contra prod)
//   node --experimental-strip-types scripts/maintenance/backfill-etiquetas-origen.mjs --prod --commit   (aplica en prod)
//   ... --commit --arreglar-colores    además alinea el color de las etiquetas administradas
//   ... --revertir scripts/maintenance/reversa-etiquetas-origen-<fecha>.json
//
// --arreglar-colores es aparte a propósito: el color se pinta como FONDO SÓLIDO
// con texto blanco encima, y los tres colores históricos no llegan al piso de
// 4,5:1 que necesita el staff con baja visión (#1677ff 4,10 · #E91E63 4,35 ·
// #4CAF50 2,78). Corregirlos pisa lo que alguien haya elegido a mano en el
// gestor de etiquetas, así que se pide explícito. El script informa la
// diferencia siempre, la aplique o no.
//
// Antes de escribir deja un archivo de reversa con el estado exacto anterior
// (qué etiquetas administradas tenía cada cliente y de qué color era cada una).
// ────────────────────────────────────────────────────────────────────────────

import 'dotenv/config';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';
import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '../..');

// Node no conoce el alias "@/" del tsconfig. Este hook lo traduce a src/ para
// poder importar el helper de verdad en vez de copiar acá la tabla de canales,
// colores y prefijos — que es exactamente el tipo de copia que después diverge.
registerHooks({
    resolve(spec, ctx, next) {
        if (spec.startsWith('@/')) {
            const base = resolve(RAIZ, 'src', spec.slice(2));
            const real = existsSync(`${base}.ts`) ? `${base}.ts` : base;
            return next(pathToFileURL(real).href, ctx);
        }
        return next(spec, ctx);
    },
});

const { etiquetasQueLeCorresponden, esEtiquetaAdministrada, TAG_POR_CANAL, COLOR_ANUNCIO, PREFIJO_ANUNCIO } =
    await import(pathToFileURL(resolve(RAIZ, 'src/lib/contact-tags.ts')).href);

const COMMIT = process.argv.includes('--commit');
const PROD = process.argv.includes('--prod');
const COLORES = process.argv.includes('--arreglar-colores');
const REVERTIR = process.argv.includes('--revertir')
    ? process.argv[process.argv.indexOf('--revertir') + 1]
    : null;

const url = PROD ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
if (!url) {
    console.error(`❌ Falta ${PROD ? 'PROD_DATABASE_URL' : 'DATABASE_URL'} en el .env.`);
    process.exit(1);
}
// Se imprime SOLO el host: la URL lleva la contraseña adentro.
const host = (() => { try { return new URL(url).host; } catch { return '(host ilegible)'; } })();
const prisma = new PrismaClient({ datasources: { db: { url } } });

/** Color canónico de una etiqueta administrada, o null si no es administrada. */
function colorCanonico(name) {
    for (const canal of Object.keys(TAG_POR_CANAL)) {
        if (TAG_POR_CANAL[canal].name === name) return TAG_POR_CANAL[canal].color;
    }
    for (const [plataforma, prefijo] of Object.entries(PREFIJO_ANUNCIO)) {
        if (name.startsWith(prefijo)) return COLOR_ANUNCIO[plataforma];
    }
    return null;
}

async function revertir(archivo) {
    const datos = JSON.parse(readFileSync(archivo, 'utf8'));
    console.log(`\n↩️  Revirtiendo ${datos.clientes.length} cliente(s) y ${datos.colores.length} color(es) desde ${archivo}\n`);
    if (!COMMIT) {
        console.log('   DRY RUN — agregá --commit para aplicar la reversa.');
        return;
    }
    for (const c of datos.clientes) {
        const actual = await prisma.client.findUnique({
            where: { id: c.id },
            select: { tags: { select: { id: true, name: true } } },
        });
        if (!actual) continue;
        const administradasAhora = actual.tags.filter(t => esEtiquetaAdministrada(t.name));
        const tags = await prisma.tag.findMany({ where: { name: { in: c.etiquetasAdministradas } } });
        await prisma.client.update({
            where: { id: c.id },
            data: {
                tags: {
                    disconnect: administradasAhora.map(t => ({ id: t.id })),
                    connect: tags.map(t => ({ id: t.id })),
                },
            },
        });
    }
    for (const t of datos.colores) {
        await prisma.tag.updateMany({ where: { name: t.name }, data: { color: t.color } });
    }
    console.log('✅ Reversa aplicada.');
}

async function main() {
    console.log('\n══════════════════════════════════════════════════════════════');
    console.log('  Backfill de etiquetas de origen (canal + anuncio)');
    console.log(`  Base: ${PROD ? 'PRODUCCIÓN' : 'local'} → ${host}`);
    console.log(`  Modo: ${COMMIT ? '⚠️  ESCRITURA (--commit)' : 'DRY RUN (no escribe nada)'}`);
    console.log('══════════════════════════════════════════════════════════════\n');

    if (REVERTIR) return revertir(REVERTIR);

    const clientes = await prisma.client.findMany({
        where: { isDeleted: false },
        select: {
            id: true,
            name: true,
            contactSource: true,
            adTag: true,
            tags: { select: { id: true, name: true } },
        },
    });
    console.log(`Clientes activos leídos: ${clientes.length}\n`);

    // ── Plan ────────────────────────────────────────────────────────────────
    const plan = [];
    const porConectar = new Map();    // nombre → cuántos clientes
    const porDesconectar = new Map();

    for (const c of clientes) {
        const deseadas = etiquetasQueLeCorresponden(c.contactSource, c.adTag);
        // Misma guarda que el service: sin canal NI anuncio no sabemos nada, y
        // no se borra por ignorancia lo que haya puesto el bot o alguien más.
        if (deseadas.length === 0) continue;

        const nombresDeseados = new Set(deseadas.map(t => t.name));
        const faltan = deseadas.filter(t => !c.tags.some(a => a.name === t.name));
        const sobran = c.tags.filter(a => esEtiquetaAdministrada(a.name) && !nombresDeseados.has(a.name));
        if (!faltan.length && !sobran.length) continue;

        for (const t of faltan) porConectar.set(t.name, (porConectar.get(t.name) || 0) + 1);
        for (const t of sobran) porDesconectar.set(t.name, (porDesconectar.get(t.name) || 0) + 1);

        plan.push({
            id: c.id,
            name: c.name,
            contactSource: c.contactSource,
            adTag: c.adTag,
            faltan,
            sobran,
            // Para la reversa: el estado administrado EXACTO de antes.
            etiquetasAdministradas: c.tags.filter(t => esEtiquetaAdministrada(t.name)).map(t => t.name),
        });
    }

    // ── Colores fuera del canon ─────────────────────────────────────────────
    const tagsExistentes = await prisma.tag.findMany({ select: { name: true, color: true } });
    const coloresADerivar = tagsExistentes
        .filter(t => {
            const canon = colorCanonico(t.name);
            return canon && (t.color || '').toUpperCase() !== canon.toUpperCase();
        })
        .map(t => ({ name: t.name, color: t.color, canonico: colorCanonico(t.name) }));

    // ── Informe (SIEMPRE antes de tocar nada) ───────────────────────────────
    console.log(`Clientes a tocar: ${plan.length}`);
    if (porConectar.size) {
        console.log('\n  Etiquetas a CONECTAR:');
        [...porConectar.entries()].sort((a, b) => b[1] - a[1])
            .forEach(([n, q]) => console.log(`    + ${String(q).padStart(5)}  ${n}`));
    }
    if (porDesconectar.size) {
        console.log('\n  Etiquetas a DESCONECTAR (ya no corresponden):');
        [...porDesconectar.entries()].sort((a, b) => b[1] - a[1])
            .forEach(([n, q]) => console.log(`    - ${String(q).padStart(5)}  ${n}`));
    }
    if (coloresADerivar.length) {
        console.log(`\n  Colores fuera del canon (${COLORES ? 'se corrigen' : 'informativo: falta --arreglar-colores'}):`);
        coloresADerivar.forEach(t => console.log(`    ~ ${t.name}: ${t.color} → ${t.canonico}`));
    }
    if (plan.length) {
        console.log('\n  Primeros 10 clientes del plan:');
        plan.slice(0, 10).forEach(p => console.log(
            `    · ${p.name} [canal: ${p.contactSource || '—'} | anuncio: ${p.adTag || '—'}]` +
            `${p.faltan.length ? ` +${p.faltan.map(t => t.name).join(', +')}` : ''}` +
            `${p.sobran.length ? ` -${p.sobran.map(t => t.name).join(', -')}` : ''}`
        ));
    }

    if (!plan.length && !(COLORES && coloresADerivar.length)) {
        console.log('\n✅ No hay nada que hacer.\n');
        return;
    }

    if (!COMMIT) {
        console.log('\n⚠️  DRY RUN: no se escribió nada. Volvé a correr con --commit para aplicar.\n');
        return;
    }

    // ── Reversa ─────────────────────────────────────────────────────────────
    const sello = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const archivo = resolve(AQUI, `reversa-etiquetas-origen-${sello}.json`);
    writeFileSync(archivo, JSON.stringify({
        fecha: new Date().toISOString(),
        base: host,
        clientes: plan.map(p => ({ id: p.id, name: p.name, etiquetasAdministradas: p.etiquetasAdministradas })),
        colores: coloresADerivar.map(t => ({ name: t.name, color: t.color })),
    }, null, 2));
    console.log(`\n💾 Reversa guardada en ${archivo}`);

    // ── Aplicar ─────────────────────────────────────────────────────────────
    // 1) Las etiquetas primero: el upsert deja el color canónico solo si la
    //    etiqueta NACE acá; si ya existe, el color se toca únicamente con
    //    --arreglar-colores.
    const idPorNombre = new Map();
    const todasDeseadas = new Map();
    for (const p of plan) for (const t of p.faltan) todasDeseadas.set(t.name, t.color);
    for (const [name, color] of todasDeseadas) {
        const tag = await prisma.tag.upsert({ where: { name }, update: {}, create: { name, color } });
        idPorNombre.set(name, tag.id);
    }

    if (COLORES) {
        for (const t of coloresADerivar) {
            await prisma.tag.updateMany({ where: { name: t.name }, data: { color: t.canonico } });
        }
        console.log(`🎨 Colores alineados: ${coloresADerivar.length}`);
    }

    // 2) Cliente por cliente. Secuencial: es un one-off y no vale la pena
    //    pelearse con el pool de conexiones de Railway por unos segundos.
    let hechos = 0;
    for (const p of plan) {
        await prisma.client.update({
            where: { id: p.id },
            data: {
                tags: {
                    connect: p.faltan.map(t => ({ id: idPorNombre.get(t.name) })),
                    disconnect: p.sobran.map(t => ({ id: t.id })),
                },
            },
        });
        hechos++;
        if (hechos % 200 === 0) console.log(`   … ${hechos}/${plan.length}`);
    }

    // 3) Trazabilidad. AuditLog y no una Interaction por ficha: un renglón
    //    "el sistema te acomodó la etiqueta" en el historial de mil clientes es
    //    ruido para el mostrador. En AuditLog queda quién (Sistema) y qué.
    await prisma.auditLog.createMany({
        data: plan.map(p => ({
            userName: 'Sistema',
            action: 'UPDATE',
            entityType: 'CONTACT',
            entityId: p.id,
            details: {
                backfill: 'etiquetas-origen',
                conectadas: p.faltan.map(t => t.name),
                desconectadas: p.sobran.map(t => t.name),
            },
        })),
    });

    console.log(`\n✅ Listo: ${hechos} cliente(s) actualizados.`);
    console.log(`   Deshacer: node --experimental-strip-types scripts/maintenance/backfill-etiquetas-origen.mjs${PROD ? ' --prod' : ''} --commit --revertir ${archivo}\n`);
}

main()
    .catch(e => { console.error('❌ Error:', e); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
