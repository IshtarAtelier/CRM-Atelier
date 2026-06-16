# Auditoría de Arquitectura del Backend y Seguridad

## Resumen Ejecutivo
La arquitectura del backend basada en Next.js App Router (App Dir) y Route Handlers (`/api`) ofrece un flujo de trabajo dinámico y ágil, delegando gran parte del control de autenticación a un `middleware.ts` global. Sin embargo, se detectaron vulnerabilidades críticas de seguridad relacionadas con exposición de endpoints y escalada de privilegios, que deben abordarse de forma inmediata.

## Hallazgos Críticos de Seguridad

### 1. Exposición de API de WhatsApp (Acceso no autenticado)
- **Vulnerabilidad (Alta):** El archivo `middleware.ts` excluye explícitamente cualquier ruta que comience con `/api/whatsapp/` de la verificación de tokens y sesiones.
- **Impacto:** Cualquier atacante con acceso a la red puede realizar solicitudes `GET` y `POST` a endpoints como `/api/whatsapp/chats`, `/api/whatsapp/send`, y `/api/whatsapp/chats/[id]/messages`. Esto permite listar, leer conversaciones enteras de clientes o enviar mensajes de WhatsApp en nombre de la empresa sin requerir ninguna autenticación o API key.
- **Recomendación:** Eliminar la exclusión de `/api/whatsapp/` del middleware. Si se necesita acceso para webhooks públicos (ej. Meta webhook), debe segregarse a una ruta específica (`/api/whatsapp/webhook`) y validar la firma o token proporcionado por Meta, asegurando que el resto de los endpoints requieran una sesión válida.

### 2. Escalada de Privilegios en Gestión de Usuarios
- **Vulnerabilidad (Crítica):** Aunque el `middleware.ts` protege las rutas `/api/` en general, inyecta los headers `x-user-id` y `x-user-role`, pero no hace comprobación de permisos (Role-Based Access Control). La responsabilidad de restringir acciones administrativas recae en cada endpoint individual. Sin embargo, endpoints como `POST /api/users`, `PATCH /api/users/[id]` y `DELETE /api/users/[id]` no validan si el usuario tiene rol `ADMIN`.
- **Impacto:** Cualquier empleado con cuenta de acceso estándar (`STAFF`) puede enviar un payload a `PATCH /api/users/[id]` y cambiar su propio rol a `ADMIN`, o modificar contraseñas de otros usuarios.
- **Recomendación:** Agregar la validación `const role = headersList.get('x-user-role'); if (role !== 'ADMIN') return ...` en todos los endpoints de gestión de usuarios, o centralizar la protección para rutas críticas.

### 3. Fuga de Información en Manejo de Errores (Information Disclosure)
- **Vulnerabilidad (Media):** Gran parte de los Route Handlers devuelven errores crudos en los bloques `catch`, mediante `return NextResponse.json({ error: error.message }, { status: 500 });`.
- **Impacto:** Un atacante podría forzar errores y visualizar trazas, nombres de archivos o detalles de consultas SQL/Prisma, facilitando la comprensión de la estructura de la base de datos subyacente.
- **Recomendación:** Implementar un middleware de captura de errores o abstraer los errores no controlados para que envíen un mensaje estandarizado ("Ocurrió un error interno en el servidor") a la respuesta, dejando el `error.message` exclusivo para logs en consola.

## Estructura y Buenas Prácticas Encontradas

### 1. Protección de Trabajos Cron (Cron Jobs)
Los endpoints bajo `/api/cron` (como la sincronización de laboratorio o envíos de caja) no están protegidos por el middleware general, pero cuentan con una implementación robusta dentro del handler, comparando de forma exitosa un parámetro `secret` de la query o el header de autorización contra la variable de entorno `CRON_SECRET`. Esta es una buena práctica para invocaciones programadas.

### 2. Uso Eficiente del Middleware
El `middleware.ts` es eficiente para interceptar rutas y validar JWTs utilizando `jose`. El diseño de inyectar claims (id, rol, nombre) en los encabezados del Request permite a los route handlers tener el contexto del usuario de forma inmediata sin volver a descifrar el token. Las exclusiones (rutas públicas como `/api/store/` y de checkout) están manejadas de forma lógica.

### 3. Autenticación Bot-a-Servidor
Rutas internas usadas por el bot y agentes de la aplicación (como `/api/bot/` y `/api/upload`) exigen la provisión de un header `x-api-key` validado de manera segura con una función `safeCompare()` previniendo ataques de "timing", o fallando esto, un JWT normal, lo cual es excelente y previene la manipulación por parte de externos sin comprometer la automatización del bot.

## Resumen de Tareas Pendientes (Action Items)
1. **Revisar `middleware.ts`:** Remover la exención de protección para `/api/whatsapp/`.
2. **Auditar Endpoints Administrativos:** Modificar `/src/app/api/users/route.ts` y `/src/app/api/users/[id]/route.ts` para requerir estrictamente que `x-user-role === 'ADMIN'`.
3. **Revisar Backdoor en Login:** En `src/app/api/auth/login/route.ts`, validar que la condición `isBypass` que evalúa `password === 'local-admin-ishtar'` sea controlada de forma estricta o preferentemente eliminada en favor de un seeding real en desarrollo, para no arriesgar la seguridad de producción ante un posible descuido de las variables de entorno.
4. **Validación de Datos y Manejo de Errores Crudos:** Omitir el envío al frontend de `error.message` para errores 500 no gestionados.
