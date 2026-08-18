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
| `pedido_listo` | reemplaza `notifyOrderReady` (A1) | nombre, nº pedido |
| `pedido_listo_saldo` | A12: listo + saldo por medio de pago | nombre, saldo tarjeta, transferencia, efectivo |
| `factura_electronica` | A11 (header documento) | nombre |
| `estado_pedido` | A13, solo fuera de 24 h | nombre, nº, estado |
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

## 3-bis. Inventario completo: todo lo que hoy sale por WhatsApp y qué le pasa

Relevado el 18/8/2026 sobre `src/`, `wa-service/`, `scripts/` y los crons.
Cada mensaje tiene nombre propio para poder hablar de él sin ambigüedad.
Leyenda de destino: **PLANTILLA** = sigue saliendo por la API oficial como
plantilla aprobada · **EMAIL** = pasa a email/CRM · **BUZÓN** = lo escribe un
humano desde `/admin/whatsapp` · **SE VA** = no vuelve.

### A. Mensajes a clientes (atención — se conservan)

| # | Nombre | Cuándo sale | Dónde vive hoy | Destino |
|---|---|---|---|---|
| A1 | **Pedido listo** | el lab termina el trabajo / botón "avisar" en la venta / recordatorio de retiro (cron `pickup-reminder`) | `orders/[id]/notify-ready/route.ts`, `bot.service.ts:216`, `cron/pickup-reminder/route.ts:89`, `copilot-tools.ts:412` | PLANTILLA `pedido_listo` (nombre, nº pedido; botón "Cómo llegar") |
| A2 | **Confirmación de compra** | se confirma una venta | `sale-confirmation.ts:419/443` (texto + PDF) | PLANTILLA `venta_confirmada` (nombre, nº, total; PDF de encabezado) |
| A3 | **Comprobante de pago** | se registra un pago | `contact.service.ts:2339/2408/2445` (texto + PDF + link de respaldo) | PLANTILLA `comprobante_pago` (nombre, importe; PDF de encabezado) |
| A4 | **Presupuesto (texto)** | botón "enviar presupuesto" | `orders/[id]/send-quote/route.ts:75`, texto en `quote-message.ts` | PLANTILLA `presupuesto_pdf` (nombre, total; PDF) — texto y PDF se unifican en un mensaje |
| A5 | **Presupuesto (PDF)** | botón "enviar PDF" | `orders/[id]/send-pdf/route.ts:132/202` | idem A4 |
| A6 | **Pedido enviado / tracking** | se carga el envío | `order.service.ts:414` | PLANTILLA `pedido_enviado` (nombre, transporte, código) |
| A7 | **Cambio de estado en laboratorio + PDF de la orden** | cambia `labStatus` | `order.service.ts:1162` | Se **funde con A1**: el cliente recibe solo "listo"; los estados intermedios no se le avisan (hoy es ruido) |
| A8 | **Confirmación "recibimos tu comprobante"** | el cliente manda una foto de transferencia | `wa-service/index.js:1838` (respuesta del bot) | BUZÓN (el staff contesta) — o, si se decide un auto-respondedor identificado, plantilla `comprobante_recibido` |
| A9 | **Respuestas del staff** | siempre | `api/whatsapp/send/route.ts` → `/api/send` | BUZÓN, texto libre dentro de 24 h; fuera de 24 h PLANTILLA `retomar_conversacion` |
| A10 | **Chat interno del equipo** (Matías/Ishtar por el CRM) | siempre | `api/equipo/mensajes/route.ts:51` | BUZÓN (es un chat más) |

