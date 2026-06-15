# Handoff Report: Integration Health Check (Milestone 3)

## 1. Observation

During our static code analysis and database schema inspection, we observed the following issues across integration points:

### A. Database Migrations Conflict
* **File/Location**: `prisma/migrations/` and database `_prisma_migrations` table.
* **Findings**:
  * There are two duplicate migration folders in the repository:
    * `20260612190000_add_smartlab_fields/migration.sql`
    * `20260612202040_add_smartlab_fields/migration.sql`
  * Both migrations try to add the same columns to the `Order` table: `smartLabSector`, `smartLabProgress`, `smartLabLastSync`, `smartLabDetails`, `smartLabDays`.
  * The **local database** (`DATABASE_URL`) already has these columns added to the `"Order"` table (observed via `scratch/check_columns.js` script run), but they are **not** present in the local `_prisma_migrations` history table.
  * In the **production database** (`PROD_DATABASE_URL`), the migrations are already recorded as applied (observed via `scratch/check_migrations_history.js` script run).
  * Consequently, running `npx prisma migrate status` locally complains that these migrations are pending. If local deployment or migration script (`npx prisma migrate deploy` / `npm run db:deploy`) is run locally, it will crash at the second migration because the columns exist and the second migration script does not use `IF NOT EXISTS` guards.

### B. Broken Access Control in WhatsApp Send Endpoint
* **File/Location**: `src/app/api/whatsapp/send/route.ts` (lines 5-34).
* **Code snippet**:
  ```typescript
  export async function POST(request: Request) {
      try {
          const body = await request.json();
          // ...
          const res = await fetchWa('/api/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
          });
          // ...
  ```
* **Findings**: There is **no authentication or authorization check** (e.g., verifying user session or role). Unauthenticated external clients can POST to `/api/whatsapp/send`, and Next.js will automatically proxy the request to the internal `wa-service` using the server's `WA_API_KEY` (injected inside `fetchWa`).

### C. Hardcoded SmartLab Credentials in Codebase
* **File/Location**: 
  * `src/services/smartlab.service.ts` (lines 54-56):
    ```typescript
    await inputs[0].fill('pisano.ishtar@gmail.com');
    await page.waitForTimeout(1500);
    await inputs[1].fill('atelier');
    ```
  * `src/app/api/smartlab-submit/route.ts` (lines 61-63):
    ```typescript
    await inputs[0].fill('pisano.ishtar@gmail.com');
    await page.waitForTimeout(800);
    await inputs[1].fill('atelier');
    ```
* **Findings**: Credentials for Grupo Óptico's portal (`pisano.ishtar@gmail.com` / `atelier`) are hardcoded in plain text.

### D. Hardcoded Address and Activity Start Date in Invoice PDFs
* **File/Location**: `src/services/billing.service.ts` (lines 388, 390).
* **Code snippet**:
  ```typescript
  issuer_address: 'Jose Luis de Tejeda 4380',
  issuer_iva_condition: 'Monotributista',
  issuer_activity_start_date: '01/01/2020',
  ```
* **Findings**: The address is hardcoded as `'Jose Luis de Tejeda 4380'` and the activity start date is `'01/01/2020'` for all generated invoice PDFs. This will output incorrect tax document details when invoices are billed using the `ISH` account (its actual address is `'Santiago del Estero 66 Local 12, Córdoba'` and start date is `'01/01/2024'`).

### E. Typo in Diagnostic Certificate PEM Pattern
* **File/Location**: `src/app/api/diag/afip/route.ts` (line 37).
* **Code snippet**:
  ```typescript
  if (cert.includes('----BEGIN CERTIFICATE----'))
  ```
* **Findings**: It searches for `----BEGIN CERTIFICATE----` (4 hyphens) instead of standard PEM format `-----BEGIN CERTIFICATE-----` (5 hyphens). Although it works as a partial string match, it is fragile.

