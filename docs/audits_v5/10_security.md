# Auditoría de Seguridad - CRM Atelier

**Fecha:** 16 de Junio de 2026
**Área:** Backend, Frontend y API (Next.js, Prisma, Express/wa-service)
**Estado:** Finalizado

---

## 1. Resumen Ejecutivo
Se realizó una auditoría de seguridad sobre el código base del proyecto, enfocándose principalmente en la protección de rutas, autenticación de usuarios, manejo de sesiones, validación de JWT y prevención general de vulnerabilidades (XSS, SQLi, CSRF, ataques de tiempo, etc.).

La arquitectura actual implementa sólidas prácticas de seguridad, utilizando `jose` para la verificación de JWT en el Edge (middleware de Next.js), encriptación de contraseñas con `bcryptjs`, y parametrización automática mediante el ORM (Prisma). A continuación se detallan los hallazgos y áreas de oportunidad.

---

## 2. Hallazgos y Evaluaciones

### 2.1 Autenticación (Authentication)
- **Mecanismo:** El login (`src/app/api/auth/login/route.ts`) verifica credenciales de forma segura.
- **Hashing:** Se utiliza `bcryptjs` para comparar la contraseña proporcionada con el hash almacenado en la base de datos, lo cual es el estándar de la industria.
- **Prevención de Enumeración:** Los mensajes de error al fallar el inicio de sesión son genéricos ("Credenciales inválidas"), mitigando ataques de enumeración de usuarios.
- **Limitación de Tasas (Rate Limiting):** El endpoint de login está protegido contra ataques de fuerza bruta usando un limitador de tasas en memoria (`src/lib/rate-limiter.ts`) configurado a 10 intentos cada 15 minutos por IP.
- **Nota:** Existe un _bypass_ (`local-admin-ishtar`) estrictamente condicionado a entornos de desarrollo (`NODE_ENV === 'development'`). Su lógica no representa un riesgo para producción.

### 2.2 Gestión de Sesiones (Session Management)
- **Implementación:** JSON Web Tokens (JWT) utilizando la librería `jose` en lugar de `jsonwebtoken` para mantener compatibilidad con Edge Computing (Next.js Middleware).
- **Almacenamiento Seguro:** El token se almacena en una cookie `httpOnly`, lo que evita la lectura mediante JavaScript del lado del cliente (mitigando ataques XSS). También cuenta con la directiva `sameSite: 'lax'`, proveyendo protección contra ataques CSRF. En producción, la cookie es `secure`.
- **Firma y Expiración:** Utiliza el algoritmo `HS256` con una clave secreta fuerte obtenida de las variables de entorno (`JWT_SECRET`). La sesión expira en 1 día.

### 2.3 Protección de Rutas (Middleware)
- **Ubicación:** `src/middleware.ts`
- **Dashboard/Admin:** Todas las rutas debajo de `/admin` redireccionan correctamente a `/login` en caso de no proveer un token de sesión válido.
- **API Endpoints:** Las rutas `/api/` requieren un token JWT válido a excepción de las explícitamente excluidas (p. ej. tienda pública `/api/store`, webhooks `/api/bot`, cron `/api/cron`).
- **Autenticación Máquina a Máquina (Bots):** Las rutas de webhooks y subida de archivos de bots (`/api/bot`, `/api/whatsapp`, `/api/admin/alert`) están protegidas con un esquema de API Key (`x-api-key`). 
- **Prevención de Ataques de Tiempo (Timing Attacks):** Es destacable la implementación y el uso de la función `safeCompare(a, b)` en el middleware para comparar el API KEY usando bitwise XOR y TextEncoder, lo que previene que un atacante adivine la clave analizando los tiempos de respuesta.

### 2.4 Prevención de Inyecciones (SQLi y XSS)
- **SQL / NoSQL Injection:** El uso de Prisma ORM parametriza inherentemente las consultas, blindando la aplicación contra inyecciones SQL. Las consultas raw (`$queryRaw`) se construyen con *tagged template literals* en lugar de strings concatenados inseguros (`$queryRawUnsafe`), evitando la inyección de forma exitosa.
- **XSS:** Next.js por defecto escapa las variables incrustadas en las vistas de React, previniendo Server-Side y Client-Side XSS.

### 2.5 Encabezados de Seguridad (Security Headers)
- En el archivo `next.config.ts`, se aplican correctamente encabezados de seguridad importantes:
  - `X-Frame-Options: DENY` (Protección contra Clickjacking)
  - `X-Content-Type-Options: nosniff` (Prevención de ataques de sniffing de MIME-type)
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`

---

## 3. Puntos de Mejora y Recomendaciones

Si bien el estado actual de seguridad es **alto**, se recomienda evaluar las siguientes implementaciones a futuro para un nivel de resiliencia empresarial:

1. **Escalabilidad del Rate Limiter:** 
   El `rate-limiter.ts` actual mantiene un objeto/mapa `rateLimits` en la memoria de Node. Si la aplicación se escala horizontalmente (múltiples pods o réplicas Vercel/Railway), cada instancia mantendrá su propio límite, disminuyendo la efectividad de la protección.
   - **Recomendación:** Considerar migrar el estado del rate limiter a una base de datos clave-valor como **Redis** (ej. `@upstash/redis` o Node-Redis) en un futuro.
2. **Invalidación de JWT (Token Revocation):**
   Actualmente, el JWT dura 1 día y, al ser stateless, no existe manera de revocar forzosamente el token si la cuenta del administrador fuese comprometida.
   - **Recomendación:** Implementar una pequeña caché de revocación (Blacklist) en la base de datos o Redis, o utilizar un sistema de "Refresh Tokens" bajando la duración del token de sesión a unos pocos minutos.
3. **Content Security Policy (CSP):**
   Aunque hay headers de seguridad definidos en `next.config.ts`, hace falta un CSP estricto (`Content-Security-Policy`). 
   - **Recomendación:** Agregar directivas de CSP para limitar los orígenes desde los que se pueden cargar scripts e imágenes, reduciendo drásticamente los vectores de ataque en caso de vulnerabilidades XSS.

---
**Resultado de Auditoría:** APROBADA ✅