| A11 | **Factura electrónica (PDF)** | botón en Facturación y en Ventas | `admin/facturacion/page.tsx:117`, `admin/ventas/page.tsx:354` (texto "te enviamos adjunta tu factura") | PLANTILLA `factura_electronica` (nombre; PDF de encabezado). **Mismo botón** |
| A12 | **Pedido listo con detalle de saldo** (tarjeta / transferencia / efectivo) | botón en Ventas cuando está READY o hay saldo | `admin/ventas/page.tsx:1706` | PLANTILLA `pedido_listo_saldo` (nombre, saldo tarjeta, transferencia, efectivo) — variante de A1. **Mismo botón** |
| A13 | **Pedido en proceso** (estado del lab + detalle) | botón en Pedidos | `admin/pedidos/page.tsx:442` | Dentro de 24 h: texto libre como hoy; fuera: PLANTILLA `estado_pedido` (nombre, nº, estado). **Mismo botón** |
| A14 | **Cotización desde el Cotizador** | botón "enviar por WhatsApp" del cotizador | `admin/cotizador/page.tsx:640` (manda por el bot; si falla abre `wa.me`) | PLANTILLA `presupuesto_pdf` (misma que A4) o texto libre dentro de 24 h. El fallback `wa.me` (abre el WhatsApp del celular) se **saca** — con la API el envío no falla por "sesión caída" |
| A15 | **Recuperación de carrito desde el panel de desarrollo** | botón manual | `admin/desarrollo/carritos/page.tsx:50` | Igual que A14 (texto libre / plantilla `retomar_conversacion`); fallback `wa.me` se saca |

### E. Botones y enlaces del sistema (la mecánica del staff — nada de esto se pierde)

Estos no mandan nada solos: **abren el buzón con el chat del cliente** (a veces
con un texto precargado que el staff revisa y manda). Con la API oficial siguen
funcionando igual; el buzón resuelve por debajo si va texto libre (24 h) o
plantilla.

