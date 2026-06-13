import React from 'react';
// Definir React como global para que los archivos importados con JSX no tiren error de referencia
(globalThis as any).React = React;

import { renderToStaticMarkup } from 'react-dom/server';
import { PrismaClient } from '@prisma/client';
import { posts } from '../src/app/blog/[slug]/page';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando migración de artículos estáticos a la base de datos...');
  
  const postEntries = Object.entries(posts);
  let importedCount = 0;
  let skippedCount = 0;

  for (const [slug, post] of postEntries) {
    try {
      // Verificar si ya existe en la base de datos
      const existing = await prisma.blogPost.findUnique({
        where: { slug }
      });

      if (existing) {
        console.log(`[SKIP] El artículo con slug "${slug}" ya existe en la base de datos.`);
        skippedCount++;
        continue;
      }

      // Renderizar el contenido React JSX a HTML estático
      const htmlContent = renderToStaticMarkup(post.content);

      // Crear el registro en la base de datos
      await prisma.blogPost.create({
        data: {
          slug: post.slug,
          title: post.title,
          excerpt: post.excerpt,
          metaTitle: post.metaTitle || post.title,
          metaDescription: post.metaDescription || post.excerpt,
          content: htmlContent,
          date: new Date(post.date + 'T12:00:00Z'),
          category: post.category,
          imageUrl: post.imageUrl || null,
          status: 'PUBLISHED'
        }
      });

      console.log(`[OK] Importado: "${post.title}" (${slug})`);
      importedCount++;
    } catch (error) {
      console.error(`[ERROR] Error importando "${post.title}" (${slug}):`, error);
    }
  }

  console.log(`\nResumen:`);
  console.log(`- Artículos totales en el código: ${postEntries.length}`);
  console.log(`- Artículos importados con éxito: ${importedCount}`);
  console.log(`- Artículos omitidos (ya existentes): ${skippedCount}`);
}

main()
  .catch((e) => {
    console.error('Error fatal durante la migración:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
