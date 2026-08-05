/**
 * Arma stories 9:16 de productos, leyendo el catálogo.
 *
 *   node scripts/social/generar-story-producto.mjs --produccion --marca "Cápsula Escarlata" --cantidad 20
 *
 * POR QUÉ SE GENERAN Y NO SE ESCRIBEN (regla R6):
 * una pieza con un precio escrito a mano no renderiza. El precio y la foto
 * salen de la base, así que publicar un valor viejo deja de ser posible en vez
 * de ser "algo a tener cuidado". Si mañana cambia el precio o la foto, la story
 * del día siguiente sale con lo nuevo sin que nadie se acuerde.
 *
 * QUÉ PRODUCTOS ENTRAN
 * Solo los que están publicados en la tienda (WebProduct activo), con stock y
 * con foto. Una story de algo agotado hace venir gente a comprar lo que no hay,
 * que es peor que no publicar.
 *
 * SOBRE EL LINK: la API de Meta no permite el sticker de link en una story
 * publicada por programa — se agrega a mano desde la app. Por eso la placa
 * lleva el nombre del modelo bien visible y el pie remite a la tienda: alguien
 * que ve la story puede buscarlo por nombre y encontrarlo.
 */
import 'dotenv/config';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { RAIZ } from './identidad.mjs';

const SALIDA = path.join(RAIZ, 'social', 'contenido');

function arg(nombre, porDefecto = null) {
    const i = process.argv.indexOf(`--${nombre}`);
    return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
        ? process.argv[i + 1] : porDefecto;
}

/** Un slug seguro para el id de la pieza y el nombre de carpeta. */
function aSlug(t) {
    return String(t).normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** $89.900 — sin decimales, que en una placa no aportan y ocupan. */
function precioAr(n) {
    return `$${Math.round(n).toLocaleString('es-AR')}`;
}

export async function generarStoriesDeProducto({ marca, cantidad, produccion, tienda }) {
    const url = produccion ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
    if (!url) throw new Error(`Falta ${produccion ? 'PROD_DATABASE_URL' : 'DATABASE_URL'} en el .env`);

    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient({ datasources: { db: { url } } });

    try {
        // `select` explícito: el schema local está adelantado respecto de
        // producción y traer la fila entera revienta contra prod.
        const webs = await prisma.webProduct.findMany({
            where: {
                isActive: true,
                product: { brand: { equals: marca, mode: 'insensitive' }, stock: { gt: 0 } },
            },
            select: {
                name: true, slug: true, images: true, imageUrl: true, imageAlts: true,
                product: { select: { model: true, brand: true, price: true, salePrice: true, stock: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        console.log(`\n${webs.length} producto(s) publicados de "${marca}" con stock.`);

        const usables = webs.filter(w => (w.images?.length || w.imageUrl) && (w.product?.price ?? 0) > 0);
        const sinFoto = webs.length - usables.length;
        if (sinFoto > 0) {
            // Se dice en voz alta: un filtro silencioso hace creer que se
            // cubrió todo el catálogo cuando se dejó afuera un tercio.
            console.log(`  · ${sinFoto} quedaron afuera por no tener foto o precio.`);
        }

        const elegidos = usables.slice(0, cantidad);
        const generadas = [];

        for (const w of elegidos) {
            const p = w.product;
            const enOferta = (p.salePrice ?? 0) > 0 && p.salePrice < p.price;
            const precio = enOferta ? p.salePrice : p.price;
            const foto = (w.images?.[0] || w.imageUrl || '').replace(/^\//, '');
            const id = `story-producto-${aSlug(w.name)}`;

            const pieza = {
                id,
                format: '9:16',
                theme: 'dark',
                pilar: 'producto',
                // Marca de origen: el validador exige que toda pieza con precio
                // venga de la base (R6). Escrita a mano, no renderiza.
                fuente: 'base',
                temas: ['armazones'],
                producto: { nombre: w.name, slug: w.slug, marca: p.brand },
                caption: `${w.name} — ${p.brand}. ${precioAr(precio)}${enOferta ? ' (en oferta)' : ''}.\n\nEn la tienda: ${tienda}/producto/${w.slug}\nO vení a probártelo en Cerro de las Rosas.`,
                slides: [
                    {
                        // `number` es la plantilla de producto: la foto va
                        // arriba y sin velo pesado (en un armazón la foto ES el
                        // producto) y el precio va grande.
                        type: 'number',
                        role: 'portada',
                        image: foto,
                        title: `${w.name} · ${p.brand}`,
                        dato: precioAr(precio),
                        body: enOferta
                            ? 'En oferta. En la tienda y en el local, Cerro de las Rosas.'
                            : 'En la tienda y en el local, Cerro de las Rosas.',
                    },
                ],
            };

            const destino = path.join(SALIDA, `${id}.json`);
            await writeFile(destino, JSON.stringify(pieza, null, 2) + '\n', 'utf-8');
            generadas.push({ id, nombre: w.name, precio: precioAr(precio), oferta: enOferta });
        }

        console.log(`\n✅ ${generadas.length} story(s) generada(s):\n`);
        generadas.forEach(g => console.log(`   ${g.nombre.padEnd(28)} ${g.precio}${g.oferta ? '  (oferta)' : ''}`));
        return generadas;
    } finally {
        await prisma.$disconnect();
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    try {
        const generadas = await generarStoriesDeProducto({
            marca: arg('marca', 'Cápsula Escarlata'),
            cantidad: Number(arg('cantidad', 20)),
            produccion: process.argv.includes('--produccion'),
            tienda: process.env.NEXT_PUBLIC_APP_URL || 'https://atelieroptica.com.ar',
        });
        console.log(`\nRenderizar todas:\n  for f in social/contenido/story-producto-*.json; do node scripts/social/render.mjs "$f"; done`);
        if (!generadas.length) process.exitCode = 1;
    } catch (e) {
        console.error(`\n❌ ${e.message}`);
        process.exit(1);
    }
}
