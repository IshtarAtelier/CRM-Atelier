# Auditoría de Estrategia de Testing y Cobertura (v5)

**Fecha**: 16 de Junio, 2026
**Objetivo**: Evaluar la estrategia actual de testing (unitario, integración, e2e) en el proyecto "Atelier" y detectar las carencias críticas de cobertura.

## 1. Estado Actual de la Estrategia de Testing

Tras analizar los repositorios principales (Next.js frontend/API en `src` y el bot multi-agente en `wa-service`), **no se ha encontrado ninguna estrategia de testing automatizada implementada**. 

- **Testing Unitario**: Ausente. No hay archivos de test (por ejemplo, `*.test.ts`, `*.spec.ts`) ni configuración de frameworks populares (como Jest, Vitest o Mocha) en el directorio principal o en `wa-service`.
- **Testing E2E (End-to-End)**: Ausente. Aunque la dependencia `playwright` está instalada en el `package.json` principal, se está utilizando de manera exclusiva como motor de headless browser para la generación de PDFs (`client-pdf-generator.ts`, `receipt-pdf-generator.ts`, `order-pdf-generator.ts`) y utilidades de scraping o envío de formularios (como en `src/app/api/smartlab-submit/route.ts`). No hay configuración ni flujos de prueba E2E reales bajo Playwright Test o Cypress.
- **Cobertura General de Código**: **0%**

## 2. Detección de Falta de Cobertura Crítica

La carencia total de testing expone al sistema a regresiones graves en flujos operativos que son esenciales para el negocio. Se debe priorizar urgentemente la cobertura en las siguientes áreas:

### A. Funcionalidad Core (Frontend y API - `src`)
- **Gestión de Fichas y Pacientes**: Operaciones CRUD, búsquedas de perfiles y filtros por receta. Una regresión en esta lógica podría corromper la historia clínica óptica y prescripciones de los clientes.
- **Flujo de Ventas y Finanzas**: Cálculos de importes de productos, señas, saldos pendientes y totalizadores. Todo el flujo monetario es extremadamente sensible a fallos lógicos.
- **Generación de PDFs**: Asegurar que los comprobantes, recibos y órdenes de laboratorio no quiebren al alterar el DOM virtual generado antes de renderizarlos con Playwright.
- **Integraciones de Terceros**: Las integraciones críticas como Smartlab (laboratorio) y AFIP (`@afipsdk/afip.js` para facturación electrónica). 

### B. Servicio Multi-Agente de WhatsApp (`wa-service`)
- **Motor de Estados y Enrutamiento (`LangGraph`)**: El enrutamiento de la conversación entre el agente de ventas, atención al cliente y triage debe ser probado para evitar respuestas incoherentes, pérdida de contexto o bucles infinitos por parte del LLM.
- **Lógica de Consultas a Base de Datos (Prisma)**: Integración con la base de datos para recuperar stock de cristales/marcos o historial de clientes por número telefónico.
- **Manejo de Respuestas de WhatsApp Web (`whatsapp-web.js`)**: Validación de eventos y flujos de reconexión si el servicio se cae.

## 3. Recomendaciones Inmediatas para Remediación

1. **Implementar Vitest**: Configurar Vitest (recomendado por ser rápido, moderno y alineado a Next.js/ESM) tanto en el directorio raíz como en `wa-service` para empezar a cubrir lógica de utilidades, helpers (ej. cálculos de ventas) y formateadores.
2. **Implementar Playwright Test**: Reutilizar la instalación existente de Playwright para configurar `playwright.config.ts` y comenzar a escribir flujos E2E críticos (ej: "Añadir lente a la orden", "Crear nuevo paciente").
3. **Tests de Integración con BD en Memoria o Mock**: Levantar un entorno de test o utilizar mocks para Prisma, a fin de validar los endpoints del API de Next.js y los actions de LangGraph en `wa-service`.
4. **CI/CD Pipeline Automatizado**: Incorporar un script de `test` en `package.json` y ejecutarlo como paso obligatorio en GitHub Actions o la plataforma de despliegue antes de cualquier despliegue a producción.

## Conclusión

El proyecto carece totalmente de una red de seguridad mediante pruebas automatizadas. La inclusión progresiva de testing, comenzando por los flujos financieros, la conexión con AFIP y la lógica multi-agente (LangGraph) en WhatsApp, es prioritaria para permitir escalabilidad técnica y estabilizar la plataforma ante futuros refactors.
