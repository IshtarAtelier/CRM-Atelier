# Auditoría de Manejo de Estado (Frontend) - V5

## Resumen Ejecutivo

El manejo del estado en el frontend del CRM Atelier y tienda en línea se apoya principalmente en **estado local (React Hooks)** para flujos de administración y **Zustand** para variables de alcance global como el carrito de compras.

No se identificó el uso de Context API nativa (`createContext`/`useContext`) ni librerías de terceros complejas como Redux.

## 1. Estado Global: Zustand
Para requerimientos de estado verdaderamente globales, el proyecto utiliza **Zustand** (actualmente versión 5).

- **Ejemplo principal:** El carrito de compras de la tienda (`src/store/useCart.ts`).
- **Middleware Persist:** Zustand se utiliza en conjunto con el middleware `persist` nativo de Zustand, lo que asegura que el estado del carrito se mantenga guardado en el navegador (Local Storage, bajo la key `atelier-cart-storage`) y sobreviva recargas o navegaciones de página.
- **Acciones y derivados:** El store del carrito incluye no solo datos estáticos, sino los métodos mutadores (`addItem`, `removeItem`, `updateQuantity`, `updateItemLensConfig`) y métodos derivados (`getCartTotal`).

## 2. Estado Local: React Hooks
La gran mayoría de la complejidad recae en el **estado local** de los componentes funcionales, a través de `useState` y `useReducer` o `useMemo`.

- **Componentes "Pesados" o "Pages":** Páginas de administración complejas como `src/app/admin/pedidos/page.tsx` actúan como *Stateful Containers*. Manejan la carga de la API (`useEffect` + `fetch`), estados de carga de interfaz (`loading`), datos del negocio (`orders`), metadatos y valores auxiliares.
- **Sin Data-Fetching Libraries Globales:** El estado proveniente del servidor (server-state) no es manejado mediante react-query, SWR ni apollo. Se almacena temporalmente en estados locales con `useState` y se refresca volviendo a llamar las funciones asíncronas del lado del cliente.

## 3. Flujo de Datos: Props Drilling
En base al diseño de estado local pesado en el nivel superior (páginas o contenedores madre), la aplicación propaga los datos y las funciones callbacks hacia sus hijos utilizando el patrón **Props Drilling**.

- **Ejemplo en Pedidos:** El componente madre inyecta el `order`, el `context` (si está en "ventas" o "pedidos"), los `financials` procesados, y funciones de callbacks mutadoras como `onAutoSubmit` o estados booleanos como `isAutoSubmitting` al hijo de detalle visual (`OrderDetailPanel.tsx`).
- **Ventajas actuales:** Para un nivel de anidación bajo a moderado, mantener un flujo unidireccional de datos hace que los componentes sean predecibles.
- **Puntos a mejorar a futuro:** En componentes con gran anidamiento, este patrón de "props drilling" puede convertirse en un cuello de botella para el mantenimiento si los datos deben pasar por tres o más componentes "dummy" solo para llegar a la capa destino. Si la complejidad crece, se podría considerar Zustand u otra forma de inyección de dependencias para aliviar el pasaje de estas variables.

## 4. Conclusión
El balance actual de estado es ligero y pragmático: Zustand soluciona de forma sencilla y persistente el estado asíncrono y omnipresente (como un carrito) mientras que el estado local y las props solucionan el estado dinámico y efímero de las interfaces administrativas.
