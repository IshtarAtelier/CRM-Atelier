# Auditoría de Estrategia de Testing y Cobertura

**Fecha:** 15 de Junio de 2026
**Objetivo:** Auditar la estrategia de pruebas actual (unitarias, integración, E2E) e identificar áreas críticas con falta de cobertura en el sistema CRM-Atelier.

---

## 1. Estado Actual de la Estrategia de Testing

Tras el análisis de la base de código (`package.json`, configuraciones de CI/CD, estructura de directorios y dependencias), se ha detectado que **el proyecto carece de una infraestructura de testing automatizada formal**.

### Hallazgos Principales:
- **Ausencia de Frameworks de Pruebas Automatizadas:** No hay dependencias ni configuraciones para Jest, Vitest, Mocha, Cypress u otras herramientas estándar de testing.
- **Testing Manual:** Se detectó una fuerte dependencia en scripts manuales aislados ubicados en los directorios `scratch/` y `scripts/tests/` (por ejemplo: `test_api.ts`, `test-pricing.js`, `test-receipt.html`). Estos scripts deben ser ejecutados y verificados visualmente por el desarrollador.
- **Uso de Playwright:** Aunque Playwright está presente en las dependencias (`"playwright": "^1.60.0"`), su propósito en la arquitectura actual no es realizar pruebas E2E. Se utiliza como motor de Chrome Headless para **generación de PDFs** (recibos, facturas, órdenes) y **web scraping/automatización de portales externos** (`smartlab.service.ts`). No hay archivos de configuración (`playwright.config.ts`) ni carpetas de pruebas e2e.
- **Integración Continua (CI):** El pipeline de GitHub Actions (`ci.yml`) actualmente solo valida el linting (`npm run lint`) y que el proyecto compile correctamente (`npm run build`). Al no haber pruebas automatizadas, cualquier error de lógica de negocio puede ser integrado silenciosamente en producción (deploy).

---

## 2. Brechas de Cobertura Críticas (Puntos de Riesgo)

La falta de cobertura automatizada expone al sistema a regresiones severas, especialmente en los siguientes dominios de misión crítica:

### A. Facturación, Finanzas y Cierres de Caja (Riesgo Muy Alto)
- **Integración AFIP (`src/lib/afip.ts`):** No hay validación automatizada de las estructuras de datos XML enviadas a la API de AFIP ni del manejo de errores ante caídas del servicio gubernamental.
- **Transacciones y Pagos:** La lógica que maneja `Order`, `Payment` y `CashMovement` carece de pruebas unitarias. Un error aquí podría generar descuadres de caja, estados de deuda incorrectos en clientes, o duplicación de pagos.

### B. Gestión de Órdenes e Inventario (Riesgo Alto)
- **Ciclo de Vida de la Órden:** El flujo desde la creación, paso por laboratorio, hasta la entrega final del cliente requiere pruebas E2E.
- **Manejo de Stock:** No existen tests que validen el correcto descuento de stock (o reserva temporal) de un producto (`Product`) al momento de confirmarse un `OrderItem`, previniendo sobreventas.

### C. WhatsApp Bot y Comunicaciones (Riesgo Moderado a Alto)
- **Manejo de Intenciones:** La lógica alojada en `wa-service/` y el bot que responde consultas, envía notificaciones de "anteojos listos" o procesa recetas, no tiene validación automatizada de parseo de mensajes. Un cambio en las expresiones regulares o en la API de WhatsApp Web (`whatsapp-web.js`) podría dejar mudo al sistema.

### D. Seguridad y Autenticación (Riesgo Alto)
- **Control de Accesos (Middleware):** Carece de pruebas que aseguren que los endpoints de `src/app/api/` solo puedan ser consultados con tokens válidos, previniendo accesos no autorizados a datos médicos (recetas) o financieros de la óptica.

---

## 3. Recomendaciones y Plan de Acción Estratégico

Para estabilizar el sistema de cara a futuros desarrollos y refactorizaciones (como el crecimiento hacia franquicias), se recomienda adoptar la siguiente estrategia iterativa:

### Fase 1: Infraestructura (Semanas 1)
1. **Testing Unitario:** Instalar y configurar **Vitest** (por su excelente integración con ecosistemas Next.js/Typescript y rapidez).
2. **Testing E2E:** Aprovechar la instalación existente de **Playwright**, configurando un framework de testing E2E con su respectivo `playwright.config.ts`.
3. **Mocks:** Configurar `msw` (Mock Service Worker) o mocks de Jest/Vitest para aislar la base de datos de Prisma en los tests unitarios.

### Fase 2: Cobertura de Lógica Crítica Core (Semanas 2-3)
1. Desarrollar pruebas unitarias exclusivas para los servicios contables: calculadoras de saldos, generación de carga útil para la factura de AFIP y lógicas de descuentos/promociones.
2. Escribir tests para funciones auxiliares puras y validadores de schemas Zod.

### Fase 3: Pruebas E2E de "Happy Paths" (Semanas 3-4)
Implementar flujos completos en Playwright para asegurar que la operativa básica no se caiga en cada despliegue:
- Flujo 1: Ingreso al sistema $\rightarrow$ Crear Paciente $\rightarrow$ Cargar Receta $\rightarrow$ Crear Órden $\rightarrow$ Registrar Pago parcial.
- Flujo 2: Cierre de Caja Diario (generación del reporte y cuadre).

### Fase 4: Refuerzo del CI/CD (Semana 4)
- Integrar `npm run test:unit` y `npm run test:e2e` en `.github/workflows/ci.yml`.
- Bloquear la integración de ramas al `main` si la cobertura (coverage) del código core modificado disminuye o si las pruebas fallan.
