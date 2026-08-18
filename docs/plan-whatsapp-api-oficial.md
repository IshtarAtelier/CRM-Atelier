# Plan: WhatsApp por la API oficial de Meta (Cloud API), sin automatización oculta

Escrito el 18/8/2026, con la cuenta @atelieroptica_ bajo observación de Meta
(aviso del 15/8, ver `auditoria-automatizaciones-meta-15ago2026`). Objetivo:
que la óptica hable con sus clientes por WhatsApp de una forma que Meta
**permite y ve como legítima**, y que nada de lo que hoy sale del número
+54 9 351 868-5644 pueda leerse como "bot enganchado a WhatsApp Web".

El número mayorista (+54 9 3541 21-5971) queda **fuera** de este plan por ahora.

---

## 0. Qué tenemos hoy (diagnóstico, verificado en el código el 18/8)

| Cosa | Cómo es hoy | Por qué es un problema |
|---|---|---|
| Conexión | `wa-service/` usa **whatsapp-web.js** (WhatsApp Web + Chromium headless, sesión por QR en un volumen de Railway). Fork pinneado `lindionez/whatsapp-web.js@92f443fb`. | Es exactamente lo que los Términos de WhatsApp prohíben (cliente no oficial / automatización de una cuenta personal). Un baneo del número es unilateral y sin apelación efectiva. |
| Bot de ventas IA | LangGraph + Gemini 2.5 Flash contesta a clientes nuevos como "Matías" (`wa-service/graph.js`, `prompts/salesPrompt.js`); guardrail que **prohíbe revelar que es un bot** (`services/ai.service.js`). | Suplantar a un humano es lo que peor cae; y en la API oficial es directamente política: hay que identificar la automatización. |
| Seguimientos proactivos | 5 motores (`sales-followups`, `inactivity-followups`, `smart-task-executor`, `broadcast-followup.ts`, `send-cierres-followups.ts`) generan texto con IA y lo mandan por la cola anti-ban (120/día, 30/h, jitter, spintax, ventana 9-20). | Toda esa maquinaria (spintax, jitter, "Cold Contact Shield") existe **para no parecer bot**. En la API oficial no hace falta y no sirve: fuera de la ventana de 24 h solo entran plantillas aprobadas. |
| Avisos internos | El bot le escribía a la dueña por WhatsApp (breaker, factura, reclamo, "sin clave", etiqueta aplicada, error persistente, vCard de cada venta). | Tráfico robótico visible desde el mismo número. **Apagado el 18/8** (commits de hoy: todo pasa a email). |
| Disparo por etiqueta | Etiquetar "Seguimiento 1/2", "Frío" en la ficha creaba una tarea vencida y le pegaba a `/api/followups/trigger` para mandar al toque. | Un click en el CRM = mensaje generado por IA a un cliente. **Eliminado el 18/8** (`contact.service.ts`). |
| Buzón del CRM | `/admin/whatsapp` lee/escribe `WhatsAppChat` / `WhatsAppMessage` vía el wa-service (REST + socket.io). | Esto **se conserva**: la UI y los modelos son agnósticos del transporte. |
| Mensajes a clientes desde flujos | Pedido listo, presupuesto (texto/PDF), confirmación de venta, comprobante de pago, envío/tracking, cambio de estado de lab. Todos `[NEG]` (iniciados por el negocio). | En la API oficial cada uno tiene que ser una **plantilla de utilidad aprobada** cuando pasaron >24 h del último mensaje del cliente. |

Lo que NO existe hoy: ninguna línea de código contra
`graph.facebook.com/…/messages`, ningún webhook `hub.challenge`, ninguna
plantilla. Arrancamos de cero en la parte oficial, pero con toda la capa de
negocio (buzón, fichas, PDFs, textos) reutilizable.

---

## 1. Decisiones (para no debatirlas dos veces)

1. **Cloud API directa de Meta**, no un BSP (Twilio, 360dialog, etc.). Meta
   aloja la API sin cargo; se paga solo por mensaje. Ya hay Business
   Portfolio, app y system user en Meta: es sumar un activo, no empezar de cero.
2. **El número de la tienda (351 868-5644) migra a la Cloud API.** Un número
   está en la app de WhatsApp *o* en la API — no en las dos (la función
   "coexistencia" existe pero es limitada y hay que verificar disponibilidad;
   no contar con ella). Consecuencia: **el celular del local deja de tener
   WhatsApp con ese número**; se atiende desde el buzón del CRM (que ya es lo
   que hace el staff). Alternativa si eso no cierra: número nuevo para la API
   y el viejo sigue en el celular a mano, sin bot — más simple para Meta,
   peor para los clientes que ya tienen el número guardado.
