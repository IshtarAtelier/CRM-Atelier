# Auditoría de Integración de WhatsApp

## Resumen
Análisis del estado actual de la integración con `whatsapp-web.js` en el microservicio `wa-service`. El reporte evalúa la gestión de sesiones, la estabilidad del cliente de Chromium y el manejo del flujo de mensajes para el bot multi-agente.

## 1. Integración Principal (`whatsapp-web.js`)
- **Librería y Entorno**: Se utiliza `whatsapp-web.js` (versión ^1.34.7) ejecutándose sobre Puppeteer (Chromium) de manera *headless*.
- **Configuración del Cliente**: Centralizada en el archivo `wa-service/whatsapp/client.js`.
- **Estrategia de Autenticación**: Basada en `LocalAuth`, persistiendo los datos de la sesión en el directorio `.wwebjs_auth`. En entornos productivos (Railway), se mapea hacia un volumen persistente (`RAILWAY_VOLUME_MOUNT_PATH`) para no perder la sesión entre despliegues.

## 2. Gestión de Sesión (Session Management)
La plataforma implementa múltiples medidas de resiliencia avanzadas para evitar interrupciones que comúnmente afectan a `whatsapp-web.js`:
- **Limpieza de Bloqueos (Lock Files)**: Elimina proactivamente archivos como `SingletonLock`, `SingletonCookie` y `SingletonSocket` al reiniciar. Esto mitiga el error crítico *Code 21* que indica que el perfil de Chromium está en uso.
- **Validación de Integridad**: Antes de iniciar el cliente, verifica que el archivo de preferencias de sesión (`Default/Preferences`) contenga un JSON válido. Si está corrupto, la sesión se purga automáticamente.
- **Manejo de `auth_failure`**: Ante una falla de autenticación prolongada, el sistema elimina los datos corruptos de la sesión en disco para obligar un re-escaneo del código QR en vez de entrar en un ciclo infinito de errores.
- **Control de Procesos Zombie**: Implementa comandos de sistema (`pkill`) para limpiar procesos residuales de Chromium en memoria y optimizar el uso de recursos.

## 3. Estabilidad y Reconexiones (Client Handling)
- **Monitoreo de Conexión (Keep-Alive)**: Incorpora un `setInterval` cada 3 minutos que invoca `waClient.getState()`. Si la respuesta no es `CONNECTED` repetidas veces (se toleran hasta 2 fallos), procede a reiniciar el cliente automáticamente.
- **Timeouts Seguros**: Para evitar bloqueos permanentes del servicio (*hangs*), las llamadas asíncronas críticas se envuelven en una función propia `withTimeout`. (Ej. 60 segundos máximos para la inicialización, 30 segundos para el envío de mensajes, 20 segundos para consultar el estado).
- **Control de Auto-Reconexión**: Dispone de manejadores para los eventos `disconnected` y retardos exponenciales (`setTimeout` de ~5s a 10s) para evitar ráfagas de inicialización durante caídas temporales de la red de Meta.
- **WebVersionCache**: Inyecta un *BootstrapQR* remoto vía URL en `webVersionCache` mitigando problemas de carga inicial frente a las actualizaciones silenciosas de WhatsApp Web.

## 4. Procesamiento de Mensajes y Orquestación del Bot
- **Debounce de Interacciones**: Los mensajes entrantes inician un *timer* de espera de 25 segundos (`botDebounceTimers`) antes de enviar el historial acumulado al agente en LangGraph. Esto evita que el bot lance respuestas separadas por cada mensaje corto del usuario (efecto *doble o triple reply*).
- **Manejo de Intervención Humana (`botReplyingTo`)**: El bot puede ser desactivado si un humano (asesor de ventas) responde desde un dispositivo vinculado (`fromMe: true`). Para evitar que el sistema confunda al bot con un humano, se usa el mapa `botReplyingTo` que registra cuándo es el bot quien emite activamente el mensaje saliente.
- **Resolución Compleja de Contactos (LIDs)**: WhatsApp introdujo números ofuscados (`@lid` o Linked IDs) que impiden extraer el número de teléfono real directamente. La integración usa de forma iterativa y robusta varios métodos (`getContactLidAndPhone`, `getFormattedNumber`, `getChatById`) para reconstruir la identidad real del usuario y evitar registros duplicados en la DB.

## 5. Conclusiones y Recomendaciones
- **Estado Actual**: **Robusto y altamente customizado.** La capa de integración está muy madura y toma precauciones preventivas ante las fallas más típicas de bibliotecas de web-scraping para WhatsApp.
- **Oportunidades de Mejora (Deuda Técnica)**:
  - **Refactorización**: Lógicas como el *debounce* de mensajes (`processBotTurn`) y el mapeo de números LID residen en `wa-service/index.js` inflando el archivo principal. Sería ideal delegarlas a `whatsapp/message-handler.js`.
  - **Escalabilidad Futura**: Para flujos de notificación masivos, se recomienda no saturar el cliente de web.js e integrar paralelamente *WhatsApp Cloud API* (API Oficial), reservando `whatsapp-web.js` exclusivamente para la inteligencia del CRM del equipo comercial.
