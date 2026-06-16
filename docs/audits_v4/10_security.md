# Auditoría de Seguridad General y Autenticación

## 1. Resumen Ejecutivo
El sistema presenta una arquitectura de seguridad sólida en términos de protección de rutas y manejo de sesiones, utilizando estándares modernos como JWT en cookies `HttpOnly` y middleware para la interceptación de solicitudes. Sin embargo, se ha detectado una **vulnerabilidad crítica de escalada de privilegios** debido a la falta de verificación de roles en los endpoints de gestión de usuarios.

## 2. Autenticación y Manejo de Sesiones
- **JWT (JSON Web Tokens)**: La aplicación utiliza la librería `jose` para generar tokens firmados (HS256) con una validez de 1 día.
- **Almacenamiento**: Los tokens se almacenan en una cookie llamada `session` configurada como `HttpOnly`, `SameSite: lax` y `Secure` (en entornos de producción). Esto previene ataques XSS (Cross-Site Scripting) al no exponer el token a JavaScript del lado del cliente.
- **Protección contra Fuerza Bruta**: El endpoint `/login` (`src/app/api/auth/login/route.ts`) cuenta con un rate limiter (10 intentos fallidos cada 15 minutos). No obstante, el estado se guarda en un mapa en memoria (`src/lib/rate-limiter.ts`), lo cual es efectivo para despliegues de una sola instancia (como Railway o Docker continuo) pero perderá eficacia y estado si se migra a un entorno serverless (Vercel) o de múltiples instancias.
- **Manejo de Contraseñas**: Se utiliza `bcryptjs` con un factor de costo adecuado (10) para el almacenamiento seguro de contraseñas.

## 3. Protección de Rutas (Middleware)
- El archivo `src/middleware.ts` intercepta todas las peticiones a `/api/` y `/admin/`.
- Evalúa correctamente la validez del token y expulsa o deniega el acceso con error `401 Unauthorized` si no existe sesión válida.
- Inyecta cabeceras de confianza (`x-user-id`, `x-user-role`, `x-user-name`) a las peticiones hacia los endpoints API después de descifrar el payload del JWT. 
- Al inyectar/sobrescribir estas cabeceras dentro del middleware protegido, se previene el "Header Spoofing" desde el cliente externo para las rutas que sí están protegidas.

## 4. Control de Acceso Basado en Roles (RBAC) - VULNERABILIDAD CRÍTICA
Mientras que el middleware inyecta correctamente el rol del usuario, la validación final del rol debe hacerse en cada endpoint que requiere permisos especiales.

### Hallazgos Positivos
Endpoints como `/api/products/delete-all`, `/api/laboratories`, `/api/settings` y `/api/billing/config` validan de manera correcta que el usuario sea administrador:
```typescript
const role = headersList.get('x-user-role');
if (role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
}
```

### 🚨 VULNERABILIDAD CRÍTICA: Escalada de Privilegios
Los endpoints encargados de gestionar usuarios (`src/app/api/users/route.ts` y `src/app/api/users/[id]/route.ts`) **NO implementan la verificación del rol `ADMIN`**.
- Cualquier usuario con sesión válida (ej. rol `STAFF`) puede hacer un `POST` a `/api/users` y crear un nuevo usuario con rol `ADMIN`.
- Un usuario `STAFF` puede enviar un `PATCH` a `/api/users/[id]` para cambiarse el rol a sí mismo a `ADMIN`, o incluso modificar la contraseña de otros administradores.

## 5. Integración con Bots y APIs (x-api-key)
Las rutas del bot de WhatsApp (`/api/bot/`, `/api/whatsapp/`, `/api/upload`) tienen una protección mixta que permite acceso mediante JWT o mediante un Header `x-api-key`.
- Se utiliza una función propia `safeCompare` para validar el `x-api-key` contra el `BOT_API_KEY` del entorno.
- **Punto Fuerte**: Esta comparación byte a byte previene ataques de sincronización (Timing Attacks) que de otro modo podrían permitir deducir la clave.

## 6. Recomendaciones de Remediación

1. **Parchear de inmediato la escalada de privilegios**:
   Añadir la validación restrictiva del rol `ADMIN` en todos los métodos (`POST`, `PATCH`, `DELETE`) de la API de usuarios (`src/app/api/users`).
2. **Revisión de Cabeceras en el Frontend**:
   El código en el frontend (ej. `LabPriceImporter.tsx`) envía manualmente la cabecera `x-user-role: ADMIN`. Aunque el middleware la sobrescribe y anula el efecto, se sugiere limpiar este código para evitar confusión sobre cómo funciona el flujo de autorización de la aplicación.
3. **Mejorar el Rate Limiter**:
   Si a futuro la aplicación crece a múltiples contenedores, migrar el mapa de memoria de `src/lib/rate-limiter.ts` a un sistema centralizado como Redis.
4. **Protección de Datos Generales**:
   Considerar si endpoints de lectura como el Dashboard de estadísticas y ventas mensuales (`/api/dashboard`) debieran estar restringidos únicamente a `ADMIN`, ya que actualmente cualquier miembro del `STAFF` puede consultar la facturación global de la óptica.