3. **"No automatizada" significa: sin bot que finja ser persona y sin
   seguimientos generados por IA.** Lo que sí queda automatizado y es
   legítimo en la API oficial: notificaciones transaccionales por plantilla
   (tu pedido está listo, tu presupuesto, tu comprobante). Un
   auto-respondedor fuera de horario o un menú de opciones se puede sumar
   después, identificado como automático.
4. **El wa-service no se reescribe: se le cambia el transporte.** La capa
   `whatsapp/client.js` + `anti-ban.js` se reemplaza por un adaptador Cloud
   API; el resto (Prisma, socket.io, buzón, `/api/send`) sigue igual. Todo lo
   de IA (grafo, followups, extractor pasivo, transcriptor) se **desconecta**
   y queda en el repo hasta que se decida qué vuelve como plantilla.
5. **Nunca sin OK explícito**: vincular/desvincular el número, crear el activo
   en Meta, pedir plantillas y prender el webhook en producción son pasos que
   se hacen de a uno, con la dueña adelante (regla PARTE 0 de
   `buenas-practicas-meta-google.md`).

---

## 2. Cómo funciona la Cloud API (lo que hay que saber para decidir)

- **Ventana de 24 h**: si el cliente escribió en las últimas 24 h, se le puede
  mandar texto libre, fotos, PDF, lo que sea ("service"). Pasadas 24 h, **solo
  plantillas** aprobadas por Meta (utility / marketing / authentication).
- **Plantillas**: texto con variables `{{1}}`, opcionalmente header (imagen /
  documento), botones (URL, "responder", llamar). Se cargan en el WhatsApp
  Manager, Meta las aprueba (minutos a 24 h). Las de *utilidad* (pedido listo,
  comprobante) son baratas y casi siempre se aprueban; las de *marketing*
  (promo, "te esperamos") cuestan más y el cliente puede bloquear.
- **Costo** (Argentina, orientativo — confirmar en la tabla oficial al armar
  el presupuesto): utilidad ≈ US$ 0,03–0,04, marketing ≈ US$ 0,06 por
  mensaje; las respuestas dentro de la ventana de 24 h no se cobran (y las de
  utilidad dentro de la ventana tampoco). Con el volumen de la óptica (decenas
  de avisos por día) son **pocos dólares al mes**. Se paga con la misma
  cuenta/tarjeta del Business Manager.
- **Límite de conversaciones iniciadas por el negocio**: 250 destinatarios
  únicos / 24 h hasta verificar el negocio; después 1 000 y sube solo con buen
  uso. La verificación del negocio (CUIT, constancia, dominio) conviene
  hacerla desde el día 1.
- **Nombre para mostrar** (display name): "Atelier Óptica" tiene que coincidir
  con lo público (web, IG). Meta lo aprueba.
- **Calidad**: cada número tiene un rating (verde/amarillo/rojo) que baja con
  bloqueos y reportes. Es la métrica a mirar; los proactivos por IA de hoy
  son justo lo que la hunde.
- **Webhook**: Meta hace POST a una URL HTTPS nuestra con cada mensaje
  entrante y con los estados (enviado / entregado / leído / fallido). Antes
  hay una verificación `GET ?hub.mode=subscribe&hub.verify_token=…&hub.challenge=…`.
- **Credenciales**: token de **system user** con permisos
  `whatsapp_business_messaging` + `whatsapp_business_management`, IDs del
  WABA y del `phone_number_id`, y `META_APP_SECRET` para verificar la firma
  `X-Hub-Signature-256` del webhook. **Ninguno de los tokens actuales sirve**
  (`META_SYSTEM_USER_TOKEN` es de contenido, `META_ADS_TOKEN` de Ads).
- **Medios**: para mandar un PDF/imagen, primero se sube a `/{phone_number_id}/media`
  (o se pasa una URL pública) y se manda por id. Los medios entrantes se
  descargan con el token, dentro de las horas siguientes.
- **Formato de destino**: E.164 sin `+` (`5493518685644`) — sin `@c.us`,
  sin `@lid`. Los ids `@lid` desaparecen; el `waId` de la tabla pasa a ser
  el número.

---

## 3. Fases

### Fase 0 — Bajar el ruido YA (hecho / en curso, no requiere Meta)

