# Auditoría: Manejo de Estado en el Frontend

## 1. Resumen Ejecutivo
Se analizó la arquitectura de gestión de estado en la aplicación web del proyecto (basada en Next.js 15, React 19). La aplicación opta por un enfoque híbrido pero mayoritariamente localizado, delegando la gestión de estado asíncrono a Custom Hooks y utilizando herramientas específicas para las escasas necesidades de estado global.

## 2. Manejo de Estado Global

### Zustand
El estado global está reservado estrictamente para los dominios de la aplicación que requieren un acceso omnipresente y persistencia.
- **Ubicación:** `src/store/useCart.ts`.
- **Uso:** Gestiona exclusivamente el estado del **carrito de compras** (items, configuraciones de cristales, abrir/cerrar modal, limpieza y totales).
- **Características:** Se hace uso del middleware `persist` de Zustand, lo que indica que el carrito debe persistir a lo largo de las recargas de página (probablemente almacenado en `localStorage`). Adicionalmente, cuenta con lógica acoplada de analíticas (`trackAddToCart`).

### Context API
- **Estado actual:** **Ausente**. No se detectan implementaciones de `createContext` o `useContext` en todo el proyecto de interfaz de usuario.
- **Análisis:** La decisión de evitar Context API previene problemas comunes de re-renderizado masivo y simplifica el flujo de datos. Indica una fuerte inclinación a mantener la lógica de estado cerca de la jerarquía que la consume.

### Next.js Router (Estado por URL)
Al ser una aplicación con Server Components y App Router, gran parte de lo que tradicionalmente sería estado global (filtros, parámetros de búsqueda, id de elementos seleccionados, tabs activos) se delega a los parámetros de la URL usando `searchParams` y los hooks nativos de Next.js.

## 3. Manejo de Estado Local y Patrones de UI

### Hooks Nativos (`useState`, `useEffect`)
Existe un uso masivo (más de 400 instancias) de `useState` a lo largo de `src/components`. Esto indica que el estado de la UI (toggles de acordeones, modales, formularios temporales, spinners) se mantiene encapsulado en el nivel del componente donde nace.

### Custom Hooks (`src/hooks`)
La lógica compleja de sincronización de estado cliente-servidor está extraída en Custom Hooks:
- **Ejemplos:** `useContacts.ts`, `useProducts.ts`.
- **Implementación:** Estos hooks manejan su propia instancia de `useState` para almacenar la información, así como las banderas de `loading` y los mensajes de `error`. Implementan `AbortController` para prevenir *race conditions* en peticiones de red repetidas, emulando de forma rudimentaria bibliotecas como React Query.

### Props Drilling
Debido a la inexistencia de un estado global por Context, los componentes contenedores (`page.tsx` por ejemplo) inyectan tanto los datos como las funciones mutadoras directamente a sus componentes hijos a través de las *props*.
- **Ejemplo destacado:** El componente `ContactDetail.tsx` recibe más de 10 *callbacks* (e.g., `onEdit`, `onToggleFavorite`, `onUpdatePriority`, `onAddInteraction`, `onAddTask`, `onDeleteOrder`, etc.) directamente de su padre.
- **Análisis:** Si bien este patrón asegura una relación clara de "quién controla los datos", propicia una alta carga de parámetros (*prop drilling*) que puede volver tedioso el mantenimiento de los componentes intermedios o dificultar el rediseño de las jerarquías de componentes (por ejemplo, si se añaden niveles de profundidad).

## 4. Conclusiones y Recomendaciones

1. **Arquitectura Sana:** El patrón actual de Container-Presentational, potenciado por la extracción lógica en *Custom Hooks*, es muy limpio y fácil de predecir. Limitar Zustand al carrito también es una buena práctica de separación de responsabilidades.
2. **Mitigación del Props Drilling:** Si las *props* de callbacks siguen creciendo en componentes orquestadores como `ContactDetail`, se podría contemplar usar un store ligero en Zustand exclusivamente para la capa de UI (p. ej., un `useModalStore` para evitar pasar funciones de *cierre/apertura* a través de varios componentes).
3. **Estado del Servidor (Server State):** La gestión de la asincronía en Custom Hooks actualmente se realiza de forma manual con `useState` y `useEffect`. Se recomienda encarecidamente evaluar la adopción de **React Query (@tanstack/react-query)** o **SWR**. Estas herramientas no solo reemplazarán todo el código boilerplate de `useContacts.ts` y `useProducts.ts`, sino que además dotarán a la app de caché, *revalidation on focus*, *optimistic updates* y evitarán por completo cualquier necesidad de *props drilling* relacionado con el refresco de datos.
