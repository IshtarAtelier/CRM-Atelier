# Reporte de Auditoría: Manejo de Errores (Frontend y Backend)

## 1. Frontend (Error Boundaries)
El frontend de la aplicación utiliza el sistema de enrutamiento de Next.js (App Router). El manejo de errores en la interfaz se gestiona principalmente de la siguiente manera:
- **Error Boundary Global (`src/app/error.tsx`):** Existe un componente global encargado de capturar las excepciones no controladas en el árbol de componentes.
- **Feedback al Usuario:** Muestra una interfaz amigable con el mensaje "¡Ups! Algo salió mal" y ofrece un botón de "Intentar nuevamente" que invoca la función `reset()` para intentar recuperar el estado de la aplicación.
- **Logging en Cliente:** Al activarse, registra el error en la consola del navegador mediante `console.error('Global Error Boundary caught:', error)`.
- **Falta de Error Boundaries Granulares:** No se detectaron componentes `ErrorBoundary` específicos en la carpeta `src/components`. Esto significa que si un componente secundario falla, el error se propaga hasta la capa global de la ruta.

## 2. Backend (API Routes en Next.js)
El backend principal alojado bajo `src/app/api` maneja las excepciones utilizando un patrón estándar y repetitivo en la mayoría de sus controladores:
- **Uso Extensivo de Try/Catch:** Prácticamente todos los endpoints envuelven su lógica principal (consultas a base de datos, llamadas a servicios externos) en bloques `try { ... } catch (error: any) { ... }`.
- **Respuestas HTTP 500:** En caso de error, el servidor siempre devuelve un objeto JSON estructurado indicando el fallo, habitualmente con un código HTTP 500. Ejemplo: `NextResponse.json({ error: error.message || 'Error genérico' }, { status: 500 })`.
- **Logging del Servidor:** Los errores se imprimen en la consola del servidor con mensajes de contexto como `console.error('Error fetching orders:', error)`.
- **Manejo Específico:** En algunos controladores más complejos (como el procesamiento de imágenes por IA en `src/app/api/ai/process-image`), se diferencian errores específicos de parseo o de PDFs antes de devolver el error general.
- **Ausencia de Clases de Error Personalizadas:** No se detectó un patrón de "Custom Errors" (ej. `NotFoundError`, `ValidationError`). La mayoría se tipan como `any` y se extrae la propiedad `.message`.

## 3. Servicio de WhatsApp (wa-service)
El servicio independiente de WhatsApp (`wa-service`), desarrollado en Node.js, tiene su propio estilo de manejo de errores, más orientado a procesos en segundo plano (background tasks):
- **Bloques Try/Catch Tradicionales:** Utilizados de forma estándar para operaciones síncronas o llamadas bloqueantes con `await` en rutas y lógica principal.
- **Promesas con `.catch()`:** Dado que el bot realiza muchas operaciones asíncronas de manera pasiva y no bloqueante (fire-and-forget), es muy común ver llamadas a funciones asíncronas sin `await` terminadas en `.catch(e => console.error(...))`. Esto asegura que el hilo principal (Event Loop) de Node.js no colapse si una de estas tareas secundarias falla (por ejemplo, `processBotTurn(...).catch(...)` o envío de emails/notas).
- **Logging Diferenciado:** Algunos mensajes de error críticos incluyen formato visual para facilitar su búsqueda en los logs, utilizando emojis, como por ejemplo: `console.error("❌ Error async en processBotTurn:", e.message)`.
- **Errores Ignorados (Silent Fails):** Existen bloques que deliberadamente silencian excepciones esperadas sin afectar la ejecución general: `} catch (e) { /* ignore */ }` (por ejemplo, en notificaciones no críticas o al aplicar etiquetas de interés menores).
- **Zod Catchall:** En la validación de esquemas (ej. `agent-tools.js`), se usa activamente `.catchall(z.any())` para prevenir bloqueos o caídas por parámetros extra inesperados que pueda proporcionar la inteligencia artificial al invocar herramientas.

## Conclusión y Recomendaciones
1. **Frontend:** Sería ideal implementar Error Boundaries locales (granulares) para que una falla particular en un widget no interrumpa toda la experiencia del usuario, permitiendo que el resto de la página siga operativa.
2. **Backend (API):** Se recomienda estandarizar el manejo de errores implementando una clase `ApiError` base y una función de utilidad (helper) para estructurar y centralizar la creación de respuestas. Esto evitaría repetir continuamente `NextResponse.json({ error }, { status: 500 })` y simplificaría el uso de los códigos HTTP adecuados (400, 401, 403, 404, etc.) en lugar de manejar todo siempre como un 500.
3. **WA-Service:** La técnica "fire-and-forget" capturando errores con `.catch()` es correcta para las rutinas pasivas. Sin embargo, se sugiere integrar una herramienta centralizada de monitorización de errores (como Sentry o Datadog) en el futuro, ya que los fallos capturados silenciosamente o registrados solo en consola son difíciles de rastrear y pueden esconder bugs sistémicos importantes a largo plazo.
