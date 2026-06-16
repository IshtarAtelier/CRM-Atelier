# Auditoría de Rendimiento del Frontend

Este documento detalla el análisis de rendimiento de la aplicación Frontend (basada en Next.js), focalizado en los tiempos de carga, tamaño del paquete (bundle size) y optimización de recursos (especialmente imágenes).

## 1. Tamaño del Paquete (Bundle Size) y Tiempos de Carga

De acuerdo con el análisis del build de producción más reciente de Next.js (v15.1.11), la aplicación presenta un excelente manejo del peso de sus paquetes gracias al enrutador de aplicaciones (App Router) y React Server Components:

- **First Load JS (Compartido)**: ~106 kB. Este tamaño es altamente competitivo para una aplicación Next.js y establece un piso de carga muy veloz.
- **Páginas Públicas**: Las páginas orientadas al cliente (`/`, `/tienda`, `/checkout`, `/producto/[slug]`) tienen un payload adicional de First Load JS de apenas ~4 kB a ~9 kB. Esto da como resultado un tiempo de carga total muy reducido (en torno a los 175 kB - 185 kB de First Load JS).
- **Rutas de Administración**: Las vistas en `/admin` oscilan entre 50 kB y 125 kB adicionales por ruta. Considerando que estas páginas tienen lógicas complejas de negocio, el tamaño es más que razonable e impacta únicamente en usuarios internos (no afecta el SEO o la experiencia del cliente final).

**Veredicto**: El uso extensivo de Server Components mantiene el JavaScript del lado del cliente al mínimo. Los tiempos de carga inicial están altamente optimizados.

## 2. Optimización de Imágenes

### Aspectos Positivos
- **Configuración Global**: El archivo `next.config.ts` está excelentemente configurado. Soporta formatos de última generación (`image/avif` y `image/webp`) para todas las imágenes procesadas.
- **Uso en Storefront**: La mayoría de los componentes de la interfaz de cliente (`Interactive3DImage.tsx`, `CategoryGrid.tsx`, `StorefrontFooter.tsx`, etc.) utilizan el componente oficial `<Image>` de `next/image`, lo que garantiza redimensionado automático, carga diferida (lazy loading) por defecto y conversión de formatos on-the-fly.
- **Implementación Reactiva**: En los componentes que usan `<Image>`, se observa un buen uso de la propiedad `sizes="(max-width: 768px) 100vw, 50vw"` para la carga condicional de acuerdo al tamaño del viewport.

### Áreas Críticas de Mejora (Deuda Técnica)
A través de un escaneo en el código base, se detectó el uso del tag nativo HTML `<img src="...">` en lugares que sí impactan al SEO y rendimiento al público:
- **Blog (`/src/app/blog/[slug]/page.tsx`)**: Existen más de 15 incidencias de etiquetas `<img />` directas para cargar avatares, fotos de los posts e imágenes de locales. Esto evade la optimización automática, forzando la descarga de imágenes en su resolución máxima original, perjudicando fuertemente el rendimiento móvil y el puntaje de Lighthouse.
- **Landing Pages (`/src/app/landing/wicue/page.tsx`)**: Se observa la carga de imágenes crudas sin optimización de Next.
- **Dashboard Web (`/src/app/admin/web/page.tsx`)**: Se utiliza extensamente `<img>`. Si bien es para uso interno, a medida que la galería crezca, la vista de administración puede volverse inestable o lenta.

## 3. Carga Dinámica (Code Splitting)

La aplicación aprovecha las características nativas de separación de código del App Router por ruta. Sin embargo:
- El uso de **`next/dynamic`** para la carga diferida de componentes pesados del lado del cliente (como visores 3D, carruseles y selectores de emojis) está casi ausente (solo se identificó en `/admin/whatsapp`).
- **Recomendación**: Evaluar la implementación de carga asíncrona (`next/dynamic` con `ssr: false` donde aplique) para componentes interactivos de Framer Motion en el Storefront que se ubiquen "below the fold" (debajo del pliegue de pantalla inicial), lo que reduciría marginalmente todavía más el impacto en el tiempo total de bloqueo (TBT - Total Blocking Time).

## 4. Conclusiones y Plan de Acción

El proyecto en general está **muy bien optimizado estructuralmente** gracias a las bases de Next.js 15. Sin embargo, se sugieren las siguientes acciones para alcanzar los puntajes máximos (95-100) en Core Web Vitals:

1. **Refactorizar el Blog y Landing Pages**: Reemplazar todas las etiquetas `<img>` estáticas por el componente `<Image>` de `next/image`.
2. **Priorizar LCP (Largest Contentful Paint)**: Asegurarse de que cualquier imagen "above the fold" en la página principal o ficha de producto lleve la etiqueta `priority={true}` en su componente `<Image>`.
3. **Lazy Loading de Componentes**: Implementar `next/dynamic` para secciones interactivas que no son necesarias durante los primeros milisegundos de la renderización del Home.
