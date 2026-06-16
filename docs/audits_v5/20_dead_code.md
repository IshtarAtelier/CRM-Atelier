# Reporte de Código Muerto y Archivos Huérfanos (Fase 4)

Este reporte detalla los archivos no utilizados, dependencias obsoletas, exportaciones huérfanas y tipos exportados que ya no se usan en el proyecto luego de completar la Fase 4. Los resultados fueron obtenidos utilizando herramientas de análisis estático (`knip` y `unimported`).

## 1. Archivos No Utilizados (55 archivos)

### Scripts en la Raíz
Estos archivos temporales de utilidad ya no se importan en el proyecto principal:
- `audit-eslint.config.mjs`
- `fix_fonts.js`
- `fix_globals.js`
- `fix_inputs.js`
- `fix_inputs2.js`
- `generate_report.js`
- `run_audit.js`

### Scripts de Actualización (`scripts/updates/`)
Estos scripts de migraciones de datos o parches temporales están aislados:
- `backfill_store_visits.ts`, `fix_treatment.ts`, `fix-physio-lab.js`, `merge-duplicates.ts`, `reprocess-all-eyewear.js`, `update-all-prices.js`, `update-comfort-max.js`, `update-interview-espace.js`, `update-kodak.js`, `update-mi-primer-varilux.js`, `update-monofocales-gens.js`, `update-myopilux-names.js`, `update-physio-prod.js`, `update-precise.js`, `update-product-names.js`, `update-ranges-comfort.js`, `update-ranges-eyezen.js`, `update-ranges-kodak.js`, `update-ranges-myopilux.js`, `update-ranges-xr-fix.js`, `update-ranges-xr.js`, `update-varilux-xr-prod.js`

### Servicio WhatsApp (`wa-service/`)
El directorio `wa-service` entero parece ser un código heredado o desacoplado del flujo actual de Next.js:
- Archivos en la raíz del servicio: `agent-tools.js`, `db.js`, `graph.js`, `index.js`, `passive-extractor.js`, `sales-followups.js`, `tools.js`, `transcriber.js`, `utils.js`
- Cron y Followups: `cron/inactivity-followups.js`, `followups/*.js`
- Prompts, Rutas y Servicios: `prompts/*.js`, `routes/*.js`, `services/*.js`, `shared/*.js`, `whatsapp/client.js`

## 2. Dependencias No Utilizadas (en `package.json`)

### Dependencias (`dependencies`) (19)
- `@aws-sdk/client-s3`
- `@aws-sdk/s3-request-presigner`
- `@langchain/langgraph`
- `axios`
- `clsx`
- `cors`
- `dotenv`
- `express`
- `googleapis`
- `jsonwebtoken`
- `node-fetch`
- `openai`
- `pg`
- `proxy-agent`
- `qrcode-terminal`
- `tailwind-merge`
- `tesseract.js`
- `whatsapp-web.js`
- `xlsx`

### Dependencias de Desarrollo (`devDependencies`) (4)
- `@types/bcryptjs`
- `better-sqlite3`
- `cross-env`
- `eslint-config-next`

### Dependencias Faltantes en package.json pero importadas en código (3)
- `@eslint/eslintrc`
- `@eslint/js`
- `sharp`

## 3. Exportaciones Huérfanas (Código Muerto)

Se encontraron constantes y funciones exportadas que no tienen ninguna importación activa en el proyecto:

- `src/lib/afip.ts`: `BILLING_ACCOUNTS`
- `src/lib/backup.ts`: `BACKUP_PREFIX`
- `src/lib/client-pdf-generator.ts`: `getClientHtml()`
- `src/lib/copilot-tools.ts`: `STAFF_TOOLS`, `ADMIN_TOOLS`
- `src/lib/crystal-color-utils.ts`: `getColorCategoryLabel()`
- `src/lib/googleReviews.ts`: `FALLBACK_REVIEWS`, `fetchLegacyReviews()`, `fetchNewReviews()`
- `src/lib/order-pdf-generator.ts`: `getOrderHtml()`
- `src/lib/promo-utils.ts`: `calculatePromoFrameDiscount`
- `src/lib/receipt-pdf-generator.ts`: `getReceiptHtml()`
- `src/lib/wa-config.ts`: `WA_SERVER_URL`
- `src/services/order.service.ts`: `dynamic`

## 4. Tipos de TypeScript Huérfanos

Interfaces que se exportan pero nadie las consume:
- **Agents:** `QuoteOption` (`src/services/agents/agents/QuoteAgent.ts`)
- **Billing:** `CreateInvoiceItem` (`src/services/billing.service.ts`)
- **Reports:** `BillingStat` (`src/services/report.service.ts`)
- **SmartLab:** `ScrapedDetail` (`src/services/smartlab.service.ts`)
- **Store:** `CartItem` (`src/store/useCart.ts`)
- **Types (Contacts):** `Tag`, `Interaction`, `Prescription`, `OrderItem`, `Payment`, `Order`
- **Types (Orders):** `OrderItemProduct`, `OrderItem`, `OrderPrescription`, `OrderPayment`, `OrderInvoice`, `OrderClient`

---
*Recomendación de acción:* 
1. Eliminar los archivos sueltos y scripts de migración antiguos.
2. Evaluar si `wa-service` debe ser mantenido o puede ser archivado.
3. Desinstalar dependencias no utilizadas (`npm uninstall ...`) para acelerar el tiempo de construcción y reducir vulnerabilidades.
4. Remover las funciones exportadas que ya no se invocan.
