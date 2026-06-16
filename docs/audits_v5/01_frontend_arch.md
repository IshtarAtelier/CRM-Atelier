# Auditoría de Arquitectura Frontend (Next.js App Router)

## 1. Server vs Client Components (El Problema de "use client")
Durante la auditoría de la carpeta `src/app`, se detectó que el paradigma del **App Router** no está siendo aprovechado correctamente en gran parte de la aplicación, especialmente en el panel de administración (`/admin`).

### Hallazgos
- **Uso masivo de `'use client'` a nivel de página:** Casi todas las rutas bajo `app/admin/*` (ej. `admin/pedidos/page.tsx`, `admin/caja/page.tsx`), así como páginas como `contacto/page.tsx` y `checkout/page.tsx`, declaran `'use client'` en la primera línea.
- **Componentes Monolíticos:** Archivos como `app/admin/pedidos/page.tsx` superan las 1400 líneas, mezclando interfaz de usuario, estado local y la orquestación del fetching.
- **Punto Positivo:** La página de inicio (`app/page.tsx`) sí hace un uso correcto de los Server Components, realizando consultas directas a Prisma de forma asíncrona antes de renderizar la UI, reduciendo el JS enviado al cliente.

### Consecuencias
- **Pérdida de beneficios SSR y RSC:** Todo el código, incluidas las dependencias de esas páginas masivas, se empaqueta e hidrata en el navegador, aumentando el TTI (Time to Interactive).
- **SEO y Performance Penalizados:** En las páginas públicas donde se abusa del cliente, los motores de búsqueda reciben menos HTML útil de entrada, y el usuario sufre mayores tiempos de carga.

---

## 2. Data Fetching y Mutaciones
El manejo de datos en la aplicación replica una arquitectura **SPA (Single Page Application)** clásica basada en React 18 / Create React App, ignorando las ventajas del App Router.

### Hallazgos
- **Cascadas en cliente (Waterfalls):** La información inicial se carga utilizando `useEffect` con la API `fetch()`. Esto requiere que el navegador descargue el HTML, luego el bundle de JS, hidrate la página y *recién entonces* pida los datos al servidor.
- **Superpoblación de API Routes:** El directorio `src/app/api/` cuenta con más de 50 endpoints RESTful tradicionales.

### Consecuencias
- Cargas más lentas porque el cliente tiene que realizar saltos de red adicionales en lugar de recibir los datos listos desde el servidor.
- Layout Shifts (cambios visuales bruscos) a medida que los datos van reemplazando los estados de carga.

---

## 3. Correcciones Propuestas (Hoja de Ruta)

### Fase 1: Invertir el Patrón de Renderizado en Rutas
Cambiar el paradigma: hacer que las páginas (`page.tsx`) sean **Server Components** por defecto y limitar `'use client'` solo a las hojas del árbol (interactividad).
- **Acción:** Mover el `fetch` inicial desde el `useEffect` a una consulta directa con Prisma a nivel del `async function Page()` en el servidor.
- **Beneficio:** El HTML se enviará al navegador con los datos poblados de inmediato.

### Fase 2: Implementar Server Actions
Reemplazar gradualmente las llamadas POST/PUT/DELETE hacia `app/api/*` por **Server Actions**.
- **Acción:** Crear un directorio `src/actions/` (ej. `actions/orders.ts`) declarando `'use server'`. Mover allí la lógica de los endpoints de la API.
- **Beneficio:** Elimina la necesidad de escribir y mantener la capa de red con `fetch`. Mejora el tipado estático (End-to-End Type Safety) y la experiencia de desarrollo.

### Fase 3: Desacoplamiento y Componentización
Refactorizar los "archivos monstruo" (+1000 líneas) en piezas reusables.
- **Acción:** Dividir `pedidos/page.tsx` en componentes más chicos ubicados en `src/components/admin/pedidos/` (ej. `OrderFilters.tsx` [Cliente], `OrderList.tsx` [Servidor], `OrderCard.tsx` [Cliente]).
- **Beneficio:** Mantenimiento muchísimo más sencillo, menor carga cognitiva al leer el código y optimización del bundle size al aislar las partes cliente de las partes servidor.

### Fase 4: Revalidación y Caché
- **Acción:** Utilizar `revalidatePath('/admin/pedidos')` dentro de las Server Actions al editar un pedido. 
- **Beneficio:** Next.js purgará el caché e hidratará automáticamente los nuevos datos sin requerir configuraciones complejas de mutación global en el cliente.
