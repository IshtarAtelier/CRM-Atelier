# Auditoría de Componentes UI y Estructura (src/components)

## 1. Resumen Ejecutivo
La estructura de la carpeta `src/components` demuestra una clara intención de organizar los componentes por dominio de negocio y características (Feature-based/Domain-Driven). Sin embargo, presenta problemas de duplicación de archivos en la raíz y una carencia notable de componentes UI primitivos (átomos), lo que sugiere una baja abstracción de elementos base.

## 2. Análisis de la Estructura

### Aspectos Positivos
- **Agrupación por Dominio:** Los componentes están bien divididos en carpetas lógicas correspondientes a módulos del sistema: `admin`, `billing`, `campanas`, `checkout`, `contacts`, `dashboard`, `inventory`, `quotes`, `Storefront`, etc.
- **Separación de Vistas Complejas:** Existen subcarpetas internas (ej. `admin/reports`, `contacts/page`) que ayudan a mantener componentes muy específicos localizados donde se usan.

### Áreas de Mejora y Hallazgos Críticos

**A. Archivos Duplicados y Mal Ubicados en la Raíz**
Se detectaron múltiples archivos en la raíz de `src/components` que tienen una copia idéntica o ya han sido movidos a sus respectivas subcarpetas, generando ambigüedad sobre cuál es la fuente de verdad (Single Source of Truth).
Ejemplos detectados:
- `ContactFormSections.tsx` (presente en la raíz y en `contacts/`)
- `FileDropZone.tsx` (presente en la raíz y en `ui/`)
- `FloatingDock.tsx` (presente en la raíz y en `ui/`)
- Componentes Globales del Dashboard: `GlobalBalanceReminders.tsx`, `GlobalLabReady.tsx`, `GlobalOpportunities.tsx`, `GlobalReviewRequests.tsx`, `GlobalTasks.tsx` (presentes en la raíz y en `dashboard/`)
- `LeadToastNotifications.tsx`, `NotificationBell.tsx` (presentes en la raíz y en `ui/`)
- `ReviewRequestsPanel.tsx` (raíz y `dashboard/`)
- `TestChatModal.tsx` (raíz y `modals/`)

**B. Falta de Componentes UI Primitivos (Atomic Design)**
La carpeta `ui/` contiene componentes complejos y compuestos (ej. `CommandPalette.tsx`, `FloatingDock.tsx`, `NotificationBell.tsx`), pero faltan los componentes primitivos básicos (átomos) como `Button`, `Input`, `Select`, `Card`, `Table`, etc.
- **Riesgo:** Esto sugiere que el HTML base y las clases de estilos (ej. Tailwind) se están repitiendo a lo largo de todos los componentes de dominio, reduciendo la mantenibilidad, escalabilidad y coherencia visual del proyecto.

**C. Abstracción**
- La abstracción vertical (de página a componente de dominio) es buena.
- La abstracción horizontal (componentes reutilizables a nivel global) es deficiente. No hay un sistema de diseño o librería de componentes base estandarizado visible en la estructura.

## 3. Plan de Acción Recomendado

1. **Limpieza de Archivos Raíz:**
   - Eliminar los archivos duplicados en la raíz de `src/components` asegurándose de actualizar las importaciones en todo el proyecto (refactorización) para que apunten a los directorios correctos (ej. `src/components/dashboard/GlobalTasks.tsx`).
2. **Implementar Atomic Design / Primitivos UI:**
   - Crear una base sólida de componentes primitivos en `src/components/ui/` (Button, Input, Modal, Dropdown, etc.). Se recomienda usar herramientas como **shadcn/ui** o Headless UI para acelerar esto.
   - Refactorizar gradualmente los componentes de dominio para que utilicen estos primitivos en lugar de etiquetas HTML con clases sueltas.
3. **Consolidar Carpetas de Apoyo:**
   - Crear carpetas como `src/components/layout` (que actualmente solo tiene `Sidebar.tsx`) y expandirla con `Header`, `Footer`, `Containers`, etc.
   - Revisar `src/components/modals` y asegurar que la lógica de modales siga un patrón centralizado o utilice los primitivos de UI correspondientes.
