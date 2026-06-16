# Auditoría de Seguridad General y Autenticación

Este documento presenta una auditoría exhaustiva sobre la seguridad, autenticación, protección de rutas, validación de JWT y otras prácticas de seguridad implementadas en la plataforma (Next.js + wa-service).

## 1. Resumen Ejecutivo
La plataforma cuenta con un sistema de autenticación funcional basado en JWT almacenados en cookies HTTP-only, complementado con un `middleware` de Next.js que protege correctamente los accesos no autenticados a los paneles de administración y API. Sin embargo, existen vulnerabilidades críticas vinculadas a la falta de autorización basada en roles (RBAC) en varios endpoints de la API, fallas potenciales por configuraciones incompletas en el microservicio `wa-service`, y vulnerabilidades a ataques de fuerza bruta debido a la ausencia de límite de peticiones (Rate Limiting) en rutas críticas como el inicio de sesión.

## 2. Autenticación y Gestión de Sesiones (JWT)
El inicio de sesión se procesa a través de `/api/auth/login/route.ts` utilizando la librería `bcryptjs` para comparar contraseñas hash.

**Fortalezas:**
- Se utiliza `jose` para generar y validar JWT firmados con el algoritmo `HS256`.
- El token expira razonablemente en 1 día.
- Las cookies se configuran de manera segura con los flags `httpOnly: true`, `sameSite: 'lax'` y `secure: true` (en producción).

**Vulnerabilidades:**
- **Sin Revocación de Estado (Stateless JWT):** El endpoint de `/api/auth/logout/route.ts` simplemente elimina la cookie del lado del cliente. Si un token es comprometido, no hay forma nativa de revocarlo del lado del servidor antes de su expiración, dado que no hay una base de datos de tokens activos o lista negra (blacklist).

## 3. Protección de Rutas (Middleware)
El archivo `src/middleware.ts` es responsable de interceptar las peticiones y verificar la autenticación.

**Fortalezas:**
- Redirecciona correctamente a `/login` los accesos sin autenticación a la ruta de `/admin`.
- Protege los endpoints bajo `/api/` (con excepciones documentadas) validando que exista un payload válido del JWT.
- Las rutas del bot y wekbooks (`/api/bot/`, `/api/whatsapp/`, `/api/upload`) exigen un API Key `x-api-key` y previenen *timing attacks* utilizando una función criptográfica (`safeCompare`).

**Excepciones Críticas (Endpoints públicos):**
- `/api/auth/`
- `/api/cron/`
- Rutas públicas del e-commerce (`/api/store/`, `/api/web/`, `/api/checkout/`).

## 4. Autorización y Control de Roles (Vulnerabilidad Crítica)
El middleware inyecta los roles del usuario como headers HTTP (`x-user-role`, `x-user-id`). Aunque el rol se envía a los manejadores de rutas (Route Handlers), la gran mayoría de la API **no verifica el rol** al realizar operaciones sensibles.

**Hallazgos Críticos de Escalada de Privilegios:**
- **`POST /api/users` y `PATCH /api/users/[id]`:** No exigen que el usuario sea `ADMIN`. Cualquier usuario autenticado (ej. un empleado con rol `STAFF`) puede modificar su propio rol a `ADMIN`, crear nuevos administradores, o cambiar contraseñas e información de cualquier otro usuario del sistema.
- **`GET /api/reports`:** Los reportes de ventas devuelven toda la información financiera, gastos fijos, márgenes de ganancia e ingresos netos de la clínica. No existe control de permisos; cualquier usuario autenticado (incluyendo personal sin autorización contable) puede observar la rentabilidad financiera total del negocio.

*Nota:* Únicamente la ruta `/api/settings/route.ts` verifica correctamente el `x-user-role === 'ADMIN'`.

## 5. Prevención de Ataques de Fuerza Bruta y Limitación de Tasa (Rate Limiting)
Existe una utilidad `src/lib/rate-limiter.ts` que almacena un control en memoria.

**Fortalezas:**
- Se emplea para endpoints como `/api/ocr` y actualización de productos con lectura OCR para prevenir abusos a la IA.

**Vulnerabilidades:**
- **Ausencia de Rate Limit en Login:** La ruta `/api/auth/login/route.ts` no implementa límite de peticiones. Un atacante puede intentar de forma automatizada miles de combinaciones de contraseñas, lo que facilita un ataque de diccionario o de fuerza bruta.
- **Implementación en Memoria:** Si el servidor escala a múltiples instancias, el límite en memoria ya no es efectivo entre contenedores/servidores.

## 6. Seguridad en Microservicio `wa-service` (Bot de WhatsApp)
El `wa-service` expone endpoints (`api.js`) y webhooks para manejar interacciones con LangGraph. Utiliza un middleware interno `apiAuth`.

**Vulnerabilidad de Diseño (Fail-Open):**
- Dentro de `apiAuth` se evalúa:
  ```javascript
  if (!WA_API_KEY) return next(); // Sin key configurada, permitir (modo legacy)
  ```
  Si por un error de despliegue, la variable de entorno `WA_API_KEY` se omite, los endpoints (como `/api/send` o `/api/chats`) quedan **totalmente expuestos a Internet sin requerir contraseña**. Cualquiera podría enviar mensajes en nombre del comercio.

## 7. Plan de Acción y Recomendaciones

1. **Implementar RBAC en la API de Next.js:** 
   - Modificar obligatoriamente las rutas `api/users` y `api/reports` para requerir que `request.headers.get('x-user-role') === 'ADMIN'`.
2. **Rate Limiting para Autenticación:** 
   - Integrar la función `checkRateLimit` dentro de `/api/auth/login`, permitiendo un número máximo de 5 a 10 intentos fallidos por IP o email en una ventana de 15 minutos.
3. **Parchear el Fail-Open del wa-service:** 
   - Cambiar la lógica en el middleware del bot para que exija obligatoriamente una key. Si no está configurada, el servicio debe fallar en el inicio o rechazar cualquier petición externa.
4. **Validar contraseñas de Usuarios:** 
   - Agregar validaciones robustas (Zod) a la creación de usuarios para exigir una complejidad mínima en las contraseñas.
