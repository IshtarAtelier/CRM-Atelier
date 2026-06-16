# Reporte de Calidad del Código (Code Quality Audit)

## Resumen Ejecutivo

Este reporte detalla los problemas de calidad de código encontrados en el proyecto, enfocándose en la **complejidad ciclomática**, **funciones excesivamente largas** y otros **code smells**. Se han evaluado los archivos fuente utilizando ESLint con métricas de calidad estrictas.

- **Total de Errores detectados**: 274
- **Total de Advertencias detectadas**: 952

---

## 1. Complejidad Ciclomática (Cyclomatic Complexity)

La complejidad ciclomática mide la cantidad de rutas independientes que puede tomar la ejecución de una función (if, else, switch, loops, etc.). Una complejidad alta (generalmente mayor a 10-15) indica código difícil de testear, mantener y entender, propenso a bugs.

### Top 15 funciones más complejas:

| Archivo | Línea | Complejidad |
|---------|-------|-------------|
| `src/services/order.service.ts` | 189 | **156** |
| `src/app/admin/ventas/page.tsx` | 59 | **135** |
| `src/app/admin/pedidos/page.tsx` | 418 | **130** |
| `src/app/api/reports/route.ts` | 14 | **127** |
| `src/app/api/checkout/payway/route.ts` | 9 | **117** |
| `src/app/admin/inventario/page.tsx` | 27 | **95** |
| `src/app/api/sales-opportunities/route.ts` | 6 | **92** |
| `src/components/quotes/QuoteSummary.tsx` | 48 | **86** |
| `src/app/api/products/import/route.ts` | 85 | **82** |
| `src/app/admin/whatsapp/page.tsx` | 113 | **77** |
| `src/services/contact.service.ts` | 1490 | **76** |
| `src/app/api/dashboard/route.ts` | 7 | **69** |
| `src/app/producto/[slug]/ProductClient.tsx` | 19 | **69** |
| `src/app/admin/cotizador/page.tsx` | 75 | **63** |
| `src/services/contact.service.ts` | 337 | **58** |


> **Recomendación**: Dividir estas funciones utilizando refactorización (Extract Function), aplicar patrones de diseño como `Strategy` o `Polimorfismo` para reemplazar bloques `switch`/`if-else` masivos y delegar responsabilidades a servicios más pequeños.

---

## 2. Funciones Largas (Max Lines per Function)

Las funciones demasiado largas son un "Code Smell" claro, dificultando la lectura y sugiriendo que la función está haciendo más de una cosa (violando el principio de Responsabilidad Única - SRP). Se sugiere un máximo de 50 líneas por función.

### Top 15 funciones más largas:

| Archivo | Línea | Cantidad de Líneas |
|---------|-------|--------------------|
| `src/app/admin/whatsapp/page.tsx` | 113 | **2235** |
| `src/app/admin/web/page.tsx` | 61 | **1858** |
| `src/app/admin/pedidos/page.tsx` | 33 | **1502** |
| `src/app/admin/configuracion/page.tsx` | 68 | **1397** |
| `src/app/admin/ventas/page.tsx` | 31 | **1354** |
| `src/app/admin/inventario/page.tsx` | 27 | **1286** |
| `src/app/admin/cotizador/page.tsx` | 75 | **1183** |
| `src/app/admin/administracion/page.tsx` | 144 | **963** |
| `src/components/inventory/ProductForm.tsx` | 49 | **918** |
| `src/components/quotes/QuoteSummary.tsx` | 48 | **739** |
| `src/services/order.service.ts` | 189 | **697** |
| `src/components/contacts/PrescriptionManager.tsx` | 22 | **624** |
| `src/app/producto/[slug]/ProductClient.tsx` | 19 | **620** |
| `src/app/api/checkout/payway/route.ts` | 9 | **555** |
| `src/components/Storefront/LensConfigurator.tsx` | 22 | **538** |


> **Recomendación**: Extraer bloques lógicos dentro de estas funciones largas hacia funciones o componentes auxiliares (ej. Hooks de React, pequeños componentes funcionales, o utilidades aisladas).

---

## 3. Otros "Code Smells" Detectados

### 3.1 Profundidad de Anidamiento (Max Depth)

La anidación profunda de bloques (if dentro de for dentro de if) hace que el código sea ilegible. Hemos encontrado **37** casos donde la profundidad de bloques excede el límite recomendado (4 niveles).

*Ejemplos principales:*
- `src/app/admin/whatsapp/fotos/page.tsx:121`: Blocks are nested too deeply (5). Maximum allowed is 4.
- `src/app/admin/whatsapp/page.tsx:398`: Blocks are nested too deeply (5). Maximum allowed is 4.
- `src/app/admin/whatsapp/page.tsx:2036`: Blocks are nested too deeply (5). Maximum allowed is 4.
- `src/app/api/admin/fix-phones/route.ts:40`: Blocks are nested too deeply (5). Maximum allowed is 4.
- `src/app/api/ai/process-image/route.ts:45`: Blocks are nested too deeply (5). Maximum allowed is 4.


### 3.2 Cantidad Excesiva de Parámetros (Max Params)

Las funciones con muchos parámetros son frágiles y difíciles de usar. Se sugiere pasar objetos en lugar de listas largas de variables. Encontramos **9** funciones que sobrepasan los 4 parámetros permitidos.

*Ejemplos principales:*
- `src/hooks/useContacts.ts:4`: Function 'useContacts' has too many parameters (5). Maximum allowed is 4.
- `src/lib/order-pdf-generator.ts:495`: Arrow function has too many parameters (6). Maximum allowed is 4.
- `src/lib/promo-utils.ts:197`: Arrow function has too many parameters (5). Maximum allowed is 4.
- `src/services/PricingService.ts:54`: Static method 'calculateTotals' has too many parameters (5). Maximum allowed is 4.
- `src/services/contact.service.ts:54`: Async method 'getAll' has too many parameters (5). Maximum allowed is 4.


### 3.3 Otras Métricas y Advertencias

Hemos analizado las advertencias generales y se han identificado los siguientes patrones problemáticos principales:

- **@typescript-eslint/no-unused-vars**: 214 incidencias. (Generalmente variables declaradas pero no usadas, imports obsoletos o problemas de react).
- **unused-imports/no-unused-vars**: 214 incidencias. (Generalmente variables declaradas pero no usadas, imports obsoletos o problemas de react).
- **react/no-unescaped-entities**: 60 incidencias. (Generalmente variables declaradas pero no usadas, imports obsoletos o problemas de react).
- **max-nested-callbacks**: 4 incidencias. (Generalmente variables declaradas pero no usadas, imports obsoletos o problemas de react).


---

## Conclusión y Plan de Acción

El proyecto presenta deudas técnicas significativas en cuanto a funciones gigantescas (particularmente componentes React o controladores de API que superan las 500+ líneas) y altísima complejidad ciclomática (funciones con complejidad >100). 

**Plan sugerido para el refactor**:
1. **Atacar los componentes de página (`page.tsx`) masivos**: Como `AdministracionPage`, `ConfiguracionPage` y `VentasPage`. Separar en subcomponentes más pequeños.
2. **Refactorizar controladores de API**: Los archivos como `api/reports/route.ts` y `services/order.service.ts` necesitan ser modulares y aplicar inyección de dependencias o patrones para manejo de casos.
3. **Limpieza de variables y código muerto**: Resolver las cientas de incidencias de variables y imports no utilizados para mejorar la legibilidad.
