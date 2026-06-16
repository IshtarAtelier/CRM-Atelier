# Reporte de Auditoría: Manejo de Estado en el Frontend

## 1. Resumen Ejecutivo
Se realizó una auditoría sobre la arquitectura del estado en el frontend del proyecto (tanto en el Storefront como en el panel Admin/CRM). La estrategia de manejo de estado es **altamente descentralizada y dependiente del estado local**, limitando el estado global únicamente al carrito de compras de e-commerce.

## 2. Estado Global (Zustand)
El único manejador de estado global de terceros presente en el proyecto es **Zustand**.
- **Uso actual**: Está restringido a un único archivo (`src/store/useCart.ts`). Se encarga exclusivamente de la lógica del carrito de compras (ítems, precios, persistencia, apertura/cierre del panel del carrito).
- **Persistencia**: Implementa el middleware `persist` de Zustand, guardando los datos en `localStorage` bajo la clave `atelier-cart-storage`.
- **Ausencia en el resto de la app**: Fuera del carrito, Zustand no es utilizado para sesión de usuario, permisos del CRM ni configuraciones globales de la app.

## 3. Context API (Inexistente)
A nivel de código fuente, la API nativa de React Context brilla por su ausencia.
- **Sin Contextos**: No existen ocurrencias de `createContext` ni de `useContext` en todo el proyecto.
- No hay contextos para temas globales (ThemeContext), ni para la autenticación (AuthContext), ni para configuraciones de idioma o moneda.

## 4. Estado Local y Prop Drilling
Dado que no existe una capa de Context y Zustand solo se usa en el carrito, la aplicación depende fuertemente de **Prop Drilling** y de `useState`.
- **Sesión de Usuario / Layouts**: La información principal del usuario se extrae a nivel del servidor (Server Components) en archivos como `src/app/admin/layout.tsx` a través de los `headers` (inyectados por el middleware). Luego, esta información (`userName`, `userRole`, `userId`) es pasada como *props* a los componentes cliente (ej. `Sidebar`, `CopilotChat`, etc.).
- **Componentes Complejos**: Archivos densos como la gestión de ventas o configuradores de cristales usan múltiples hooks `useState` localmente para manejar toda la interactividad de la UI (modalización, formularios, filtros, etc.).

## 5. Fetching de Datos (Server State)
Un punto crítico encontrado es cómo los componentes del lado del cliente gestionan los datos que provienen del backend:
- **Ausencia de Librerías Dedicadas**: No se utiliza React Query (TanStack), ni SWR, ni Apollo.
- **Fetch manual en useEffect**: Los paneles del CRM (como `GlobalOpportunities`, `OpportunitiesPanel`) hacen peticiones nativas con `fetch()` dentro de `useEffect` y almacenan los datos localmente en `useState`.
- **Polling manual**: Algunos componentes usan `setInterval` dentro de `useEffect` para actualizar datos repetidamente (como el de oportunidades).

## 6. Oportunidades de Mejora / Recomendaciones
1. **Adopción de React Query / SWR**: 
   Actualmente hay mucha lógica repetitiva (`useState` para datos, `useEffect` para fetch, manejo de errores/cargas manual). React Query mejoraría el rendimiento del CRM al introducir una capa de caché local, reduciendo el "prop drilling" de listados de información.
2. **Globalizar la Sesión del Usuario**: 
   Añadir un Contexto de Sesión (SessionProvider) o un Store en Zustand para el usuario actual simplificaría el código al evitar pasar roles e IDs manualmente desde el layout superior hacia cada uno de los componentes anidados de la interfaz administrativa.
3. **Optimizar Componentes Pesados**: 
   Varios componentes en `admin` tienen más de 15 sentencias `useState`. Podría ser prudente unificar estados dependientes en un único objeto usando `useReducer` o refactorizar a stores locales de Zustand (`createStore`) en vez de múltiples estados independientes.
