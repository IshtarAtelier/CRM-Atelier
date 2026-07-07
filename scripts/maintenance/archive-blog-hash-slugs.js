const path = require('path');
const fs = require('fs');

// Carga las variables de entorno desde el .env del proyecto
const projectEnv = path.resolve(__dirname, '../../.env');
if (fs.existsSync(projectEnv)) {
    fs.readFileSync(projectEnv, 'utf8').split('\n').forEach(line => {
        const [key, ...vals] = line.split('=');
        if (key && !key.startsWith('#') && vals.length) {
            process.env[key.trim()] = vals.join('=').trim().replace(/^["']|["']$/g, '');
        }
    });
}

// Por defecto apunta a la base LOCAL. Solo usa producción con el flag --prod explícito.
const useProd = process.argv.includes('--prod');
const isApply = process.argv.includes('--apply');

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    datasources: { db: { url: useProd ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL } }
});

// Mismo mapa que HASH_SLUG_REDIRECTS en src/app/blog/[slug]/page.tsx:
// slugs heredados (con sufijo hash de Medium/Tienda Nube) -> slug limpio.
const HASH_SLUG_REDIRECTS = {
    'anteojos-para-ninos-salud-visual-y-vuelta-al-cole-atelier-optica-cordoba-de24d54c7a83': 'anteojos-para-ninos',
    'lentes-filtro-luz-azul-home-office-cordoba-atelier-optica-85679646df21': 'filtro-azul-pantallas',
    'tendencias-anteojos-de-sol-2026-cordoba-atelier-optica-d67c205b4d5d': 'lentes-de-sol-tendencias-2026',
    'lentes-progresivos-multifocales-cordoba-atelier-optica-c0e9ffcaefb9': 'guia-multifocales-cordoba',
    'anteojos-segun-tipo-rostro-guia-cordoba-atelier-optica-588826877f03': 'elegir-anteojos-recetados',
    'tendencias-en-anteojos-2026-marcos-colores-y-estilos-que-dominan-este-anio-09f7ade26e9d': 'diseno-y-marcas-armazones-cordoba',
    'tratamiento-crizal-essilor-en-crdoba-2026-visin-clara-y-proteccin-total-6fd79b8ca784': 'multifocales-marcas-precios-varilux-novar',
    'xperio-transitions-essilor-cordoba-2026-529a0209b715': 'cristales-fotocromaticos-transitions',
    'varilux-liberty-3-0-cordoba-2026-5c5c684411a8': 'multifocales-primera-vez-guia-cordoba',
    'varilux-physio-cordoba-2026-1c4afadee3eb': 'mejor-optica-multifocales-cordoba',
    'varilux-comfort-max-cordoba-f11509d74771': 'pasos-faciles-adaptacion-multifocales',
    'varilux-xr-series-cordoba-dcf372d4c673': 'por-que-nuestros-multifocales-no-fallan-tecnologia-cordoba',
    'multifocales-vs-bifocales-88beb900df52': 'bifocales-vs-multifocales-diferencias',
    'lentes-multifocales-precios-argentina-893166c0d81a': 'precio-multifocales-cordoba-2026',
    'lentes-multifocales-cordoba-69ccf4016c8d': 'guia-multifocales-cordoba',
    'lentes-multifocales-cordoba-69ccf4016c8d-1572994c138d': 'guia-multifocales-cordoba',
    'lentes-varilux-9f7dbebda6cb': 'multifocales-marcas-precios-varilux-novar',
    'lentes-varilux-fotocromaticos-cordoba-c0ffdb0d81fc': 'cristales-fotocromaticos-transitions',
};

const HASH_SUFFIX_REGEX = /-[0-9a-f]{12}$/;

// Slugs limpios que existen como páginas estáticas (posts en [slug]/page.tsx o carpetas propias),
// por si el destino no está en la DB.
const STATIC_SLUGS = new Set([
    'ray-ban-meta-smart-glasses-cordoba', 'lentes-wicue-oscurecen-con-boton', 'control-miopia',
    'tratamiento-antirreflex-crizal-sapphire', 'lentes-eyezen-descanso-pantallas-essilor',
    'lentes-stellest-control-miopia-infantil', 'varilux-xr-series-inteligencia-artificial',
    'varilux-comfort-max-dolor-de-cuello', 'varilux-vs-genericos-diferencias',
    'mejor-optica-multifocales-cordoba', 'precio-multifocales-cordoba-2026',
    'optica-exclusiva-cerro-rosas-cordoba', 'multifocales-primera-vez-guia-cordoba',
    'anteojos-para-ninos',
]);

function stripHash(slug) {
    let clean = slug;
    while (HASH_SUFFIX_REGEX.test(clean)) {
        clean = clean.replace(HASH_SUFFIX_REGEX, '');
    }
    return clean;
}

async function main() {
    console.log('--- Archivado de posts del blog con slug heredado (sufijo hash) ---');
    console.log(`Base de datos: ${useProd ? 'PRODUCCIÓN (--prod)' : 'local'}`);
    if (!isApply) {
        console.log('⚠️ Modo SIMULACIÓN (dry-run, por defecto). No se realizarán cambios. Usá --apply para aplicar.');
    }
    if (useProd && !process.env.PROD_DATABASE_URL) {
        console.error('❌ No hay PROD_DATABASE_URL en el .env. Abortando.');
        process.exit(1);
    }

    const allPosts = await prisma.blogPost.findMany({
        select: { id: true, slug: true, status: true, title: true }
    });
    const slugsInDb = new Map(allPosts.map(p => [p.slug, p]));

    let archived = 0;
    let skipped = 0;

    for (const post of allPosts) {
        const isLegacy = post.slug in HASH_SLUG_REDIRECTS || HASH_SUFFIX_REGEX.test(post.slug);
        if (!isLegacy) continue;

        const target = HASH_SLUG_REDIRECTS[post.slug] || stripHash(post.slug);
        const targetInDb = slugsInDb.get(target);
        const targetExists = (targetInDb && targetInDb.status === 'PUBLISHED') || STATIC_SLUGS.has(target);

        if (!targetExists) {
            console.log(`⏭️  ${post.slug} -> sin versión limpia publicada ("${target}"). Se deja como está.`);
            skipped++;
            continue;
        }

        if (post.status === 'ARCHIVED') {
            console.log(`✔️  ${post.slug} ya estaba archivado.`);
            continue;
        }

        console.log(`📦 ${post.slug} (${post.status}) -> archivar. Redirige a /blog/${target}.`);
        if (isApply) {
            await prisma.blogPost.update({
                where: { id: post.id },
                data: { status: 'ARCHIVED' }
            });
        }
        archived++;
    }

    console.log('--- Resumen ---');
    console.log(`Posts con slug heredado ${isApply ? 'archivados' : 'a archivar'}: ${archived}`);
    console.log(`Sin versión limpia (no se tocan): ${skipped}`);
    if (!isApply && archived > 0) {
        console.log('Corré de nuevo con --apply para aplicar los cambios (y --prod si corresponde, con autorización).');
    }
}

main()
    .catch(err => {
        console.error('❌ Error:', err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
