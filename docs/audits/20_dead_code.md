# Reporte de Código Muerto y Archivos No Utilizados (Auditoría)

## Resumen Ejecutivo
Se ha realizado un análisis exhaustivo del proyecto para identificar archivos no utilizados, importaciones huérfanas, variables sin uso, código comentado (dead code) y consolas de log en producción. El objetivo es mantener el código limpio, optimizar el rendimiento y facilitar el mantenimiento.

---

## 1. Archivos No Utilizados (Unused Files)
Se detectaron **190 archivos** que no están siendo importados o utilizados por el resto de la aplicación. La gran mayoría pertenece a la carpeta `scripts/` (138 archivos) que actúan como ejecutables independientes. Sin embargo, hay varios componentes de la aplicación que se encuentran huérfanos:

**Componentes y utilidades en `src/` que pueden ser eliminados:**
- `src/components/CotizadorPopup.tsx`
- `src/components/QuickQuote.tsx`
- `src/components/Storefront/HomeVideoSection.tsx`
- `src/components/billing/InvoiceItemEditor.tsx`
- `src/components/inventory/ProductCard.tsx`
- `src/components/quotes/QuotePrescription.tsx`
- `src/lib/data/blog.ts`
- `src/lib/validations/order.schema.ts`
- Scripts de prueba locales: `src/test-html.ts`, `src/test-local-pdf.ts`, `src/test-pdf.ts`, `src/test-send-pdf.ts`.

*(Nota: Los archivos de `wa-service/` también fueron marcados debido a que la herramienta de análisis estático requiere configurarlos como puntos de entrada, pero los componentes de React mencionados arriba son genuinamente huérfanos).*

---

## 2. Importaciones y Variables Huérfanas (Unused Imports & Locals)
El análisis estático con TypeScript (`tsc --noUnusedLocals`) detectó **299 instancias** de variables y/o importaciones que se declaran pero nunca se utilizan en el código.

Adicionalmente, se encontraron las siguientes **Exportaciones Huérfanas** (funciones que se exportan pero nadie las importa):
- `calculatePromoFrameDiscount` en `src/lib/promo-utils.ts`
- `BILLING_ACCOUNTS` en `src/lib/afip.ts`
- `BACKUP_PREFIX` en `src/lib/backup.ts`
- `STAFF_TOOLS` y `ADMIN_TOOLS` en `src/lib/copilot-tools.ts`
- `FALLBACK_REVIEWS`, `fetchLegacyReviews`, `fetchNewReviews` en `src/lib/googleReviews.ts`
- `getClientHtml`, `getReceiptHtml`, `getOrderHtml` en sus respectivos generadores de PDF.

---

## 3. Código Comentado (Dead Code)
Se revisó el código en busca de bloques lógicos de código comentados (ej. `// import ...`, `// function ...`, `// if (...)`).
El código base se encuentra **muy limpio** en este aspecto. Apenas se encontró código funcional comentado, lo que indica un buen mantenimiento y uso adecuado de control de versiones. 
El único caso destacable aislado encontrado en producción es:
- `src/app/admin/cotizador/page.tsx:30` (`// import { toast } from 'sonner';`)

---

## 4. Consolas de Log en Producción
Se encontró una gran cantidad de llamadas a `console.log`, `console.info`, `console.error`, etc., en código destinado a producción (excluyendo tests y `node_modules`).

**Total de instancias encontradas:** 784 llamadas.

Los archivos con mayor cantidad de logs son:
- **`wa-service/index.js`**: 72 logs
- **`wa-service/whatsapp/client.js`**: 32 logs
- **`src/services/contact.service.ts`**: 30 logs
- **`wa-service/tools.js`**: 27 logs
- **`src/app/api/ai/process-image/route.ts`**: 20 logs
- **`wa-service/services/sync.service.js`**: 14 logs
- **`wa-service/followups/smart-task-executor.js`**: 14 logs
- **`src/services/smartlab.service.ts`**: 13 logs
- **`src/app/admin/whatsapp/page.tsx`**: 13 logs
- **`src/app/admin/cotizador/page.tsx`**: 12 logs
- **`src/hooks/useContacts.ts`**: 10 logs

---

## Recomendaciones y Próximos Pasos

1. **Limpieza de Componentes:** Revisar y eliminar los componentes de React en `src/components/` mencionados en la Sección 1 si ya han sido deprecados.
2. **Corrección de TypeScript:** Ejecutar `eslint --fix` o limpiar manualmente los archivos para eliminar las 299 importaciones y variables no utilizadas, mejorando así la legibilidad y tiempo de compilación.
3. **Limpieza de Consolas de Log:**
   - **Frontend:** Implementar una regla como `no-console` en ESLint para advertir o bloquear `console.log` en el código de Next.js (lado cliente).
   - **Backend / wa-service:** Migrar de `console.log` a un sistema estructurado de logging (como `pino` o `winston`) que permita ajustar los niveles de log (`info`, `debug`, `error`) según el entorno (desarrollo vs. producción), evitando ensuciar la salida estándar y facilitando el monitoreo.
