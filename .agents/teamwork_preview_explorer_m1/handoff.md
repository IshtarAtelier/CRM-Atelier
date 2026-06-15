# Security Audit Handoff Report

## 1. Observation
A static security audit of the API endpoints, JWT token configurations, route middleware, and environment variables has identified multiple vulnerabilities.

Below are the exact file paths, line numbers, classifications, and code quotes.

### Finding 1: Privilege Escalation & Account Takeover via User Endpoints
* **Classification**: **Critical**
* **Target Files**:
  * `/Users/ishtarpissano/proyectos/atelier/src/app/api/users/route.ts` (GET, POST)
  * `/Users/ishtarpissano/proyectos/atelier/src/app/api/users/[id]/route.ts` (PATCH, DELETE)
* **Direct Observations**:
  * In `src/app/api/users/route.ts`, the endpoints read from/write to the user database without checking the user's role:
    ```typescript
    // POST /api/users — Create a new user
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
  * In `src/app/api/users/[id]/route.ts`, any authenticated user can modify any other user's password or role, or delete them:
    ```typescript
    export async function PATCH(
        request: Request,
        { params }: { params: Promise<{ id: string }> }
    ) {
        try {
            const { id } = await params;
            const body = await request.json();
            const { name, role, password } = body;
            ...
            const user = await prisma.user.update({
                where: { id },
                data,
    ```

---

### Finding 2: Public Information Disclosure of Pending Checkout Sessions (PII Leak)
* **Classification**: **Critical**
* **Target File**: `/Users/ishtarpissano/proyectos/atelier/src/app/api/checkout/session/route.ts` (GET, PUT)
* **Direct Observations**:
  * `src/middleware.ts` explicitly bypasses all authentication for paths starting with `/api/checkout/`:
    ```typescript
    if (isApiRoute && !isAuthRoute && ... && !pathname.startsWith('/api/checkout/')) {
        // requires token validation
    }
    ```
  * `src/app/api/checkout/session/route.ts` lacks internal token/API key validation:
    ```typescript
    export async function GET(req: Request) {
      try {
        // Only return PENDING sessions
        const sessions = await prisma.checkoutSession.findMany({
          where: { status: 'PENDING' },
          orderBy: { updatedAt: 'desc' }
        });
        return NextResponse.json(sessions);
    ```

---

### Finding 3: Client-Side Payment Price Tampering
* **Classification**: **Critical**
* **Target File**: `/Users/ishtarpissano/proyectos/atelier/src/app/api/checkout/payway/route.ts` (POST)
* **Direct Observations**:
  * The total amount is fetched directly from the request body without validation against the database:
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

---

### Finding 4: Unauthenticated Socket.io Server Leaking Chat Messages
* **Classification**: **Critical**
* **Target File**: `/Users/ishtarpissano/proyectos/atelier/wa-service/index.js` (lines 44-48, 993-1001)
* **Direct Observations**:
  * The WebSocket server (`socket.io`) is initialized without authorization middlewares:
    ```javascript
    io.on('connection', (socket) => {
        console.log('🔌 Nuevo cliente WebSocket conectado:', socket.id);
        const status = getStatus();
        socket.emit('bot_status', { ...status, connected: status.isReady, phone: status.connectedPhone, qr: status.qrCode, agentEnabled, prompt: agentPrompt });
    });
    ```
  * Incoming chat details and message contents are broadcasted to all connected sockets:
    ```javascript
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

---

### Finding 5: Missing Authorization/Role Checks in Admin Endpoints
* **Classification**: **Warning**
* **Target Files**:
  * `/Users/ishtarpissano/proyectos/atelier/src/app/api/admin/alert/route.ts`
  * `/Users/ishtarpissano/proyectos/atelier/src/app/api/admin/fix-names/route.ts`
  * `/Users/ishtarpissano/proyectos/atelier/src/app/api/admin/web-products/route.ts`
* **Direct Observations**:
  * These routes check that a session cookie is present (via Next.js middleware), but do not check if `x-user-role` is `'ADMIN'`.
  * For example, in `/api/admin/fix-names/route.ts`:
    ```typescript
    export async function GET() {
      try {
        let updatedProducts = 0;
        ...
    ```
    There is no role verification at all. Any staff user can invoke the batch update.

---

### Finding 6: Broken Bot Integration in Complaints Endpoint
* **Classification**: **Warning / Integration Bug**
* **Target Files**:
  * `/Users/ishtarpissano/proyectos/atelier/src/app/api/complaints/route.ts`
  * `/Users/ishtarpissano/proyectos/atelier/src/middleware.ts`
* **Direct Observations**:
  * `src/app/api/complaints/route.ts` restricts calls to `BOT_API_KEY`:
    ```typescript
    const apiKey = req.headers.get('x-api-key');
    if (apiKey !== BOT_API_KEY) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    ```
  * But `src/middleware.ts` does not list `/api/complaints` in its exceptions, so it will block any non-cookie requests before they hit the endpoint handler.

---

### Finding 7: Hardcoded Development Authentication Bypass
* **Classification**: **Warning**
* **Target File**: `/Users/ishtarpissano/proyectos/atelier/src/app/api/auth/login/route.ts` (line 30)
* **Direct Observations**:
  * Line 30: `const isBypass = process.env.NODE_ENV === 'development' && password === 'local-admin-ishtar';`

---

### Finding 8: Public/Private Logic Conflict in Products PATCH Route
* **Classification**: **Informational/Warning**
* **Target File**: `/Users/ishtarpissano/proyectos/atelier/src/app/api/products/[id]/route.ts` (PATCH method)
* **Direct Observations**:
  * Line 59 has a comment: `// PATCH público — solo para actualizar medidas del armazón desde la web`.
  * However, `/api/products/[id]` is not bypassed by `middleware.ts`, meaning this route is not public (requires a session cookie). If it were meant to be private, it is missing role checks.

---

### Finding 9: Payway Public Configuration Disclosure
* **Classification**: **Informational**
* **Target File**: `/Users/ishtarpissano/proyectos/atelier/src/app/api/checkout/config/route.ts`
* **Direct Observations**:
  * Exposes `PAYWAY_PUBLIC_KEY` and `PAYWAY_ENVIRONMENT` without authentication. Public key exposure is intended for frontend integration, so this is normal.

---

## 2. Logic Chain
1. **User privilege escalation**: Because Next.js middleware in `src/middleware.ts` only sets role headers (`x-user-role`) but does not block requests, individual API endpoints are responsible for checking these headers. Since `/api/users` and `/api/users/[id]` do not check the `x-user-role` header, any logged-in user can modify, delete, or create user credentials and roles.
2. **Checkout session leak**: Because `/api/checkout/` is bypassed by the middleware cookie check, and `/api/checkout/session` does not implement any manual authorization check, all pending session items (which contain names, emails, phones, and shopping carts) are publicly retrievable by anyone sending a `GET` request.
3. **Price tampering**: The `/api/checkout/payway` endpoint takes `total` from the client request body. Since the server does not recalculate this total using database-held product prices, an attacker can modify the total in the request body to execute arbitrary underpayments.
4. **Unauthenticated WebSocket leak**: In `wa-service`, the WebSocket listener is bound to the root namespace without an authorization handshake. When messages are received via WhatsApp, the server broadcasts them to all connected socket clients. Thus, anyone connecting to the WebSocket port receives all chat streams.
5. **Complaints integration failure**: The Next.js middleware intercepts all API calls not in its bypass list. Since `/api/complaints` requires `x-api-key` and is not bypassed, the middleware automatically returns `401 Unauthorized` due to the lack of a session cookie, preventing the external bot service from executing complaints reports.

---

## 3. Caveats
* **No Dynamic Auditing/Testing**: Since this is a read-only static security audit, no active pen-testing was performed to verify if endpoints behave differently under specific runtimes. All findings are derived directly from static code patterns.
* **Network isolation**: If the `wa-service` WebSocket is not exposed to the public internet (i.e. blocked by a firewall or Railway internal private network), the WebSocket leak is mitigated to internal actors. However, it still poses a significant lateral movement risk.

---

## 4. Conclusion
The application contains several critical authorization issues. Left unaddressed, these issues permit complete database compromise (via staff-to-admin privilege escalation), massive customer PII disclosure, price fraud in checkout payment processing, and eavesdropping on chat communications.

---

## 5. Verification Method
To verify these issues, check the following endpoints and files:
1. **User Endpoint Role Missing**: Inspect `/Users/ishtarpissano/proyectos/atelier/src/app/api/users/route.ts` and `/Users/ishtarpissano/proyectos/atelier/src/app/api/users/[id]/route.ts`. Note the absence of any checks on headers like `x-user-role`.
2. **PII Checkout Leak**: Run a curl request against GET `/api/checkout/session` (without cookies). Confirm it returns a JSON array of pending sessions containing email and name fields.
3. **Payway Price Tampering**: Inspect `/Users/ishtarpissano/proyectos/atelier/src/app/api/checkout/payway/route.ts`. Verify that `total` is extracted directly from the body and passed to both the database record creation and the Decidir/Payway client payload.
4. **Unauthenticated Socket.io**: Inspect `/Users/ishtarpissano/proyectos/atelier/wa-service/index.js` at line 44. Observe that no socket middleware (`io.use(...)`) is present to validate incoming connections or headers.
5. **Lint/Build Tests**: Run the following validation commands to ensure the build pipeline remains clean:
   ```bash
   npm run lint
   npm run build
   ```