Hecho hoy 18/8 en el código (dos commits, todavía sin deploy):
- Los 7 avisos WA del CRM a la dueña → email (`27ebd046`).
- Sacado el disparo por etiqueta (`contact.service.ts`), la vCard automática
  por venta (`order.service.ts`), y los avisos del bot al admin en el
  wa-service (breaker, advertencia anti-ban, error persistente, atención
  humana, factura, reclamo, sin clave, etiqueta con `notifyPhone`) → email.

Falta, y es **de la dueña desde /admin/whatsapp** (dos interruptores, sin
deploy, efecto inmediato):
- **"Seguimientos automáticos" → apagar** (`followups_enabled=false`). Frena
  los 3 crons del wa-service, el broadcast y el trigger manual (fail-closed).
- **"Asistente IA" → apagar** (`bot_enabled=false`). El bot deja de contestar;
  el buzón sigue recibiendo y el staff contesta a mano.

Con eso el número solo emite lo que un humano escribe desde el buzón y los
avisos transaccionales a clientes (pedido listo, comprobante, presupuesto).
Esos últimos se pueden dejar: son mensajes de utilidad a clientes que ya
hablaron con la óptica. Si se quiere silencio total hasta migrar, se apagan
en `bot.service.ts` / `sale-confirmation.ts` con un flag — decisión de la dueña.

También hoy: **deployar los dos commits** (OK explícito), y **verificar que
`~/proyectos/whatsapp-agent` (Baileys) esté muerto y el dispositivo
desvinculado** — es el otro cliente no oficial de la casa.

### Fase 1 — Alta del activo en Meta (dueña + acompañamiento, ~1-2 días de espera)

Todo en el Business Manager, un paso por vez (regla de estilo). El orden:

1. `business.facebook.com` → Configuración → **Cuentas de WhatsApp** → Agregar
   → crear la **WhatsApp Business Account (WABA)** dentro del portfolio de
   Atelier. (Sin número todavía.)
2. Aprobar el **nombre para mostrar** "Atelier Óptica" y cargar categoría
   (Salud / Óptica), descripción, dirección, web, foto de perfil.
3. **Verificación del negocio** (Seguridad → Verificación de la empresa):
   constancia de CUIT/AFIP + dominio `atelieroptica.com.ar`. Tarda 1-3 días.
   Se puede seguir con lo demás mientras.
4. En `developers.facebook.com`, en la app existente "Atelier Optica Contenido"
   (o una nueva "Atelier WhatsApp" — recomendado, así los permisos no se
   mezclan) → Agregar producto **WhatsApp**. Elegir la WABA del paso 1.
5. **System user** (Configuración → Usuarios del sistema): asignarle la WABA
   con control total y generar un token **sin vencimiento** con
   `whatsapp_business_messaging` y `whatsapp_business_management`. Se guarda
   directo en Railway como `WA_CLOUD_TOKEN`; no se pega en ningún chat ni doc.
6. Cargar en Railway (servicio del bot): `WA_CLOUD_TOKEN`, `WA_CLOUD_WABA_ID`,
   `WA_CLOUD_PHONE_NUMBER_ID` (llega en la fase 3), `WA_CLOUD_VERIFY_TOKEN`
   (string aleatorio nuestro), `META_APP_SECRET` de la app elegida.
7. **Método de pago** de la WABA (Facturación de WhatsApp): sin esto no salen
   plantillas fuera de la ventana.

Nada de esto toca el número todavía. **Antes del paso 1: aviso en criollo y OK.**

### Fase 2 — Código: adaptador Cloud API en el wa-service (dev, ~1 semana)

Se hace en la rama `desarrollo`, testeado contra el **número de prueba** que
Meta regala con cada WABA (permite mandar a 5 números propios) — así se
prueba todo sin tocar el número real ni el celular del local.

Estructura:

```
wa-service/
  transport/
    cloud-api.js        ← sendText / sendMedia / sendTemplate / markRead / downloadMedia
                          (fetch a graph.facebook.com/v21.0/{phone_number_id}/messages)
    webhook.js          ← GET verificación hub.challenge, POST entrantes+estados,
                          verificación X-Hub-Signature-256 con META_APP_SECRET
  whatsapp/client.js    ← queda como transporte legacy detrás de WA_TRANSPORT=webjs
  index.js              ← WA_TRANSPORT=cloud|webjs elige; el resto igual
```

Trabajo concreto:
- **Enviar**: `POST /api/send` (`routes/api.js:334`) llama a `transport.send()`.
  Texto libre si el chat tiene `lastInboundAt` < 24 h; si no, la ruta
  devuelve `409 { needsTemplate: true }` y el CRM ofrece la plantilla
  correspondiente. La cola anti-ban desaparece; queda una cola simple con
  reintento por `429`/`5xx` (backoff largo, nunca ráfaga).
