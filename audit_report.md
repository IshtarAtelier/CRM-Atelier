# Codebase Audit Report — Atelier CRM & E-Commerce

**Date**: 2026-06-15  
**Target Repository**: `/Users/ishtarpissano/proyectos/atelier`  
**Status**: Synthesized Final Audit  

---

## 1. Executive Summary

This report presents a comprehensive synthesis of the codebase audit for Atelier CRM & E-Commerce. The audit was conducted across four distinct milestones investigating **Security**, **Code Quality & Performance**, **Integration Health**, and **Build/TypeScript Verification**.

### Overall Status Assessment

- **Security (Critical Risks)**: The application contains severe security flaws that expose it to privilege escalation, client-side price manipulation, and mass disclosure of customer Personally Identifiable Information (PII). Unauthenticated endpoints allow unauthorized database manipulation, and an unprotected WebSocket server leaks real-time customer chat logs. Immediate remediation is mandatory.
- **Code Quality & Performance (High Risk)**: Prisma Client connection leaks occur due to redundant database instantiations across several modules, risking connection pool exhaustion. Crucial dashboard and order endpoints query entire tables to execute in-memory filtering rather than aggregating data at the database level, creating serverless timeout risks. A lacks of indexes on heavily searched text fields further increases DB load.
- **Integration Health (Medium Risk)**: The codebase features plain-text credentials for external services (Grupo Óptico/SmartLab portal), fragile URL manipulation in internal services, and static hardcoded values in legal tax documents (billing address and activity start date). Integration with WhatsApp lacks route-level session validation.
- **Build & TypeScript Verification (Clean / Warning)**: The project currently passes type-checking (`tsc --noEmit`) with zero errors. The Next.js production build (`npm run build`) compiles successfully, but triggers multiple React Hook dependency warnings and Next.js image optimization recommendations.

---

## 2. Issue Classification by Severity

---

### Critical Issues

#### 1. Privilege Escalation & Account Takeover via User Endpoints
* **Target Files**:
  * `/Users/ishtarpissano/proyectos/atelier/src/app/api/users/route.ts` (GET, POST)
  * `/Users/ishtarpissano/proyectos/atelier/src/app/api/users/[id]/route.ts` (PATCH, DELETE)
* **Description**: These API endpoints read from and write directly to the user database without validating the caller's role (checking `x-user-role` headers). Any authenticated user, regardless of authorization level, can modify, delete, or create user credentials and administrative roles.
* **Direct Code Observation**:
  ```typescript
  // src/app/api/users/route.ts
  export async function POST(request: Request) {
      try {
          const { name, email, password, role } = await request.json();
          ...
          const user = await prisma.user.create({
              data: {
                  name,
                  email,
                  password: hashedPassword,
                  role: role || 'STAFF',
              },
  ```

#### 2. Public Information Disclosure of Pending Checkout Sessions (PII Leak)
* **Target Files**:
  * `/Users/ishtarpissano/proyectos/atelier/src/app/api/checkout/session/route.ts` (GET, PUT)
  * `/Users/ishtarpissano/proyectos/atelier/src/middleware.ts` (line 39)
* **Description**: The Next.js routing middleware explicitly bypasses token/session checks for all routes matching `/api/checkout/`. Because the checkout session endpoint itself has no internal key or token validation, anyone can query the `GET` endpoint and retrieve a full JSON list of pending sessions containing sensitive client information (emails, names, phone numbers, and shopping carts).
* **Direct Code Observation**:
  ```typescript
  // src/middleware.ts
  if (isApiRoute && !isAuthRoute && ... && !pathname.startsWith('/api/checkout/')) {
      // requires token validation
  }

  // src/app/api/checkout/session/route.ts
  export async function GET(req: Request) {
    try {
      const sessions = await prisma.checkoutSession.findMany({
        where: { status: 'PENDING' },
        orderBy: { updatedAt: 'desc' }
      });
      return NextResponse.json(sessions);
  ```

#### 3. Client-Side Payment Price Tampering
* **Target File**: `/Users/ishtarpissano/proyectos/atelier/src/app/api/checkout/payway/route.ts` (POST)
* **Description**: The endpoint takes the checkout transaction amount directly from the request body without cross-referencing product databases. An attacker can modify the `total` payload client-side to execute payments for arbitrary underpaid totals.
* **Direct Code Observation**:
  ```typescript
  const body = await req.json();
  const { customer, items, total } = body;
  ...
  const order = await prisma.order.create({
    data: {
      ...
      total: customer.paymentMethod === 'TRANSFER' ? total * 0.85 : total,
  ...
  const paywayRequest = {
    ...
    amount: total,
  ```

