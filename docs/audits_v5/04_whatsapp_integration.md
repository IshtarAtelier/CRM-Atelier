# Auditoría: Integración de WhatsApp (whatsapp-web.js)

**Fecha de la Auditoría**: 16 de Junio de 2026  
**Ubicación Principal**: `wa-service/whatsapp/client.js` y `wa-service/index.js`  
**Librería Principal**: `whatsapp-web.js` v1.34.7  

## 1. Configuración de Cliente y Entorno
- **Librería y Versión**: Utiliza `whatsapp-web.js` versión 1.34.7.
- **Caché Web Remoto**: Hace uso de un repositorio de GitHub para cargar el archivo `BootstrapQr.html` remoto (`webVersionCache`). Esto soluciona de forma proactiva las frecuentes desactualizaciones de la interfaz web de WhatsApp sin necesidad de esperar actualizaciones a la librería local.
- **Entorno Headless / Docker**: El cliente arranca mediante `puppeteer` en modo headless e incluye múltiples *flags* críticos (`--no-sandbox`, `--disable-dev-shm-usage`, `--disable-gpu`, `--disable-extensions`, etc.) garantizando una ejecución segura y previniendo colapsos por falta de memoria compartida en contenedores.

## 2. Manejo de Sesiones (Session Management)
- **LocalAuth Adaptativo**: Configurado para utilizar `LocalAuth`, eligiendo dinámicamente un volumen de Railway (`RAILWAY_VOLUME_MOUNT_PATH`) en producción, lo cual evita que la sesión desaparezca en reinicios del contenedor, o una carpeta local (`.wwebjs_auth`) en desarrollo.
- **Prevención de Zombies**: Ejecuta `pkill -9 -f chromium` al arrancar el cliente para eliminar procesos de Chromium colgados (zombis) que comúnmente bloquean la lectura de la sesión en entornos Linux.
- **Resolución de Locks de Chromium**: Se implementa un borrado agresivo y forzado (`fs.rmSync(..., { force: true })`) de archivos conflictivos como `SingletonLock`, `SingletonCookie` y `SingletonSocket`. Esto es crucial porque tras los reinicios de un contenedor Docker, estos archivos a menudo quedan como *symlinks* rotos que bloquean Puppeteer.
- **Detección de Corrupción Previa**: Antes de instanciar el cliente, lee y valida sintácticamente como JSON el archivo `Default/Preferences` de la sesión. Si está corrupto, borra de inmediato la carpeta para evitar cuelgues durante el arranque de Puppeteer y fuerza la solicitud de un nuevo QR.
- **Fallo de Autenticación (`auth_failure`)**: Frente a la pérdida o expiración del token desde la app móvil, se limpia la sesión completa automáticamente.

## 3. Manejo de Clientes y Estabilidad Actual
- **Wrappers con Timeout Globales**: Utiliza una función `withTimeout` personalizada en todas las interacciones críticas. Si Puppeteer falla en silencio, esto evita promesas infinitas:
  - `initialize()`: Límite de 60 segundos.
  - `sendMessage()`: Límite de 30 segundos.
  - Carga de `MessageMedia.fromUrl()`: Límite de 15 segundos.
  - `getState()`: Límite de 20 segundos.
- **Gestión de Concurrencia al Iniciar**: Emplea la variable de exclusión `isStarting` para evitar que peticiones simultáneas de reinicio desencadenen la creación de múltiples clientes de Chromium paralelos.
- **Keep-Alive (Monitor de Salud Activo)**: 
  - Chequea periódicamente (cada 3 minutos) la salud del cliente mediante la función `waClient.getState()`.
  - Tolera hasta 2 fallos consecutivos (`MAX_KEEPALIVE_FAILS`). Si los supera, asume la muerte silenciosa del cliente y reinicia toda la instancia. 
- **Reconexiones Automáticas**:
  - Responde al evento `disconnected` programando un reinicio automático.
  - Retraso progresivo en reinicios fallidos (`RETRY_DELAY_MS`) con un límite de 3 reintentos (`MAX_RETRIES`) antes de abortar.
- **Recuperación ante Locks de Perfil (Error Code 21)**: Si al inicializar arroja `Code: 21` o fallos de `process_singleton`, intercepta el error, borra la carpeta de sesión bloqueada por el sistema y continúa el arranque limpio.

## 4. Comunicación Externa e Integración con la Lógica Principal
- **Desacoplamiento**: Exporta los métodos `sendMessage`, `sendTypingState` e `initWhatsApp`, manteniendo el código de control y la UI separados de la arquitectura del bot y los agentes de LangGraph en `index.js`.
- **Integración Multimedia Inteligente**: En la función de envío de mensajes, adapta las URLs de los adjuntos usando el prefijo base de la API del CRM. Detecta y formatea mensajes de voz como verdaderos "Voice notes" (`sendAudioAsVoice = true`).
- **Sincronización Transparente**: Al recibir el evento de conexión (`isReady = true`), lo propaga mediante `onStatusChange` al archivo `index.js`, el cual a su vez informa a la UI vía WebSockets (`bot_status`) y desencadena la tarea en segundo plano `syncRecentChatsAndMessages` para no perder la traza de los chats entrantes durante periodos de caída.

## Conclusión de Estabilidad
La implementación revela un **nivel avanzado de madurez y resiliencia**. Se han interceptado y solucionado proactivamente la gran mayoría de problemas comunes de `whatsapp-web.js` en entornos productivos o headless. La inclusión de un `Keep-Alive`, limpieza de locks de sesión, *timeouts* envolventes para las peticiones en promesas y el uso del caché web remoto garantizan un servicio sumamente estable y listo para operar 24/7 sin intervención humana.
