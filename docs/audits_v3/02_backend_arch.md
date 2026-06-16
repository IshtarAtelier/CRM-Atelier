# Auditoría de Arquitectura Backend y Seguridad (v3)

**Fecha:** 16 de Junio, 2026
**Analista:** Agente IA Asistente
**Alcance:** Rutas API de Next.js, `middleware.ts`, Seguridad de Endpoints y Manejo de Datos.

---

## 1. Resumen de la Arquitectura
El backend del sistema CRM está constituido por un entorno integrado en Next.js (App Router), utilizando Prisma ORM para la capa de acceso a datos. La estrategia principal de autenticación se basa en JWT resuelto a nivel de middleware (`src/middleware.ts`), inyectando roles e identidades a través de los *headers* de la petición (`x-user-role`, `x-user-id`, `x-user-name`). Las automatizaciones (Cron) y los webhooks externos (Bot de WhatsApp) utilizan autenticación estática por *Secrets* y *API Keys*.

---

## 2. Puntos Fuertes Detectados (Fortalezas)

1. **Estrategia Global de Middleware (Default-Deny):**
   El archivo `src/middleware.ts` implementa una validación restrictiva por defecto para todas las rutas `/api/*` y `/admin`. Solo exime a rutas explícitamente públicas (como web, store o cron). Esto evita la exposición accidental de nuevos endpoints creados a futuro.

2. **Inyección de Identidad (Zero Trust Patterns):**
   Validar y decodificar el token a nivel de Edge Middleware y reenviarlo como cabecera (e.g., `requestHeaders.set('x-user-role', payload.role)`) es una excelente práctica. Evita que la lógica de cada endpoint tenga que lidiar repetitivamente con la criptografía de la sesión.

3. **Prevención de Inyección SQL:**
   Todo el sistema emplea Prisma ORM. Donde se hace necesario el uso de consultas SQL crudas (`$queryRaw` en reportes de ventas o búsquedas avanzadas), se usan literales de plantilla etiquetados (Tagged Template Literals), lo que parametriza de forma segura las variables, evitando SQL Injections de primer y segundo orden.

4. **Prevención de Path Traversal:**
   El endpoint público de visualización de almacenamiento (`/api/storage/view/route.ts`) cuenta con validaciones estrictas (`resolvedPath.startsWith(storageDir)` y sanitización estricta de variables) eliminando la posibilidad de descargar archivos del sistema operativo a través del uso de secuencias como `../`.

5. **Cabeceras de Seguridad Perimetral:**
   Se encuentran debidamente aplicadas cabeceras como `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` y configuraciones estrictas en `next.config.ts`.

---

## 3. Vulnerabilidades y Problemas Arquitectónicos Críticos

### A. Endpoint Público Web Checkout sin Validación de Precios (CWE-602)
**Ruta:** `POST /api/web/checkout/route.ts`
* **Descripción:** Este endpoint permite la creación automatizada de pedidos desde la web. Actualmente bypassa el `middleware.ts` de forma pública. Sin embargo, no verifica los cálculos de la transacción. El campo `totalPrice` es aceptado y guardado de manera literal como `price` y `total` del cliente en la base de datos sin comparar con el precio oficial de `prisma.product`.
* **Riesgo (Alto):** Un atacante podría interceptar la petición y enviar `totalPrice: 1` para registrar un pedido por anteojos premium de ARS 500.000 a ARS 1. Adicionalmente, al no poseer Rate Limiting ni reCAPTCHA, un bot podría saturar la base de datos creando decenas de miles de contactos y pedidos falsos (Denegación de Servicio).
* **Mitigación:** Validar que el cálculo final (`totalPrice`) coincida con los valores reales del carrito, obtenidos mediante una búsqueda directa del lado del servidor de los IDs enviados. Implementar controles anti-spam o cuotas en la ruta web.

### B. Manipulación Irrestricta en las Sesiones de Checkout Web
**Ruta:** `POST / PUT /api/checkout/session/route.ts`
* **Descripción:** Por el bypass explicitado en el middleware (`isCheckoutBypass`), los métodos POST y PUT de este endpoint se encuentran totalmente expuestos. Permiten que se envíe indiscriminadamente payload para crear y actualizar entidades `CheckoutSession`.
* **Riesgo (Medio):** Podría ser utilizado para ataques DoS en la base de datos al llenar la tabla con registros basura masivamente, o manipular carritos de forma irregular.

### C. Conflicto de Permisos con `/api/complaints`
**Ruta:** `POST /api/complaints/route.ts` vs `src/middleware.ts`
* **Descripción:** El endpoint `complaints` valida la autenticación de la petición externa (Wa-Service / Make) exigiendo la coincidencia del header `x-api-key` con `BOT_API_KEY`.
* **Problema Arquitectónico:** El `middleware.ts` **no incluye** a `/api/complaints` dentro de la lista de bypass para bots (solo `/api/bot/`, `/api/whatsapp/`, `/api/admin/alert`, etc.).
* **Consecuencia:** Cuando el Bot intenta llamar al endpoint, el middleware exige una cookie de sesión (que un bot no tiene) y devuelve HTTP 401 Unauthorized antes de siquiera ejecutar el código de `complaints/route.ts`.
* **Mitigación:** Mover la ruta a `/api/bot/complaints/route.ts` o agregar `!pathname.startsWith('/api/complaints')` en el listado condicional del middleware.

### D. Redundancia DRY en Rutas Protegidas (Baja Severidad)
**Rutas:** `/api/contacts/route.ts` (POST), `/api/contacts/[id]/route.ts` (DELETE)
* **Descripción:** A pesar de tener la identidad del usuario resuelta e inyectada por el `middleware.ts` en los headers (`x-user-role`, `x-user-name`), varios endpoints de contactos continúan invocando manualmente `cookies()` y desencriptando el JWT de `session` a lo largo del flujo de la API.
* **Mitigación:** Usar de manera unificada `const headersList = await headers(); const role = headersList.get('x-user-role');` para disminuir tiempos de cómputo redundantes y consolidar el diseño del backend.

---

## 4. Recomendaciones Finales de Refactorización

1. **Reforzar Web Checkout:** Prohibir que la orden tome el "precio" suministrado por el Request del cliente de manera ciega.
2. **Implementar Rate Limiting Global o por Endpoint:** Incorporar un Rate Limit para rutas públicas (Store API, Web Checkout API, Login API) para prevenir fuerza bruta o envenenamiento de la DB.
3. **Auditar Endpoints de Archivos:** Aunque `storage/view` previene el Path Traversal, asegurar que el endpoint `/api/upload` evalúe Mime Types verificados por librerías como *file-type*, en lugar de confiar ciegamente en una lista negra de extensiones (`.exe`, `.sh`).
