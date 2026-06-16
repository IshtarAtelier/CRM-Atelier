# Reporte de Auditoría: Estrategia y Cobertura de Testing

**Fecha:** 15 de Junio de 2026
**Proyecto:** CRM-Atelier

## 1. Resumen Ejecutivo
Se realizó una auditoría sobre la estrategia de pruebas actual del proyecto, incluyendo testing unitario, pruebas end-to-end (e2e) y scripts de validación existentes. Se detectó una carencia crítica de automatización de pruebas, lo que representa un riesgo alto para la estabilidad del sistema frente a futuros despliegues y refactorizaciones. 

## 2. Estrategia Actual de Testing

Actualmente, **no existe una estrategia de testing automatizado consolidada** en el proyecto.
- **Testing Unitario:** Inexistente. No hay frameworks configurados (como Jest o Vitest) ni archivos con extensión `.test.ts`, `.spec.ts` en el código fuente principal (`src/` o `wa-service/`).
- **Testing End-to-End (E2E):** Inexistente de forma automatizada. Aunque la librería `playwright` está listada en las dependencias y se utiliza en pasos de build, parece estar usándose para web scraping o generación de PDFs (ej. `test-screenshot.js`), no como un entorno de test suite. No se encuentran carpetas de E2E como `cypress/` o `playwright/tests/`.
- **Integración Continua (CI):** No hay comandos en los scripts del `package.json` destinados a correr validaciones de test (`npm test`). El único control pre-build es `scripts/checks/verify-build.js`, el cual es un validador de configuración básica para la base de datos, no un suite de pruebas.

## 3. Evaluación de Scripts de Pruebas Existentes

Existe una carpeta `scripts/tests/` con más de 20 archivos (`test_clients.js`, `test_chats.js`, `test-image.ts`, `test_jspdf.ts`, etc.). 

**Análisis de estos scripts:**
- **Naturaleza Ad-Hoc:** Son scripts aislados, construidos para validación visual o verificación manual por parte del desarrollador.
- **Falta de Aserciones:** No utilizan un runner de tests ni aserciones reales (no hay expects o asserts). Simplemente ejecutan código (ej. consultas de Prisma a la BD) y arrojan resultados en consola mediante `console.log()`.
- **Mantenibilidad:** Al depender de ejecución y revisión humana, es inviable correrlos de forma sistemática y no garantizan la prevención de regresiones.

## 4. Falta de Cobertura Crítica Detectada

Debido a la falta total de pruebas automatizadas, las siguientes áreas de misión crítica carecen de cobertura:

1. **Frontend y Componentes UI (`src/`):** 
   - No hay validación de renderizado de componentes clave en React/Next.js.
   - Los flujos de usuario (creación de contactos, ventas, vistas de tablero) no tienen garantías ante cambios de código.

2. **Backend y Lógica de Negocio (`src/app/api/` y Prisma):** 
   - **Facturación y Finanzas:** La integración con AFIP y la generación de recibos/facturas es crítica y propensa a errores sin tests automatizados.
   - **Gestión de Base de Datos:** La lógica de creación, actualización y borrado en base de datos (Prisma) no está verificada para operaciones complejas o en cascada.

3. **Servicio WhatsApp y LangChain (`wa-service/`):** 
   - Carece completamente de pruebas. Al ser el canal principal de interacción y utilizar IA (LangChain), cualquier cambio en el prompt o en el flujo de los grafos puede romper la atención automática.
   - Los agentes (controllers, followups, passive-extractor) no poseen mocks ni validaciones de output.

## 5. Recomendaciones de Acción

1. **Implementar Testing Unitario:** Configurar **Vitest** (recomendado por velocidad con Next.js) o **Jest** para empezar a testear funciones utilitarias, lógica de facturación y el procesamiento del `wa-service`.
2. **Implementar E2E Testing:** Configurar un entorno formal de **Playwright** (ya instalado en dependencias) para simular al menos 3 flujos críticos:
   - Login de usuario.
   - Creación de un cliente y venta básica.
   - Generación de un PDF/Recibo.
3. **Migración de Scripts:** Refactorizar los scripts útiles de `scripts/tests/` hacia aserciones reales dentro de suites de test automatizadas para que validen datos de prueba contra resultados esperados.
4. **CI Pipeline:** Integrar un paso de `npm run test` en Github Actions (o plataforma equivalente) que bloquee despliegues si alguna prueba falla.
