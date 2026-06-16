# Auditoría de Manejo de Errores (Error Handling)

Este documento detalla el estado actual del manejo de errores tanto en el Frontend como en el Backend del proyecto Atelier.

## 1. Frontend: Error Boundaries y UI de Fallo

### 1.1 Error Boundaries de Next.js
El sistema delega la captura de errores no controlados en la renderización a los componentes nativos de Next.js (App Router):
- **`src/app/error.tsx`**: Proporciona una interfaz amigable (fallback UI) cuando ocurre un error en la renderización de un componente de servidor o cliente dentro de las rutas. Ofrece un botón para "Intentar nuevamente" (`reset()`) y un mensaje general para el usuario.
- **`src/app/global-error.tsx`**: Se encarga de errores críticos a nivel de aplicación (afuera del layout principal). Renderiza su propio `<html>` y `<body>` mostrando una pantalla de "Error Crítico" invitando a recargar la página.

### 1.2 Interacciones en el Cliente (Client Components)
- En la mayoría de componentes interactivos (p.ej. `src/app/admin/pedidos/page.tsx`), las llamadas a la API a través de `fetch` están encapsuladas en bloques `try/catch`.
- **Notificación al Usuario:** Actualmente, gran parte de los errores de red se registran en la consola de desarrollo (`console.error`), pero no siempre se presenta feedback visual al usuario (como un "Toast" o alerta unificada) en toda la plataforma. 
- Existen notificaciones puntuales y personalizadas (ej. `LeadToastNotifications.tsx` para errores de los bots de WhatsApp o nuevos Leads), pero no una librería de toasts global e integrada (como `sonner` o `react-hot-toast`) para los errores HTTP comunes.

---

## 2. Backend: API Routes, Servicios y Logging

### 2.1 API Routes (Next.js)
Las rutas del backend ubicadas en `src/app/api` siguen un patrón uniforme:
- Envuelven la lógica del controlador en bloques `try/catch`.
- Capturan la excepción, la envían a la consola con `console.error('Error [contexto]:', error)`.
- Retornan al cliente un código de estado `500 Internal Server Error` junto con un payload JSON estándar, generalmente `{ error: 'Mensaje genérico' }`.

### 2.2 Capa de Servicios (`src/services`)
- Los servicios delegan el manejo final del error a las APIs. Cuando operaciones de Prisma (Base de Datos) o lógicas de negocio fallan, normalmente se lanza un error (`throw new Error(...)`) para que el controlador lo capture.
- **Background Tasks:** Para tareas asíncronas no bloqueantes o que no deben interferir con el hilo principal (por ejemplo, notificaciones de WhatsApp, eventos analíticos a `AdsService`), los servicios implementan `.catch(err => console.error(...))` y suprimen la excepción, logrando que un fallo en un sistema auxiliar no interrumpa flujos críticos (como cerrar una venta).

### 2.3 Gestor Especializado de Errores de IA (`src/lib/ai-error-handler.ts`)
Existe un patrón muy robusto para controlar el agotamiento de recursos de los servicios de Inteligencia Artificial (ej. Google AI Studio).
- Funciona interceptando errores de red y evaluando si corresponden a `429` (Too Many Requests), `RESOURCE_EXHAUSTED` o problemas de "Quota".
- Si los detecta, envía proactivamente un **correo de alerta al administrador** y **notifica a un grupo de WhatsApp**.
- Esto previene interrupciones silenciosas de las automatizaciones al agotar los créditos.

### 2.4 Logging (Registro de Errores)
- **Tecnología de Log:** Todo el proyecto usa la API nativa de Javascript (`console.log`, `console.error`, `console.warn`). 
- **Ausencia de un Sistema Estructurado:** No se utiliza ninguna biblioteca de logging estructurado (como `Winston`, `Pino` o `Morgan`), ni se integra con plataformas de monitoreo como Sentry o Datadog en el código base revisado. Esto significa que los logs actualmente residen en la salida estándar de ejecución (stdout/stderr) del servidor en Railway o Docker.

---

## Recomendaciones
1. **Toasts Globales en Frontend:** Implementar un proveedor de notificaciones global (ej. `sonner`) que intercepte respuestas `500` u otros códigos de error del `fetch`, y muestre mensajes visuales amables al usuario (en lugar de solo fallar silenciosamente en consola).
2. **Logging Estructurado:** Considerar integrar herramientas como `Pino` o servicios como `Sentry` para no perder la trazabilidad de los `console.error`, facilitando la búsqueda e indexado de incidentes del lado del servidor.
3. **Manejo Centralizado en API:** Crear un middleware o una función de envoltura (`withErrorHandler`) para los Route Handlers de Next.js, de modo que no sea necesario repetir `try/catch` de manera idéntica en docenas de rutas de API.