| # | Nombre | Dónde | Qué hace | Después |
|---|---|---|---|---|
| E1 | **Ícono de WhatsApp en la ficha del cliente** (dos lugares) | `contacts/ContactHeader.tsx:100/213` | abre `/admin/whatsapp?phone=…` con el chat del cliente | Igual. Si el chat aún no existe se crea con el número (E.164) |
| E2 | **Tareas de la ficha → "escribirle"** | `contacts/TaskManager.tsx:168` | abre el buzón con texto precargado | Igual; si la ventana está cerrada el buzón ofrece `retomar_conversacion` |
| E3 | **Panel Tareas del dashboard** | `dashboard/TasksPanel.tsx:173` | idem | Igual |
| E4 | **Panel Oportunidades de cierre** | `dashboard/OpportunitiesPanel.tsx:106` | idem | Igual |
| E5 | **Panel Reseñas** (pedido de reseña, siempre manual) | `dashboard/ReviewRequestsPanel.tsx:103` | abre el buzón con el texto; **nunca automático** (regla de la casa) | Igual, sigue manual |
| E6 | **Tarjeta de lead → "abrir chat"** | `leads/LeadCard.tsx:172` | link a `/admin/whatsapp?chatId=…` | Igual (con número E.164 en vez de `@c.us`) |
| E7 | **Buzón `/admin/whatsapp` con `?phone=&text=`** | `admin/whatsapp/page.tsx:374/443` | busca/crea el chat y precarga el texto | Igual + indicador de ventana 24 h y estado entregado/leído |
| E8 | **Ópticas mayoristas → link `wa.me`** | `admin/opticas/page.tsx:138` | abre el WhatsApp del celular del staff hacia la óptica | Fuera del plan (usa el número mayorista, no la API) |
| E9 | **Botones "Hablanos por WhatsApp" de la tienda** (flotante, footer, producto, checkout, FAQ, contacto, landings, blog, popup, configurador de cristales, emails de checkout, página de error) | `Storefront/FloatingWhatsApp.tsx`, `WhatsAppAttribution.tsx`, `whatsapp-link.ts`, `constants.ts:WHATSAPP_PHONE`, `checkout-emails.ts:26` y ~55 archivos más | link `wa.me/5493518685644?text=…` — lo abre **el cliente** en su celular | **No cambia nada**: el cliente le escribe al mismo número, el mensaje entra por el webhook y aparece en el buzón. La atribución `[metaXxx]` en el texto precargado sigue funcionando |
| E10 | **Anuncios click-to-WhatsApp de Meta Ads** | campañas "Mensajes" del plan publicitario | el anuncio abre un chat al número | Igual; además, con la API oficial Meta **atribuye la conversación al anuncio** por webhook (`referral`), mejor que hoy |
| E11 | **Enlace al chat desde emails internos / notificaciones** (`/admin/whatsapp?…`) | varios | link al buzón | Igual |
| E12 | **QR y "conectar teléfono" del panel del bot** | `admin/whatsapp/page.tsx` (config), `admin/configuracion/page.tsx` | escanear la sesión | **SE VA**: no hay QR en la API oficial. Se reemplaza por "número conectado ✅ / token vencido ⚠️" |
| E13 | **Toggle "Asistente IA" y "Seguimientos automáticos"** | `admin/whatsapp/page.tsx` | prenden el bot y los followups | SE VAN (o quedan apagados y ocultos) — no hay bot ni followups por IA |
| E14 | **Toggle "bot por chat" y etiqueta "cancelar bot"** | `api/whatsapp/chats/[id]/bot`, `TAGS_SIN_BOT` | apagar el bot en un chat | SE VA |
| E15 | **Chat de prueba (simulador del bot)** | `ui/TestChatModal.tsx`, `/api/test/chat` | probar el prompt | SE VA |
| E16 | **Galería de fotos de WhatsApp** | `admin/whatsapp/fotos/page.tsx` | ver medias recibidas | Igual (los medios llegan por webhook y se guardan como hoy) |
| E17 | **Badge de no leídos y toasts de mensaje nuevo** | `ui/WhatsAppBadge.tsx`, `ui/LeadToastNotifications.tsx` | socket.io | Igual (el webhook emite los mismos eventos de socket) |
| E18 | **Vincular chat ↔ ficha / extraer cliente del chat** | `lib/whatsapp/vincular-chat.ts`, `chats/[id]/extract-client` | asocia el chat a un cliente | Igual, más simple: el número viene siempre real (adiós `@lid`) |
| E19 | **Grabar y mandar audio desde el buzón** | `admin/whatsapp/page.tsx:248` | nota de voz | Igual (audio ogg/opus por `/media`) — solo dentro de 24 h (las plantillas no llevan audio) |
| E20 | **Adjuntar imagen/PDF desde el buzón** | `admin/whatsapp/page.tsx` | media | Igual dentro de 24 h; fuera, plantilla con documento |

### B. Avisos internos a la administración / staff (pasan a email o CRM)

