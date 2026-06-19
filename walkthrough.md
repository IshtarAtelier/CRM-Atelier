# Resumen de Cambios: Agregar Filtros al Cotizador del Vendedor y Corrección de Recetas

Se han integrado filtros de productos avanzados en el Cotizador y se ha solucionado el problema de visualización de las recetas médicas en el resumen de ventas.

## Cambios Realizados

### 1. Filtros Avanzados en el Cotizador (`/admin/cotizador`)
- **Variables de Estado Adicionales (`src/app/admin/cotizador/page.tsx`)**:
  - Se crearon los estados `selectedSubtype`, `selectedOrigin`, `selectedBrand` y `selectedLab` para capturar las opciones de filtro secundarias seleccionadas.
- **Efecto de Limpieza (`useEffect`)**:
  - Se añadió un `useEffect` que detecta cambios en la categoría principal (`activeType`). Al cambiar de categoría, se restablecen a sus valores por defecto todos los sub-filtros.
- **Extracción Dinámica (`baseFilteredForBrandsAndLabs`)**:
  - Se calcula una lista base filtrada únicamente por categoría principal, subtipo y origen. Sobre esta, se extraen de forma única y ordenada alfabéticamente las marcas (`uniqueBrands`) y laboratorios (`uniqueLabs`) relevantes.
- **Lógica de Filtros Combinada (`filtered`)**:
  - Se actualizó el `useMemo` principal que calcula el listado final de productos para aplicar de forma acumulativa todas las reglas de filtrado secundario.
- **Interfaz Visual Premium y Consistente**:
  - Se convirtió el contenedor superior de búsqueda en un diseño vertical (`flex-col gap-3`) para alojar las píldoras de subtipos y origen, además de los selectores desplegables dinámicos.

### 2. Corrección de Recetas en el Resumen de Ventas (`/admin/ventas`)
- **Unificación del Resolutor de Storage (`src/components/orders/OrderDetailPanel.tsx`)**:
  - Se eliminó la función local inline `resolveStorageUrl` que estaba limitada y rompía imágenes locales (`local://`), base64 o rutas relativas.
  - Se importó y utilizó la función centralizada `resolveStorageUrl` desde `@/lib/utils/storage` (la misma utilizada por la ficha del cliente y los demás paneles).
  - Esto soluciona de forma definitiva el problema donde las fotos de las recetas aparecían rotas en el resumen de ventas de laboratorio.

---

## Verificación de Compilación

La compilación de producción (`npm run build`) se ha realizado exitosamente con cero errores de tipo y optimización de páginas completa.
