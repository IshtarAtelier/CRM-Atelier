# Auditoría de Estructura de Componentes UI (`src/components`)

## 1. Resumen Ejecutivo
Se realizó una auditoría de la carpeta `src/components` para evaluar el nivel de abstracción, organización y escalabilidad de la arquitectura de la interfaz de usuario. En términos generales, el proyecto utiliza una arquitectura **basada en dominios/funcionalidades** (Feature-Driven), lo cual es una excelente práctica para proyectos medianos y grandes. 

Se detectaron áreas fuertes en la separación entre back-office y el portal público (Storefront), así como en la creación de componentes UI genéricos. Sin embargo, existen oportunidades significativas de mejora enfocadas en la reducción de archivos masivos (God Components), normalización de nomenclatura y refinamiento de la estructura interna de los dominios más densos.

## 2. Análisis de la Estructura Actual

El directorio `src/components` contiene 18 subdirectorios principales:
- **Dominios de Negocio (Back-office)**: `admin`, `billing`, `campanas`, `checkout`, `contacts`, `cristales`, `dashboard`, `inventory`, `marketing`, `orders`, `prescriptions`, `quotes`.
- **UI Pública**: `Storefront`.
- **Compartidos / Genéricos**: `ui`, `layout`, `icons`, `modals`, `config`.

### Fortalezas (Lo que se está haciendo bien)
1. **Alta Cohesión (Feature-Driven)**: Los componentes están organizados lógicamente alrededor de funcionalidades de negocio. Si un desarrollador necesita modificar algo de la funcionalidad de contactos, sabe que debe dirigirse directamente a `src/components/contacts`.
2. **Separación de UI Genérica**: Existe un directorio dedicado `ui/` que encapsula componentes base reutilizables (como `Modal.tsx`, `CommandPalette.tsx`, `FileDropZone.tsx`), lo que evita la duplicación y mantiene un sistema de diseño consistente.
3. **Desacoplamiento Público vs Privado**: Todo lo relacionado con la vista del cliente se aísla de manera limpia en `Storefront/`, evitando que dependencias de la tienda pública se mezclen con el ERP o sistema de administración.
4. **Agrupación de Vistas Específicas**: Dentro de directorios como `contacts/page/`, se ve un esfuerzo por aislar los componentes que construyen directamente la página (layouts y secciones grandes) de los componentes individuales, lo que facilita la composición.

## 3. Oportunidades de Mejora y Riesgos (Code Smells)

### 3.1. Archivos Masivos ("God Components")
Varios archivos tienen un tamaño desproporcionado (superando los 20KB y hasta 50KB). Esto indica una violación al Principio de Responsabilidad Única (SRP) y una falta de abstracción de sub-componentes. Son muy difíciles de mantener y testear.
- `quotes/QuoteSummary.tsx` (~52KB) 🔴 *Crítico*
- `contacts/PrescriptionManager.tsx` (~38KB) 🔴 *Crítico*
- `admin/DoctorCommissions.tsx` (~32KB) 🟠 *Advertencia*
- `orders/OrderDetailPanel.tsx` (~26KB) 🟠 *Advertencia*
- `billing/InvoiceModal.tsx` (~26KB) 🟠 *Advertencia*

### 3.2. Nomenclatura Inconsistente (Casing)
El directorio `Storefront` utiliza **PascalCase**, mientras que todos los demás directorios utilizan **kebab-case** o minúsculas (ej. `admin`, `quotes`, `billing`).
- *Recomendación*: Renombrar `Storefront` a `storefront` para mantener coherencia en las convenciones de sistema de archivos.

### 3.3. Estructura Plana en Directorios Densos
El directorio `Storefront/` contiene **23 archivos** en el nivel raíz. Se está volviendo un directorio "basurero" para todo lo público.
- *Recomendación*: Subdividir `Storefront` en dominios más pequeños como `storefront/layout` (Navbar, Footer), `storefront/home` (Carruseles, Secciones del index), `storefront/product`, etc.

### 3.4. Inconsistencia en la Ubicación de los Modales
Existe una carpeta `modals/` a nivel raíz que solo contiene un archivo (`TestChatModal.tsx`). Sin embargo, los modales reales del sistema de negocio están ubicados dentro de las carpetas de sus respectivos dominios (por ejemplo, `AddPaymentModal.tsx` está en `quotes`, `InvoiceModal.tsx` en `billing`).
- *Recomendación*: Eliminar la carpeta `modals/` genérica (o mover su contenido a `ui/` si es verdaderamente reutilizable) y continuar con la excelente práctica actual de almacenar cada modal en el directorio de su respectivo dominio.

## 4. Plan de Acción Recomendado

1. **Refactorización de God Components**: Descomponer `QuoteSummary.tsx` y `PrescriptionManager.tsx` en componentes más pequeños. Por ejemplo, en `QuoteSummary` abstraer los items, el cálculo de totales y las notas en archivos separados (`QuoteSummaryItems.tsx`, `QuoteSummaryTotals.tsx`, etc.).
2. **Normalización de Nombres**: Renombrar `/Storefront` a `/storefront` en todo el repositorio y actualizar los import correspondientes.
3. **Sub-directorios para Storefront**: Ordenar internamente la carpeta pública separando secciones de layout, home, catálogo e interactivos.
4. **Limpieza de Modales Huérfanos**: Reubicar `TestChatModal.tsx` e invalidar la carpeta `modals` del nivel raíz de componentes.

## 5. Conclusión
La abstracción basada en dominios de negocio es la correcta. El esfuerzo próximo no debe centrarse en cambiar la arquitectura, sino en refactorizar los componentes sobrecargados internamente para respetar principios SOLID, unificar el nombrado de carpetas y darle estructura interna a los dominios más densos como `Storefront`.
