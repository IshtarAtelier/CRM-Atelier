# Auditoría de Manejo de Errores (Error Handling)

## Frontend (Next.js)

1. **Ausencia de Error Boundaries nativos:**
   El proyecto en Next.js (App Router) **no implementa** Error Boundaries globales (`global-error.tsx`) ni por ruta (`error.tsx`). Tampoco se encontraron clases personalizadas del tipo `ErrorBoundary` (`class ErrorBoundary extends React.Component`). 
   - **Riesgo:** Si ocurre una excepción no capturada (unhandled exception) durante el renderizado de cualquier componente, la UI podría bloquearse ("pantalla blanca de la muerte") o mostrar un error feo por defecto, afectando la experiencia del usuario.

2. **Manejo superficial en bloques Try/Catch:**
   El uso de bloques `try/catch` está muy extendido en los handlers de páginas (por ejemplo, en `src/app/admin/administracion/page.tsx`, `src/app/admin/configuracion/page.tsx`, etc.). Sin embargo, la estrategia de manejo de errores consiste mayormente en mostrar alertas nativas del navegador:
   - `alert('Error al actualizar: ' + err.message);`
   - **Riesgo:** La función `alert()` es bloqueante y no proporciona una experiencia de usuario fluida o premium.
   - Existen casos donde los errores de JSON parseo o de peticiones simplemente se ignoran: `catch(e) {}`, o se asignan valores por defecto silenciosos `catch { json = { error: 'Error del servidor...' } }`.

3. **Logging:**
   No hay un sistema de logging estructurado; la aplicación usa exclusivamente `console.error` en el cliente.

---

## Backend y WhatsApp Service (`wa-service`)

1. **Abuso de `catch (e) { /* ignore */ }`:**
   Particularmente en `wa-service/index.js` y `wa-service/routes/api.js`, hay una gran cantidad de bloques `try/catch` que atrapan errores y literalmente los ignoran (ej. fallos al obtener datos formateados del cliente de WhatsApp o fallos de notificaciones).
   - **Riesgo:** Si ocurre un comportamiento inesperado, no quedará ningún rastro en los logs para su posterior diagnóstico.

2. **Manejo descentralizado de excepciones:**
   Las rutas de la API de Next (`src/app/api/...`) no utilizan un middleware centralizado para capturar excepciones. Cada controlador envuelve su lógica en un gran `try { ... } catch (error) { return NextResponse.json({ error: ... }, { status: 500 }); }`.
   - **Riesgo:** Código repetitivo y riesgo de que algún error imprevisto se escape sin el formato adecuado.

3. **Logging de Errores en Backend:**
   Al igual que en el frontend, el backend se basa en `console.error(e.message)`. No hay rastros de integración con sistemas de monitorización (APM) o agregación de logs como Sentry, Datadog o Winston. En caso de caída de un entorno de producción, la información de error queda enterrada en la salida estándar (stdout).
   - En el bot de WhatsApp (`wa-service/index.js`), sí se envían alertas de emergencia por WhatsApp (al teléfono 3541215971) o por correo para errores críticos (ej: *Error 429 RESOURCE_EXHAUSTED* de la API de Gemini), lo cual es una buena práctica de contingencia operativa.

---

## Recomendaciones

- **Frontend:** 
  1. Crear el archivo `src/app/error.tsx` (y `global-error.tsx`) para mostrar una interfaz visualmente amigable en caso de caídas.
  2. Reemplazar todos los `alert()` nativos por una librería de notificaciones UI moderna como `sonner` o `react-hot-toast` para informar de errores de API.
- **Backend:** 
  1. Implementar un "Error Handler" genérico o usar `next-connect` (o middleware similar) para estandarizar las respuestas de error `500`.
  2. Sustituir los comentarios `/* ignore */` por logs de nivel "debug" o "warn".
- **Observabilidad:** Integrar una herramienta como **Sentry** (o análogos) para el rastreo estructurado y alertas automatizadas de errores en producción, tanto en Frontend como en Backend.
