# Security & Authentication Audit Report (M1)

**Date**: 2026-06-15
**Auditor**: Security Audit Explorer
**Scope**: CRM & E-Commerce codebase (Next.js & wa-service)

---

## Executive Summary
A static security and authentication audit was performed on the CRM & E-Commerce codebase. The review focused on:
1. JWT token configuration and session validation.
2. Next.js API route middleware and endpoint authorization.
3. Environment variables, sensitive credentials, and backdoor patterns.

Several critical security issues were identified, most notably a **complete authentication bypass for the entire WhatsApp management API** (`/api/whatsapp/*`), an **unprotected Express API** in `wa-service` due to missing key configurations, and **missing role checks** in user management and administrative API routes.

---

## Summary of Findings

| ID | Finding Title | Severity | File Path & Line Numbers |
|---|---|---|---|
| **SEC-01** | Complete Authentication Bypass for WhatsApp API Routes | **Critical** | `src/middleware.ts:39` |
| **SEC-02** | Unprotected `wa-service` Endpoints due to Missing `WA_API_KEY` | **Critical** | `wa-service/index.js:1219-1229` |
| **SEC-03** | Missing Role Checks in User Management Endpoints | **Critical** | `src/app/api/users/route.ts`, `src/app/api/users/[id]/route.ts` |
| **SEC-04** | Intentional Password Bypass (Backdoor) in Development Mode | **Warning** | `src/app/api/auth/login/route.ts:30-31` |
| **SEC-05** | Hardcoded Cron Job Bypass Token | **Warning** | `src/app/api/cron/smartlab-sync/route.ts:14` |
| **SEC-06** | Degraded Security State on Zod Environment Validation Failure | **Warning** | `src/env.ts:80-92` |
| **SEC-07** | Plain-Text Exposure of Highly Sensitive Production Secrets | **Informational** | `.env`, `wa-service/.env` |
| **SEC-08** | Missing Role Verification on Administrative Endpoints | **Informational** | `/src/app/api/admin/alert/route.ts`, `fix-names/route.ts`, `fix-phones/route.ts` |
| **SEC-09** | Incomplete Audit Logging for Sensitive User Actions | **Informational** | `src/lib/audit.ts` |

---

## Detailed Findings

### SEC-01: Complete Authentication Bypass for WhatsApp API Routes
- **Severity**: **Critical**
- **File**: `src/middleware.ts` (Line 39)
- **Description**: The Next.js middleware is configured to protect all internal API routes under `/api/*` unless they match specific exclusions. The path `/api/whatsapp/` is included in the exclusions:
  ```typescript
  if (isApiRoute && !isAuthRoute && !pathname.startsWith('/api/cron/') && !pathname.startsWith('/api/bot/') && !pathname.startsWith('/api/whatsapp/') && ...)
  ```
  Because the individual route handlers under `/api/whatsapp/*` do not perform session token validation locally, all endpoints in this directory are completely public.
- **Impact**: An unauthenticated user on the public internet can:
  - List all active WhatsApp chats and metadata (`GET /api/whatsapp/chats`).
  - View full chat transcripts and message histories (`GET /api/whatsapp/chats/[id]/messages`).
  - Send arbitrary outbound SMS/WhatsApp messages using the boutique's phone number (`POST /api/whatsapp/send`).
  - Tweak, enable, disable, or redirect the WhatsApp AI bot prompt and parameters (`GET/POST /api/whatsapp/agent`).
  - Archive conversations and modify chat labels (`PATCH /api/whatsapp/chats/[id]`).
- **Remediation**: Remove `!pathname.startsWith('/api/whatsapp/')` from the middleware's exclusion list. If specific public webhooks or proxies are required, exclude only the explicit sub-path (e.g. `/api/whatsapp/webhook`) and protect the rest.

---

### SEC-02: Unprotected `wa-service` Endpoints due to Missing `WA_API_KEY`
- **Severity**: **Critical**
- **File**: `wa-service/index.js` (Lines 1219-1229)
- **Description**: The standalone WhatsApp integration microservice (`wa-service`) uses a custom API key authentication middleware (`apiAuth`). However, it contains a fallback check that completely disables authorization if the `WA_API_KEY` variable is not set in the environment:
  ```javascript
  const WA_API_KEY = process.env.WA_API_KEY;
  if (!WA_API_KEY) {
      console.warn('⚠️ WARNING: WA_API_KEY not set. API endpoints are UNPROTECTED.');
  }
  function apiAuth(req, res, next) {
      if (!WA_API_KEY) return next(); // Sin key configurada, permitir (modo legacy)
      ...
  }
  ```
  Currently, neither the main `.env` nor the microservice `wa-service/.env` has the `WA_API_KEY` variable set or declared.
- **Impact**: Any connection made to the Express service (running on port 3100) will bypass authentication checks entirely, exposing chat records, messaging capabilities, and server controls to anyone on the same network or host.
- **Remediation**: Require `WA_API_KEY` to be defined at startup. Fail fast and crash the application if it is missing or insecure, rather than failing open.

---

### SEC-03: Missing Role Checks in User Management Endpoints
- **Severity**: **Critical**
- **Files**:
  - `src/app/api/users/route.ts` (GET / POST)
  - `src/app/api/users/[id]/route.ts` (GET / PATCH / DELETE)
