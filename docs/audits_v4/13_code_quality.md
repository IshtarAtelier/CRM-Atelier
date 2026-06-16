# Reporte de Calidad de Código (Code Quality Audit)

Este reporte analiza métricas clave de calidad del código fuente en `src/`, incluyendo complejidad ciclomática, funciones largas, archivos largos y "code smells".

## 1. Resumen de Métricas
- **Funciones de Alta Complejidad (>15):** 153
- **Funciones Largas (>50 líneas):** 380
- **Archivos Largos (>300 líneas):** 59

## 2. Complejidad Ciclomática (Top 20)
La complejidad ciclomática indica el número de rutas linealmente independientes en una función. Valores altos (mayores a 15) hacen el código difícil de testear y mantener.

| Archivo | Línea | Detalle |
|---|---|---|
| `src/services/order.service.ts` | 189 | Static async method 'updateOrder' has a complexity of 156. Maximum allowed is 15. |
| `src/app/admin/ventas/page.tsx` | 60 | Async arrow function has a complexity of 135. Maximum allowed is 15. |
| `src/app/admin/pedidos/page.tsx` | 418 | Async arrow function has a complexity of 130. Maximum allowed is 15. |
| `src/app/api/reports/route.ts` | 14 | Async function 'GET' has a complexity of 127. Maximum allowed is 15. |
| `src/app/api/checkout/payway/route.ts` | 9 | Async function 'POST' has a complexity of 117. Maximum allowed is 15. |
| `src/app/admin/inventario/page.tsx` | 28 | Function 'InventarioPage' has a complexity of 95. Maximum allowed is 15. |
| `src/app/api/reports/reportHelpers.ts` | 3 | Function 'calculateOrderStats' has a complexity of 93. Maximum allowed is 15. |
| `src/app/api/sales-opportunities/route.ts` | 6 | Async function 'GET' has a complexity of 92. Maximum allowed is 15. |
| `src/components/quotes/QuoteSummary.tsx` | 48 | Function 'QuoteSummary' has a complexity of 86. Maximum allowed is 15. |
| `src/app/api/products/import/route.ts` | 85 | Async function 'POST' has a complexity of 82. Maximum allowed is 15. |
| `src/app/admin/whatsapp/page.tsx` | 114 | Function 'WhatsAppPage' has a complexity of 77. Maximum allowed is 15. |
| `src/services/contact.service.ts` | 1490 | Async arrow function has a complexity of 76. Maximum allowed is 15. |
| `src/app/api/dashboard/route.ts` | 7 | Async function 'GET' has a complexity of 69. Maximum allowed is 15. |
| `src/app/producto/[slug]/ProductClient.tsx` | 19 | Function 'ProductClient' has a complexity of 69. Maximum allowed is 15. |
| `src/app/admin/cotizador/page.tsx` | 76 | Function 'CotizadorPageContent' has a complexity of 63. Maximum allowed is 15. |
| `src/services/contact.service.ts` | 337 | Async method 'update' has a complexity of 58. Maximum allowed is 15. |
| `src/components/prescriptions/PrescriptionDetails.tsx` | 13 | Function 'PrescriptionDetails' has a complexity of 56. Maximum allowed is 15. |
| `src/app/admin/web/page.tsx` | 106 | Arrow function has a complexity of 55. Maximum allowed is 15. |
| `src/services/contact.service.ts` | 923 | Async arrow function has a complexity of 53. Maximum allowed is 15. |
| `src/components/Storefront/LensConfigurator.tsx` | 22 | Function 'LensConfigurator' has a complexity of 52. Maximum allowed is 15. |

## 3. Funciones Largas (Top 20)
Funciones con más de 50 líneas. Se recomienda refactorizar extrayendo lógica a funciones más pequeñas.

