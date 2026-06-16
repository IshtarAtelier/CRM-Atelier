# Auditoría de SEO y Metadatos

**Fecha:** 15 de Junio de 2026
**Objetivo:** Evaluar la implementación de SEO on-page, metadatos globales, generación dinámica de metadatos, sitemap, robots y estructura de encabezados (H1) en la aplicación web basada en Next.js (App Router).

## 1. Configuración Global de SEO (Layout Principal)
**Archivo analizado:** `src/app/layout.tsx`

La aplicación utiliza correctamente la API de metadatos de Next.js App Router (`export const metadata`), prescindiendo totalmente de `next/head` (que es exclusivo de Pages Router).
- **Título base y template:** Se define un esquema de título `"Atelier Óptica | Armazones, Cristales y Multifocales en Cuotas"` con un template `"%s | Atelier Óptica"`, asegurando una marca constante en todas las páginas.
- **OpenGraph & Twitter Cards:** Correctamente implementado con imágenes predeterminadas, URL base (`metadataBase`), y descripciones específicas para redes sociales.
- **Palabras Clave (Keywords):** Bien definidas abarcando los principales términos de búsqueda ("optica cordoba", "multifocales en cuotas", "precio multifocales").

## 2. Generación Dinámica de Metadatos (SEO Dinámico)
**Archivos analizados:** 
- `src/app/producto/[slug]/page.tsx`
- `src/app/blog/[slug]/page.tsx`

**Hallazgos:**
Las correcciones previas de SEO dinámico están activas y funcionan correctamente mediante la función `export async function generateMetadata`.
- **Productos:** Se obtiene la información del producto por slug y se inyectan como variables para `title`, `description` (con "mensajitos" personalizados y fallback dinámico), URL canónica (`alternates.canonical`), y configuración OpenGraph usando la primera imagen del catálogo o una imagen de relleno (`mockImage`).
- **Blog:** Similar estructura, levantando los artículos desde `getPostBySlug` y pasando `cleanTitle` (removiendo duplicidad de la marca) junto con la fecha de publicación (`publishedTime`) bajo el tipo `article` para OpenGraph.

## 3. Mapas de Sitio y Rastreo (Sitemap y Robots)
**Archivos analizados:**
- `src/app/sitemap.ts`
- `src/app/robots.ts`

**Hallazgos:**
Ambos archivos están implementados utilizando el estándar de metadatos de Next.js App Router (`MetadataRoute.Sitemap` y `MetadataRoute.Robots`).
- **Sitemap (`sitemap.ts`):** 
  - Rutas estáticas con prioridad ajustada (la raíz tiene prioridad `1.0`, secciones principales `0.8`).
  - Extracción dinámica de slugs del Blog (prioridad `0.7`) y de Productos desde Prisma DB (`where: { isActive: true }` con prioridad `0.9` y actualización diaria).
- **Robots (`robots.ts`):** 
  - Permitido de forma general (`userAgent: '*'`).
  - Bloqueo correcto a directorios administrativos, de API y procesos de pago (`/admin/`, `/api/`, `/login/`, `/checkout/`).
  - Enlace al sitemap incluido al final (`https://www.atelieroptica.com.ar/sitemap.xml`).

## 4. Estructura de Encabezados (H1)
**Hallazgos:**
El uso de etiquetas `<h1/>` se encuentra estandarizado en la gran mayoría de las páginas estáticas y dinámicas. 
- En la página principal (`src/app/page.tsx`), se implementa una etiqueta H1 estructurada para accesibilidad y rastreadores (`<h1 className="sr-only">Atelier Óptica Córdoba — Anteojos de Receta, Lentes de Sol y Multifocales</h1>`), lo cual evita romper el diseño "Hero" pero mantiene la semántica HTML intacta.
- En las páginas internas (blog, catálogo, contactos), las etiquetas H1 son utilizadas correctamente reflejando el contenido principal de cada página.

## Conclusión y Veredicto
La implementación de SEO técnico en el proyecto es **excelente y se encuentra totalmente adaptada al estándar de Next.js App Router**.
- **`next/head`**: No se encontraron vestigios de importaciones erróneas.
- **Metadatos dinámicos**: Operativos y bien protegidos contra fallos por páginas no encontradas.
- **Rastreo**: Sitemap actualizado dinámicamente conectando con la base de datos de productos y reglas del robot claras para maximizar la indexación de productos y artículos sin filtrar rutas críticas.
