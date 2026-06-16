# Auditoría de Integración de WhatsApp (whatsapp-web.js)

## 1. Manejo de Sesiones
- **Estrategia de Autenticación**: Se utiliza `LocalAuth` para mantener la persistencia en disco de las sesiones de WhatsApp.
- **Rutas de Sesión Flexibles**: Soporta el guardado en un volumen montado de Railway (`RAILWAY_VOLUME_MOUNT_PATH`) o de forma local en `.wwebjs_auth`.
- **Prevención de Bloqueos (Locks)**: Al inicio del cliente se fuerza la eliminación (`fs.rmSync(..., { force: true })`) de los archivos `SingletonLock`, `SingletonCookie` y `SingletonSocket` para evitar problemas en caso de reinicios abruptos del contenedor.
- **Detección de Sesión Corrupta**: Incluye un mecanismo para evaluar la integridad del archivo `Preferences` de Chromium. Si detecta corrupción, elimina recursivamente el directorio de sesión para regenerar el proceso limpiamente.
- **Recuperación Automática (`auth_failure`)**: Ante fallos en la autenticación, se elimina la sesión local y se reinicia el flujo, permitiendo un nuevo escaneo de QR. 
- **Manejo del Error Code 21**: Captura explícitamente el bloqueo de perfil de Chromium y purga la sesión para evitar bloqueos permanentes (`crash loops`).

## 2. Manejo de Clientes e Identificadores
- **Resolución de LID (`@lid`)**: Posee un sistema escalonado y robusto para mapear los nuevos identificadores `@lid` de WhatsApp hacia números de teléfono reales (`@c.us`), usando:
  1. `getContactLidAndPhone` con reintentos para la API oficial.
  2. `getFormattedNumber` del Contacto.
  3. `getFormattedNumber` del Cliente de WWebJS.
  4. Extracción desde el objeto de Chat directo (`getChatById`).
- **Concurrencia e Intervención Humana**: El servidor detecta la intervención del usuario humano en el chat (`message_create` saliente) y apaga el bot. Se utiliza la variable global `botReplyingTo` (instancia de `Set()`) para diferenciar cuando los mensajes salientes son emitidos por el sistema (evitando que el bot se desactive a sí mismo).
- **Consistencia en BD**: Emplea operaciones `upsert` basadas en el ID serializado de mensaje (`waMessageId`), previniendo registros duplicados durante reinicios o rebotes de red.

## 3. Estabilidad y Tolerancia a Fallos
- **Mecanismo "Keep-Alive"**: Implementa un "ping" ejecutando `waClient.getState()` cada 3 minutos. Al detectar estados inconsistentes o demoras en la respuesta, acumula un contador que fuerza el reinicio del cliente si falla 2 veces seguidas (`MAX_KEEPALIVE_FAILS`).
- **Control de Tiempos (`withTimeout`)**: Funciones críticas como el envío de mensajes (`sendMessage`), recuperación de estados y descargas de medios (`MessageMedia.fromUrl`) están encapsuladas con un tiempo de gracia máximo (ej. 15-30s). Esto evita que promesas bloqueadas paralicen el proceso general.
- **Optimización de Puppeteer**: Se le envían flags extensos de optimización de Chromium (`--no-sandbox`, `--disable-dev-shm-usage`, `--disable-gpu`, etc.) que reducen notablemente el uso de memoria e incrementan la viabilidad en entornos dockerizados.
- **Prevención Zombie**: Al arrancar, intenta matar procesos `chromium/chrome` sueltos para limpiar memoria y evitar interferencias (`pkill -9 -f chromium`).
- **Desconexión y Reconexión Automática**: Monitorea el evento `disconnected` e intenta reconectarse aplicando un delay prudencial (`RETRY_DELAY_MS`) para no acaparar recursos.

## 4. Limitaciones y Riesgos
- **Memoria por Medios (Media Cache)**: El almacenamiento en `global.mediaCache` acumula imágenes en memoria para multimodality que podría derivar en un eventual Memory Leak en instancias muy activas.
- **Sincronización Multi-hilos**: Pese a los mitigantes actuales, los timeouts en reconexiones pueden demorar la inicialización del cliente temporalmente durante bloqueos severos del headless browser.

## Conclusión
La implementación demuestra un profundo entendimiento de los retos con `whatsapp-web.js`. La arquitectura de auto-curación de estado (sesiones corruptas), los fallbacks para la resolución de números de teléfono (LID) y el control de procesos garantizan una muy alta disponibilidad apta para producción sin la necesidad de intervención manual frecuente.
