# Auditoría de Integraciones de Terceros (Third-Party APIs)

Este documento detalla todas las integraciones de sistemas externos, APIs de terceros y servicios utilizados por la plataforma de Atelier Óptica, documentando sus propósitos, mecanismos técnicos y ubicaciones en el código fuente.

## 1. SmartLab (Grupo Óptico)
- **Propósito:** Sincronización del estado de pedidos de laboratorio enviados a Grupo Óptico (progreso, sector, fecha de ingreso, días en proceso).
- **Mecanismo Técnico:** Debido a la falta de una API pública de SmartLab, se utiliza **Web Scraping**. Un script levanta una instancia *headless* de Chromium usando **Playwright**, inicia sesión en el portal de SmartLab (`https://grupooptico.dyndns.info/smartlab/...`), busca los números de pedidos activos y extrae el estado de progreso leyendo el DOM (barras de progreso y tablas).
- **Ubicación:** `src/services/smartlab.service.ts`, `src/app/api/smartlab-sync/route.ts`

## 2. AFIP / ARCA (Facturación Electrónica)
- **Propósito:** Emisión de facturas electrónicas (Factura C) autorizadas por la entidad fiscal argentina.
- **Mecanismo Técnico:** Se integra a través de la librería `@afipsdk/afip.js`. El sistema soporta multi-cuenta (múltiples Monotributos, ej. cuenta "ISH" y "YANI"), conectándose vía Web Services de AFIP con Tokens de Acceso, Certificados `.crt` y Claves Privadas `.key`. También utiliza plantillas del SDK de AFIP para generar los PDFs de las facturas con su CAE correspondiente.
- **Ubicación:** `src/services/billing.service.ts`, `src/lib/afip.ts`

## 3. WhatsApp (Bot y Notificaciones)
- **Propósito:** 
  - Notificaciones automatizadas a clientes (ej. "Pedido Listo para Retirar" con saldos pendientes).
  - Envío de *vCards* (Contactos) al celular del local para facilitar el agendado rápido.
- **Mecanismo Técnico:** La comunicación con WhatsApp no utiliza la API oficial de Meta para empresas, sino que se apoya en un servicio interno (probablemente basado en `whatsapp-web.js`) expuesto mediante un proxy REST (`/api/send`, `/api/status`). La función `fetchWa` realiza peticiones a este microservicio para encolar y enviar mensajes.
- **Ubicación:** `src/services/bot.service.ts`, `src/services/google-contacts.service.ts`, `src/lib/wa-config.ts`

## 4. Meta Conversions API (CAPI)
- **Propósito:** Envío de eventos de conversión offline (ej. compras físicas en la tienda o por la plataforma) para optimizar campañas publicitarias en Facebook e Instagram.
- **Mecanismo Técnico:** Integración directa mediante peticiones POST a la API Graph de Meta (`https://graph.facebook.com/v19.0/{pixelId}/events`). Se aplican prácticas de privacidad hasheando previamente con **SHA-256** los datos sensibles de los clientes (email, teléfono normalizado) antes de mandarlos al servidor de Meta.
- **Ubicación:** `src/services/ads.service.ts`

## 5. Google Vertex AI / Gemini (Inteligencia Artificial)
- **Propósito:** 
  - Extraer y resumir hitos clave de largas conversaciones de WhatsApp.
  - Generar *copies* atractivos para redes sociales (Instagram, Facebook) y prompts de imágenes a partir de productos y posteos de blog.
  - Generar imágenes fotorealistas de estética premium y de producto a través de Imagen 3.0.
- **Mecanismo Técnico:** Se utilizan múltiples librerías de IA: `@langchain/google-vertexai-web` y `@langchain/google-genai` integrando los modelos **Gemini 2.5 Flash** para NLP y **Imagen-3.0** para la síntesis de imágenes.
- **Ubicación:** `src/services/bot.service.ts`, `src/services/social-content.service.ts`

## 6. Firebase Cloud Storage
- **Propósito:** Almacenamiento seguro de archivos estáticos pesados o privados (ej. PDFs de facturas generadas, imágenes generadas por IA para redes sociales).
- **Mecanismo Técnico:** Integrado mediante `firebase-admin`. Configurado vía variables de entorno (`projectId`, `clientEmail`, `privateKey`). Cuenta con *fallbacks* para almacenar archivos en local (`storage/uploads`) durante el ambiente de desarrollo si la nube no está configurada.
- **Ubicación:** `src/lib/storage.ts`

## 7. Google Maps / Places API
- **Propósito:** Mostrar las reseñas más recientes y la calificación pública de Atelier Óptica en el sitio web (Frontend).
- **Mecanismo Técnico:** Peticiones REST HTTP. Integra soporte tanto para la API *Legacy* (vía `/maps/api/place/details/json`) como para la *New Places API* (vía `v1/places/{placeId}`). Incluye un modo de *fallback* si ninguna de las APIs está disponible o si fallan las llaves.
- **Ubicación:** `src/lib/googleReviews.ts`

## 8. Gmail SMTP
- **Propósito:** Envío de correos electrónicos transaccionales a clientes.
- **Mecanismo Técnico:** Utiliza `nodemailer` para configurar un transportador (transporter) estándar con el servicio `gmail`, autenticándose vía SMTP.
- **Ubicación:** `src/lib/email.ts`

---
*Reporte generado a partir del análisis del código fuente. Las integraciones están diseñadas bajo el principio de resiliencia, aplicando backoffs y fallbacks locales cuando es posible.*
