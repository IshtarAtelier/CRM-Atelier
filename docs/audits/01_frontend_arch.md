# Auditoría de Arquitectura Frontend - CRM-Atelier

**Fecha:** 16 de Junio, 2026
**Objetivo:** Análisis exhaustivo de la estructura Frontend (Next.js, Routing, Layouts y Gestión de Estado).

---

## 1. Stack Tecnológico Base
- **Framework Core:** Next.js `15.1.11` (enfocado íntegramente en App Router).
- **Librería UI:** React `19.0.0` y React DOM `19.0.0`.
- **Estilos:** Tailwind CSS `v4` configurado globalmente, soportado con `framer-motion` para animaciones y `lucide-react` para iconografía.
- **Manejo de Estado:** `zustand` para estados globales críticos (como el carrito de compras) complementado con Contextos y Hooks nativos en React.
- **Validación y Utilidades:** `zod` para la validación de esquemas/formularios.

---

## 2. Arquitectura de Enrutamiento (App Router)
El proyecto ha migrado o sido concebido enteramente bajo el paradigma del **App Router de Next.js** (`src/app`), prescindiendo de la clásica carpeta `pages/`. Esta estructura se encuentra altamente fragmentada y modularizada:

1. **Contexto Storefront (Público):**
   Rutas como `/tienda`, `/blog`, `/cristales-opticos`, `/checkout`, `/landing`, orientadas al SEO y al E-commerce. Aprovechan las funciones de layouts compartidos y generación de metadatos estáticos/dinámicos.
2. **Contexto CRM / Admin (Privado):**
   Todo el backoffice está encapsulado bajo `src/app/admin/*` (con submódulos exhaustivos como `pedidos`, `cotizador`, `facturacion`, `whatsapp`).
3. **Contexto Backend (API Routes):**
   Las rutas de API viven en `src/app/api/*`, y funcionan como el backend masivo del aplicativo interactuando con Prisma (base de datos) y servicios externos (AFIP, AWS S3, WhatsApp Web, IA Generativa).

---

## 3. Arquitectura de Layouts y Páginas
La jerarquía de visualización está organizada mediante Layouts anidados (`layout.tsx`), que proporcionan una excelente segregación de responsabilidades:

- **Root Layout (`src/app/layout.tsx`):**
  - **Metadatos y SEO:** Define extensos metadatos estáticos (OpenGraph, Twitter Cards, manifiesto PWA e íconos).
  - **Configuración Global:** Inyección de tipografía (Geist Sans vía `next/font/google`), carga del Service Worker (`/sw.js`) para capabilities PWA y la inclusión del componente `<TrackingScripts />`.
  - **Theming:** Inicialización de clases base (`bg-background`, `text-foreground`) que actúan sobre variables de CSS para manejar un modo claro/oscuro.

- **Admin Layout (`src/app/admin/layout.tsx`):**
  - Layout especializado que envuelve todas las rutas privadas de la administración.
  - Implementa la interfaz central conformada por componentes globales interactivos: `<Sidebar />`, `<FloatingDock />`, `<CommandPalette />`, `<LeadToastNotifications />` y `<CopilotChat />`.
  - Extrae datos iniciales de sesión directamente usando `headers()` del servidor (ej. `x-user-role`, `x-user-name`) antes de pintar los Client Components hijos.

---

## 4. Estilos y Sistema de Diseño (Tailwind CSS v4)
- La configuración de Tailwind está abstraída dentro de `src/app/globals.css` empleando sintaxis moderna de v4 (`@import "tailwindcss";` y `@theme inline`).
- Se observa el uso de un sistema de diseño basado en variables CSS (`--background`, `--primary`, `--sidebar`) lo cual habilita intercambios temáticos (Dark Mode estricto apoyado por selector de clase `.dark`).
- Se extienden utilidades propias personalizadas como `.btn-premium`, `.glass-panel` y animaciones custom (`.animate-shimmer`), garantizando un aspecto "premium" y moderno.

---

## 5. Estructura de Componentes (`src/components/`)
La carpeta `src/components/` aloja la interfaz de usuario:
- **Componentes Base / Globales:** En la raíz de la carpeta se encuentran componentes modulares de gran tamaño como `ContactForm.tsx`, `Sidebar.tsx` o `CotizadorPopup.tsx`.
- **Componentes por Dominio:** Existen carpetas dedicadas para dominios específicos (e.g., `admin`, `Storefront`, `contacts`, `quotes`, `inventory`).
- **Componentes UI (Dumb Components):** Ubicados en `src/components/ui/`, actualmente luce con pocos componentes estandarizados (principalmente un Modal e íconos locales). Gran parte del UI está construido de forma declarativa y acoplada a las páginas/componentes por dominio usando Tailwind utility classes directo en los nodos.

---

## 6. Manejo de Estado y Hooks Locales
- **Global:** Se utiliza `zustand` (evidenciado por `useCart.ts` en `src/store`) para manejar estados que deben persistir entre vistas y ser accedidos transversalmente (como el carrito de compras en la tienda).
- **Hooks Custom:** Se emplea una carpeta `src/hooks` para encapsular la lógica de fetching y estado modular (ej. `useContacts.ts`, `useProducts.ts`).
- Se infiere la utilización extensiva de *Client Components* (indicativo por el uso de `useEffect`, estados reactivos y manejo de eventos DOM en las vistas administrativas y dashboards).

---

## 7. Conclusiones y Recomendaciones
1. **Excelente Modularidad en Routing:** La subdivisión del App Router entre público y administrativo funciona de forma óptima y clara.
2. **Escalabilidad de Componentes:** Se recomienda mover progresivamente los archivos sueltos en `src/components/` (como `ContactForm.tsx` o `BalancePanel.tsx`) hacia sus dominios respectivos (e.g. `src/components/contacts/` y `src/components/dashboard/`) para prevenir aglomeración o migrar a un patrón *Feature-Sliced Design* (FSD).
3. **UI Library Core:** Considerar poblar `src/components/ui/` con componentes atómicos más reutilizables (Botones, Inputs, Dropdowns base) para asegurar consistencia visual, disminuyendo la duplicación de largos listados de utilidades en Tailwind.
4. **Optimización de Rendering:** Para el `Storefront`, se debe priorizar mantener la mayor cantidad de páginas como *Server Components* por cuestiones de rendimiento (Core Web Vitals) y delegar la interactividad únicamente a los nodos "hoja" (Client Components aislados).
