require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { marked } = require('marked');

// Use PROD_DATABASE_URL to connect directly to the production DB
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.PROD_DATABASE_URL
        }
    }
});

const dir = path.join(__dirname, 'contenidos-essilor');

async function uploadPosts() {
    try {
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));

        for (const file of files) {
            const filePath = path.join(dir, file);
            let content = fs.readFileSync(filePath, 'utf8');

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

                const titleMatch = fm.match(/title:\s*"([^"]+)"/);
                if (titleMatch) title = titleMatch[1];

                const metaMatch = fm.match(/meta_description:\s*"([^"]+)"/);
                if (metaMatch) meta_description = metaMatch[1];

                const slugMatch = fm.match(/slug:\s*"([^"]+)"/);
                if (slugMatch) slug = slugMatch[1];
                
                const imageMatch = fm.match(/image_url:\s*"([^"]+)"/);
                if (imageMatch) image_url = imageMatch[1];
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

            // Default image
            const imageUrl = image_url || '/images/blog/blog1_header.png';

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
