# Auditoría de SEO y Metadatos

**Fecha:** 15 de Junio de 2026
**Proyecto:** CRM-Atelier (Web Application)

## 1. Resumen Ejecutivo
La aplicación web utiliza el **App Router de Next.js**, por lo que reemplaza el clásico componente `next/head` por la moderna **Metadata API** (`export const metadata` y `generateMetadata`). En general, la implementación es **excelente** a nivel de etiquetado, estructura de metadatos y schemas (JSON-LD). Sin embargo, se identificó un **problema crítico en la generación del Sitemap (`sitemap.ts`)** relacionado con las rutas del blog que podría afectar severamente la indexación de los artículos.

---

## 2. Metadatos (Metadata API vs next/head)
Dado que el proyecto utiliza el directorio `src/app/`, el uso de `next/head` está deprecado en favor de la Metadata API. La aplicación cumple perfectamente con este estándar.

* **Layout Principal (`src/app/layout.tsx`)**: Configura correctamente la base (`metadataBase`), títulos (con `template` para las páginas secundarias), descripciones, `canonical`, configuración de Open Graph (imágenes, locale) y Twitter Cards.
* **Páginas Estáticas (ej. `/quienes-somos`, `/como-comprar`, `/faq`)**: Exportan su propia constante `metadata` sobrescribiendo el título, la descripción y apuntando correctamente al `canonical` de su URL.
* **Páginas Dinámicas (`/producto/[slug]/page.tsx`, `/blog/[slug]/page.tsx`)**: Hacen uso de la función `generateMetadata` de manera asíncrona, fetcheando datos de Prisma y generando etiquetas Open Graph dinámicas (incluyendo las imágenes y descripciones específicas por producto o artículo).

### JSON-LD (Datos Estructurados)
Se destaca la inclusión de Schemas enriquecidos:
* En la Home (`page.tsx`) se incluye schema de `Organization`, `Optician` (LocalBusiness) y `WebSite` con acciones de búsqueda (SearchAction).
* En el producto (`ProductClient.tsx` / `page.tsx`) se inyecta schema de `Product` y `BreadcrumbList`, enviando disponibilidad, precios, marcas y SKU a Google Shopping de forma nativa.

---

## 3. Estructura de Encabezados (H1)
El etiquetado `H1` es clave para SEO y está correctamente estructurado en las rutas analizadas:
* **Home (`src/app/page.tsx`)**: Tiene un `<h1>` con la clase `sr-only` ("Atelier Óptica Córdoba — Anteojos de Receta, Lentes de Sol y Multifocales"). Es una excelente práctica para dotar de semántica a una portada muy visual y rica en multimedia sin romper el diseño.
* **Tienda (`src/app/tienda/TiendaClient.tsx`)**: Incluye un `<h1>` visible ("Colección de Anteojos").
* **Producto (`src/app/producto/[slug]/ProductClient.tsx`)**: Usa animaciones con Framer Motion pero declara un `<motion.h1>` explícito con el nombre y la marca del modelo.

---

## 4. Sitemap y Robots.txt (`sitemap.ts` y `robots.ts`)
* **`robots.ts`**: Correctamente configurado para permitir el acceso a los bots (con `userAgent: '*'`), bloqueando páginas sensibles o de administración (`/admin/`, `/api/`, `/checkout/`, `/login/`) y referenciando el sitemap correctamente.
* **`sitemap.ts` (PROBLEMA IDENTIFICADO)**:
  La generación del sitemap tiene fallas en la sección del Blog:
  1. **Slugs Hardcodeados**: Posee un array `blogSlugs` con unas 22 URLs "a fuego" (ej. `mejor-optica-multifocales-cordoba`, `precio-multifocales-cordoba-2026`). Si estas URLs no existen, Google rastreará enlaces que dan error 404.
  2. **No incluye los subdirectorios físicos**: Hay muchas rutas en `src/app/blog/` (como `/blog/colores-cristales`, `/blog/como-leer-receta-oftalmologica`, etc.) que **no** se están incluyendo en el arreglo de rutas estáticas (`staticRoutes`).
  3. **No lee de la Base de Datos**: A diferencia de los productos (donde sí usa `prisma.webProduct.findMany`), el sitemap no está recuperando de manera dinámica los artículos creados en el modelo `BlogPost` (`prisma.blogPost`).

---

## 5. Recomendaciones de Acción Inmediata

1. **Refactorizar el Blog en `sitemap.ts`**:
   Se debe modificar `src/app/sitemap.ts` para que genere los enlaces dinámicamente desde la base de datos y/o incluya correctamente las carpetas estáticas:
   ```typescript
   // Fetch posts dinámicos de Prisma
   const blogPosts = await prisma.blogPost.findMany({
     where: { status: 'PUBLISHED' },
     select: { slug: true, updatedAt: true }
   });
   
   const dynamicBlogRoutes = blogPosts.map((post) => ({
     url: \`\${baseUrl}/blog/\${post.slug}\`,
     lastModified: post.updatedAt,
     changeFrequency: 'weekly' as const,
     priority: 0.7,
   }));
   ```
2. **Limpiar Slugs Estáticos**: Eliminar los slugs del array manual `blogSlugs` que ya no funcionen o devolver errores 404. Incluir explícitamente en el `staticRoutes` las páginas informativas del blog que sí existen físicamente en `src/app/blog/`.
