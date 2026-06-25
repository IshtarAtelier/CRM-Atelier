require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.PROD_DATABASE_URL
        }
    }
});

async function main() {
    try {
        const posts = await prisma.blogPost.findMany({
            where: { status: 'PUBLISHED' },
            select: { slug: true, title: true }
        });
        console.log(`Found ${posts.length} published posts in DB:`);
        posts.forEach(p => console.log(`- ${p.slug}`));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
