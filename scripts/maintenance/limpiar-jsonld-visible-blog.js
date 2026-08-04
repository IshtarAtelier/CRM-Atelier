/**
 * Saca el bloque JSON-LD que quedó pegado DENTRO del cuerpo de 18 notas del blog.
 *
 * Qué pasaba: al final del artículo se veía un recuadro negro con el código
 * schema.org crudo ({"@context": "https://schema.org", ...}). No es un detalle
 * estético: ese markup va oculto en el <head>, y la página del blog YA lo emite
 * bien (src/app/blog/[slug]/page.tsx:1584-1592, tres bloques
 * application/ld+json). O sea que el del cuerpo es una copia duplicada, visible
 * y sin ninguna función.
 *
 * Uso:
 *   node scripts/maintenance/limpiar-jsonld-visible-blog.js            → PRUEBA
 *   node scripts/maintenance/limpiar-jsonld-visible-blog.js --execute  → aplica
 *
 * Guarda el contenido anterior completo en backups/ antes de escribir.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const EXECUTE = process.argv.includes('--execute');
const url = process.env.PROD_DATABASE_URL;
if (!url) { console.error('Falta PROD_DATABASE_URL'); process.exit(1); }
const prisma = new PrismaClient({ datasources: { db: { url } } });

/**
 * Quita el bloque de código con el JSON-LD, junto al <hr> que lo precede.
 * Conservador: solo toca bloques <pre><code> que realmente contienen schema.org,
 * para no borrar un ejemplo de código legítimo de alguna nota.
 */
function limpiar(html) {
    if (!html) return html;
    let out = html;

    // <hr> opcional + <pre><code ...>…schema.org…</code></pre>
    const bloque = /(?:<hr\s*\/?>\s*)?<pre>\s*<code[^>]*>[\s\S]*?<\/code>\s*<\/pre>/gi;
    out = out.replace(bloque, (m) => (/@context|schema\.org/i.test(m) ? '' : m));

    return out.replace(/\s+$/, '') + '\n';
}

(async () => {
    const posts = await prisma.blogPost.findMany({ select: { id: true, slug: true, content: true } });
    const afectados = posts.filter(p => /@context|schema\.org/i.test(p.content || ''));

    console.log(`Notas del blog: ${posts.length} · con JSON-LD visible: ${afectados.length}`);
    console.log();

    const cambios = [];
    for (const p of afectados) {
        const nuevo = limpiar(p.content);
        const quedaSchema = /@context|schema\.org/i.test(nuevo);
        cambios.push({
            id: p.id,
            slug: p.slug,
            antes: p.content.length,
            despues: nuevo.length,
            limpio: !quedaSchema,
            contenidoNuevo: nuevo,
            contenidoAnterior: p.content,
        });
    }

    for (const c of cambios) {
        const quitado = c.antes - c.despues;
        const estado = c.limpio ? 'OK ' : '⚠️ QUEDA SCHEMA';
        console.log(`  ${estado} ${c.slug.padEnd(52).slice(0, 52)} ${String(quitado).padStart(5)} caracteres menos`);
    }

    const problemas = cambios.filter(c => !c.limpio);
    if (problemas.length) {
        console.log(`\n⚠️ ${problemas.length} nota(s) quedarían con schema: NO se aplica nada. Revisar a mano.`);
        await prisma.$disconnect();
        return;
    }

    if (!EXECUTE) {
        console.log('\nMODO PRUEBA: no se escribió nada. Correr con --execute para aplicar.');
        await prisma.$disconnect();
        return;
    }

    const backupPath = path.join(__dirname, '..', '..', 'backups', `blog-jsonld-${Date.now()}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(
        cambios.map(c => ({ id: c.id, slug: c.slug, contenidoAnterior: c.contenidoAnterior })), null, 2));
    console.log(`\nRespaldo del contenido anterior: ${backupPath}`);

    for (const c of cambios) {
        await prisma.blogPost.update({
            where: { id: c.id },
            data: { content: c.contenidoNuevo },
            select: { id: true },
        });
    }
    console.log(`Aplicado: ${cambios.length} notas limpias.`);

    await prisma.$disconnect();
})().catch(async (e) => { console.error('ERROR:', e.message); await prisma.$disconnect(); process.exit(1); });
