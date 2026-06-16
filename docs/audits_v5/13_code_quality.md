# Reporte de Calidad de Código

Este reporte analiza la calidad general del código en el directorio `src/`, centrándose en complejidad ciclomática, code smells y funciones largas. Se ha generado mediante análisis estático utilizando ESLint.

## Resumen Ejecutivo

- **Total de problemas de diseño detectados:** 920
- **max-lines-per-function:** 420
- **max-statements:** 147
- **complexity:** 258
- **max-lines:** 57
- **max-depth:** 35
- **max-nested-callbacks:** 3

## 1. Complejidad Ciclomática (`complexity`)

Las siguientes funciones tienen una complejidad ciclomática superior al límite recomendado (10), lo que significa que tienen demasiados caminos de ejecución independientes (muchos `if`, `switch`, `loops`). Esto las hace difíciles de probar y mantener.

- **services/order.service.ts:189** - Static async method 'updateOrder' has a complexity of 156. Maximum allowed is 10.
- **services/report.service.ts:11** - Static async method 'generateReportData' has a complexity of 138. Maximum allowed is 10.
- **app/admin/ventas/page.tsx:60** - Async arrow function has a complexity of 135. Maximum allowed is 10.
- **app/admin/pedidos/page.tsx:418** - Async arrow function has a complexity of 130. Maximum allowed is 10.
- **app/api/checkout/payway/route.ts:9** - Async function 'POST' has a complexity of 117. Maximum allowed is 10.
- **app/admin/inventario/page.tsx:28** - Function 'InventarioPage' has a complexity of 95. Maximum allowed is 10.
- **app/api/sales-opportunities/route.ts:6** - Async function 'GET' has a complexity of 89. Maximum allowed is 10.
- **components/quotes/QuoteSummary.tsx:48** - Function 'QuoteSummary' has a complexity of 86. Maximum allowed is 10.
- **app/api/products/import/route.ts:85** - Async function 'POST' has a complexity of 82. Maximum allowed is 10.
- **app/admin/whatsapp/page.tsx:114** - Function 'WhatsAppPage' has a complexity of 77. Maximum allowed is 10.
- **services/contact.service.ts:1493** - Async arrow function has a complexity of 76. Maximum allowed is 10.
- **app/api/dashboard/route.ts:7** - Async function 'GET' has a complexity of 69. Maximum allowed is 10.
- **app/producto/[slug]/ProductClient.tsx:19** - Function 'ProductClient' has a complexity of 69. Maximum allowed is 10.
- **app/admin/cotizador/page.tsx:76** - Function 'CotizadorPageContent' has a complexity of 63. Maximum allowed is 10.
- **components/prescriptions/PrescriptionDetails.tsx:13** - Function 'PrescriptionDetails' has a complexity of 56. Maximum allowed is 10.

## 2. Funciones Largas (`max-lines-per-function` y `max-statements`)

Las funciones demasiado largas son un "code smell" clásico. Sugieren que la función está haciendo demasiadas cosas (violando el Principio de Responsabilidad Única) y debería dividirse en funciones más pequeñas.

- **app/admin/administracion/page.tsx:145** - Function 'AdministracionPage' has too many lines (963). Maximum allowed is 40.
- **app/admin/administracion/page.tsx:239** - Async arrow function has too many lines (56). Maximum allowed is 40.
- **app/admin/administracion/page.tsx:604** - Arrow function has too many lines (57). Maximum allowed is 40.
- **app/admin/administracion/page.tsx:696** - Arrow function has too many lines (82). Maximum allowed is 40.
- **app/admin/administracion/page.tsx:828** - Arrow function has too many lines (48). Maximum allowed is 40.
- **app/admin/caja/page.tsx:28** - Function 'CajaPage' has too many lines (498). Maximum allowed is 40.
- **app/admin/caja/page.tsx:91** - Async arrow function has too many lines (49). Maximum allowed is 40.
- **app/admin/caja/page.tsx:237** - Arrow function has too many lines (50). Maximum allowed is 40.
- **app/admin/configuracion/laboratorios/page.tsx:13** - Function 'LaboratoriosConfigPage' has too many lines (211). Maximum allowed is 40.
- **app/admin/configuracion/page.tsx:68** - Function 'ConfiguracionPage' has too many lines (1397). Maximum allowed is 40.
- **app/admin/configuracion/page.tsx:755** - Arrow function has too many lines (129). Maximum allowed is 40.
- **app/admin/configuracion/page.tsx:1006** - Arrow function has too many lines (94). Maximum allowed is 40.
- **app/admin/configuracion/page.tsx:1253** - Arrow function has too many lines (43). Maximum allowed is 40.
- **app/admin/contactos/page.tsx:19** - Function 'ContactosPageContent' has too many lines (219). Maximum allowed is 40.
- **app/admin/cotizador/page.tsx:76** - Function 'CotizadorPageContent' has too many lines (1183). Maximum allowed is 40.

