# Auditoría de UI Components - Fase 2 y Abstracción

## 1. Estado del Ordenamiento (Fase 2)

Se ha verificado la estructura de la carpeta `src/components`. La **Fase 2** plantea una arquitectura basada en dominios, la cual se evidencia con la creación de carpetas específicas como `admin`, `billing`, `contacts`, `dashboard`, `inventory`, `layout`, `quotes`, y `ui`.

### Problemas Detectados:
* **Duplicidad de Archivos:** Existen múltiples componentes que conviven tanto en la raíz de `src/components` como en las subcarpetas de dominio.
    * *Ejemplos:* `InvoiceModal.tsx` (en raíz y en `billing/`), `Sidebar.tsx` (en raíz y en `layout/`), `DoctorCommissions.tsx` (en raíz y en `admin/`), entre muchos otros (`CommandPalette`, `UserProfile`, `TasksPanel`, etc.).
* **Inconsistencia de Versiones:** Al comparar los archivos duplicados (ej. `diff InvoiceModal.tsx billing/InvoiceModal.tsx`), se observan diferencias en clases CSS y marcado. Esto indica que se han estado modificando versiones distintas de un mismo componente, lo que genera deuda técnica y posibles bugs visuales/lógicos.
* **Falta de Limpieza:** La migración a la Fase 2 quedó incompleta; no se eliminaron los componentes originales de la raíz ni se actualizaron todas las referencias de importación de forma consistente.

## 2. Falta de Abstracción ("God Components")

Se analizaron componentes clave como `DoctorCommissions.tsx` (>500 líneas), `InvoiceModal.tsx` (>400 líneas) y `QuickQuote.tsx` (>290 líneas). Se detecta una **fuerte falta de abstracción y separación de responsabilidades**:

* **Lógica de Negocio y UI Acoplada:** Los componentes manejan simultáneamente la UI (JSX complejo, modales, alertas), el estado local (decenas de `useState`), y la lógica de negocio pura (cálculos de comisiones, generación de PDFs, validación de topes de Monotributo).
* **Llamadas Directas a la API:** Se observan múltiples usos de `fetch()` y llamadas a endpoints directamente dentro de los componentes (ej. `fetch('/api/products')`, `fetch('/api/doctors/payments')`), en lugar de abstraerlos en un Service Layer (servicios) o Custom Hooks (ej. React Query o SWR).
* **Interfaces y Constantes en Línea:** Los modelos de datos (`interface DoctorPayment`, `Operation`, `InvoiceItem`) y las constantes (`MONOTRIBUTO_LIMIT`) se definen y viven en el mismo archivo del componente, impidiendo su reutilización en otras partes de la aplicación.
* **JSX Extenso y Poco Modular:** Los retornos de los componentes (`return ( ... )`) contienen bloques gigantes de HTML/JSX. No se extraen piezas pequeñas de la interfaz (como filas de tablas, formularios internos, tarjetas de pago) en subcomponentes más manejables.

## 3. Recomendaciones de Refactorización

1. **Completar la Migración de la Fase 2:**
   - Consolidar los cambios entre las versiones duplicadas.
   - Eliminar los archivos sobrantes en la raíz de `src/components`.
   - Actualizar los alias e importaciones en toda la aplicación para apuntar a la nueva estructura de dominios.
2. **Implementar Patrones de Diseño de UI:**
   - **Custom Hooks:** Mover toda la lógica de obtención de datos y estado complejo a hooks como `useDoctorCommissions()` o `useQuickQuote()`.
   - **Servicios:** Centralizar todos los `fetch()` en archivos dentro de `src/services/` o `src/api/`.
   - **Componentización:** Dividir los archivos de >300 líneas en micro-componentes enfocados en una sola responsabilidad (ej. `InvoiceForm.tsx`, `InvoiceSummary.tsx`, `DoctorPaymentsList.tsx`).
3. **Extraer Tipos y Constantes:** Mover las interfaces y constantes globales a una carpeta `src/types/` o `src/constants.ts` dedicada.