- **Description**: These endpoints manage the core system users and their database records. While they are protected by the Next.js middleware (which ensures a valid session token exists), neither the middleware nor the endpoints check if the user has an `ADMIN` role.
- **Impact**: Any authenticated user with a `STAFF` role can call these endpoints. A low-privilege staff user can retrieve the list of all system users, create new administrator accounts, change any user's password, or delete other users (including active administrators).
- **Remediation**: Verify the `x-user-role` header injected by the middleware and reject requests if the role is not `ADMIN`:
  ```typescript
  const headersList = await headers();
  const userRole = headersList.get('x-user-role');
  if (userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  ```

---

### SEC-04: Intentional Password Bypass (Backdoor) in Development Mode
- **Severity**: **Warning**
- **File**: `src/app/api/auth/login/route.ts` (Lines 30-31)
- **Description**: The session login route has a hardcoded condition that overrides password verification in development mode:
  ```typescript
  const isBypass = process.env.NODE_ENV === 'development' && password === 'local-admin-ishtar';
  const isPasswordValid = isBypass ? true : await bcrypt.compare(password, user.password);
  ```
- **Impact**: If the application's environment variable `NODE_ENV` is set to `'development'` (or is left undefined and defaults to development in certain staging or local network environments), any user record in the system can be logged into using the password `'local-admin-ishtar'` without verification.
- **Remediation**: Remove this bypass check entirely. Rely on mock database seeds to test login flows with known bcrypt hashes rather than inserting conditional code paths.

---

### SEC-05: Hardcoded Cron Job Bypass Token
- **Severity**: **Warning**
- **File**: `src/app/api/cron/smartlab-sync/route.ts` (Line 14)
- **Description**: The endpoint checks for authorization using the query string parameters. While it correctly checks against the environment variable `env.CRON_SECRET`, it also permits a hardcoded backup token:
  ```typescript
  if (secret !== env.CRON_SECRET && secret !== 'atelier-smartlab-2026') {
  ```
- **Impact**: If the `CRON_SECRET` environment variable is rotated or set to a secure string, the hardcoded `'atelier-smartlab-2026'` token remains valid indefinitely, allowing external actors to trigger the laboratory sync cron task.
- **Remediation**: Remove the hardcoded fallback token and validate ONLY against `env.CRON_SECRET`.

---

### SEC-06: Degraded Security State on Zod Environment Validation Failure
- **Severity**: **Warning**
- **File**: `src/env.ts` (Lines 80-92)
- **Description**: The Next.js server validates its environment variables using Zod. However, the catch block is designed to prevent a crash if any variables are missing:
  ```typescript
  } catch (error: any) {
    ...
    // No crashear la app para evitar 502 en Railway si falta alguna variable.
    // Solo inicializar un objeto vacío con fallbacks seguros.
    env = {
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
      WA_SERVER_URL: process.env.WA_SERVER_URL || 'http://127.0.0.1:3100',
    } as any;
  }
  ```
- **Impact**: If validation fails due to a malformed or missing key, the application starts with undefined environment settings for `JWT_SECRET`, `BOT_API_KEY`, `CRON_SECRET`, etc. This results in auth checks evaluating `undefined !== undefined` or fallback configurations failing open, creating silent security holes.
- **Remediation**: Environment validation should be strict. If critical secrets are missing or malformed, the application must crash on start (Fail Fast) so that operators can immediately identify and fix deployment configurations.

---

### SEC-07: Plain-Text Exposure of Highly Sensitive Production Secrets
- **Severity**: **Informational**
- **Files**: `.env` and `wa-service/.env`
- **Description**: Multiple production API keys, service accounts, and database credentials are stored in plain text inside local files:
  - `.env:6`: Entire Google Cloud Service Account Private Key.
  - `.env:7`: Google Gemini API Key (`GOOGLE_GENAI_API_KEY`).
  - `.env:8`: Google Places API Key.
  - `.env:11` / `.env:24`: Google App Password for email sending (`EMAIL_PASS`).
  - `.env:14-16`: PayWay production credentials (`PAYWAY_PRIVATE_KEY` / `PAYWAY_SITE_ID`).
  - `.env:35`: Meta Offline Conversions API permanent Access Token.
  - `.env:44`: Production PostgreSQL connection string and credentials (`PROD_DATABASE_URL`).
- **Impact**: Increases the risk of credentials leakage if the development machine is compromised or if these files are accidentally shared.
- **Remediation**: Use placeholders in the local `.env` and configure real production keys exclusively inside the hosting provider's dashboard (e.g., Railway Dashboard envs) or secret managers.

---

### SEC-08: Missing Role Verification on Administrative Endpoints
- **Severity**: **Informational**
- **Files**:
  - `src/app/api/admin/alert/route.ts`
  - `src/app/api/admin/fix-names/route.ts`
  - `src/app/api/admin/fix-phones/route.ts`
- **Description**: These administrative utility routes only verify user session validity (via the middleware) but do not check if the user is an `ADMIN`.
- **Impact**: Low-privilege `STAFF` users can trigger repair scripts or send system-wide notifications.
- **Remediation**: Restrict access to these endpoints to users with the `ADMIN` role.

---

### SEC-09: Incomplete Audit Logging for Sensitive User Actions
- **Severity**: **Informational**
- **Files**: `src/lib/audit.ts`
- **Description**: The database includes an `AuditLog` table and a `logAudit` helper. However, it is only called in a few places (deleting contacts, payments, and order state updates). Administrative operations like user creation, deletion, password updates, and database fixes are not audited.
- **Impact**: Reduces visibility and makes security forensic analysis difficult.
- **Remediation**: Integrate `logAudit` calls into user management and administration routes.
