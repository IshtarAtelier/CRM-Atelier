require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { marked } = require('marked');

// Use PROD_DATABASE_URL to connect directly to the production DB
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.PROD_DATABASE_URL || process.env.DATABASE_URL
        }
    }
});

const dir = path.join(__dirname, 'contenidos-essilor');

async function uploadPosts() {
    try {
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));

        for (const file of files) {
            const filePath = path.join(dir, file);
            let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');

            // Simple frontmatter parser
            const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
            const match = content.match(frontmatterRegex);

            let title = '';
            let meta_description = '';
            let slug = '';
            let image_url = '';
            let bodyMarkdown = content;

            if (match) {
                const fm = match[1];
                bodyMarkdown = content.replace(match[0], '').trim();

                const parseField = (field) => {
                    const qMatch = fm.match(new RegExp(`${field}:\\s*['"](.*?)['"]`));
                    if (qMatch) return qMatch[1].replace(/['"]/g, '').trim();
                    const uMatch = fm.match(new RegExp(`${field}:\\s*([^\\n]+)`));
                    if (uMatch) return uMatch[1].replace(/['"]/g, '').trim();
                    return '';
                };

                title = parseField('title');
                meta_description = parseField('meta_description') || parseField('metaDescription');
                slug = parseField('slug');
                image_url = parseField('image_url') || parseField('imageUrl');
            }

            // Fallbacks
            if (!title) title = file.replace('.md', '').replace(/-/g, ' ').toUpperCase();
            if (!slug) slug = file.replace('.md', '');

            // The excerpt can be the meta description
            const excerpt = meta_description || title;

            // STRIP OUT JSON-LD code blocks so they don't render on the page
            bodyMarkdown = bodyMarkdown.replace(/```json[\s\S]*?```/g, '').trim();

            // Convert body to HTML
            const htmlContent = marked.parse(bodyMarkdown);

            // Determine a category based on the filename or title
            let category = 'Cristales';
            if (file.includes('nino') || file.includes('miopia')) category = 'Pediatría';
            else if (file.includes('transitions') || file.includes('xperio')) category = 'Cristales Especiales';
            else if (file.includes('varilux') || file.includes('definity')) category = 'Multifocales';
            else if (file.includes('blue-uv') || file.includes('eyezen')) category = 'Salud Visual';

            // Beautiful alternating images
            const BEAUTIFUL_IMAGES = [
                '/images/blog/blog1_marcos.png',
                '/images/blog/blog2_homeoffice.png',
                '/images/blog/blog3_eligiendo.png',
                '/images/blog/blog4_leyendo.png',
                '/images/blog/blog5_cordoba.png',
                '/images/blog/blog6_consulta.png',
                '/images/blog/vidriera-atelier.webp',
                '/images/blog/mostrador-marmol.webp',
                '/images/blog/muestrario-smart-lens.webp',
                '/images/blog/local-varilux.webp',
                '/images/blog/arte-monalisa.webp',
                '/images/blog/anteojos-rosa-pastel.webp'
            ];
            const fileIndex = files.indexOf(file);
            const alternateImage = BEAUTIFUL_IMAGES[fileIndex % BEAUTIFUL_IMAGES.length];
            const imageUrl = image_url || alternateImage;

            console.log(`Subiendo: ${slug} ...`);

            await prisma.blogPost.upsert({
                where: { slug: slug },
                update: {
                    title,
                    excerpt,
                    metaTitle: title,
                    metaDescription: meta_description,
                    content: htmlContent,
                    category,
                    imageUrl,
                    status: 'PUBLISHED'
                },
                create: {
                    slug,
                    title,
                    excerpt,
                    metaTitle: title,
                    metaDescription: meta_description,
                    content: htmlContent,
                    category,
                    imageUrl,
                    status: 'PUBLISHED'
                }
            });
            console.log(`✅ ${slug} subido con éxito.`);
        }

        console.log('¡Todos los artículos fueron subidos a Producción exitosamente!');
    } catch (err) {
        console.error('Error subiendo los posts:', err);
    } finally {
        await prisma.$disconnect();
    }
}

uploadPosts();
