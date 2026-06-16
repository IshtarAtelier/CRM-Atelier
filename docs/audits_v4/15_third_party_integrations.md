# Auditoría de Integraciones de Terceros (Third-Party APIs) - v4

Este documento detalla todas las integraciones de sistemas externos, APIs de terceros y servicios utilizados por la plataforma de Atelier Óptica, documentando sus propósitos, mecanismos técnicos y ubicaciones en el código fuente.

## 1. SmartLab (Grupo Óptico)
- **Propósito:** Sincronización del estado de pedidos de laboratorio enviados a Grupo Óptico (progreso, sector, fecha de ingreso, días en proceso) y pre-carga (creación de borradores) de pedidos en el portal.
- **Mecanismo Técnico:** Debido a la falta de una API pública completa de SmartLab para consultar estados, se utiliza **Web Scraping**. Un script levanta una instancia *headless* de Chromium usando **Playwright**, inicia sesión en el portal de SmartLab (`https://grupooptico.dyndns.info/smartlab/...`), busca los números de pedidos activos y extrae el estado de progreso leyendo el DOM (barras de progreso y tablas). Para la creación de pedidos, el sistema se comunica con una API interna (`smartlab-api-v2`) usando peticiones POST autenticadas con la sesión iniciada previamente vía web scraping.
- **Ubicación:** `src/services/smartlab.service.ts`, `src/app/api/smartlab-sync/route.ts`, `src/app/api/smartlab-submit/route.ts`, `src/app/api/cron/smartlab-sync/route.ts`

## 2. Payway (Prisma Medios de Pago / Decidir)
- **Propósito:** Procesamiento de pagos (Checkout) vía tarjeta de crédito o débito para compras en la tienda web y facturación.
- **Mecanismo Técnico:** Peticiones HTTP directas (`fetch`) a la API de Payway (`https://api.decidir.com/api/v2/payments`), autenticadas mediante el envío de un `apikey` (Clave Privada) en los headers. Al procesarse un pago exitoso, el sistema actualiza automáticamente el estado de la orden en la base de datos a confirmada.
- **Ubicación:** `src/app/api/checkout/payway/route.ts`

## 3. AFIP / ARCA (Facturación Electrónica)
- **Propósito:** Emisión de facturas electrónicas (Factura C) autorizadas por la entidad fiscal argentina.
- **Mecanismo Técnico:** Se integra a través de la librería `@afipsdk/afip.js`. El sistema soporta multi-cuenta (múltiples Monotributos, ej. cuenta "ISH" y "YANI"), conectándose vía Web Services de AFIP con Tokens de Acceso, Certificados `.crt` y Claves Privadas `.key`. También utiliza plantillas del SDK de AFIP para generar los PDFs de las facturas con su CAE correspondiente.
- **Ubicación:** `src/services/billing.service.ts`, `src/lib/afip.ts`

## 4. WhatsApp (Bot y Notificaciones)
- **Propósito:** 
  - Notificaciones automatizadas a clientes (ej. "Pedido Listo para Retirar" con saldos pendientes).
  - Envío de *vCards* (Contactos) al celular del local para facilitar el agendado rápido.
- **Mecanismo Técnico:** La comunicación con WhatsApp se apoya en un servicio interno (ubicado en `wa-service`, basado en `whatsapp-web.js`) expuesto mediante un proxy REST (`/api/whatsapp/send`, etc.). Se realizan peticiones HTTP a este microservicio para encolar y enviar mensajes y contactos.
- **Ubicación:** `src/services/bot.service.ts`, `wa-service/`

## 5. Meta Conversions API (CAPI)
- **Propósito:** Envío de eventos de conversión offline (ej. compras físicas en la tienda o por la plataforma) para optimizar campañas publicitarias en Facebook e Instagram.
- **Mecanismo Técnico:** Integración directa mediante peticiones POST a la API Graph de Meta (`https://graph.facebook.com/v19.0/{pixelId}/events`). Se aplican prácticas de privacidad hasheando previamente con **SHA-256** los datos sensibles de los clientes (email, teléfono normalizado) antes de mandarlos al servidor de Meta.
- **Ubicación:** `src/services/ads.service.ts`

## 6. Google Vertex AI / Gemini (Inteligencia Artificial)
- **Propósito:** 
  - Extraer y resumir hitos clave de largas conversaciones de WhatsApp.
  - Generar *copies* atractivos para redes sociales (Instagram, Facebook) y prompts de imágenes a partir de productos y posteos de blog.
  - Generar imágenes fotorealistas de estética premium y de producto a través de Imagen 3.0.
- **Mecanismo Técnico:** Se utilizan múltiples librerías de IA: `@langchain/google-vertexai-web`, `@langchain/google-genai` y `@google/genai` integrando los modelos **Gemini 2.5 Flash** para NLP y **Imagen-3.0** para la síntesis de imágenes.
- **Ubicación:** `src/services/bot.service.ts`, `src/services/social-content.service.ts`, `src/services/blog-agent.service.ts`

## 7. Firebase Cloud Storage & AWS S3
- **Propósito:** Almacenamiento seguro de archivos estáticos pesados o privados (ej. PDFs de facturas generadas, recibos, imágenes de productos, imágenes generadas por IA para redes sociales).
- **Mecanismo Técnico:** Integrado principalmente mediante `firebase-admin` o `@aws-sdk/client-s3` para gestión en la nube (Google Cloud Storage / AWS S3 dependiente del entorno). Cuenta con *fallbacks* para almacenar archivos en local (`storage/uploads` o `public/`) durante el ambiente de desarrollo si la nube no está configurada.
- **Ubicación:** `src/lib/storage.ts`

## 8. Google Maps / Places API
- **Propósito:** Mostrar las reseñas más recientes y la calificación pública de Atelier Óptica en el sitio web (Frontend).
- **Mecanismo Técnico:** Peticiones REST HTTP. Integra soporte tanto para la API *Legacy* (vía `/maps/api/place/details/json`) como para la *New Places API* (vía `v1/places/{placeId}`). Incluye un modo de *fallback* si ninguna de las APIs está disponible o si fallan las llaves.
- **Ubicación:** `src/lib/googleReviews.ts`

## 9. Gmail SMTP
- **Propósito:** Envío de correos electrónicos transaccionales a clientes (ej. comprobantes de compra, notificaciones, alertas de errores de sincronización).
- **Mecanismo Técnico:** Utiliza `nodemailer` para configurar un transportador (transporter) estándar con el servicio `gmail`, autenticándose vía SMTP.
- **Ubicación:** `src/lib/email.ts`

---
*Reporte de auditoría generado v4. Las integraciones están diseñadas bajo el principio de resiliencia, aplicando backoffs y fallbacks locales cuando es posible.*
