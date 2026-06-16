# Auditoría de Calidad de Código: CRM-Atelier

Este reporte detalla el análisis de la calidad general del código del proyecto `CRM-Atelier`. La auditoría cubrió 389 archivos y un total de 72,291 líneas de código, focalizándose en cuatro pilares principales: Complejidad Ciclomática, "Code Smells", Funciones Demasiado Largas y DRY (Don't Repeat Yourself).

---

## 1. DRY (Don't Repeat Yourself) - Duplicación de Código

El análisis de duplicación de código arrojó resultados generalmente positivos a nivel macro, aunque con áreas muy específicas que requieren refactorización.

- **Total de líneas analizadas:** 72,291
- **Líneas duplicadas:** 2,433
- **Porcentaje de duplicación:** 3.37% (Aceptable en la industria, siendo <5% un buen estándar).
- **Bloques clonados encontrados:** 205

**Puntos críticos encontrados de duplicación:**
- **Servicios de Contacto (`src/services/contact.service.ts`):** Existen múltiples bloques duplicados entre las líneas 820-909 y 968-1602. Es altamente probable que se estén repitiendo consultas a la base de datos o lógica de endpoints que podrían extraerse en funciones auxiliares (helpers).
- **Herramientas de IA (`src/lib/copilot-tools.ts`):** Alta repetición de definiciones de herramientas o esquemas (aprox. 15 líneas por bloque que se repiten).
- **Generación de PDFs (`src/lib/order-pdf-generator.ts` y `src/lib/receipt-pdf-generator.ts`):** Gran similitud de código (boilerplate de jsPDF) entre la generación de órdenes y recibos. Se sugiere unificar la creación de layouts, cabeceras y tarjetas.
- **Middleware (`src/middleware.ts`):** Bloques de protección de rutas y redirección duplicados.

---

## 2. Complejidad Ciclomática

La complejidad ciclomática mide el número de caminos independientes que puede tomar el flujo de ejecución de una función (if, switch, for, and/or loops, etc). Una complejidad alta aumenta el riesgo de bugs y dificulta las pruebas unitarias.

- **Total de funciones analizadas:** 3,444
- **Complejidad Promedio:** 5.25 (Saludable a nivel general)

**Las funciones / componentes más complejos (Antipatrón: God Objects):**
1. `WhatsAppPage` (`src/app/admin/whatsapp/page.tsx`) - **Complejidad: 376** ⚠️ (Extremadamente alto)
2. `VentasPage` (`src/app/admin/ventas/page.tsx`) - **Complejidad: 330** ⚠️
3. `PedidosPage` (`src/app/admin/pedidos/page.tsx`) - **Complejidad: 289** ⚠️
4. `InventarioPage` (`src/app/admin/inventario/page.tsx`) - **Complejidad: 246** ⚠️
5. `ProductForm` (`src/components/inventory/ProductForm.tsx`) - **Complejidad: 183** ⚠️
6. `CotizadorPageContent` (`src/app/admin/cotizador/page.tsx`) - **Complejidad: 182** ⚠️

*Observación*: Estos componentes de interfaz están abarcando demasiadas responsabilidades simultáneas (UI, fetch de datos, estados complejos, condicionales de renderizado en un solo archivo).

---

## 3. Funciones Demasiado Largas

El tamaño de una función o componente es uno de los principales indicadores de mantenibilidad. Como regla general, se aconseja que las funciones no superen las 30-50 líneas para que sean testeables y fáciles de leer.

- **Funciones de más de 30 líneas:** 544
- **Funciones de más de 50 líneas:** 364

**Los 5 archivos/componentes más largos del proyecto:**
1. `WhatsAppPage` (`src/app/admin/whatsapp/page.tsx`): **2,219 líneas**
2. `WebManagementPage` (`src/app/admin/web/page.tsx`): **1,858 líneas**
3. `ConfiguracionPage` (`src/app/admin/configuracion/page.tsx`): **1,397 líneas**
4. `PedidosPage` (`src/app/admin/pedidos/page.tsx`): **1,389 líneas**
5. `VentasPage` (`src/app/admin/ventas/page.tsx`): **1,332 líneas**

*Recomendación*: Es urgente descomponer estos archivos monolíticos (Next.js Pages) en componentes funcionales más pequeños, delegar la lógica de estado en "Custom Hooks" (`hooks/`) y extraer la comunicación externa hacia servicios dedicados.

---

## 4. Code Smells

Además de la duplicación y las clases Dios ("God Components"), se detectaron las siguientes alertas de "malos olores" en el código:

- **Exceso de Parámetros:** Una función idealmente debería recibir entre 0 y 3 parámetros. Pasar un objeto de opciones es mejor que múltiples parámetros posicionales.
  - `drawCard` en `order-pdf-generator.ts` (6 parámetros)
  - `useContacts` en `useContacts.ts` (5 parámetros)
  - `calculateQuoteTotals` en `promo-utils.ts` (5 parámetros)
  - `getAll`, `addPayment` y `analyzeReceipt` en diferentes servicios (5 parámetros).

- **Lógica Profunda ("Deep Nesting" o "Callback Hell"):**
  - Componentes como `AdministracionPage` muestran niveles de anidamiento de control de flujo y JSX que superan los 5 niveles lógicos de profundidad. Esto dificulta entender qué condiciones se están aplicando al contexto visual.

---

## Conclusiones y Plan de Acción

1. **Refactorización de Páginas Administrativas (Urgente):** Empezar por fragmentar `WhatsAppPage`, `WebManagementPage` y `VentasPage`. Extraer los modales, formularios y tablas a subcarpetas de componentes independientes.
2. **Abstracción de Servicios PDF:** Crear un `BasePdfGenerator` del cual `order-pdf-generator` y `receipt-pdf-generator` puedan reutilizar funciones de layout y tipografía.
3. **Revisión del `contact.service.ts`:** Eliminar las repeticiones directas en funciones de consulta mediante una interfaz más genérica.
4. **Objetos de Parámetros:** Modificar funciones como `drawCard` o `useContacts` para recibir un solo parámetro `options` de tipo `interface` o `type`.
