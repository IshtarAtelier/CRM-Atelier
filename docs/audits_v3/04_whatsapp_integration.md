# Auditoría de Integración de WhatsApp (whatsapp-web.js) - v3

**Fecha de Auditoría:** Junio 2026  
**Librería Principal:** `whatsapp-web.js` (v1.34.7)  

## 1. Arquitectura General y Configuración
*   **Modo Cliente Localizado (Headless):** Se utiliza `whatsapp-web.js` encapsulando una instancia de Puppeteer/Chromium de manera completamente invisible.
*   **Prevención de Cambios de Interfaz (WebVersionCache):** El servicio implementa el *bypass* de la caché utilizando un repositorio remoto para estabilizar la capa de inyección frente a las continuas actualizaciones de WhatsApp Web.
*   **Optimizaciones de Chromium:** Se declaran múltiples *flags* (`--no-sandbox`, `--disable-dev-shm-usage`, `--disable-gpu`, `--disable-web-security`, `--no-zygote`, etc.) cruciales para evitar el alto consumo de RAM y caídas en sistemas de orquestación limitados como Railway o Docker.

## 2. Manejo de Sesiones y Estabilidad Estructural
*   **Persistencia Híbrida (`LocalAuth`):** Adaptabilidad dinámica que evalúa de forma inteligente dónde almacenar los datos locales. Dependiendo del ambiente, usa rutas volátiles o el volumen persistente de Railway (`RAILWAY_VOLUME_MOUNT_PATH`).
*   **Manejo Zombis y Deadlocks:** En producción, justo antes de invocar la instancia, ejecuta `pkill -9 -f chromium` para purgar navegadores "zombis". A su vez, fuerza la eliminación de archivos de bloqueo internos (`SingletonLock`, `SingletonCookie`, `SingletonSocket`), protegiendo de cuelgues causados por caídas previas abruptas.
*   **Auto-Sanación contra Sesiones Corruptas:** Hay un control explícito que intenta parsear el archivo `Preferences` de Chromium, así como un validador contra el temido `Code: 21` (Bloqueo de perfil de Chromium). Si hay fallos de lectura o rechazo (`auth_failure`), la sesión se borra completamente, lo cual fuerza de forma limpia la readquisición por código QR sin que la máquina caiga en un bucle (*crash loop*).

## 3. Resiliencia, Control de Tiempos y Reconexión Automática
*   **Watchdog / Keep-Alive Constante:** Un monitor corre cada 3 minutos consultando `waClient.getState()`. Al acumular dos fallos consecutivos o *timeouts* críticos, decreta la instancia como muerta y fuerza el reciclaje de Chromium de manera automatizada.
*   **Envoltura con Timeouts (`withTimeout`):** Operaciones riesgosas que se comunican con el DOM de WhatsApp (envío de mensajes, consultas de estado, generación de `MessageMedia.fromUrl()`) están cubiertas por promesas temporales de gracia (15 a 30 segundos). Si la API no responde, se lanza una excepción controlada pero el flujo de Node no queda paralizado en promesas colgadas.
*   **Backoff de Reconexión:** Eventos como `disconnected` y caídas en la inicialización programan re-intentos de arranque con lapsos configurados (`RETRY_DELAY_MS`) para no atosigar de peticiones concurrentes a la CPU de la máquina.

## 4. Gestión de Clientes (LIDs), Conversaciones e IA
*   **Mapeo de Nuevos Identificadores (@lid):** La base incorpora un sistema escalonado en 4 capas para extraer el verdadero número de teléfono de los nuevos `LIDs` ofuscados. Llama a APIs como `getContactLidAndPhone` con reintentos y, si falla, avanza utilizando objetos secundarios como `Client.getFormattedNumber()`. Así evita la proliferación de IDs ilegibles en el CRM.
*   **Detección Quirúrgica de Intervención Humana (Handoff):** Existe un escuchador proactivo en `message_create`. Para evitar auto-desconexiones, distingue hábilmente entre un mensaje propio saliente del bot y uno de un humano evaluando el `Set` global `botReplyingTo`. Cuando el vendedor responde directamente en WhatsApp a un cliente, se desactiva en el acto la respuesta de Inteligencia Artificial (IA) para ese chat.
*   **Comandos Seguros / "Silenciosos":** Integración completa de Guardrails y controles de error en LangGraph/Gemini. Ante códigos 429 de cuotas límite, fallos de API o inyecciones detectadas en respuestas, el sistema corta la emisión al cliente, notifica por WebSockets al CRM e informa al administrador principal en silencio sin exponer datos técnicos.

## 5. Riesgos Actuales y Áreas de Mejora a Vigilar
*   **Media Cache Local en Memoria:** Actualmente, el uso de la variable en la capa de persistencia `global.mediaCache` para imágenes entrantes podría devenir en una eventual fuga de memoria (*memory leak*) de Node.js en picos prolongados de mensajes multimedia, ya que no se ve un recolector de basura automatizado o delegación al servidor S3/Buckets.
*   **Concurrencia en la Inicialización:** Aunque `isStarting` oficia como una bandera booleana para proteger inicializaciones múltiples de la instancia pesada de Chromium, bajo ciertos escenarios atípicos en operaciones asíncronas lentas esto podría abrir puertas a "race conditions", cargando la RAM excesivamente por una inicialización doble.
*   **Delegación Crítica en Repositorios Externos:** Depender explícitamente de un repositorio personal alojado en Github crudo para el Bypass (`https://raw.githubusercontent.com/.../BootstrapQr.html`) siempre conlleva el riesgo de que si el autor borra el *repo* o se queda desactualizado, el inicio de sesión colapse hasta actualizar la versión manualmente. Se recomendaría bajar ese bootstrap HTML a un directorio del mismo proyecto por seguridad futura.

---

**Conclusión Final:**  
El estado de la integración de **whatsapp-web.js** es excepcionalmente robusto para un entorno de producción exigente. Aborda proactivamente casi todos los problemas más duros de Puppeteer y Chromium "Headless" en servidores (Locks, Zombis, LIDs, Crash Loops). Si bien requiere vigilancia sobre el caché de medios y las dependencias externas (BootstrapQR), las estrategias de auto-sanación son maduras y otorgan muy alta estabilidad.