#### 4. Unauthenticated Socket.io Server Leaking Chat Messages
* **Target File**: `/Users/ishtarpissano/proyectos/atelier/wa-service/index.js` (lines 44-48, 993-1001)
* **Description**: The WebSocket server (`socket.io`) is initialized without authorization handshakes, cookies, or token check middlewares. Incoming WhatsApp chat details, contact names, phone numbers, and message bodies are broadcasted to all connected socket clients indiscriminately.
* **Direct Code Observation**:
  ```javascript
  // wa-service/index.js (connection)
  io.on('connection', (socket) => {
      console.log('🔌 Nuevo cliente WebSocket conectado:', socket.id);
      const status = getStatus();
      socket.emit('bot_status', { ...status, connected: status.isReady, phone: status.connectedPhone, qr: status.qrCode, agentEnabled, prompt: agentPrompt });
  });

  // wa-service/index.js (broadcast)
  if (global.io) {
      global.io.emit('new_message_received', {
          chatId: chat.id,
          name: profileName || chat.profileName || 'Cliente',
          phone: realPhone || chat.realPhone || waId.split('@')[0],
          content: messageType === 'TEXT' ? body : `[Mensaje ${messageType}]`,
          botEnabled: chat.botEnabled
      });
  }
  ```

#### 5. Prisma Client Connection Leaks & Redundancies
* **Target Files**:
  * `/Users/ishtarpissano/proyectos/atelier/src/lib/audit.ts` (line 3)
  * `/Users/ishtarpissano/proyectos/atelier/src/lib/backup.ts` (line 9)
  * Multiple API routes under `src/app/api/admin/fix-phones/route.ts`, `src/app/api/auth/login/route.ts`, etc.
* **Description**: Rather than importing the global database client singleton from `src/lib/db.ts`, multiple service scripts and endpoints instantiate a `new PrismaClient()` locally. In serverless and high-concurrency settings, this initiates redundant connection pools and leads to database connection exhaustion.
* **Direct Code Observation**:
  ```typescript
  import { PrismaClient } from '@prisma/client';
  const prisma = new PrismaClient();
  ```

#### 6. Unpaginated & Heavy Database Queries (findMany) with Serverless Timeout Risks
* **Target Files**:
  * `/Users/ishtarpissano/proyectos/atelier/src/app/api/dashboard/route.ts` (lines 90-94, 120-138, 469)
  * `/Users/ishtarpissano/proyectos/atelier/src/app/api/orders/route.ts` (lines 389-398)
* **Description**: Dashboard and orders endpoints query massive datasets (historical orders and clients with full nested tables) to aggregate totals, calculate balances, or filter rows in-memory. Under standard production growth, this pattern degrades response times, leading to 504 Gateway Timeouts on serverless functions.
* **Direct Code Observation**:
  * Line 90: Fetches all-time order sales without date filters to compute stats for the last 6 months.
  * Line 120: Fetches all-time client lists along with full orders and payments to calculate `globalPendingBalance` in-memory.
  * Line 469: Invokes `ContactService.getOrdersWithBalance()`, which pulls all clients with sales, order items, products, and payments on every dashboard load.

#### 7. Broken Access Control in WhatsApp Send Endpoint
* **Target File**: `/Users/ishtarpissano/proyectos/atelier/src/app/api/whatsapp/send/route.ts` (lines 5-34)
* **Description**: This endpoint contains no authentication checks, allowing external users to issue HTTP POST requests directly. The server automatically forwards these requests to the internal `wa-service` using the server-injected `WA_API_KEY` credential, granting public clients unlimited outbound message transmission.
* **Direct Code Observation**:
  ```typescript
  export async function POST(request: Request) {
      try {
          const body = await request.json();
          // Lack of session verification / role validation before proxying
          const res = await fetchWa('/api/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
          });
  ```

#### 8. Hardcoded SmartLab Credentials in Codebase
* **Target Files**:
  * `/Users/ishtarpissano/proyectos/atelier/src/services/smartlab.service.ts` (lines 54-56)
  * `/Users/ishtarpissano/proyectos/atelier/src/app/api/smartlab-submit/route.ts` (lines 61-63)
