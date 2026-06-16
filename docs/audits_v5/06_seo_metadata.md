# Auditoría de SEO y Metadatos

**Fecha:** Junio 2026  
**Proyecto:** Atelier Óptica (Next.js App Router)

Esta auditoría revisa el estado actual de las configuraciones de SEO, uso de encabezados H1, metadatos, migración de dependencias obsoletas (`next/head`) y la generación del mapa del sitio (Sitemap) en la aplicación.

---

## 1. Encabezados H1 (H1 Tags)

### Estado Actual: **Aceptable / Bueno**
Se analizaron las páginas y plantillas dentro de `src/app`.
- **Implementación Global:** De un total de aproximadamente 75 páginas identificadas, se confirma la presencia de la etiqueta `<h1>` de forma directa o a través de componentes (ej: `CristalHero`, `motion.h1` de Framer Motion en la landing page de Wicue).
- **Semántica:** Las páginas de producto dinámico, el blog y la mayoría de páginas estáticas usan un solo H1 principal. Esto ayuda a los motores de búsqueda a entender el contenido primario de la URL.
- **Observación Menor:** En la página de `arma-tus-lentes` el encabezado principal tiene clases como `text-[11px] uppercase`. Si bien es válido semánticamente para SEO, es inusual ver un H1 estilizado de forma tan pequeña (parece un supra-título). No afecta negativamente a los motores, pero debe haber coherencia estructural en la página.

## 2. Metadatos (Meta Tags & Next Metadata API)

### Estado Actual: **Excelente**
El proyecto ha implementado de manera muy prolija la configuración de metadatos utilizando las capacidades nativas del Next.js App Router (`Metadata` object).

- **Globales (`layout.tsx`):** Se definió correctamente un `metadataBase` con la URL del sitio y un `template` en los títulos (`"%s | Atelier Óptica"`), lo que garantiza coherencia en todo el sitio sin repetir código. También están configuradas palabras clave base y OpenGraph (para previsualizaciones en redes sociales/WhatsApp).
- **Estáticos:** Alrededor de 49 archivos (`page.tsx` y `layout.tsx`) usan `export const metadata: Metadata` proporcionando títulos, descripciones, palabras clave e incluso links canónicos (`alternates`).
- **Dinámicos:** Las páginas `/producto/[slug]` y `/blog/[slug]` utilizan exitosamente `generateMetadata` para extraer información desde la base de datos y construir los títulos dinámicos y descripciones optimizadas de forma automática.

## 3. Uso de `next/head`

### Estado Actual: **Limpio (Correcto)**
- Se realizó una búsqueda profunda en `src/app` y **no se encontraron rastros** de importaciones de `next/head` ni del componente `<Head>`.
- Como el proyecto usa App Router, la documentación oficial de Next.js indica que `next/head` es obsoleto en favor de la API de Metadata (mencionada en el punto anterior). Esto demuestra una migración exitosa y completa a la nueva arquitectura.

## 4. Sitemap y Robots.txt

### Estado Actual: **Contiene Errores Críticos a Resolver**
El archivo `robots.ts` se encuentra correctamente configurado, permitiendo el rastreo global y bloqueando carpetas sensibles (`/admin/`, `/api/`, `/login/`). Sin embargo, el archivo dinámico `sitemap.ts` (`src/app/sitemap.ts`) tiene algunos problemas que requieren atención inmediata para no perder tráfico orgánico:

1. **Rutas Estáticas Rotas o Desactualizadas:**
   - En el arreglo `staticRoutes` existe la URL `'/varilux'`. Esta ruta actualmente devuelve un error 404 porque la URL real de la página en el código fuente es `/cristales-opticos/varilux`.
   - **Faltantes:** Se han omitido de las rutas estáticas las demás páginas importantes de cristales (ej: `/cristales-opticos/crizal`, `/cristales-opticos/kodak`, `/cristales-opticos/transitions`, `/cristales-opticos/stellest`, etc.).

2. **Rutas de Blog Hardcodeadas:**
   - `sitemap.ts` inyecta las URLs del blog de forma mixta (hardcodeando un array `blogSlugs` de 22 artículos). No obstante, dentro de la carpeta `src/app/blog/` existen carpetas de páginas estáticas adicionales (ej: `colores-cristales`, `control-miopia`, etc.) que **no figuran** en el sitemap. Idealmente, el sitemap debería recorrer todos los posts activos de la base de datos dinámicamente o leer los directorios existentes en vez de usar una constante hardcodeada.

3. **Puntos Positivos del Sitemap:**
   - Los productos (`/producto/[slug]`) se iteran de manera totalmente dinámica conectándose a la base de datos (vía `prisma.webProduct.findMany`), garantizando que siempre se indexen solo los productos activos e informando fechas de `lastModified` reales.

---

## Recomendaciones a Implementar

1. **Reparar el Sitemap (`src/app/sitemap.ts`):** 
   - Eliminar `'/varilux'` de las `staticRoutes` y agregar la familia de cristales correcta (`'/cristales-opticos/varilux'`, `'/cristales-opticos/crizal'`, etc.).
   - Automatizar o actualizar la lista de blogs (`blogSlugs`) para que coincidan con los artículos de base de datos o estáticos reales.
2. **Revisar Etiquetas H1:** Garantizar visualmente que el texto en el que se aplica el H1 siempre es el título representativo y primario de cada página. 
3. **Imágenes para Redes (OpenGraph):** Validar que `/images/og-image.jpg` existe y tiene el tamaño recomendado (1200x630) para previsualizaciones impecables.