- **Recibir**: `POST /webhook/whatsapp` → mismo `handleMessage` de hoy pero
  con el payload de Meta normalizado a `{ waId, content, type, mediaUrl,
  waMessageId, senderName, timestamp }`. Los `statuses` actualizan
  `WhatsAppMessage.status` (sent/delivered/read/failed) — el buzón ya tiene
  la columna.
- **Medios**: descarga con token → subir al CRM (`/api/upload`) como hoy →
  `mediaUrl`. Para salientes con PDF, subir a `/media` y mandar por id.
- **Ids**: `waId` = número E.164. Migración de datos: para cada `WhatsAppChat`
  con `@c.us`, `waId = número`; los `@lid` se resuelven por `realPhone` /
  `client.phone` y los que no se puedan se archivan (script en
  `scripts/maintenance/`, con dry-run).
- **Modelos**: sumar a `WhatsAppChat` `lastInboundAt DateTime?` (para la
  ventana de 24 h) y a `WhatsAppMessage` `templateName String?`. Migración
  Prisma commiteada.
- **Plantillas en el CRM**: tabla `WhatsAppTemplate` (name, language,
  category, status, variables) sincronizada desde
  `GET /{waba_id}/message_templates`; y en cada flujo `[NEG]` (pedido
  listo, presupuesto, comprobante, envío) reemplazar el texto libre por
  `sendTemplate(name, vars, mediaId?)`. Los textos actuales
  (`quote-message.ts`, `bot.service.ts`, `sale-confirmation.ts`) son la base
  para redactar las plantillas.
- **Desconectar la IA**: `WA_TRANSPORT=cloud` no carga el grafo ni los crons
  de followups (`index.js:2040-2115`), ni el extractor pasivo, ni el
  transcriptor. Quedan en el repo, apagados; borrarlos es otra decisión.