| Archivo | Línea | Detalle |
|---|---|---|
| `src/app/admin/administracion/page.tsx` | 145 | Function 'AdministracionPage' has too many lines (963). Maximum allowed is 50. |
| `src/app/admin/administracion/page.tsx` | 239 | Async arrow function has too many lines (56). Maximum allowed is 50. |
| `src/app/admin/administracion/page.tsx` | 604 | Arrow function has too many lines (57). Maximum allowed is 50. |
| `src/app/admin/administracion/page.tsx` | 696 | Arrow function has too many lines (82). Maximum allowed is 50. |
| `src/app/admin/caja/page.tsx` | 28 | Function 'CajaPage' has too many lines (498). Maximum allowed is 50. |
| `src/app/admin/configuracion/laboratorios/page.tsx` | 13 | Function 'LaboratoriosConfigPage' has too many lines (211). Maximum allowed is 50. |
| `src/app/admin/configuracion/page.tsx` | 68 | Function 'ConfiguracionPage' has too many lines (1397). Maximum allowed is 50. |
| `src/app/admin/configuracion/page.tsx` | 755 | Arrow function has too many lines (129). Maximum allowed is 50. |
| `src/app/admin/configuracion/page.tsx` | 1006 | Arrow function has too many lines (94). Maximum allowed is 50. |
| `src/app/admin/contactos/page.tsx` | 19 | Function 'ContactosPageContent' has too many lines (219). Maximum allowed is 50. |
| `src/app/admin/cotizador/page.tsx` | 76 | Function 'CotizadorPageContent' has too many lines (1183). Maximum allowed is 50. |
| `src/app/admin/cotizador/page.tsx` | 135 | Arrow function has too many lines (64). Maximum allowed is 50. |
| `src/app/admin/cotizador/page.tsx` | 136 | Async function 'load' has too many lines (61). Maximum allowed is 50. |
| `src/app/admin/cotizador/page.tsx` | 336 | Async arrow function has too many lines (51). Maximum allowed is 50. |
| `src/app/admin/cotizador/page.tsx` | 694 | Arrow function has too many lines (86). Maximum allowed is 50. |
| `src/app/admin/cotizador/page.tsx` | 708 | Arrow function has too many lines (68). Maximum allowed is 50. |
| `src/app/admin/desarrollo/carritos/page.tsx` | 9 | Function 'CarritosAbandonadosPage' has too many lines (260). Maximum allowed is 50. |
| `src/app/admin/desarrollo/carritos/page.tsx` | 138 | Arrow function has too many lines (61). Maximum allowed is 50. |
| `src/app/admin/desarrollo/page.tsx` | 6 | Function 'DesarrolloPage' has too many lines (77). Maximum allowed is 50. |
| `src/app/admin/desarrollo/social/page.tsx` | 50 | Function 'SocialMediaPage' has too many lines (415). Maximum allowed is 50. |

## 4. Archivos Largos (Top 20)
Archivos con más de 300 líneas. Suelen indicar clases o módulos con múltiples responsabilidades que deberían dividirse.

| Archivo | Línea | Detalle |
|---|---|---|
| `src/app/admin/administracion/page.tsx` | 301 | File has too many lines (1107). Maximum allowed is 300. |
| `src/app/admin/caja/page.tsx` | 301 | File has too many lines (525). Maximum allowed is 300. |
| `src/app/admin/configuracion/page.tsx` | 301 | File has too many lines (1475). Maximum allowed is 300. |
| `src/app/admin/cotizador/page.tsx` | 301 | File has too many lines (1270). Maximum allowed is 300. |
| `src/app/admin/desarrollo/social/page.tsx` | 301 | File has too many lines (464). Maximum allowed is 300. |
| `src/app/admin/facturacion/page.tsx` | 301 | File has too many lines (532). Maximum allowed is 300. |
| `src/app/admin/gastos/page.tsx` | 301 | File has too many lines (466). Maximum allowed is 300. |
| `src/app/admin/inventario/page.tsx` | 301 | File has too many lines (1313). Maximum allowed is 300. |
| `src/app/admin/page.tsx` | 301 | File has too many lines (578). Maximum allowed is 300. |
| `src/app/admin/pedidos/page.tsx` | 301 | File has too many lines (1534). Maximum allowed is 300. |
| `src/app/admin/reportes/page.tsx` | 301 | File has too many lines (367). Maximum allowed is 300. |
| `src/app/admin/ventas/page.tsx` | 301 | File has too many lines (1385). Maximum allowed is 300. |
| `src/app/admin/web/page.tsx` | 301 | File has too many lines (1919). Maximum allowed is 300. |
| `src/app/admin/whatsapp/fotos/page.tsx` | 301 | File has too many lines (431). Maximum allowed is 300. |
| `src/app/admin/whatsapp/page.tsx` | 301 | File has too many lines (2361). Maximum allowed is 300. |
| `src/app/api/ai/process-image/route.ts` | 301 | File has too many lines (402). Maximum allowed is 300. |
| `src/app/api/checkout/payway/route.ts` | 301 | File has too many lines (563). Maximum allowed is 300. |
| `src/app/api/cron/payment-report/route.ts` | 301 | File has too many lines (328). Maximum allowed is 300. |
| `src/app/api/dashboard/route.ts` | 301 | File has too many lines (536). Maximum allowed is 300. |
| `src/app/api/orders/route.ts` | 301 | File has too many lines (463). Maximum allowed is 300. |

## 5. Otros Code Smells Frecuentes
Otros problemas detectados por el linter (ej: variables sin uso, problemas de React/Next):

- **@typescript-eslint/no-unused-vars:** 212 ocurrencias
- **unused-imports/no-unused-vars:** 205 ocurrencias
- **react/no-unescaped-entities:** 60 ocurrencias
- **unused-imports/no-unused-imports:** 7 ocurrencias

## Conclusión y Recomendaciones
1. **Refactorización Prioritaria:** Enfocarse en los archivos listados en la sección de Complejidad Ciclomática, extrayendo lógica a utilidades independientes.
2. **Componentes Muy Grandes:** Muchos componentes de React tienen funciones muy largas. Se sugiere separar la lógica de UI (Componentes de Presentación) de la lógica de estado (Hooks o Container Components).
3. **Archivos Extensos:** Archivos que superan las 300 líneas son candidatos a ser separados en sub-módulos para mejorar la mantenibilidad.