* **Description**: Playwright automation browser parameters for login into Grupo Óptico's portal are hardcoded inside service scripts as plain-text literals rather than mapped from environment variables.
* **Direct Code Observation**:
  ```typescript
  // src/services/smartlab.service.ts
  await inputs[0].fill('pisano.ishtar@gmail.com');
  await page.waitForTimeout(1500);
  await inputs[1].fill('atelier');
  ```

---

### Warning Issues

#### 1. Missing Authorization/Role Checks in Admin Endpoints
* **Target Files**:
  * `/Users/ishtarpissano/proyectos/atelier/src/app/api/admin/alert/route.ts`
  * `/Users/ishtarpissano/proyectos/atelier/src/app/api/admin/fix-names/route.ts`
  * `/Users/ishtarpissano/proyectos/atelier/src/app/api/admin/web-products/route.ts`
* **Description**: These administrative routes check for cookie sessions, but fail to check if the session's role header `x-user-role` is `'ADMIN'`. Consequently, any staff/restricted user can trigger these administrative data adjustments.

#### 2. Broken Bot Integration in Complaints Endpoint (Middleware Blocks Bot)
* **Target Files**:
  * `/Users/ishtarpissano/proyectos/atelier/src/app/api/complaints/route.ts`
  * `/Users/ishtarpissano/proyectos/atelier/src/middleware.ts`
* **Description**: Although `/api/complaints` implements manual validation of `x-api-key` headers matching `BOT_API_KEY`, the routing middleware does not exempt `/api/complaints` from cookie checks. The middleware blocks external bot requests and returns `401 Unauthorized` before hitting the handler.

#### 3. Hardcoded Development Authentication Bypass
* **Target File**: `/Users/ishtarpissano/proyectos/atelier/src/app/api/auth/login/route.ts` (line 30)
* **Description**: Line 30 contains a development condition bypass permitting administrative access with the password `'local-admin-ishtar'`.
* **Direct Code Observation**:
  ```typescript
  const isBypass = process.env.NODE_ENV === 'development' && password === 'local-admin-ishtar';
  ```

#### 4. Public/Private Logic Conflict in Products PATCH Route
* **Target File**: `/Users/ishtarpissano/proyectos/atelier/src/app/api/products/[id]/route.ts` (line 59)
* **Description**: The route contains comments suggesting it is a public endpoint for frame sizes. However, Next.js routing middleware enforces cookie validation on this route, making it inaccessible to the public. If it was intended to be private, it lacks role-based controls.

#### 5. Database Migrations Conflict (Blocked Local Migration Deployments)
* **Target Files**:
  * `/Users/ishtarpissano/proyectos/atelier/prisma/migrations/20260612190000_add_smartlab_fields/migration.sql`
  * `/Users/ishtarpissano/proyectos/atelier/prisma/migrations/20260612202040_add_smartlab_fields/migration.sql`
* **Description**: There are two duplicate migration scripts in the Git history attempting to create identical columns (`smartLabSector`, `smartLabProgress`, `smartLabLastSync`, etc.) on the `Order` table. Local databases already contain these columns but lack matching entries in the local `_prisma_migrations` log table, causing local status checks and automated migrations to fail.

#### 6. Hardcoded Address and Activity Start Date in Invoice PDFs
* **Target File**: `/Users/ishtarpissano/proyectos/atelier/src/services/billing.service.ts` (lines 388, 390)
* **Description**: The issuer address and activity start date are statically declared as `'Jose Luis de Tejeda 4380'` and `'01/01/2020'` on invoice layouts, overriding the configured `accountConfig` attributes for other billing profiles (e.g. `ISH`).
* **Direct Code Observation**:
  ```typescript
  issuer_address: 'Jose Luis de Tejeda 4380',
  issuer_iva_condition: 'Monotributista',
  issuer_activity_start_date: '01/01/2020',
  ```

#### 7. Fragile URL Manipulation of `CRM_API_URL`
* **Target Files**:
  * `/Users/ishtarpissano/proyectos/atelier/wa-service/index.js` (lines 163-166, 955-958)
  * `/Users/ishtarpissano/proyectos/atelier/wa-service/services/sync.service.js` (lines 55-58)
  * `/Users/ishtarpissano/proyectos/atelier/wa-service/routes/api.js` (lines 243-248)
* **Description**: The WhatsApp service manipulates file upload endpoints assuming `CRM_API_URL` is configured and terminates in `/api/bot`. If `CRM_API_URL` is left undefined or deviates from this structure, it triggers TypeError runtime failures.