### F. Fragile URL Manipulation of `CRM_API_URL`
* **File/Location**:
  * `wa-service/index.js` (lines 163-166, 955-958)
  * `wa-service/services/sync.service.js` (lines 55-58)
  * `wa-service/routes/api.js` (lines 243-248)
* **Code snippet**:
  ```javascript
  let uploadUrl = process.env.CRM_API_URL;
  if (uploadUrl.endsWith('/api/bot')) uploadUrl = uploadUrl.replace('/api/bot', '/api/upload');
  ```
* **Findings**: Assumes `CRM_API_URL` is always defined and ends with `/api/bot`. If `CRM_API_URL` is undefined or does not match this structure, it throws a runtime TypeError or silent upload failures.

### G. Hardcoded Alert Recipients
* **File/Location**:
  * `wa-service/tools.js` (lines 721, 732)
  * `src/app/api/cron/smartlab-sync/route.ts` (lines 40, 51)
* **Findings**: The email `pisano.ishtar@gmail.com` and phone numbers `5493541215971@c.us` / `3541215971@c.us` are hardcoded in the codebase for error/invoice alerts.

### H. SmartLab Order Synchronization Regex Limit
* **File/Location**: `src/services/smartlab.service.ts` (line 123)
* **Code snippet**:
  ```typescript
  const nums = order.labOrderNumber!.match(/\d{6,}/g) || [];
  ```
* **Findings**: The regex requires 6 or more consecutive digits. If order IDs in `SML-[id]` are 4 or 5 digits long, the synchronization script will skip them entirely.

---

## 2. Logic Chain

1. **Migration Failure**: Because the local `_prisma_migrations` table lacks entries for the two smartlab migrations while local columns exist, any automated local deployment script (`npx prisma migrate deploy` or `npm run db:deploy`) will run the SQL scripts. Since the second script has no `IF NOT EXISTS` filters, it will attempt to add columns that exist and error out. Marking them as manually resolved (`npx prisma migrate resolve`) will circumvent the block.
2. **Access Control Bypass**: In `/api/whatsapp/send/route.ts`, the absence of any authentication checks (like cookies/JWT verification) means anyone can hit this endpoint. Because it automatically signs requests with the server's `WA_API_KEY`, it gives public clients full access to send outbound messages.
3. **Hardcoded Secrets Risk**: Hardcoding plain text passwords (e.g. `'atelier'`) and emails inside service classes (`smartlab.service.ts`, `smartlab-submit/route.ts`) exposes credentials in git repositories.
4. **Legal/Tax Discrepancies**: Hardcoding `issuer_address` and `issuer_activity_start_date` on PDF layouts overrides config settings (`accountConfig.address` and `accountConfig.activityStart`), leading to invalid PDFs printed under the `ISH` billing account.
5. **Sync Skips**: Orders submitted as e.g. `SML-1025` will have 4 digits. The regex `\d{6,}` will match nothing. Thus, those orders will not query the SmartLab dashboard and their sync progress remains stuck.

---

## 3. Caveats

* We analyzed the codebase statically; we did not run the browser headless engine against the live SmartLab service, so we could not verify if there are any current DOM selector failures on the live dashboard.
* No actual AFIP SOAP production endpoints were hit, only database structure and SDK initializer options were validated.

---

## 4. Conclusion

The integration endpoints are functionally implemented but contain **Critical security vulnerabilities** (broken access control on WhatsApp API proxying, hardcoded credentials) and **deployment/local run issues** (database migration desynchronization). Furthermore, tax PDF generation is prone to illegal address rendering for the `ISH` account, and order sync will fail for order IDs of less than 6 digits.

---

## 5. Verification Method

To verify these issues independently:
1. **Local Database Migration Failure**: Run `npx prisma migrate status` locally to see the pending status of the two smartlab migrations. Run `npx prisma migrate deploy` and observe it failing.
2. **Access Control**: Send a test POST request to `/api/whatsapp/send` using a tool like curl (without sending any session cookies) and check if the message is proxied to WhatsApp.
3. **Regex Check**: Test the regex `/\d{6,}/g` against an order number like `SML-1234` and see that it returns `null`.
