# Auditoría de Seguridad: Autenticación, Rutas y Middleware

## Resumen Ejecutivo

El sistema **CRM-Atelier** utiliza un esquema de autenticación basado en **JWT** (JSON Web Tokens) implementado a medida mediante la librería `jose`. No hace uso de frameworks de terceros como NextAuth. En general, el nivel de seguridad es **adecuado y robusto** para las necesidades de un CRM interno, aunque existen áreas puntuales donde la seguridad se puede endurecer para prevenir ataques específicos.

## 1. Autenticación y Manejo de Sesiones

### Mecanismo de Inicio de Sesión
- **Validación**: Las contraseñas se almacenan y verifican utilizando hashes seguros provistos por la librería `bcryptjs`.
- **Generación de JWT**: Al loguearse, el servidor genera un token JWT simétrico (`HS256`) utilizando un `JWT_SECRET`. La expiración está configurada correctamente a **1 día** (`1d`).
- **Dev Bypass**: Existe un bypass habilitado para desarrollo: `password === 'local-admin-ishtar'`. Está debidamente protegido por la comprobación `process.env.NODE_ENV === 'development'`, evitando su explotación en producción.
- **Almacenamiento (Cookies)**: El token se envía al cliente a través de una cookie segura llamada `session` con las banderas:
  - `httpOnly: true` (Previene ataques XSS para el robo de sesión).
  - `secure: process.env.NODE_ENV === 'production'` (Solo se envía por HTTPS en producción).
  - `sameSite: 'lax'` (Previene ataques CSRF básicos originados en sitios de terceros).

## 2. Protección de Rutas (Middleware)

El archivo `src/middleware.ts` es el principal guardián de las rutas de la aplicación:
- Intercepta el tráfico dirigido a `/admin` y a las APIs `/api/*`.
- Permite el tráfico público necesario (como rutas del e-commerce o web).
- **Protección contra falsificación de Cabeceras (Header Spoofing)**: El middleware extrae la carga útil del JWT validado y reescribe las cabeceras `x-user-role`, `x-user-id` y `x-user-name`. Esto significa que si un atacante o cliente intenta enviar un `x-user-role: ADMIN` adulterado, **el middleware lo sobrescribirá** con el valor real proveniente de la base de datos (JWT). Esta es una práctica muy segura y bien implementada.

## 3. Autorización (Roles y Permisos)

- Las rutas restringidas leen el rol directamente desde la cabecera confiable `x-user-role` (por ej. `if (role !== 'ADMIN')`).
- **Verificación en controladores**: La autorización no está centralizada. Los controladores validan el rol manualmente. Ej: `src/app/api/products/delete-all/route.ts` correctamente frena el borrado masivo de la base de datos si el rol no es `ADMIN`.
- **Rutas permisivas**: Existe una ruta `PATCH` en `api/products/[id]` diseñada para actualizar datos de armazones que omite la validación de roles de administrador. Está protegida por el JWT del middleware (requiere estar autenticado como STAFF o ADMIN), por lo que un usuario externo no puede modificarla, pero todos los usuarios registrados tienen acceso irrestricto.

## 4. APIs Externas (Bots y Tareas Programadas)

- **Cron Jobs**: Las tareas automáticas (`/api/cron/*`) evaden la validación de JWT, pero el archivo requiere que el solicitante provea el `CRON_SECRET` mediante Query Params (`?secret=...`) o el header de autorización (`Bearer ...`). Esto cumple con las recomendaciones de seguridad de Vercel/Next.js.
- **Bot y WhatsApp**: Para subir archivos o comunicarse a través de servicios de WhatsApp como el `wa-service`, el middleware solicita el header `x-api-key`.
- **Protección contra ataques de tiempo**: La validación de la API Key utiliza una función personalizada `safeCompare` implementada a bajo nivel (usando operadores bit a bit y búferes). Esto previene **Timing Attacks** (ataques basados en la medición del tiempo de respuesta del servidor al validar cadenas), demostrando un excelente cuidado por parte del desarrollador.

## 5. Áreas de Mejora y Riesgos Detectados

Aunque la base es segura, se identificaron las siguientes oportunidades de mejora:

1. **Ausencia de Rate Limiting (Límite de peticiones)**:
   - Los endpoints de inicio de sesión (`/api/auth/login`) no limitan la cantidad de intentos fallidos. Un atacante podría realizar fuerza bruta para adivinar las contraseñas sin que el servidor lo bloquee.
   - **Recomendación**: Implementar rate limiting a nivel de aplicación (ej. `@upstash/ratelimit` con Redis) o asegurar que el proxy inverso (Nginx / Cloudflare / Railway) tenga políticas estrictas para la ruta `/api/auth/login`.

2. **Protección CSRF basada únicamente en `SameSite`**:
   - Actualmente, la aplicación confía en la política `SameSite: lax` de la cookie. Aunque detiene muchas amenazas, peticiones maliciosas forzadas desde navegadores antiguos o navegaciones de "top-level" podrían desencadenar acciones destructivas (ej. `DELETE /api/products/delete-all`).
   - **Recomendación**: Considerar enviar un token anti-CSRF adicional en los formularios de modificación, o bien migrar los endpoints críticos a *Server Actions* de Next.js, los cuales traen protección CSRF estricta nativa.

3. **Centralización de la lógica de Autorización**:
   - Múltiples controladores duplican la lógica de verificación (`const role = headersList.get('x-user-role'); if (role !== 'ADMIN') return ...`).
   - **Recomendación**: Crear un *wrapper* o un servicio de guarda que valide los permisos automáticamente antes de ejecutar el handler del controlador para evitar que un endpoint accidentalmente olvide validar los permisos, mitigando errores humanos en el futuro.

## Conclusión
La arquitectura de seguridad de CRM-Atelier es sólida. El desarrollo "in-house" de la validación JWT con el middleware de Edge funciona perfectamente. Aplicando medidas preventivas para el Rate-Limiting en el login y centralizando los permisos de roles, se logrará alcanzar un estándar empresarial de seguridad óptimo.