#### 8. SmartLab Order Synchronization Regex Limit
* **Target File**: `/Users/ishtarpissano/proyectos/atelier/src/services/smartlab.service.ts` (line 123)
* **Description**: The regular expression extracting numbers requires 6 or more digits. SmartLab order IDs below 6 digits (e.g., `SML-1234`) fail matching and will be skipped by the synchronizer.
* **Direct Code Observation**:
  ```typescript
  const nums = order.labOrderNumber!.match(/\d{6,}/g) || [];
  ```

#### 9. Missing Database Indexes
* **Target File**: `/Users/ishtarpissano/proyectos/atelier/prisma/schema.prisma`
* **Description**: Text columns frequently queried with SQL `contains` (`LIKE '%value%'`) (e.g., `Product.name`, `Product.brand`, `Product.model`, `Client.name`, `Client.phone`) do not have database index declarations (`@@index`), causing sequential scans on search.

#### 10. TypeScript Strictness & Type Bypasses (Use of `as any`)
* **Target Files**:
  * `/Users/ishtarpissano/proyectos/atelier/src/app/admin/facturacion/page.tsx`
  * `/Users/ishtarpissano/proyectos/atelier/src/app/admin/pedidos/page.tsx`
  * `/Users/ishtarpissano/proyectos/atelier/src/app/admin/ventas/page.tsx`
  * `/Users/ishtarpissano/proyectos/atelier/src/app/admin/inventario/page.tsx`
* **Description**: Type safety compile checks are suppressed using `as any` type assertions on domain properties that actually exist in the DB schema, making frontend components vulnerable to undetected schema refactoring runtime crashes.

---

### Informational Issues

#### 1. Payway Public Configuration Disclosure
* **Target File**: `/Users/ishtarpissano/proyectos/atelier/src/app/api/checkout/config/route.ts`
* **Description**: Exposes `PAYWAY_PUBLIC_KEY` and `PAYWAY_ENVIRONMENT` without authentication. Public key exposure is intended for frontend integration, so this is normal.

#### 2. Typo in Diagnostic AFIP Certificate PEM Pattern
* **Target File**: `/Users/ishtarpissano/proyectos/atelier/src/app/api/diag/afip/route.ts` (line 37)
* **Description**: Searches for `----BEGIN CERTIFICATE----` (4 hyphens) instead of standard PEM format `-----BEGIN CERTIFICATE-----` (5 hyphens). Although it works as a partial string match, it is fragile.
* **Direct Code Observation**:
  ```typescript
  if (cert.includes('----BEGIN CERTIFICATE----'))
  ```

#### 3. Hardcoded Alert Recipients
* **Target Files**:
  * `/Users/ishtarpissano/proyectos/atelier/wa-service/tools.js` (lines 721, 732)
  * `/Users/ishtarpissano/proyectos/atelier/src/app/api/cron/smartlab-sync/route.ts` (lines 40, 51)
* **Description**: Alert emails (`pisano.ishtar@gmail.com`) and phone coordinates (`5493541215971@c.us`, `3541215971@c.us`) are hardcoded for operational monitoring.

#### 4. Package Dependency Inefficiencies (Bloat)
* **Target File**: `/Users/ishtarpissano/proyectos/atelier/package.json`
* **Description**: Manifest declares duplicate or heavy dependencies (e.g. `express`, `cors`, `qrcode-terminal`, `better-sqlite3`, `xlsx`) in the Next.js manifest root that are only required within the isolated `wa-service` node directory or are completely unused.

#### 5. Scratch Files & Legacy Scripts Clutter
* **Target Locations**: Root directory, `scripts/` directory, and `prisma/scripts/`
* **Description**: Over 40 scratch/temporary files (like `check_db*.ts`, `test-*.js`, `debug-reports.js`, `import-legacy.py`) are tracked in the Git repository, polluting code search and indexing queries.

---

## 3. Build & Type Verification Logs

Below are the verbatim check outputs generated during Milestone 4 build checks.

### A. TypeScript Compile Check (`npx tsc --noEmit`)

- **Command**: `npx tsc --noEmit`
- **Result**: **PASS** (Zero compilation errors/warnings)
- **Verbatim Output**:
```
(No stdout or stderr output produced)
```

---

### B. Application Build Check (`npm run build`)

- **Command**: `npm run build`
- **Result**: **PASS** (Application built successfully with minor warnings)
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
