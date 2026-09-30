/**
 * Carga en BlogPost las notas de lanzamiento de Hoya (posts-hoya-sep-2026.json
 * + posts/*.html). Entran como BORRADOR (status DRAFT): el blog público solo
 * sirve PUBLISHED, así que nada se ve hasta que se publiquen desde el admin.
 *
 * Idempotente por slug: lo que ya existe no se toca. Contra producción los
 * inserts van con columnas explícitas (el schema local está adelantado).
 *
 *   node scripts/maintenance/blog-hoya/subir-posts-hoya.mjs                      # ensayo, LOCAL
 *   node scripts/maintenance/blog-hoya/subir-posts-hoya.mjs --aplicar            # escribe en LOCAL
 *   node scripts/maintenance/blog-hoya/subir-posts-hoya.mjs --produccion --aplicar
 *   node scripts/maintenance/blog-hoya/subir-posts-hoya.mjs --vista=salida.html  # arma una vista previa para leerlas
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

const AQUI = path.dirname(fileURLToPath(import.meta.url));

export function leerPosts() {
    const meta = JSON.parse(readFileSync(path.join(AQUI, 'posts-hoya-sep-2026.json'), 'utf8'));
    return meta.posts.map(p => ({ ...p, content: readFileSync(path.join(AQUI, 'posts', p.archivo), 'utf8').trim() }));
}

function vistaPrevia(posts) {
    const nota = p => `
      <article style="max-width:720px;margin:0 auto 64px;font-family:Georgia,serif;line-height:1.55">
        <p style="font:700 11px sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#888">${p.category} · /blog/${p.slug}</p>
        <h1 style="font-size:32px;line-height:1.15">${p.title}</h1>
        <p style="font-size:18px;color:#555">${p.excerpt}</p>
        <p style="font:12px sans-serif;color:#999">Meta título: ${p.metaTitle}<br>Meta descripción: ${p.metaDescription}<br>Imagen: ${p.imageUrl}</p>
        <hr>${p.content}
      </article>`;
    return `<!doctype html><meta charset="utf-8"><title>Notas Hoya (borradores)</title>
      <body style="background:#faf8f5;color:#111;padding:32px 16px">
      <p style="text-align:center;font:14px sans-serif;color:#888">${posts.length} borradores · ${new Date().toLocaleDateString('es-AR')}</p>
      ${posts.map(nota).join('\n')}</body>`;
}

async function main() {
    config();
    const APLICAR = process.argv.includes('--aplicar');
    const PRODUCCION = process.argv.includes('--produccion');
    const vista = process.argv.find(a => a.startsWith('--vista='))?.slice(8);
    const posts = leerPosts();

    if (vista) { writeFileSync(vista, vistaPrevia(posts)); console.log(`Vista previa en ${vista}`); }

    const url = PRODUCCION ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
    if (!url) { console.error('Falta la URL de la base en el .env'); process.exitCode = 1; return; }
    if (!PRODUCCION && !/localhost|127\.0\.0\.1/.test(url)) {
        console.error('❌ DATABASE_URL no apunta a localhost. Para producción hace falta --produccion.');
        process.exitCode = 1; return;
    }
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    try {
        console.log(`Base: ${PRODUCCION ? '⚠️  PRODUCCIÓN' : 'LOCAL'} · modo: ${APLICAR ? 'APLICAR (escribe)' : 'ENSAYO'}\n`);
        const slugs = posts.map(p => p.slug);
        const existentes = await prisma.$queryRaw`select slug, status from "BlogPost" where slug = any(${slugs})`;
        const ya = new Map(existentes.map(e => [e.slug, e.status]));
        for (const p of posts) {
            const palabras = p.content.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
            console.log(`${ya.has(p.slug) ? `ya está (${ya.get(p.slug)})` : 'ALTA como DRAFT'}  ${p.slug}  · ${palabras} palabras · ${p.category}`);
        }
        const altas = posts.filter(p => !ya.has(p.slug));
        console.log(`\nAltas: ${altas.length} de ${posts.length}`);
        if (!APLICAR) { console.log('Ensayo: no se escribió nada. Para aplicarlo: --aplicar'); return; }

        for (const p of altas) {
            await prisma.$executeRaw`
                insert into "BlogPost" (id, slug, title, excerpt, "metaTitle", "metaDescription", content, date, category, "imageUrl", status, "createdAt", "updatedAt")
                values (${randomUUID()}, ${p.slug}, ${p.title}, ${p.excerpt}, ${p.metaTitle}, ${p.metaDescription}, ${p.content}, now(), ${p.category}, ${p.imageUrl}, 'DRAFT', now(), now())`;
        }
        console.log(`✅ ${altas.length} nota(s) cargadas como borrador.`);
    } finally { await prisma.$disconnect(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch(err => { console.error(err); process.exitCode = 1; });
}