- **Buzón**: en `/admin/whatsapp` mostrar la ventana ("cliente escribió hace
  3 h" / "cerrada: solo plantilla") y el estado entregado/leído. Sacar el
  QR y el "conectar teléfono" del panel de configuración.
- **`/api/whatsapp/status`**: `connected` pasa a ser "token válido + número
  activo" (un `GET /{phone_number_id}` con el token).
- **Auth del webhook**: firma HMAC del body con `META_APP_SECRET`; sin firma
  válida, 401 y log. Es la única puerta pública nueva.

### Fase 3 — Plantillas (dueña redacta, se cargan por API o Manager)

Mínimo viable, todas categoría **utilidad**:

| Nombre | Uso | Variables |
|---|---|---|
| `pedido_listo` | reemplaza `notifyOrderReady` | nombre, nº pedido |
| `presupuesto_pdf` | reemplaza `send-quote` / `send-pdf` (header documento) | nombre, total |
| `comprobante_pago` | reemplaza el recibo de `contact.service.ts` (header documento) | nombre, importe |
| `pedido_enviado` | tracking (`order.service.ts:414`) | nombre, transporte, código |
| `venta_confirmada` | `sale-confirmation.ts` | nombre, nº pedido |
| `retomar_conversacion` | "Hola {{1}}, te escribimos de Atelier Óptica por tu consulta. ¿Seguimos?" — la ÚNICA proactiva humana: el staff la dispara desde el buzón para reabrir la ventana | nombre |

Redacción neutra, sin urgencia ni "gratis" (misma lista que ya bloquea
`validateContent`), sin implicar condiciones del lector (sección 3 de
`buenas-practicas-meta-google.md`). Se envían a aprobar **de a una o dos**,
no las seis juntas el mismo minuto.

### Fase 4 — Migrar el número (el paso irreversible; con OK y en horario tranquilo)

Secuencia exacta, para hacer con el celular del local en la mano:
1. Avisar al staff: durante ~1 h no entra WhatsApp en ese número.
2. **Backup**: exportar los chats del celular (Ajustes → Chats → Copia). El
   historial en el CRM ya está en Postgres; lo del teléfono no se pierde por
   la migración pero conviene tenerlo.
3. En el wa-service: **desvincular la sesión de WhatsApp Web** (borrar el
   volumen `wwebjs_auth` / "Dispositivos vinculados" en el celular → cerrar
   sesión). Deploy con `WA_TRANSPORT=cloud` ya listo pero el número aún no
   registrado — el buzón queda en solo lectura unos minutos.
4. En el celular: **eliminar la cuenta de WhatsApp Business** de ese número
   (Ajustes → Cuenta → Eliminar cuenta). Sí, hay que borrarla: si el número
   sigue registrado en la app, Meta no lo deja entrar a la API. (Si el número
   nunca estuvo en la app, se saltea.)
5. En el WhatsApp Manager → Números de teléfono → **Agregar número**
   +54 9 351 868-5644 → verificación por SMS o llamada al celular del local
   → código de 6 dígitos (**lo tipea la dueña**).
6. Registrar el número en la API: `POST /{phone_number_id}/register` con un
   PIN de 6 dígitos (verificación en dos pasos) — guardar el PIN.
7. Cargar `WA_CLOUD_PHONE_NUMBER_ID` en Railway → redeploy → en la app de
   Meta suscribir el webhook (`https://…up.railway.app/webhook/whatsapp` +
   `WA_CLOUD_VERIFY_TOKEN`) a los campos `messages`.
8. Prueba: mandarse un mensaje desde otro celular → aparece en el buzón →
   contestar desde el buzón → llega. Mandar una `pedido_listo` de prueba.
9. Recién ahí: apagar `WA_TRANSPORT=webjs`, borrar el volumen de sesión y
   `.wwebjs_auth` del repo, quitar Chromium del Dockerfile (baja el deploy
   de minutos a segundos).

### Fase 5 — Operar y observar (semanas 1-4)

- Panel: rating de calidad del número, plantillas rechazadas/pausadas,
  límite de conversaciones. Un cron diario que lea
  `GET /{phone_number_id}?fields=quality_rating,messaging_limit_tier` y
  avise por email si baja de GREEN (patrón de `social-cadencia`).
- Reglas para el staff: contestar dentro de las 24 h; si se cerró la ventana,
  `retomar_conversacion` y esperar; **nunca** varios mensajes seguidos a
  quien no responde.
- Al mes: revisar costo real vs. estimado y qué automatismos vale la pena
  volver a pedir (p. ej. respuesta automática fuera de horario, identificada
  como tal — permitido y bien visto).

---

## 4. Lo que se pierde y hay que aceptar

- **El bot vendedor "Matías" no vuelve como está.** Automatizar respuestas en
  la API oficial es legal, pero tiene que presentarse como asistente
  automático y ofrecer salida a un humano; el prompt actual hace lo
  contrario. Si algún día se quiere, es un rediseño, no un puerto.
- **Seguimientos generados por IA a quien no escribió: no.** Solo plantillas
  aprobadas, y las de marketing con opt-in y opción de baja.
- **El celular del local pierde ese WhatsApp** (o se usa número nuevo). El
  staff atiende desde el CRM — que ya es la práctica.
- **Los grupos** (aviso al grupo de ventas `120363321589178129@g.us`) no
  existen en la Cloud API. Ese aviso interno pasa a email/notificación del CRM.
- **Recibir audios y transcribirlos** sigue siendo posible (el medio llega
  por webhook), pero la transcripción con Gemini se re-conecta aparte si se
  quiere.

## 5. Riesgos y cómo se cubren

| Riesgo | Cobertura |
|---|---|
| Meta rechaza el nombre / la verificación | Empezar la Fase 1 hoy; nada de la Fase 2 depende de eso. |
| Migrar el número y que quede en el limbo | Número de prueba de Meta para todo el desarrollo; la migración real recién cuando el flujo completo funciona con el número de prueba. Ventana horaria fuera de atención. |
| Plantilla clave rechazada | Redactar en utilidad pura, sin promo; tener versión B. Enviar de a pocas. |
| Se pierden chats `@lid` sin teléfono | Script de migración con dry-run y listado de los que quedan sin resolver; se archivan, no se borran. |
| Token filtrado | Solo en Railway; ningún script lo imprime (misma regla que redes). Rotación desde el system user si hay dudas. |
| Volver atrás | Hasta el paso 4 de la Fase 4 se vuelve con `WA_TRANSPORT=webjs`. Después del paso 4, la vuelta es reinstalar la app y re-verificar el número (posible, tedioso). |

## 6. Orden de la próxima sesión

1. OK para **deployar** los dos commits de Fase 0.
2. La dueña apaga **Seguimientos automáticos** y **Asistente IA** en `/admin/whatsapp`.
3. Confirmar el `whatsapp-agent` de la Mac apagado y desvinculado.
4. Empezar Fase 1 paso 1 (crear la WABA), un paso por mensaje.
5. En paralelo, arrancar Fase 2 en `desarrollo` con el número de prueba.
