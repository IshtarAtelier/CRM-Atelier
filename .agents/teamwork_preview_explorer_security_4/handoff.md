# Handoff Report: Security & Authentication Audit (M1)

## 1. Observation
The following observations were made via static analysis:
- **Observation A**: In `src/middleware.ts:39`, the exclusion condition is defined as:
  ```typescript
  if (isApiRoute && !isAuthRoute && !pathname.startsWith('/api/cron/') && !pathname.startsWith('/api/bot/') && !pathname.startsWith('/api/whatsapp/') && !pathname.startsWith('/api/upload') && !pathname.startsWith('/api/store/') && !pathname.startsWith('/api/web/') && !pathname.startsWith('/api/checkout/') && !pathname.startsWith('/api/storage/view'))
  ```
  This excludes all requests to `/api/whatsapp/*` from session authentication. The individual files in `src/app/api/whatsapp/*` (e.g. `chats/route.ts`, `send/route.ts`, `agent/route.ts`) do not check for session headers or roles locally.
- **Observation B**: In `wa-service/index.js` (lines 1219-1229), the Express api auth middleware is implemented as:
  ```javascript
  const WA_API_KEY = process.env.WA_API_KEY;
  if (!WA_API_KEY) {
      console.warn('⚠️ WARNING: WA_API_KEY not set. API endpoints are UNPROTECTED.');
  }
  function apiAuth(req, res, next) {
      if (!WA_API_KEY) return next(); // Sin key configurada, permitir (modo legacy)
      const key = req.headers['x-api-key'];
      if (key !== WA_API_KEY) {
          return res.status(401).json({ error: 'Unauthorized: Invalid API key' });
      }
      next();
  }
  ```
  Neither the root `.env` nor `wa-service/.env` contain a `WA_API_KEY` declaration.
- **Observation C**: In `src/app/api/users/route.ts` and `src/app/api/users/[id]/route.ts`, there are no role verification headers (`x-user-role`) parsed or validated, only standard database CRUD queries.
- **Observation D**: In `src/app/api/auth/login/route.ts` (lines 30-31), the password verification bypass is coded as:
  ```typescript
  const isBypass = process.env.NODE_ENV === 'development' && password === 'local-admin-ishtar';
  const isPasswordValid = isBypass ? true : await bcrypt.compare(password, user.password);
  ```
- **Observation E**: In `src/app/api/cron/smartlab-sync/route.ts` (line 14), the bypass check allows `secret === 'atelier-smartlab-2026'`:
  ```typescript
  if (secret !== env.CRON_SECRET && secret !== 'atelier-smartlab-2026')
  ```
- **Observation F**: In `src/env.ts` (lines 80-92), Zod parsing failures fallback to:
  ```typescript
  env = {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    WA_SERVER_URL: process.env.WA_SERVER_URL || 'http://127.0.0.1:3100',
  } as any;
  ```
- **Observation G**: Both `.env` and `wa-service/.env` contain sensitive plain-text values, including production database strings (`PROD_DATABASE_URL`), PayWay API keys (`PAYWAY_PRIVATE_KEY`), Google API credentials, and Meta Conversions Access tokens (`META_ACCESS_TOKEN`).

---

## 2. Logic Chain
- **Step 1**: From **Observation A**, because `/api/whatsapp/` paths are excluded from middleware checking, and the individual files under `src/app/api/whatsapp/` do not perform authentication checks internally, we can conclude that these endpoints are completely public. Any user can call `/api/whatsapp/send` to send messages or `/api/whatsapp/chats` to view chats.
- **Step 2**: From **Observation B**, since `WA_API_KEY` is not defined in any `.env` file, the fallback `if (!WA_API_KEY) return next();` triggers, making all `wa-service` endpoints completely unprotected on the exposed port (3100).
- **Step 3**: From **Observation C**, because the user management endpoints lack code checks for `x-user-role`, any user authenticated via the Next.js middleware (even with `STAFF` role) can call them and manipulate administrative accounts.
- **Step 4**: From **Observation D**, when the system is run in development mode (`NODE_ENV === 'development'`), any user password matches if it is `'local-admin-ishtar'`, bypassing the standard password verification.
- **Step 5**: From **Observation E**, even if `CRON_SECRET` is defined securely, the hardcoded `'atelier-smartlab-2026'` allows unauthorized triggers of the sync cron job.
- **Step 6**: From **Observation F**, if any environment variable check fails, all variables (except `NEXT_PUBLIC_SITE_URL` and `WA_SERVER_URL`) are omitted, leading to security-sensitive values evaluating to `undefined` and potentially bypassing checks that compare with `undefined`.
- **Step 7**: From **Observation G**, production secrets are stored in cleartext locally, posing a risk of leakage.

---

## 3. Caveats
- The codebase was analyzed strictly via static code audit. Penetration testing, active scanning, or payload execution were not conducted.
- It is assumed that the port where `wa-service` runs (default `3100`) might be protected by network firewalls in a cloud/production environment, but the lack of key configurations is still a major vulnerability if exposed.

---

## 4. Conclusion
The codebase has multiple critical security vulnerabilities.
1. **Public WhatsApp routes**: The Next.js API route middleware has an exclusion rule that leaves the entire `/api/whatsapp/*` tree unprotected, allowing anyone to send messages and read chat histories.
2. **Unauthenticated wa-service**: The microservice operates with no authentication check since `WA_API_KEY` is not configured in `.env`.
3. **Privilege escalation**: Low-privilege users can access administrative endpoints like user management (`/api/users/*`) and database repair scripts because these routes lack role verification.
4. **Bypass logic and hardcoded tokens**: Dev backdoor password (`local-admin-ishtar`), hardcoded cron bypass (`atelier-smartlab-2026`), and soft Zod error catching degrade the application's security stance.

---

## 5. Verification Method
- **Verify SEC-01 (WhatsApp Public Endpoints)**:
  Perform a curl call to `http://localhost:3000/api/whatsapp/chats` without any cookies or headers. It should return a list of chats instead of `401 Unauthorized` or `403 Forbidden`.
- **Verify SEC-02 (Unauthenticated wa-service)**:
  Perform a GET request to `http://localhost:3100/api/status` without any `x-api-key` header. It should return status JSON instead of `401 Unauthorized`.
- **Verify SEC-03 (Missing Role Check)**:
  Inspect `src/app/api/users/route.ts` and verify there are no calls to headers list role checks. Log in as a `STAFF` user and verify you can fetch `/api/users`.