## 3. Archivos Demasiado Largos (`max-lines`)

Archivos con demasiadas líneas de código suelen indicar componentes monolíticos que asumen demasiadas responsabilidades.

- **app/admin/administracion/page.tsx:301** - File has too many lines (1107). Maximum allowed is 300.
- **app/admin/caja/page.tsx:301** - File has too many lines (525). Maximum allowed is 300.
- **app/admin/configuracion/page.tsx:301** - File has too many lines (1475). Maximum allowed is 300.
- **app/admin/cotizador/page.tsx:301** - File has too many lines (1270). Maximum allowed is 300.
- **app/admin/desarrollo/social/page.tsx:301** - File has too many lines (464). Maximum allowed is 300.
- **app/admin/facturacion/page.tsx:301** - File has too many lines (532). Maximum allowed is 300.
- **app/admin/gastos/page.tsx:301** - File has too many lines (466). Maximum allowed is 300.
- **app/admin/inventario/page.tsx:301** - File has too many lines (1313). Maximum allowed is 300.
- **app/admin/page.tsx:301** - File has too many lines (578). Maximum allowed is 300.
- **app/admin/pedidos/page.tsx:301** - File has too many lines (1534). Maximum allowed is 300.
- **app/admin/reportes/page.tsx:301** - File has too many lines (367). Maximum allowed is 300.
- **app/admin/ventas/page.tsx:301** - File has too many lines (1385). Maximum allowed is 300.
- **app/admin/web/page.tsx:301** - File has too many lines (1919). Maximum allowed is 300.
- **app/admin/whatsapp/fotos/page.tsx:301** - File has too many lines (431). Maximum allowed is 300.
- **app/admin/whatsapp/page.tsx:301** - File has too many lines (2361). Maximum allowed is 300.

## Archivos con Más Problemas de Calidad (Top 10)

- **services/contact.service.ts:** 42 problemas
- **app/admin/whatsapp/page.tsx:** 28 problemas
- **services/order.service.ts:** 27 problemas
- **app/admin/ventas/page.tsx:** 25 problemas
- **app/admin/pedidos/page.tsx:** 21 problemas
- **app/admin/cotizador/page.tsx:** 15 problemas
- **components/inventory/ProductForm.tsx:** 15 problemas
- **app/api/ai/process-image/route.ts:** 14 problemas
- **components/contacts/PrescriptionManager.tsx:** 14 problemas
- **app/admin/administracion/page.tsx:** 11 problemas

## Recomendaciones para Refactorización

1. **Extraer Funciones:** Para las funciones identificadas en las secciones 1 y 2, buscar bloques de código cohesivos y extraerlos en funciones independientes bien nombradas.
2. **Dividir Componentes:** Los archivos listados en la sección 3 probablemente contienen múltiples componentes lógicos (por ejemplo, UI y gestión de estado). Separar la lógica de negocio en `hooks` personalizados o servicios, y dividir la UI en subcomponentes más pequeños.
3. **Simplificar Lógica Condicional:** Reducir la complejidad ciclomática consolidando condiciones, usando polimorfismo, o retornando temprano (`early return`) para evitar anidamiento profundo.
4. **Principio de Responsabilidad Única (SRP):** Cada archivo y función debe tener un único propósito. Si cuesta describir qué hace una función sin usar la palabra "y", es candidata a ser dividida.
