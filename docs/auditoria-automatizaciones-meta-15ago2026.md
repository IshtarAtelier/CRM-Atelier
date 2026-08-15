# Auditoría de automatizaciones Meta/WhatsApp — 15/8/2026

**Disparador**: aviso de Instagram en la cuenta principal (@atelieroptica_):
"Sospechamos que hay comportamientos automatizados en tu cuenta". Llegó vía
Uriel (gestor de campañas), que lo vio en el teléfono con el que opera la cuenta.

## Veredicto corto

- **Instagram/Facebook desde el código: todo API oficial (Graph).** No hay
  scraping, ni likes/follows/comentarios automáticos, ni sesiones de navegador
  contra instagram.com. Lo que publica automáticamente (stories diarias + feed)
  usa `META_SYSTEM_USER_TOKEN` con permisos de contenido solamente — mecanismo
  permitido por Meta, no es la causa típica de este aviso.
- **El disparador más probable está FUERA del repo**: las herramientas/accesos
  con que se opera la cuenta a mano (dispositivos de Uriel, apps de terceros
  con la contraseña de IG, logins compartidos).
- **WhatsApp es otra historia**: los DOS bots (el CRM y un agente suelto en la
  Mac) usan protocolo NO oficial. Riesgo de baneo del número, no de la cuenta
  de Instagram — pero es la mayor superficie de riesgo ante Meta.

## Inventario y clasificación

### ALTO — sesiones no oficiales de WhatsApp

1. **`~/proyectos/whatsapp-agent/` (fuera de este repo, corría en la Mac)**
   - Baileys (protocolo WhatsApp Web, login por QR), "sin usar la Cloud API".
   - Vinculado al número PRINCIPAL de la óptica (+54 9 3541 215971).
   - 685 mensajes entre el 1/8 y el 4/8; inactivo desde entonces, pero el
     proceso llevaba 14 días corriendo (`tsx watch src/run.ts`) y la sesión
     seguía vinculada.
   - **Acción**: detener el proceso (`kill <pid>`) y desvincular el dispositivo
     desde WhatsApp → Dispositivos vinculados. NO se borró nada: el proyecto,
     su base sqlite y la carpeta `whatsapp_auth/` quedan intactos para revisar.
2. **`wa-service/` (el bot del CRM, Railway)**
   - `whatsapp-web.js` sobre Puppeteer (fork de tercero pineado por SHA),
     user-agent falsificado, typing simulado, sendSeen, firma como "Matías",
     prohibido revelar que es bot. **Nunca usó la Cloud API oficial.**
   - Mitigación fuerte ya incorporada (anti-ban.js): 120 proactivos/día
     (60-70% del máximo estimado), 30/hora, jitter 45-90s, pausa de lote
     8-15 min cada 5 envíos, horario 09-20, cold-contact shield, regla del
     3er intento (30 días), circuit breaker (5 fallos → 1h), outbox persistente
     con patrón SENDING, interruptor global `followups_enabled` fail-closed.
   - **Decisión pendiente de la dueña**: seguir asumiendo el riesgo (con estos
     límites, que ya son conservadores) o migrar a WhatsApp Cloud API oficial
     (proyecto grande: plantillas HSM, costo por conversación, otro modelo de
     sesión). Apagarlo rompe el CRM — no se tocó.

### MEDIO

- **Publicación automática sin ojo humano el día del envío**: GitHub Actions
  (`social-crons.yml`) → 1 story/día (10:00 ART) + feed programado (11:00 ART)
  vía Graph API. Las placas se aprobaron al commitearse; hay dedup, guarda de
  frescura de precios y mail en fallas. Oficial, pero conviene saber que existe.
- **`social-regeneracion.yml`**: viernes 06:00 ART lee la base de PRODUCCIÓN
  (solo lectura) y pushea a `main` → redeploy automático de Railway.
- **`scripts/send-cierres-followups.ts:246-247`**: API key del bot hardcodeada
  como fallback + URL de producción hardcodeada. Rotar la clave y sacarla del
  código.
- **Avisos transaccionales del CRM** (recibos, pedido listo, despacho) salen
  como MANUAL y saltean límites/horario del anti-ban. Defendible, pero es
  volumen no contabilizado en días de muchas entregas.

### BAJO (API oficial, solo lectura o con triple llave)

- `scripts/social/publicar.mjs` — dry-run por defecto, publica solo con flags.
- `scripts/ads/*` — Marketing API v24: lectura con `META_ADS_TOKEN`; escritura
  solo `manage.js` con triple llave (`confirm` + `META_ALLOW_WRITES=1` + token
  dedicado).
- Conversions API (`ads.service.ts`) — eventos server-side del pixel, PII con
  SHA-256, fire-and-forget.
- Pixel del navegador — gateado por consentimiento.
- Feed de catálogo para Commerce Manager — Meta lo consume por pull.
- 21 endpoints `/api/cron/*` — emails internos, conciliación, backups.
  Un solo secreto los apaga a todos (`CRON_SECRET`).

## Accesos y tokens (qué existe, qué revocar)

| Credencial | Tipo | Estado |
|---|---|---|
| `META_SYSTEM_USER_TOKEN` | System user, no vence | Sano: 5 permisos de contenido, ve 1 sola Página. Sin permisos de mensajería/gestión |
| `META_ADS_TOKEN` / `META_ADS_TOKEN_WRITE` | Ads lectura/escritura | Separados por diseño. Unificar el doble nombre WRITE en `.env` vs `.env.example` |
| `META_ACCESS_TOKEN` + `META_PIXEL_ID` | Conversions API | Solo eventos de pixel |
| `CRON_SECRET` | Llave de los crons | Rotarla apaga/renueva los 21 crons + GitHub Actions |
| `BOT_API_KEY` | API del wa-service | **Rotar**: está hardcodeada en `send-cierres-followups.ts` |
| Token GitHub en `.git/config` | — | Pendiente previo: rotar |
| Password prod DB en `scripts/utils/` | — | Pendiente previo: rotar en Railway |

No hay webhooks de Meta entrantes (verificado: cero `hub.challenge`/`X-Hub-Signature`).

## Qué hacer a mano (la dueña)

1. Cambiar la contraseña de Instagram **desde la app** (no desde links de mails)
   y activar 2FA. Ídem Facebook.
2. Instagram → Configuración → Seguridad → **Dónde iniciaste sesión**: cerrar
   sesiones no reconocidas. Y **Apps y sitios web**: revocar toda app que no
   se reconozca.
3. **Preguntarle a Uriel qué herramientas usa** sobre la cuenta (programadores
   tipo Metricool, apps de engagement, bots de DMs). Si algo usa la contraseña
   de IG directamente, eso es casi seguro el disparador del aviso.
4. Migrar el acceso de Uriel a **roles de Meta Business Suite** (usuario propio
   con permisos parciales) en lugar de contraseña compartida — es exactamente
   lo que el aviso de Meta pide.
5. WhatsApp → Dispositivos vinculados: verificar qué sesiones hay. Debe quedar
   solo la del CRM (Railway). Desvincular la del whatsapp-agent de la Mac.
6. Decidir sobre el punto ALTO-2 (bot del CRM no oficial): mantener con límites
   actuales o evaluar migración a Cloud API.
