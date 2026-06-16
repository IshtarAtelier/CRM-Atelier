# Reporte de Auditoría: Manejo de Estado en el Frontend

## 1. Resumen Ejecutivo
El frontend de la aplicación utiliza un enfoque mixto y altamente pragmático para el manejo del estado. Se caracteriza por un **uso intensivo del estado local** (`useState`), la **ausencia total de la Context API**, y el uso de **Zustand** exclusivamente para el dominio del carrito de compras. Además, se apoya en `localStorage` directo para simular estado global en ciertos dominios como la sesión del usuario.

---

## 2. Estado Global

### Zustand (`src/store/useCart.ts`)
Zustand es la única librería de manejo de estado global instalada y utilizada. Sin embargo, su uso está estrictamente limitado a un solo dominio: **el carrito de compras**.
- Se utiliza el middleware `persist` de Zustand para guardar automáticamente el estado del carrito en `localStorage` bajo la clave `atelier-cart-storage`.
- Define un estado claro (`items`, `isOpen`) y acciones (`addItem`, `removeItem`, `updateQuantity`, `clearCart`).
- **Evaluación**: Es una implementación limpia, eficiente y muy acotada. Zustand brilla aquí por no requerir Providers y ofrecer un hook directo (`useCart()`).

### LocalStorage (Estado Global "Manual")
En lugar de utilizar Zustand o Context API para otras variables globales, el proyecto lee y escribe directamente en el `localStorage` del navegador a lo largo de varios componentes y páginas:
- **Usuario y Sesión**: Las páginas leen recurrentemente `localStorage.getItem('user')` (visto en páginas como `/admin/ventas`, `/admin/contactos`, etc.) para determinar el rol del usuario (`currentUserRole`) en lugar de suscribirse a un store central.
- **UI (Sidebar)**: El estado de colapso del sidebar (`sidebarCollapsed`) se guarda y lee directamente desde `localStorage`.
- **Checkout**: Se guarda temporalmente el formulario y el ID de sesión (`atelier-checkout-form`, `atelier-checkout-session-id`).

---

## 3. Ausencia de Context API
Una de las características más llamativas del código es que **no se utiliza `createContext` ni `useContext` en todo el directorio `src`**. 
- No hay un `ThemeProvider`, `AuthProvider`, o `StoreProvider`. 
- Esto evita problemas de re-renders innecesarios que a veces causa Context, pero a cambio fomenta patrones como el Props Drilling o la lectura síncrona repetitiva de `localStorage`.

---

## 4. Estado Local y Props Drilling

### Uso de `useState` y ausencia de `useReducer`
- Existen más de **900 instancias** de `useState` en el proyecto. Es la herramienta principal para manejar formularios, modales, pestañas, y datos traídos desde el servidor.
- Componentes complejos o páginas enteras (como `src/app/admin/contactos/page.tsx` o `PrescriptionManager.tsx`) acumulan hasta 15 declaraciones de `useState` individuales.
- **No hay ninguna instancia de `useReducer`** en el código. El manejo de estado complejo se gestiona actualizando múltiples variables de estado independientes, lo que puede ser propenso a inconsistencias o *race conditions*.

### Props Drilling
Dado que no hay Context API, y Zustand solo se usa para el carrito, la comunicación entre la página principal y sus componentes anidados profundos se realiza exclusivamente mediante la **perforación de propiedades (Props Drilling)**.
- **Ejemplo (`QuoteSummary.tsx`)**: Este componente recibe decenas de props, incluyendo callbacks complejos (`onConvert`, `onDelete`, `onAddPayment`, `onStatusChange`) y banderas de estado (`isAdmin`, `isExpanded`, `showActions`).
- **Impacto**: Los componentes intermedios deben pasar estas propiedades aunque no las consuman. Modificar la firma de una función o agregar una nueva dependencia obliga a actualizar la cadena completa de componentes.

---

## 5. Fetching de Datos y Caché
No se utilizan librerías de gestión de estado asíncrono o caché de servidor (como **React Query** o **SWR**). 
- Todo el *data fetching* se realiza de manera tradicional combinando `useEffect` con `fetch` y guardando los estados de `data`, `isLoading` y `error` en múltiples `useState`.
- **Impacto**: Esto contribuye enormemente a la inflación de hooks `useState` en el código, carece de re-validación automática, y si un usuario navega entre componentes, la data suele volver a cargarse desde cero a menos que se implemente caché a nivel de Next.js u origen.

---

## 6. Recomendaciones de Mejora Arquitectónica

1. **Introducir un Store Global para el Usuario (Auth/Role)**: 
   Crear un segundo store en Zustand (ej. `useAuthStore`) o un Context dedicado para reemplazar las múltiples llamadas sueltas a `localStorage.getItem('user')`. Esto permitirá que la UI reaccione automáticamente si el usuario cierra sesión o cambia de rol, sin depender de recargas de página.

2. **Refactorizar Vistas Complejas con `useReducer`**:
   Para formularios masivos (como el CRM de contactos o la creación de cristales), agrupar los múltiples `useState` en un solo `useReducer`. Esto centralizará la lógica de actualización (estado de la interfaz, carga, errores, pasos del formulario) y hará los componentes más limpios y fáciles de testear.

3. **Migrar a React Query o SWR para el Data Fetching**:
   Reemplazar los combos `useEffect` + `useState` por llamadas a React Query o SWR. Esto eliminaría cientos de líneas de código repetitivo de manejo de estado local, agregaría caché en memoria y mejoraría la experiencia del usuario (UX) mediante revalidación en segundo plano.

4. **Mitigar el Props Drilling Extremo**:
   Para componentes como `QuoteSummary` o `ProductForm`, evaluar la composición de componentes (pasar `<ComponenteHijo />` como `children`) o mover cierta lógica local transaccional a un micro-store de Zustand específico para esa vista.
