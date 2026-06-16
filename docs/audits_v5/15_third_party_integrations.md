# Auditoría de Integraciones con APIs de Terceros

Este documento detalla las integraciones actuales del ecosistema de Atelier Óptica con sistemas y APIs externas, especificando su funcionamiento, ubicación en el código y riesgos asociados.

## 1. Smartlab (Grupo Óptico)
- **Tipo de Integración:** Web Scraping (Playwright / Navegador Headless).
- **Ubicación:** `src/services/smartlab.service.ts` y trabajos recurrentes en `src/app/api/cron/smartlab-sync/route.ts`.
- **Propósito:** Sincronizar automáticamente el estado (progreso y sector) de los pedidos de laboratorio desde el portal de Grupo Óptico hacia el CRM.
- **Mecanismo:** El sistema inicia una instancia oculta de Chromium, navega a la URL `https://grupooptico.dyndns.info/smartlab/laboratory/list`, se autentica introduciendo credenciales en el formulario de inicio de sesión, busca órdenes mediante el `labOrderNumber` y extrae datos leyendo el HTML (como la barra de progreso y el texto de la tabla). Al finalizar, actualiza Prisma DB y genera notificaciones internas.
- **Riesgos y Fragilidad:** **Alto**. Al no utilizar una API oficial estructurada, esta integración es sumamente susceptible a romperse si el proveedor (Smartlab) realiza el más mínimo cambio en el diseño web (clases CSS, estructura de tablas, flujos de login). Se recomienda firmemente contactar al proveedor para solicitar acceso a endpoints REST o SOAP oficiales.

## 2. AFIP / ARCA
- **Tipo de Integración:** SDK Oficial (`@afipsdk/afip.js`).
- **Ubicación:** `src/lib/afip.ts` y rutas de facturación.
- **Propósito:** Emisión y consulta de Facturas Electrónicas homologadas por el ente fiscal.
- **Mecanismo:** El sistema maneja múltiples cuentas (por ej. diferentes monotributos según el método de pago elegido). Se autentica contra los Web Services de AFIP utilizando certificados digitales (`.crt`), claves privadas (`.key`) y Access Tokens generados previamente.
- **Riesgos:** Medio. Requiere atención manual ante el vencimiento inminente de los certificados digitales. Además, depende del "uptime" general de los servidores de AFIP, que pueden experimentar caídas técnicas.

## 3. Payway (Prisma Medios de Pago)
- **Tipo de Integración:** REST API Directa (Decidir v2).
- **Ubicación:** `src/app/api/checkout/payway/route.ts` y componentes de checkout web.
- **Propósito:** Procesamiento en línea de pagos con tarjeta de crédito/débito en la plataforma e-commerce (Storefront) o vía links de pago del CRM.
- **Mecanismo:** Autenticación vía keys de entorno (`PAYWAY_PUBLIC_KEY` y `PAYWAY_PRIVATE_KEY`). El frontend de la aplicación tokeniza la tarjeta en el navegador de manera segura y envía el `paymentToken` y `bin` al backend. El backend luego ejecuta una llamada HTTP a `live.decidir.com/api/v2/payments` para asentar el cobro. El sistema maneja inteligentemente la liberación de stock reservado si el pago es rechazado.
- **Riesgos:** Bajo-Medio (estándar de industria). La implementación actual cumple con normativas básicas (no guarda los datos de tarjeta en el servidor) y las llamadas están cifradas.

## 4. WhatsApp Web (Servicio Multi-Agente)
- **Tipo de Integración:** Cliente No Oficial (`whatsapp-web.js`).
- **Ubicación:** Proyecto satélite `wa-service/` (ej. `/wa-service/whatsapp/client.js`).
- **Propósito:** Proveer el canal de atención al cliente principal, operando como un bot automatizado que clasifica consultas, cotiza productos del CRM y asiste en ventas.
- **Mecanismo:** En lugar de la Cloud API, usa una estrategia de inyección en WhatsApp Web mediante un navegador Puppeteer. El usuario escanea un código QR generado en terminal para vincular el teléfono físico.
- **Riesgos:** **Alto**. Al ser una librería no autorizada por Meta, la cuenta de teléfono corre el riesgo de suspensiones si se detecta comportamiento masivo anómalo. Técnicamente, las sesiones de navegador suelen corromperse o desvincularse periódicamente. Aunque se observan mecanismos de "auto-sanación" (eliminación de sesiones corruptas y rutinas de keep-alive en `client.js`), sigue siendo el punto más inestable.

## 5. Meta Ads (Conversions API - CAPI)
- **Tipo de Integración:** REST API (Facebook Graph API).
- **Ubicación:** `src/services/ads.service.ts` y rutas de dashboard de marketing.
- **Propósito:** Enviar eventos de conversiones offline (ventas concretadas) al Pixel publicitario de Meta para mejorar el rendimiento de los anuncios (ROAS).
- **Mecanismo:** Recolecta datos del cliente de la base de datos (nombre, email, teléfono), les aplica un cifrado unidireccional SHA-256 por motivos de privacidad, y despacha un HTTP POST hacia Meta autenticado con `META_ACCESS_TOKEN`.
- **Riesgos:** Bajo. El código está diseñado como un proceso auxiliar que no bloquea la creación del pedido si falla (fallo silencioso).

## 6. Motores de IA (Google Gemini / Vertex / LangChain)
- **Tipo de Integración:** SDK y API.
- **Ubicación:** `wa-service/package.json` y agentes.
- **Propósito:** Comprensión de lenguaje natural y toma de decisiones para el bot de WhatsApp.
- **Mecanismo:** Integraciones vía `@langchain/google-genai` usando `GOOGLE_GENAI_API_KEY`.
- **Riesgos:** Bajo. Dependiente de límites de cuota (rate limits) facturables del proveedor cloud.

---

### Conclusión y Recomendaciones Clave

La arquitectura general está bien acoplada y distribuye lógicamente las responsabilidades en servicios individuales. Sin embargo, hay dos "Single Points of Failure" vinculados al enfoque "no-oficial" en dos canales importantes:
1. **Smartlab:** El uso de scraping genera deuda técnica activa que requerirá mantenimiento constante frente a cualquier actualización visual del laboratorio. **Acción requerida:** Contactar a soporte IT de Grupo Óptico por una API.
2. **WhatsApp:** El bot depende de la salud de un proceso en navegador Chromium virtualizado. **Acción a futuro:** Migrar progresivamente la línea de atención al cliente a WhatsApp Cloud API (la vía oficial), sacrificando funciones no oficiales por una estabilidad absoluta (100% de SLA).
