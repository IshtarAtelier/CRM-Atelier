# Auditoría de Arquitectura Frontend (v3)

## 1. Resumen Ejecutivo
Esta auditoría detalla el estado actual de la arquitectura Frontend del proyecto **Atelier Óptica**. El sistema se presenta como una aplicación monolítica robusta desarrollada en **Next.js 15.1.11** utilizando exclusivamente el paradigma **App Router** (`src/app`). La arquitectura soporta un enfoque híbrido, gestionando simultáneamente el escaparate público (E-Commerce) y el panel de administración privado (CRM), así como una extensa API.

## 2. Estructura de Directorios y Routing
El proyecto ha consolidado la estructura moderna de Next.js, prescindiendo del antiguo directorio `pages` a favor de un enfoque 100% basado en `app`. 

### 2.1 Enrutamiento Público (E-commerce)
Las rutas públicas están organizadas directamente en el directorio `src/app` (ej. `/tienda`, `/checkout`, `/blog`, `/contacto`, `/cristales-opticos`).
- **Layout Global**: `src/app/layout.tsx` proporciona la carcasa base de la aplicación con configuración de tipografía (Geist), metadatos globales avanzados para SEO y scripts PWA (Service Worker).
- **Home (`src/app/page.tsx`)**: Utiliza Server Components para buscar productos destacados a través de `Prisma` y generar `LD+JSON` estructurado (Organization, Optician, WebSite), lo que maximiza la calificación en Lighthouse/SEO.

### 2.2 Enrutamiento Privado (CRM/Admin)
Encapsulado en `src/app/admin`, incluye subdominios como `/facturacion`, `/inventario`, `/caja`, `/pedidos`, y `/cotizador`.
- **Admin Layout**: `src/app/admin/layout.tsx` envuelve la experiencia interna con una interfaz de tipo dashboard: provee un `Sidebar`, `FloatingDock`, un `CommandPalette`, notificaciones (`LeadToastNotifications`) y un chat asistido (`CopilotChat`).
- **Middleware**: `src/middleware.ts` es el pilar de seguridad. Separa eficientemente las políticas de acceso: inyecta roles y headers a las rutas `/admin` con autenticación por cookies (JWT), y defiende las APIs exceptuando aquellas designadas de uso público o webhook (`/api/bot/`, `/api/whatsapp/`).

### 2.3 Capa API (Route Handlers)
Agrupada de manera exhaustiva en `src/app/api`, expone rutas REST-like que dan vida a las integraciones del Bot de WhatsApp, OCR, pasarelas de pago, facturación AFIP, entre otras. Al convivir en la misma jerarquía de App Router, aprovechan las optimizaciones y variables de entorno del framework.

## 3. Arquitectura de Componentes
El directorio `src/components/` refleja un nivel de madurez alto, dividiendo visuales y lógicas de dominio.
- **Storefront**: Un subdirectorio masivo dedicado exclusivamente al e-commerce público (`FilmmakerReel`, `HomeMacroFilm`, `CustomGlassesBuilder`, etc.), focalizado en diseño cinematográfico y scroll interactivo horizontal.
- **UI & Core**: Fragmentación en directorios como `ui/`, `billing/`, `dashboard/`, `contacts/`. El sistema utiliza extensivamente patrones como modales y paneles laterales (`Sheet`, `Dialog` - implícitamente mediante Framer Motion o UI Libraries integradas).
- **Estado Global**: Para lógicas que traspasan el árbol (ej. el carrito de compras en `src/store/useCart.ts`), el proyecto usa **Zustand** como solución de persistencia ligera.

## 4. Estilos y Diseño Sensible
- **Tailwind CSS v4**: Integrado globalmente en `src/app/globals.css`. Hace uso extensivo de CSS Variables en raíz (`@theme inline`) para el esquema de colores (Backgrounds: `#faf8f5`, Primary: `#9e7f65`).
- **Consistencia Visual**: Emplea una combinación entre Tailwind para la maqueta, utilidades tipográficas fluidas y `framer-motion` para micro-interacciones cinematográficas (especialmente vitales en el E-commerce).

## 5. Optimizaciones y Buenas Prácticas
1. **Server Components por Defecto**: La capa `page.tsx` no lleva `"use client"`, posibilitando acceso a bases de datos (`prisma.webProduct.findMany`) directo en SSR.
2. **Componentes Lazy y Suspense**: La jerarquía está ideada para segmentar el bundle (client boundaries limitados a widgets interactivos).
3. **SEO Técnico Consolidado**: Sitemaps automáticos (`sitemap.ts`), directivas de robots (`robots.ts`) y configuración robusta de manifest/pwa.
4. **Linting & Code Quality**: Configuración unificada con `eslint` (`eslint.config.mjs`) que refuerza reglas sobre Next.js y React 19.

## Conclusión
La arquitectura Frontend refleja una ejecución impecable del App Router de Next.js. El aislamiento lógico entre "Storefront" y "CRM" permite escalabilidad paralela. La eliminación de `pages` demuestra que se ha completado satisfactoriamente la migración arquitectónica pautada en fases anteriores, dejando un ecosistema veloz, declarativo y sumamente amigable para SEO.
