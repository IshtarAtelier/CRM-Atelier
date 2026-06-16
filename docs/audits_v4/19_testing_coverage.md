# Auditoría de Estrategia de Testing y Cobertura (v4)

## 1. Estado Actual de la Estrategia de Testing

Tras auditar la base de código del proyecto **CRM-Atelier**, se determina que la estrategia estandarizada de pruebas automatizadas es **inexistente**. El estado actual se resume de la siguiente manera:

- **Pruebas Unitarias y de Integración**: No hay frameworks de testing instalados (ausencia total de Jest, Vitest, Mocha, React Testing Library, etc.).
- **Pruebas End-to-End (E2E)**: No existen configuraciones de Cypress ni `@playwright/test`. Aunque el proyecto cuenta con la dependencia base `playwright`, esta parece ser utilizada como motor de automatización/scraping interno (ej. generación de PDFs o interacción de bots) y no para testing asertivo de la UI.
- **Pruebas Manuales / Ad-hoc**: Se detectó una carpeta `scripts/tests/` que contiene decenas de scripts sueltos (`test_phone.js`, `test_pdf_send.ts`, `test-receipt.html`, etc.). Estos scripts actúan como *sandboxes* o pruebas aisladas que los desarrolladores ejecutan manualmente para verificar implementaciones puntuales.

## 2. Detección de Falta de Cobertura Crítica

Dado que no existe una suite automatizada, la cobertura general de código (Code Coverage) es del **0%**. Esto introduce un riesgo altísimo de regresiones silenciosas. 

Las áreas de negocio más críticas que actualmente **no cuentan con cobertura** y deberían ser prioridad máxima son:

### A. Lógica de Negocio, Precios y Facturación
- **Cálculo de Precios y Presupuestos**: Lógica pura de cálculo de descuentos, aplicación de impuestos y sumatorias totales en los carritos de compra.
- **Integración Fiscal (`@afipsdk/afip.js`)**: Los flujos de facturación electrónica son críticos. Un error aquí tiene impacto legal y contable directo. Requiere pruebas unitarias rigurosas mediante mocks.
- **Gestión de Cierres de Caja**: El registro diario de transacciones, cobros y pagos necesita validación determinista.

### B. Gestión de Clientes, Recetas Médicas y Productos
- **Fichas Médicas/Ópticas**: La creación y edición de recetas (graduaciones, distancias pupilares, tipo de cristales) no está validada automatizadamente contra el esquema de base de datos (Prisma).
- **Inventario y Modelos (`test-models.ts`)**: No hay garantía automatizada de que el stock se actualice correctamente tras una venta.

### C. Flujos de Comunicación Externos
- **Integración WhatsApp (`whatsapp-web.js`)**: El bot y el sistema de mensajería (parser de mensajes, respuestas automáticas, estado de sesión) carecen de tests. Si el proveedor cambia la API, el sistema fallará en producción sin aviso previo.
- **Generación de PDFs (`jspdf`, `test_pdf_send.ts`)**: Las facturas o comprobantes enviados a los clientes pueden romperse por cambios en la UI sin que se detecte a tiempo.

### D. Flujos de Usuario Front-End (Camino Crítico)
- **Autenticación (Login)**: No hay validación E2E sobre los permisos y roles de los usuarios (Admin vs Vendedor).
- **Checkout de Ventas**: Todo el flujo desde que el usuario elige un armazón hasta que confirma el pago en el Front-End (Next.js) carece de validación de UI.

## 3. Plan de Acción y Recomendaciones

Para mitigar la creciente deuda técnica y estabilizar futuros despliegues, se recomienda incorporar una estrategia piramidal de testing:

1. **Implementar Pruebas Unitarias Inmediatas (Vitest)**
   - *Acción:* Instalar `vitest` (por ser nativamente compatible con el ecosistema moderno y más rápido que Jest).
   - *Foco inicial:* Cubrir exclusivamente funciones de cálculo (helpers, utilidades de precio, formateadores) y validaciones de Zod.

2. **Implementar Pruebas de Componentes (React Testing Library)**
   - *Acción:* Integrar `@testing-library/react`.
   - *Foco inicial:* Modales de confirmación críticos, formularios de ingreso de recetas y campos de clientes.

3. **Pruebas End-to-End Core (Playwright Test)**
   - *Acción:* Instalar `@playwright/test` aprovechando que los binarios de los navegadores ya se gestionan en el proyecto.
   - *Foco inicial:* Automatizar el **Camino Feliz (Happy Path)** de 2 flujos clave: Login exitoso y Creación de una orden de venta completa.

4. **Automatización CI/CD**
   - *Acción:* Configurar GitHub Actions (o similar) para ejecutar un pipeline de verificación (`npm run lint`, `npm run type-check`, `npm run test`) obligatorio en cada Pull Request antes de fusionar a la rama principal (main).
