# Auditoría de Integraciones con APIs de Terceros

Este documento detalla las integraciones de terceros presentes en el sistema, evaluando su robustez y mecanismos de fallback ante fallos o interrupciones de red.

## 1. SmartLab (Grupo Óptico)
- **Método**: Web scraping automatizado utilizando Playwright (Chromium).
- **Ubicación**: `src/services/smartlab.service.ts`
- **Robustez y Fallbacks**:
  - **Manejo de Concurrencia**: Implementa un flag local (`isSyncing`) para evitar ejecuciones simultáneas y solapadas del proceso de scraping.
  - **Rate Limiting**: Verifica la base de datos (`smartLabLastSync`) para evitar que las ejecuciones se realicen con una frecuencia excesiva (mínimo de 14 minutos entre procesos).
  - **Gestión de Recursos**: Utiliza un bloque `try...finally` que asegura el cierre del navegador virtual (`browser.close()`), previniendo fugas de memoria, incluso si el proceso aborta por un error.
  - **Ausencia de Reintentos Críticos**: Al no ser una API REST, depende de la carga del DOM. Carece de un sistema de reintentos automáticos (Retries) frente a problemas de red durante la navegación. Si la página no carga a tiempo (timeout) o los selectores no se encuentran de forma inmediata, el script falla directamente.

## 2. Facturación Electrónica (ARCA / AFIP)
- **Método**: Consumo de webservices SOAP de AFIP mediante la librería `@afipsdk/afip.js`.
- **Ubicación**: `src/lib/afip.ts` y `src/services/billing.service.ts`
- **Robustez y Fallbacks**:
  - **Reintentos Inteligentes (Backoff)**: Cuenta con la función `retryWithBackoff` que reintenta las llamadas fallidas hasta 3 veces utilizando demoras exponenciales frente a problemas o cuellos de botella de red hacia los servidores de AFIP.
  - **Filtro de Errores Fatales**: La lógica del backoff discrimina inteligentemente entre errores de red (reintentables) y errores de validación duros como `CUIT inválido` o `Punto de Venta erróneo` (no reintentables), optimizando el tiempo de respuesta.
  - **Recuperación Ante Desconexión (Fallback Fuerte)**: Si falla la conexión durante la emisión de una factura y no se recibe respuesta de AFIP, en el siguiente intento el sistema consulta el último comprobante autorizado y sus detalles (`getLastVoucher`, `getVoucherInfo`). Si coincide con la solicitud pendiente, se asume como exitoso y se previene la emisión duplicada. Esta integración es la más robusta de todo el sistema.

## 3. Inteligencia Artificial (Google Vertex AI / Gemini)
- **Método**: Uso de los SDKs oficiales `@langchain/google-vertexai-web` y `@google/genai`.
- **Ubicación**: `src/services/receipt-agent.service.ts` y `src/services/social-content.service.ts`
- **Robustez y Fallbacks**:
  - **Gestor Global (`ai-error-handler.ts`)**: Detecta específicamente errores tipo HTTP 429 (`RESOURCE_EXHAUSTED` o límite de cuota).
  - **Alertas Proactivas**: Cuando se detecta falta de créditos, el sistema detiene graciosamente el proceso y envía alertas automáticas vía Correo Electrónico y WhatsApp al administrador antes de propagar la excepción, informando la necesidad de recargar saldo.
  - **Validación Estricta**: Para el servicio de OCR (agente de recibos), la respuesta JSON se envuelve en control de excepciones. Además, se aplican revisiones posteriores en base de datos para detectar y prevenir operaciones duplicadas antes de volcar lo que la IA extrajo.

## 4. WhatsApp Bot API
- **Método**: Solicitudes HTTP (mediante capa wrapper `fetchWa`) a un microservicio de WhatsApp alojado (vía `WA_SERVER_URL`).
- **Ubicación**: `src/lib/wa-config.ts` y `src/services/contact.service.ts`
- **Robustez y Fallbacks**:
  - **Gestión de Respuestas Fallidas**: Tras invocar `/api/send`, se evalúa `resClient.ok`. Si falla el envío (ej: el cliente no posee cuenta de WhatsApp), el sistema crea un registro tipo `ERROR` en la base de datos del contacto y redirige una copia de advertencia a la cuenta de WhatsApp del administrador.
  - **Ausencia de Retries en Capa Transporte**: Aunque gestiona el caso de uso del error funcional (número incorrecto), no implementa backoff ni reintentos automáticos para lidiar con caídas breves (502 o 503) del microservicio de mensajería.

## 5. Correo Electrónico (Nodemailer)
- **Método**: SMTP autenticado vía Nodemailer (hacia servidores de Gmail).
- **Ubicación**: `src/lib/email.ts`
- **Robustez y Fallbacks**:
  - **Manejo Simple**: Operación protegida por un bloque `try-catch` que retorna `{ success: false, error }` de manera síncrona, pero sin colas de reintento ni encolamiento en caso de fallos transitorios en la red.

## Conclusión
El código backend presenta un buen blindaje en aquellas integraciones críticas para el negocio (emisión de facturas a ARCA y costos de IA), mediante recuperaciones de estado y backoffs. Como mejora a futuro, sería recomendable:
1. Implementar `retryWithBackoff` en el wrapper de `fetchWa` para mayor estabilidad en el envío de mensajes ante intermitencias del bot.
2. Incorporar un mecanismo de recarga y reintento en el script de scraping de **SmartLab**, al menos para el ciclo de login y carga inicial de la tabla.