| # | Nombre | Dónde vivía | Estado |
|---|---|---|---|
| B1 | **Nuevo pago registrado** | `contact.service.ts` | EMAIL — hecho `27ebd046` |
| B2 | **Recibo no entregado / envío fallido del recibo** | `contact.service.ts` | EMAIL — hecho `27ebd046` |
| B3 | **Copia del recibo enviado** | `contact.service.ts` | EMAIL — hecho `27ebd046` |
| B4 | **Pedido enviado a fábrica (con PDF)** | `order.service.ts` | EMAIL — hecho `27ebd046` |
| B5 | **Pedidos trabados en SmartLab** | `smartlab.service.ts` | EMAIL — hecho `27ebd046` |
| B6 | **SmartLab caído / restablecido** | `cron/smartlab-sync/route.ts` | EMAIL — hecho `27ebd046` |
| B7 | **Solicitud de factura (bot detecta que el cliente pide factura)** | `wa-service/tools.js` + `api/bot/notify-invoice/route.ts` | EMAIL — hecho `8201b8b0` (la ruta del CRM `notify-invoice` aún manda WA: **pendiente**, ver B7-bis) |
| B7-bis | **Ficha PDF de la solicitud de factura** | `api/bot/notify-invoice/route.ts:78` | EMAIL — pendiente (mismo tratamiento que B7) |
| B8 | **Reclamo post-venta** | `wa-service/tools.js` | EMAIL — hecho (`/api/complaints` ya mandaba mail) |
| B9 | **Circuit breaker / advertencia anti-ban** | `anti-ban.js` | EMAIL — hecho `8201b8b0`; **desaparece** con la API oficial (no hay cola anti-ban) |
| B10 | **Bot apagado por errores persistentes** | `wa-service/index.js:546` | EMAIL — hecho; desaparece con la API oficial (no hay bot) |
| B11 | **Atención humana requerida (chat sin registrar)** | `wa-service/index.js:1795` | EMAIL — hecho; con la API oficial pasa a ser un **badge en el buzón** |
| B12 | **API del bot sin clave** | `wa-service/index.js` | EMAIL — hecho |
| B13 | **Se aplicó la etiqueta X** (`Tag.notifyPhone`) | `wa-service/tools.js` | **SE VA** — hecho `82da5570` (ni WA ni email, pedido de la dueña) |
| B14 | **vCard del cliente nuevo al propio número** | `google-contacts.service.ts` | **SE VA** — hecho `8201b8b0` |
| B15 | **Créditos de IA agotados** | `ai-error-handler.ts:42` | EMAIL — pendiente (hoy WA a `ADMIN_PHONE`) |
| B16 | **Nuevo borrador de blog** | `blog-agent.service.ts:113` | EMAIL — pendiente |
| B17 | **Notificación de orden al staff** | `api/whatsapp/notify/route.ts` → `/api/notify-order` | EMAIL / CRM — pendiente (verificar si alguien la usa; candidata a SE VA) |
| B18 | **Venta confirmada → grupo de ventas** | `order.service.ts:2258` (grupo `120363321589178129@g.us`) | EMAIL o notificación en el CRM — pendiente; **imposible** en la API oficial (no hay grupos) |
| B19 | **Cliente ingresó al local → grupo de ventas** | `contact.service.ts:1199` | idem B18 |
| B20 | **Aviso de caída del bot** | `whatsapp/client.js:notifyAdminDown` | ya era EMAIL |

### C. Automatizaciones que hablan solas (se van, o vuelven solo como plantilla)

| # | Nombre | Dónde vive | Destino |
|---|---|---|---|
| C1 | **Bot vendedor "Matías"** (contesta a leads nuevos como persona) | `wa-service/graph.js`, `prompts/salesPrompt.js`, `index.js:959` | **SE VA** como está. Interruptor "Asistente IA" (`bot_enabled`) apagado por la dueña el 18/8. Rediseño posible después, identificado como automático |
| C2 | **Bot ejecutivo** (clientes existentes) | `prompts/executivePrompt.js` | SE VA (idem) |
| C3 | **Seguimientos de venta DIA_1 / DIA_4 / DIA_15** | `wa-service/sales-followups.js` | SE VA. Lo que valga como recordatorio transaccional vuelve como plantilla, decidido caso por caso |
| C4 | **Seguimiento por inactividad del chat (>24 h)** | `wa-service/cron/inactivity-followups.js` | SE VA. Su reemplazo humano: botón `retomar_conversacion` en el buzón |
| C5 | **Tareas [Extracción Inteligente] auto-enviables** | `followups/smart-task-executor.js` | SE VA |
| C6 | **Posventa automática** | `followups/posventa.js` | SE VA como IA; candidata a plantilla `como_te_fue` (marketing, con opt-in) — decisión aparte |
| C7 | **Broadcast de seguimientos de cierre** | `scripts/broadcast-followup.ts` (cron `/api/cron/followups`) | SE VA (script se borra) |
| C8 | **Seguimientos de cierre manual** | `scripts/send-cierres-followups.ts` | SE VA (script se borra; tiene una clave hardcodeada) |
| C9 | **Carrito abandonado — toque WhatsApp** | `checkout/recovery.ts:272` → tarea `[CARRITO]` → C5 | SE VA por WhatsApp; el toque por **email** sigue |
| C10 | **Disparo por etiqueta "Seguimiento 1/2", "Frío"** | `contact.service.ts:911` | **SE VA** — hecho `8201b8b0` |
| C11 | **Etiquetado automático por IA (`add_tags`, `autoAssignCondition`)** | `wa-service/agent-tools.js:316`, `graph.js:247` | SE VA con el bot |
| C12 | **Extractor pasivo** (lee cada chat y arma ficha/tareas con IA) | `wa-service/passive-extractor.js` | Se **desconecta**. No manda mensajes, pero es IA leyendo chats; puede volver como herramienta del staff ("resumir este chat") a pedido |
| C13 | **Transcripción de audios** | `wa-service/transcriber.js` | Se desconecta; reconectable (no manda nada) |
| C14 | **Resumen automático del chat** | `wa-service/index.js:1041` | idem C12 |
| C15 | **Cola anti-ban** (jitter, spintax, límites, retención nocturna, 3er intento) | `whatsapp/anti-ban.js` | **SE VA entera**: existe para no parecer bot; la API oficial no la necesita |
| C16 | **Outbox `EnvioProgramado`** | `followups/outbox.js` | Se conserva la tabla como cola simple de reintentos de plantillas |

