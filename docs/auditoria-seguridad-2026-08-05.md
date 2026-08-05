# Auditoría de seguridad — 5/8/2026

Barrido hecho a pedido, con verificación contra producción. Cada punto dice
qué se probó, no qué se supone.

## Cerrado en esta sesión

### 1. `GET /api/settings` filtraba la tabla `SystemSetting` entera 🔴
La ruta es GET público (la tienda lee el cartel, la dirección y las promos sin
sesión) y devolvía **todas** las filas a cualquiera en internet: `bot_prompt`
(el prompt comercial completo del bot), `bot_daily_context`,
`social_publicaciones` y el estado interno de las sincronizaciones de
laboratorio.

**Arreglado**: el público solo recibe las claves `web_`. La sesión se lee de la
cookie **en la ruta**, no de `x-user-id` — el middleware no inyecta esos headers
en las rutas que marca como públicas, así que confiar en el header habría dejado
al panel de admin sin sus claves.

Verificado en producción tras el deploy:
- sin sesión → 11 claves, todas `web_`; `?key=bot_prompt` → **401**
- con sesión ADMIN (probado en local) → las 26 claves; `?key=MANUFACTURING_TIMES` → 200

### 2. La API del wa-service, publicada sin clave 🔴 (a medias)
`GET /api/status` en la URL pública del bot respondía **200 sin cabecera
`x-api-key` y también con una clave inventada** → `WA_API_KEY` no está seteada.
`apiAuth` deja pasar todo cuando la variable no existe ("modo legacy", con un
`console.warn` que nadie lee). Con eso, cualquiera que conozca la URL puede
`POST /api/send` (mandar WhatsApp firmados como la óptica), leer el prompt y el
teléfono conectado, y cambiar la configuración del agente.

**Hecho**: clave generada y seteada en `CRM-Atelier`; el bot ahora **avisa por
WhatsApp al admin** al arrancar sin clave, en vez de dejarlo en los logs.

**FALTA — solo lo puede hacer el dueño de esa cuenta**: setear `WA_API_KEY` en el
servicio del bot desde la UI de Railway. El proyecto del bot NO aparece en
`railway list` con la cuenta `pisano.ishtar@gmail.com` (ver
`docs/` → topología de deploy), así que no se puede hacer por CLI.
El valor a copiar está en `~/.atelier-wa-api-key.txt` (permisos 600). **Tiene
que ser exactamente el mismo** que quedó en el CRM.

## Abierto — decisión pendiente

### 3. `/api/storage/view` sirve cualquier archivo sin autenticación 🟠
Probado contra producción: una clave inexistente devuelve **404, no 401** → no
hay ningún control de acceso. Solo valida path traversal.

El riesgo real es que las claves son **adivinables**: las facturas se guardan
como `invoices/FC-0001-00000123.pdf`, con numeración secuencial. Cualquiera
puede enumerar comprobantes de clientes (nombre, importe, CUIT).

No se tocó a propósito: la ruta la usa el optimizador de imágenes de Next para
toda la tienda y el visor de medios del chat. Cambiarla en caliente rompe la web.
El arreglo correcto es que las claves nuevas sean impredecibles (UUID) y decidir
qué hacer con las viejas — es una migración, no un parche.

> Nota: el fallback de recibos que se agregó hoy ya sube con
> `receipts/<uuid>-...` justamente por esto.

## Revisado y sin hallazgos

- **Los 18 crons** (`src/app/api/cron/*`): todos validan `CRON_SECRET` o
  `verifyCronAuth`. Ninguno abierto.
- **`/api/bot/*`, `/api/whatsapp/*`, `/api/admin/alert`**: 403 sin credenciales
  (probado contra producción). Aceptan `BOT_API_KEY` con `safeCompare` o cookie
  de sesión, y rechazan el rol `OPTICA`.
- **`/api/contacts`, `/api/orders`**: 401 sin sesión (probado).
- **Headers de identidad**: el middleware los borra de toda request entrante
  antes de reinyectarlos, así que no se pueden falsificar desde afuera.
- **`/api/upload`**: exige JWT o `BOT_API_KEY`, límite de 10 MB y lista negra de
  extensiones ejecutables.

## Ya conocido, sigue pendiente (de `CLAUDE.md`)

- El JWT no se revalida contra la DB: dura 24 h, así que un usuario borrado o
  degradado sigue operando con los permisos viejos hasta que expira.
- Token de GitHub en texto plano en `.git/config`.
- Contraseña de la base de producción hardcodeada en `scripts/utils/`.
