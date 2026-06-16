# Análisis de Rendimiento Frontend (Frontend Performance)

Este reporte evalúa el estado actual de los tiempos de carga, la gestión de recursos visuales y el tamaño del paquete (bundle size) de la aplicación, que opera bajo **Next.js 15.1.11** y **React 19**.

## 1. Optimización de Imágenes 🖼️

La plataforma presenta una excelente madurez en el manejo de assets gráficos:

- **Implementación de `next/image`**: Se detectaron aproximadamente 45 usos del componente optimizado a través de toda la aplicación (catálogo, vistas 3D interactiva, carruseles, cotizadores).
- **Formatos Modernos Automáticos**: El archivo `next.config.ts` está explícitamente configurado con `formats: ['image/avif', 'image/webp']`. Esto reduce radicalmente el tamaño del *payload* de las imágenes (a menudo entre un 30% y un 50% frente a JPEG/PNG estándar) mejorando enormemente el **LCP** (Largest Contentful Paint).
- **Orígenes Seguros (CDNs)**: Se configuraron los `remotePatterns` para servir contenido optimizado desde Firebase, Storage de Google Cloud y dominios promocionales propios, centralizando la carga en infraestructuras rápidas.
- **Hallazgos menores**: Existen solo ~3 instancias de etiquetas HTML `<img>` crudas (en `StorefrontNavbar`, `Sidebar` y la vista de fotos de WhatsApp). Si no se trata de íconos o SVGs mínimos, sería beneficioso migrarlos a `next/image`.

## 2. Gestión del Bundle Size y Dependencias 📦

La aplicación incluye múltiples paquetes muy pesados requeridos para el backend (ej. `whatsapp-web.js`, `playwright`, `firebase-admin`, `@google/genai`). El análisis demuestra prácticas saludables para evitar que impacten al usuario:

- **Separación Cliente/Servidor**: Gracias a *React Server Components* y la arquitectura App Router de Next.js, estas pesadas librerías de infraestructura están estrictamente aisladas de los *chunks* que se despachan al navegador web.
- **Carga Dinámica Excelente**: Componentes pesados generadores de PDF (`jspdf`, `jspdf-autotable`) se están importando de manera diferida mediante `await import('jspdf')`. Esto garantiza que el usuario solo descarga esta porción del código cuando solicita descargar una factura o recibo, evitando bloquear el hilo principal (Main Thread) en la carga inicial.
- **Framer Motion**: Se observa un uso intenso de `framer-motion` para animaciones en el `Storefront` (vistas dinámicas, efectos de hover, transiciones de layout). Aunque aporta una experiencia web *premium* altamente dinámica, es una librería voluminosa.
- **Fuentes Optimizadas**: Se ha consolidado el uso de la fuente `Geist` usando el paquete `next/font/google`, lo cual pre-carga el font en tiempo de construcción y erradica el CLS (Cumulative Layout Shift) que se produce por saltos de fuentes web.

## 3. Tiempos de Carga y Core Web Vitals ⏱️

- **First Contentful Paint (FCP) y TTI (Time to Interactive)**: La adopción de Componentes de Servidor garantiza un FCP inicial casi instantáneo al devolver HTML puro en el primer request.
- **Manejo de Scripts de Terceros**: El sistema utiliza `next/script` en componentes de seguimiento estadístico (`TrackingScripts.tsx`) para diferir y evitar que píxeles analíticos interrumpan el renderizado del DOM de la página.

## 4. Oportunidades de Mejora / Plan de Acción 🚀

Aunque el frontend está fuertemente optimizado, se recomiendan los siguientes ajustes preventivos:

1. **Auditorías de Paquete Frecuentes**: Ejecutar `npm run analyze` (gracias a que `@next/bundle-analyzer` ya está configurado en `next.config.ts`) de forma mensual para medir si alguna dependencia nueva "rompe" el tree-shaking y se filtra al cliente.
2. **Animaciones más ligeras (LazyMotion)**: Evaluar el refactor de algunos componentes del `Storefront` para que utilicen `<LazyMotion>` de Framer Motion. Esto retrasa la descarga del core de la animación hasta que se complete la hidratación primaria del usuario móvil.
3. **Limpieza de Imágenes Viejas**: Chequear los `<img>` nativos que quedan rezagados para asegurarse de que no estén filtrando PNGs/JPGs pesados a la red sin optimizar.
