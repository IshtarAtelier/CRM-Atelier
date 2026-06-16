# Reporte de Auditoría: Arquitectura Frontend (Next.js App Router)
**Fecha**: Junio 2026
**Ubicación**: `src/app`

---

## 1. Resumen Ejecutivo
La arquitectura frontend de la aplicación está basada en **Next.js 15 (App Router)**. A grandes rasgos, demuestra una base técnica sólida y adaptada a las necesidades del negocio. Implementa una separación clara de responsabilidades arquitectónicas entre la sección orientada al cliente y la plataforma de administración. 

- **Storefront (E-commerce / Web)**: Adopta un enfoque centrado en Server Components (SSR/ISR) mediante acceso directo a Prisma, resultando en beneficios críticos para el SEO y la velocidad de carga inicial (Core Web Vitals).
- **Admin Panel (`/admin`)**: Adopta un patrón de Single Page Application (SPA), compuesto principalmente por Client Components (`"use client"`) que interactúan con una extensa capa de Route Handlers (REST API).

## 2. Hallazgos y Análisis

### 2.1. Estructuración de Rutas (Routing)
**Estado actual:**
La raíz `src/app` contiene una mezcla plana de todos los dominios de la aplicación. Rutas de la web como `/tienda`, `/blog`, `/producto`, `/faq` y `/contacto` comparten el mismo nivel jerárquico que el panel `/admin` y los endpoints de `/api`. No se ha implementado el patrón de *Route Groups*.

**Impacto:**
Dificulta la organización a medida que la aplicación escala. Impide la posibilidad de tener Layouts raíz completamente aislados para la tienda pública y el panel administrativo sin tener que aplicar condicionales complejos en `src/app/layout.tsx`.

### 2.2. Fetching de Datos (Client-Side)
**Estado actual:**
En las rutas de administración (`src/app/admin/*`), los Client Components obtienen sus datos empleando la API `fetch` nativa envuelta en custom hooks (como `useContacts`) acompañados por `useEffect` y manejo manual de estados (loading, error, AbortController).

**Impacto:**
Genera boilerplate extenso. Ausencia de características modernas como el almacenamiento en caché de peticiones idénticas, revalidación en segundo plano (stale-while-revalidate), "optimistic updates" en la interfaz o paginación unificada.

### 2.3. Optimización de Imágenes y Assets
**Estado actual:**
Se han encontrado al menos 28 instancias de etiquetas HTML nativas `<img>` dentro de varios Client y Server Components (por ejemplo, en `Sidebar.tsx` y `StorefrontNavbar.tsx`).

**Impacto:**
Pérdida de funcionalidades out-of-the-box provistas por Next.js `<Image>`, como la conversión automática a WebP/AVIF, lazy loading inteligente, y prevención del *Cumulative Layout Shift* (CLS).

### 2.4. Uso de Server Actions vs. API Routes
**Estado actual:**
No se detectó el uso de Next.js Server Actions (la directiva `"use server"` es inexistente). En cambio, el 100% de la lógica backend y mutaciones recae sobre Next.js Route Handlers (`src/app/api/*`) que delegan tareas a clases de la carpeta `src/services/`.

**Impacto:**
Esta arquitectura tradicional de Servicios + REST API es altamente funcional, comprobada y favorece un fuerte desacoplamiento. Sin embargo, para formularios sencillos o envíos menores desde el cliente, puede percibirse como sobreingeniería.

### 2.5. Arquitectura de Despliegue de Servicios Pesados
**Estado actual:**
Se verificó que la integración pesada de Puppeteer (`whatsapp-web.js`) se ha abstraído exitosamente en un servicio Node.js independiente localizado en la carpeta raíz `wa-service`, el cual se comunica vía webhooks a `src/app/api/bot/interactions`.

**Impacto:**
Excelente decisión arquitectónica. Evita los clásicos problemas de memory leaks y cold-starts asociados a la ejecución de procesos tipo Puppeteer en entornos Next.js y/o de arquitectura Serverless.

---

## 3. Correcciones y Mejoras Propuestas

1. **Implementar Route Groups**:
   - Mover todas las rutas correspondientes a la vitrina web pública dentro de un subdirectorio agnóstico a la URL, como `src/app/(storefront)`.
   - Organizar las páginas secundarias y legales en `src/app/(storefront)/(informacion)`.
   - Esto dejaría el directorio raíz mucho más prolijo: `/(storefront)`, `/(admin)` y `/api`.

2. **Refactorizar Fetching Cliente con TanStack Query / SWR**:
   - Reemplazar las implementaciones basadas en `useEffect` dentro de hooks como `useContacts` introduciendo una biblioteca robusta como **SWR** (de Vercel) o **TanStack Query**.
   - Esto limpiará cientos de líneas de código redundantes para manejar AbortControllers y status de fetch.

3. **Migración Sistemática a `next/image`**:
   - Reemplazar todas las ocurrencias en componentes estáticos y dinámicos donde se use `<img src={...}>` por el componente importado desde `next/image`. Asegurarse de parametrizar las variables `width` y `height` o proveer el parámetro `fill` para mantener el layout.

4. **Adopción Gradual de Server Actions**:
   - Introducir de manera paulatina Server Actions para mutaciones simples provenientes de componentes de servidor o cliente en la web principal (por ejemplo, la suscripción a newsletters o los formularios de contacto).

5. **Aumentar el uso de Streaming (`Suspense`)**:
   - Expandir los *React Suspense Boundaries* en páginas con consultas a base de datos pesadas que no se beneficien totalmente de la regeneración estática. Esto logrará transmitir el 'shell' o esqueleto de la aplicación inmediatamente mientras el RSC resuelve la información de manera paralela.