### D. Infraestructura que cambia

| # | Qué | Hoy | Después |
|---|---|---|---|
| D1 | Transporte | `whatsapp-web.js` + Chromium + sesión QR en volumen | `transport/cloud-api.js` (HTTPS a Graph) |
| D2 | Entrada de mensajes | evento `message` de la sesión | `POST /webhook/whatsapp` firmado por Meta |
| D3 | Ids | `@c.us` / `@lid` | número E.164; migración de `WhatsAppChat.waId` |
| D4 | Estado "conectado" | `isReady` de puppeteer + QR en el panel | token válido + número activo; sin QR |
| D5 | Estados de entrega | no hay | enviado / entregado / leído / fallido en cada burbuja |
| D6 | Grupos | grupo de ventas | no existen → email/CRM (B18, B19) |
| D7 | Dockerfile del bot | `node:20-slim` + Chrome for Testing | solo Node (deploy en segundos) |
| D8 | Env vars | `WA_SERVER_URL`, `BOT_API_KEY`, `WA_WEB_VERSION`, `ADMIN_PHONE` | + `WA_CLOUD_TOKEN`, `WA_CLOUD_WABA_ID`, `WA_CLOUD_PHONE_NUMBER_ID`, `WA_CLOUD_VERIFY_TOKEN`, `META_APP_SECRET`; − `WA_WEB_VERSION` |

### Pendientes chicos de Fase 0 que salieron del inventario
B7-bis, B15, B16, B17, B18, B19: seis avisos internos que **todavía** salen por
WhatsApp. Se pasan a email en el próximo commit de Fase 0.

## 3-ter. Estado de la construcción (18/8/2026, rama `whatsapp-api-oficial`)

**Fase 2 construida y probada en local** (contra un mock de Graph y la base
docker). Nada de esto cambia producción hasta setear `WA_TRANSPORT=cloud`: el
default es `webjs` y el buzón sigue exactamente igual.

