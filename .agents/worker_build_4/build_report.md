# Build & TypeScript Verification Report

**Date/Time**: 2026-06-15T11:02:00-03:00  
**Repository**: `/Users/ishtarpissano/proyectos/atelier`  
**Agent working directory**: `/Users/ishtarpissano/proyectos/atelier/.agents/worker_build_4`

This report provides the build and compilation check status of the Atelier CRM & E-Commerce application. All checks were executed in a read-only static capacity with no modifications to source files.

---

## 1. TypeScript Compile Check (`npx tsc --noEmit`)

- **Command**: `npx tsc --noEmit`
- **Working Directory**: `/Users/ishtarpissano/proyectos/atelier`
- **Exit Code**: `0`
- **Result**: **PASS** (Zero compilation errors/warnings)
- **Verbatim Output**:
```
(No stdout or stderr output produced)
```

---

## 2. Application Build Check (`npm run build`)

- **Command**: `npm run build`
- **Working Directory**: `/Users/ishtarpissano/proyectos/atelier`
- **Exit Code**: `0`
- **Result**: **PASS** (Application built successfully)
- **Verbatim Output**:
```
> optical-crm@0.1.0 build
> npx prisma generate && next build && (PLAYWRIGHT_BROWSERS_PATH=./.playwright-browsers npx playwright install chromium || echo 'Playwright install skipped')

Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma

✔ Generated Prisma Client (v5.22.0) to ./node_modules/@prisma/client in 95ms

Start by importing your Prisma Client (See: https://pris.ly/d/importing-client)

Tip: Easily identify and fix slow SQL queries in your app. Optimize helps you enhance your visibility: https://pris.ly/--optimize

   ▲ Next.js 15.1.11
   - Environments: .env

   Creating an optimized production build ...
 ✓ Compiled successfully
   Linting and checking validity of types ...

 ⚠ The Next.js plugin was not detected in your ESLint configuration. See https://nextjs.org/docs/app/api-reference/config/eslint#migrating-existing-config

./src/app/admin/caja/page.tsx
310:29  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

./src/app/admin/cotizador/page.tsx
730:74  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

./src/app/admin/desarrollo/social/page.tsx
372:41  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

./src/app/admin/equipo/page.tsx
39:8  Warning: React Hook useEffect has a missing dependency: 'fetchMessages'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps

./src/app/admin/gastos/page.tsx
180:8  Warning: React Hook useEffect has a missing dependency: 'fetchExpenses'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps

./src/app/admin/inventario/page.tsx
685:53  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

./src/app/admin/page.tsx
93:6  Warning: React Hook useEffect has a missing dependency: 'fetchDashboard'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps

./src/app/admin/reportes/page.tsx
139:8  Warning: React Hook useEffect has a missing dependency: 'fetchReport'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps

./src/app/admin/ventas/page.tsx
202:8  Warning: React Hook useEffect has missing dependencies: 'fetchOrders' and 'search'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
217:8  Warning: React Hook useEffect has missing dependencies: 'fetchOrders' and 'search'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps

./src/app/admin/web/page.tsx
146:11  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element
208:23  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element
254:23  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element
290:23  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element
350:23  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element
379:23  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element
832:31  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element
908:25  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element
1324:33  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element
1350:31  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element
1668:19  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element
1668:19  Warning: img elements must have an alt prop, either with meaningful text, or an empty string for decorative images.  jsx-a11y/alt-text

./src/app/admin/whatsapp/fotos/page.tsx
342:53  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

./src/app/admin/whatsapp/page.tsx
441:8  Warning: React Hook useCallback has missing dependencies: 'searchParams', 'showInAppNotification', and 'urlPhone'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
799:8  Warning: React Hook useEffect has a missing dependency: 'showInAppNotification'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
1143:33  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element
1958:65  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element
2046:49  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

./src/app/blog/[slug]/page.tsx
682:17  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element
695:17  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element
708:17  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element
727:17  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element
740:17  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element
753:17  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element
772:17  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element
785:17  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element
798:17  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element
1240:11  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element
1247:11  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element
1257:13  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element
1260:13  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element
1285:11  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element
1292:11  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element
1299:11  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

./src/app/checkout/page.tsx
33:6  Warning: React Hook useEffect has a missing dependency: 'getCartTotal'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
166:6  Warning: React Hook useEffect has a missing dependency: 'getCartTotal'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps

./src/app/landing/wicue/page.tsx
22:13  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element
107:12  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

./src/app/promo/page.tsx
20:39  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element
309:25  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element
320:25  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element
331:25  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

./src/components/FileDropZone.tsx
175:17  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

./src/components/Sidebar.tsx
77:11  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

./src/components/Storefront/CartSidebar.tsx
67:23  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

./src/components/Storefront/StorefrontNavbar.tsx
273:29  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

./src/components/TestChatModal.tsx
169:45  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element
242:33  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

./src/components/campanas/AdNode.tsx
50:11  Warning: Image elements must have an alt prop, either with meaningful text, or an empty string for decorative images.  jsx-a11y/alt-text

./src/components/checkout/CheckoutSummarySidebar.tsx
14:15  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

./src/components/contacts/PrescriptionManager.tsx
479:29  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

./src/components/inventory/AIImageUploader.tsx
134:15  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

./src/components/inventory/LabPriceImporter.tsx
292:41  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

./src/components/inventory/PhotoStudio.tsx
223:27  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element
305:21  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

./src/components/orders/OrderDetailPanel.tsx
70:21  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element
147:41  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

./src/components/prescriptions/PrescriptionDetails.tsx
157:25  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

./src/components/quotes/QuotePrescription.tsx
139:21  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

info  - Need to disable some ESLint rules? Learn more here: https://nextjs.org/docs/app/api-reference/config/eslint#disabling-rules
   Collecting page data ...
   Generating static pages (0/119) ...
   Generating static pages (29/119) 
   Generating static pages (59/119) 
   Generating static pages (89/119) 
 ✓ Generating static pages (119/119)
Intentando obtener reseñas con la API de Places Legacy...
Intentando obtener reseñas con la API de Places (New)...
Intentando obtener reseñas con la API de Places Legacy...
Intentando obtener reseñas con la API de Places (New)...
Fallo la API Legacy: You’re calling a legacy API, which is not enabled for your project. To get newer features and more functionality, switch to the Places API (New) or Routes API. Learn more: https://developers.google.com/maps/legacy#LegacyApiNotActivatedMapError
Fallo la API Legacy en Página: You’re calling a legacy API, which is not enabled for your project. To get newer features and more functionality, switch to the Places API (New) or Routes API. Learn more: https://developers.google.com/maps/legacy#LegacyApiNotActivatedMapError
Fallo la API Legacy: You’re calling a legacy API, which is not enabled for your project. To get newer features and more functionality, switch to the Places API (New) or Routes API. Learn more: https://developers.google.com/maps/legacy#LegacyApiNotActivatedMapError
   Finalizing page optimization ...
   Collecting build traces ...

Route (app)                                    Size     First Load JS
┌ ○ /                                          11.9 kB         187 kB
├ ○ /_not-found                                465 B           106 kB
├ ƒ /admin                                     11.8 kB         160 kB
├ ƒ /admin/administracion                      12 kB           128 kB
├ ƒ /admin/caja                                5.55 kB         121 kB
├ ƒ /admin/configuracion                       11.2 kB         117 kB
├ ƒ /admin/configuracion/laboratorios          3.79 kB         110 kB
├ ƒ /admin/contactos                           25.5 kB         169 kB
├ ƒ /admin/cotizador                           10.4 kB         154 kB
├ ƒ /admin/desarrollo                          2.59 kB         108 kB
├ ƒ /admin/desarrollo/campanas                 8.88 kB         157 kB
├ ƒ /admin/desarrollo/carritos                 7.51 kB         116 kB
├ ƒ /admin/desarrollo/social                   6.43 kB         112 kB
├ ƒ /admin/equipo                              4.81 kB         117 kB
├ ƒ /admin/facturacion                         5.82 kB         174 kB
├ ƒ /admin/gastos                              5.61 kB         111 kB
├ ƒ /admin/inventario                          31.4 kB         137 kB
├ ƒ /admin/pedidos                             19.5 kB         136 kB
├ ƒ /admin/reportes                            16.4 kB         129 kB
├ ƒ /admin/smartlab-bookmarklet                2.59 kB         108 kB
├ ƒ /admin/ventas                              14.7 kB         187 kB
├ ƒ /admin/web                                 15.3 kB         125 kB
├ ƒ /admin/whatsapp                            48.6 kB         179 kB
├ ƒ /admin/whatsapp/fotos                      5.32 kB         115 kB
├ ƒ /api/admin/alert                           465 B           106 kB
├ ƒ /api/admin/blog                            465 B           106 kB
├ ƒ /api/admin/blog/[id]                       465 B           106 kB
├ ƒ /api/admin/fix-names                       465 B           106 kB
├ ƒ /api/admin/fix-phones                      465 B           106 kB
├ ƒ /api/admin/web-products                    465 B           106 kB
├ ƒ /api/agents/chat                           465 B           106 kB
├ ƒ /api/agents/seo                            465 B           106 kB
├ ƒ /api/ai/process-image                      465 B           106 kB
├ ƒ /api/auth/login                            465 B           106 kB
├ ƒ /api/auth/logout                           465 B           106 kB
├ ƒ /api/auth/me                               465 B           106 kB
├ ƒ /api/backup                                465 B           106 kB
├ ƒ /api/backup/status                         465 B           106 kB
├ ƒ /api/billing/config                        465 B           106 kB
├ ƒ /api/billing/invoice                       465 B           106 kB
├ ƒ /api/billing/invoice/[id]                  465 B           106 kB
├ ƒ /api/billing/invoice/[id]/pdf-data         465 B           106 kB
├ ƒ /api/blog                                  465 B           106 kB
├ ƒ /api/blog/generate                         465 B           106 kB
├ ƒ /api/bot/clients                           465 B           106 kB
├ ƒ /api/bot/hitos/extract                     465 B           106 kB
├ ƒ /api/bot/interactions                      465 B           106 kB
├ ƒ /api/bot/messages                          465 B           106 kB
├ ƒ /api/bot/notify-invoice                    465 B           106 kB
├ ƒ /api/bot/orders                            465 B           106 kB
├ ƒ /api/bot/prescriptions                     465 B           106 kB
├ ƒ /api/bot/pricing                           465 B           106 kB
├ ƒ /api/bot/products                          465 B           106 kB
├ ƒ /api/bot/tasks                             465 B           106 kB
├ ƒ /api/cash                                  465 B           106 kB
├ ƒ /api/cash/movement                         465 B           106 kB
├ ƒ /api/checkout/config                       465 B           106 kB
├ ƒ /api/checkout/payway                       465 B           106 kB
├ ƒ /api/checkout/recovery-email               465 B           106 kB
├ ƒ /api/checkout/session                      465 B           106 kB
├ ƒ /api/complaints                            465 B           106 kB
├ ƒ /api/contacts                              465 B           106 kB
├ ƒ /api/contacts/[id]                         465 B           106 kB
├ ƒ /api/contacts/[id]/can-close               465 B           106 kB
├ ƒ /api/contacts/[id]/favorite                465 B           106 kB
├ ƒ /api/contacts/[id]/interactions            465 B           106 kB
├ ƒ /api/contacts/[id]/payments                465 B           106 kB
├ ƒ /api/contacts/[id]/prescriptions           465 B           106 kB
├ ƒ /api/contacts/[id]/prescriptions/[presId]  465 B           106 kB
├ ƒ /api/contacts/[id]/priority                465 B           106 kB
├ ƒ /api/contacts/[id]/status                  465 B           106 kB
├ ƒ /api/contacts/[id]/tasks                   465 B           106 kB
├ ƒ /api/copilot                               465 B           106 kB
├ ƒ /api/cron/daily-cash                       465 B           106 kB
├ ƒ /api/cron/payment-report                   465 B           106 kB
├ ƒ /api/cron/smartlab-sync                    465 B           106 kB
├ ƒ /api/crystal-colors                        465 B           106 kB
├ ƒ /api/crystal-colors/[id]                   465 B           106 kB
├ ƒ /api/dashboard                             465 B           106 kB
├ ƒ /api/diag                                  465 B           106 kB
├ ƒ /api/diag/afip                             465 B           106 kB
├ ƒ /api/doctors                               465 B           106 kB
├ ƒ /api/doctors/commissions                   465 B           106 kB
├ ƒ /api/doctors/payments                      465 B           106 kB
├ ƒ /api/email                                 465 B           106 kB
├ ƒ /api/equipo/mensajes                       465 B           106 kB
├ ƒ /api/expenses                              465 B           106 kB
├ ƒ /api/export                                465 B           106 kB
├ ƒ /api/fixed-costs                           465 B           106 kB
├ ƒ /api/fixed-costs/[id]                      465 B           106 kB
├ ƒ /api/lab-ready                             465 B           106 kB
├ ƒ /api/laboratories                          465 B           106 kB
├ ƒ /api/laboratories/[id]                     465 B           106 kB
├ ƒ /api/marketing/dashboard                   465 B           106 kB
├ ƒ /api/notifications                         465 B           106 kB
├ ƒ /api/notifications/[id]                    465 B           106 kB
├ ƒ /api/ocr                                   465 B           106 kB
├ ƒ /api/orders                                465 B           106 kB
├ ƒ /api/orders/[id]                           465 B           106 kB
├ ƒ /api/orders/[id]/notify-ready              465 B           106 kB
├ ƒ /api/orders/[id]/payments                  465 B           106 kB
├ ƒ /api/orders/[id]/pdf                       465 B           106 kB
├ ƒ /api/orders/[id]/refresh-prices            465 B           106 kB
├ ƒ /api/orders/[id]/send-pdf                  465 B           106 kB
├ ƒ /api/orders/with-balance                   465 B           106 kB
├ ƒ /api/payments                              465 B           106 kB
├ ƒ /api/payments/[id]                         465 B           106 kB
├ ƒ /api/payments/[id]/receipt-pdf             465 B           106 kB
├ ƒ /api/products                              465 B           106 kB
├ ƒ /api/products/[id]                         465 B           106 kB
├ ƒ /api/products/bulk                         465 B           106 kB
├ ƒ /api/products/delete-all                   465 B           106 kB
├ ƒ /api/products/fix-categories               465 B           106 kB
├ ƒ /api/products/import                       465 B           106 kB
├ ƒ /api/products/ocr-update                   465 B           106 kB
├ ƒ /api/products/recalculate-stock            465 B           106 kB
├ ƒ /api/reports                               465 B           106 kB
├ ƒ /api/review-requests/pending               465 B           106 kB
├ ƒ /api/reviews                               465 B           106 kB
├ ƒ /api/sales-opportunities                   465 B           106 kB
├ ƒ /api/search                                465 B           106 kB
├ ƒ /api/seo/generate                          465 B           106 kB
├ ƒ /api/service-pricing                       465 B           106 kB
├ ƒ /api/service-pricing/[id]                  465 B           106 kB
├ ƒ /api/settings                              465 B           106 kB
├ ƒ /api/smartlab-submit                       465 B           106 kB
├ ƒ /api/smartlab-sync                         465 B           106 kB
├ ƒ /api/social/generate                       465 B           106 kB
├ ƒ /api/social/history                        465 B           106 kB
├ ƒ /api/storage/local-upload                  465 B           106 kB
├ ƒ /api/storage/upload-url                    465 B           106 kB
├ ƒ /api/storage/view                          465 B           106 kB
├ ○ /api/store/products                        465 B           106 kB
├ ƒ /api/tags                                  465 B           106 kB
├ ƒ /api/tags/[id]                             465 B           106 kB
├ ƒ /api/targets                               465 B           106 kB
├ ƒ /api/tasks/pending                         465 B           106 kB
├ ƒ /api/tmp-import-contacts                   465 B           106 kB
├ ƒ /api/upload                                465 B           106 kB
├ ƒ /api/users                                 465 B           106 kB
├ ƒ /api/users/[id]                            465 B           106 kB
├ ƒ /api/web/checkout                          465 B           106 kB
├ ƒ /api/web/pricing                           465 B           106 kB
├ ƒ /api/whatsapp/agent                        465 B           106 kB
├ ƒ /api/whatsapp/agent/catalog                465 B           106 kB
├ ƒ /api/whatsapp/agent/media                  465 B           106 kB
├ ƒ /api/whatsapp/chats                        465 B           106 kB
├ ƒ /api/whatsapp/chats/[id]                   465 B           106 kB
├ ƒ /api/whatsapp/chats/[id]/bot               465 B           106 kB
├ ƒ /api/whatsapp/chats/[id]/extract-client    465 B           106 kB
├ ƒ /api/whatsapp/chats/[id]/messages          465 B           106 kB
├ ƒ /api/whatsapp/notify                       465 B           106 kB
├ ƒ /api/whatsapp/send                         465 B           106 kB
├ ƒ /api/whatsapp/status                       465 B           106 kB
├ ƒ /api/whatsapp/sync                         465 B           106 kB
├ ƒ /api/whatsapp/test-chat                    465 B           106 kB
├ ○ /apple-icon.png                            0 B                0 B
├ ƒ /arma-tus-lentes                           4.74 kB         176 kB
├ ○ /blog                                      3.12 kB         175 kB
├ ƒ /blog/[slug]                               3.12 kB         175 kB
├ ○ /blog/colores-cristales                    183 B           110 kB
├ ○ /blog/control-miopia                       183 B           110 kB
├ ○ /blog/guia-cristales                       183 B           110 kB
├ ○ /blog/matias-turchi                        3.13 kB         175 kB
├ ○ /checkout                                  8.57 kB         180 kB
├ ○ /clip-on                                   3.13 kB         175 kB
├ ○ /como-comprar                              3.13 kB         175 kB
├ ○ /contacto                                  3.96 kB         176 kB
├ ○ /cristales-opticos                         465 B           106 kB
├ ○ /cristales-opticos/blue-uv                 1.5 kB          111 kB
├ ○ /cristales-opticos/crizal                  1.5 kB          111 kB
├ ○ /cristales-opticos/kodak                   1.5 kB          111 kB
├ ○ /cristales-opticos/myofix                  1.5 kB          111 kB
├ ○ /cristales-opticos/stellest                1.5 kB          111 kB
├ ○ /cristales-opticos/transitions             1.5 kB          111 kB
├ ○ /cristales-opticos/varilux                 1.5 kB          111 kB
├ ○ /cristales-opticos/xperio                  1.5 kB          111 kB
├ ○ /faq                                       4.24 kB         176 kB
├ ○ /icon.png                                  0 B                0 B
├ ○ /landing/wicue                             3.72 kB         179 kB
├ ○ /lentes-de-contacto                        3.13 kB         175 kB
├ ƒ /lentes-de-sol                             2.05 kB         179 kB
├ ○ /login                                     2.37 kB         114 kB
├ ○ /nuestro-local                             3.12 kB         175 kB
├ ○ /politicas-de-cambio                       3.13 kB         175 kB
├ ○ /politicas-de-privacidad                   3.13 kB         175 kB
├ ƒ /producto/[slug]                           11.8 kB         183 kB
├ ○ /promo                                     2.05 kB         108 kB
├ ○ /quienes-somos                             3.13 kB         175 kB
├ ƒ /receta                                    2.05 kB         179 kB
├ ○ /resenas                                   6.44 kB         178 kB
├ ○ /robots.txt                                0 B                0 B
├ ƒ /sitemap.xml                               0 B                0 B
├ ○ /terminos-y-condiciones                    3.13 kB         175 kB
└ ƒ /tienda                                    4.65 kB         182 kB
+ First Load JS shared by all                  106 kB
  ├ chunks/1517-034cc8192a156291.js            50.7 kB
  ├ chunks/4bd1b696-38cd4b0c17d94630.js        53 kB
  └ other shared chunks (total)                2.24 kB


ƒ Middleware                                   36.6 kB

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```
