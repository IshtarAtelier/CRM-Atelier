# Auditoría de SEO y Metadatos (v4)

## 1. Resumen Ejecutivo
La aplicación web utiliza de manera correcta y moderna el nuevo **App Router de Next.js (App Directory)** para el manejo de SEO. El uso del antiguo componente `next/head` ha sido completamente erradicado a favor de las APIs `export const metadata` y `generateMetadata`. A nivel técnico general, el SEO On-Page está muy bien estructurado (JSON-LD presente, OpenGraph configurado, estructura de jerarquía HTML sólida). 

Sin embargo, **existen errores críticos en el `sitemap.ts`** que están enviando rutas inexistentes (404) a los motores de búsqueda, afectando negativamente la indexación.

---

## 2. Etiquetas H1 (Jerarquía de Encabezados)
- **Implementación**: Excelente. Se escaneó todo el directorio `src/app` y se validó que cada página pública cuenta con exactamente **una** etiqueta `<h1>` por página. 
- **Excepciones**: Únicamente la ruta privada de administración (`/admin/facturacion/page.tsx`) posee múltiples etiquetas H1, lo cual no impacta el SEO ya que está bloqueada para los rastreadores.
- **Accesibilidad**: Se utilizan técnicas modernas como `<h1 className="sr-only">` en el `page.tsx` del inicio para inyectar palabras clave vitales de SEO ("Atelier Óptica Córdoba — Anteojos de Receta, Lentes de Sol y Multifocales") sin romper el diseño minimalista tipo *Gentle Monster*.

---

## 3. Meta Tags y API de Metadata (Next.js)
- **Uso de `next/head`**: **Erradicado**. La búsqueda en el proyecto arroja que no existen importaciones de `next/head`. Sólo se importa `next/headers` para lectura de cookies y cabeceras en APIs, lo cual es correcto.
- **Metadatos estáticos**: Implementados correctamente vía `export const metadata: Metadata = {...}` en `layout.tsx` global y en los `page.tsx` individuales (ej. `/tienda`, `/blog`, `/urgencias`).
- **OpenGraph & Twitter Cards**: Integración impecable. Las etiquetas `og:title`, `og:description`, `og:image`, `twitter:card` y los `alternates.canonical` están presentes y bien estructurados.
- **Metadatos Dinámicos**: Implementados perfectamente vía `export async function generateMetadata` en las rutas dinámicas como `/producto/[slug]` y `/blog/[slug]`. Automáticamente se generan los `seoTitle` y `seoDescription` si el usuario no los personalizó en la base de datos, usando las variables de marca y modelo del producto.
- **Schema.org / JSON-LD**: Excelente integración global en `layout.tsx`, inyectando objetos enriquecidos del tipo `Organization`, `LocalBusiness` (con horarios y lat/long), y `WebSite` con barra de búsqueda para la SERP de Google.

---

## 4. Sitemap y Archivo Robots
### 4.1. `robots.ts`
- **Estado**: **Perfecto.** 
- Bloquea correctamente mediante directivas `disallow` las carpetas sensibles: `/admin/`, `/api/`, `/login/` y `/checkout/`.
- Permite la indexación general (`*`) e inyecta dinámicamente la URL absoluta al `sitemap.xml`.

### 4.2. `sitemap.ts` (⚠️ PROBLEMAS CRÍTICOS ENCONTRADOS)
El archivo `src/app/sitemap.ts` tiene datos desactualizados (probablemente mock data de versiones previas) que deben solucionarse urgente:

1. **Rutas Estáticas Inexistentes**: 
   - Está inyectando `/varilux` al sitemap, pero dicha ruta no existe en la app y retorna 404. La ruta correcta es `/cristales-opticos/varilux`.
2. **Rutas Estáticas Faltantes**: 
   - No se están indexando las landings específicas de los cristales: `/cristales-opticos/crizal`, `/cristales-opticos/blue-uv`, `/cristales-opticos/kodak`, `/cristales-opticos/myofix`, `/cristales-opticos/stellest`, `/cristales-opticos/transitions`, `/cristales-opticos/xperio`.
3. **Slugs del Blog Desfasados (Hardcodeados)**: 
   - El arreglo estático `blogSlugs` contiene URLs inventadas/mockeadas como `mejor-optica-multifocales-cordoba`, pero las carpetas físicas reales en `src/app/blog/` son diferentes (ej. `como-leer-receta-oftalmologica`, `control-miopia`, etc.). 
   - **Consecuencia**: Google está intentando indexar posts inexistentes y recibiendo errores 404, mientras que los posts reales se quedan sin aparecer en el sitemap.

*(Nota: Los slugs de los productos están correctos porque se consumen dinámicamente desde Prisma mediante `prisma.webProduct.findMany`).*

---

## 5. Recomendaciones de Acción
1. **Refactorizar `sitemap.ts`**:
   - Eliminar el arreglo hardcodeado de `blogSlugs`.
   - Leer dinámicamente las carpetas dentro de `src/app/blog/` (excepto `[slug]` y `page.tsx`) usando `fs.readdirSync`, o consultar la lista de posts si vienen de un CMS/Base de datos.
   - Reemplazar `/varilux` en `staticRoutes` por toda la familia de cristaleras (`/cristales-opticos/varilux`, `/cristales-opticos/crizal`, etc.).
2. Mantener la estricta vigilancia sobre las meta tags y la estructura de un único H1 en futuros desarrollos visuales.