| Pieza | Archivo | Estado |
|---|---|---|
| Interruptor de transporte | `wa-service/start.js` (`WA_TRANSPORT=cloud\|webjs`), `Dockerfile`, `railway.toml` | ✅ |
| Cliente Graph | `wa-service/transport/cloud-api.js` | ✅ texto, medios, plantillas, leído, bajar medios, estado del número, listar/crear plantillas |
| Transporte con misma interfaz que el legacy | `wa-service/transport/cloud-transport.js` | ✅ ventana 24 h → `WINDOW_CLOSED`; reintento en 429/5xx |
| Webhook firmado | `wa-service/transport/webhook.js` (`/webhook/whatsapp`) | ✅ verify token, HMAC, 200 inmediato |
| Persistencia sin bot | `wa-service/transport/inbound.js` | ✅ idempotente por wamid, candado por remitente, migra `@c.us` al vuelo, vincula ficha, `referral` de Ads, estados sent/delivered/read/failed |
| Rutas propias | `wa-service/transport/cloud-routes.js` | ✅ `/api/templates`, `/api/chats/:id/window`, 410 para bot/followups |
| Entrada sin Chromium/IA | `wa-service/cloud.js` | ✅ misma auth, `/health`, socket.io |
| `/api/send` | `wa-service/routes/api.js` | ✅ E.164 pelado, `template`, 409 `needsTemplate`, 422 número/plantilla |
| Schema | `WhatsAppChat.lastInboundAt`, `WhatsAppMessage.templateName`, `WhatsAppTemplate` | ✅ migración `20260818230000_whatsapp_cloud_api` |
| Helper único del CRM | `src/lib/whatsapp/send.ts` (`sendWhatsApp`) | ✅ texto → 409 → plantilla con el mismo adjunto |
| Catálogo de plantillas | `src/lib/whatsapp/templates.ts` (11) | ✅ texto a aprobar, variables, `toMetaComponents` |
| Flujos migrados | A1–A7, A11–A15 (ver §3-bis) | ✅ mismos botones |
| Buzón | `src/app/admin/whatsapp/page.tsx`, `TemplatePromptModal.tsx` | ✅ chip de ventana, modal de plantilla al 409, tildes, sin QR/toggles en cloud |
| Avisos internos | B1–B20 | ✅ todos por email o eliminados; **ninguno por WhatsApp** |
| Cron de salud | `/api/cron/whatsapp-calidad` | ✅ (dar de alta en cron-job.org al migrar) |
| Scripts | `scripts/maintenance/whatsapp-api-oficial/` | ✅ plantillas (alta/estado), migración de waId (dry-run: 227 chats, 44 a revisar) |

**Variables del bot en Railway (servicio "Pagina Web") para encender la API oficial**:
`WA_TRANSPORT=cloud`, `WA_CLOUD_TOKEN`, `WA_CLOUD_PHONE_NUMBER_ID`,
`WA_CLOUD_WABA_ID`, `WA_CLOUD_VERIFY_TOKEN`, `META_APP_SECRET`. Se sacan
después: `WA_WEB_VERSION`, el volumen de sesión, `GOOGLE_GENAI_API_KEY` (si no
se usa para otra cosa).

**URL del webhook a cargar en la app de Meta**:
`https://magnificent-courage-production-83d7.up.railway.app/webhook/whatsapp`
(campo suscrito: `messages`; token de verificación = `WA_CLOUD_VERIFY_TOKEN`).

**Qué falta y de quién depende**
- Meta (dueña + acompañamiento, un paso por mensaje): Fase 1 completa (WABA,
  nombre, verificación del negocio, app con producto WhatsApp, system user y
  token, método de pago) y Fase 4 (migrar el número).
- Plantillas con encabezado de documento (`venta_confirmada`, `comprobante_pago`,
  `presupuesto_pdf`, `factura_electronica`): Meta pide una muestra de PDF al
  crearlas — se hacen desde el WhatsApp Manager con el texto del catálogo. Las
  demás las da de alta el script.
- Merge de la rama a `main` y deploy: **con OK explícito**. Hasta setear
  `WA_TRANSPORT=cloud`, el deploy es inofensivo.
- Cuando el número ya esté en la API: correr `migrar-waid-e164.mjs --prod`
  (con OK) y dar de alta el cron de calidad.
- Limpieza posterior (Fase 4 paso 9): borrar Chromium del Dockerfile, la
  sesión, `whatsapp/`, `anti-ban.js`, la IA y los followups del repo.

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
