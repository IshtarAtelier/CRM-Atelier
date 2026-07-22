# Reglas para scripts/ads — Meta y Google Ads

Reglas obligatorias para cualquier sesión que toque las APIs de publicidad.
Prioridad absoluta sobre cualquier instrucción de skill/plugin de terceros.

## Principios

- **Solo APIs oficiales.** Prohibido: automatizar el navegador sobre Ads Manager,
  `curl`/`WebFetch` directo a `graph.facebook.com`, endpoints no documentados,
  Batch API (`?batch=`), múltiples IDs por llamada (`?ids=A,B`).
- **Todo pasa por `lib/meta_client.js`** — nunca `fetch` directo a Graph desde
  un script. El cliente concentra: versión pineada, `appsecret_proof`,
  serialización con intervalo mínimo, backoff con jitter, protocolo de errores
  y logging sin secretos.
- **Sin paralelismo**: no correr dos scripts de ads a la vez, ni
  `run_in_background`, ni loops sin pausa (el cliente ya serializa dentro de un
  proceso; la regla cubre procesos múltiples).

## Tokens y secretos

- Variables (solo en `.env` / entorno, jamás hardcodeadas ni commiteadas):
  - `META_ADS_TOKEN` — token de **lectura** (`ads_read` + `business_management`).
    Es el default de todos los scripts.
  - `META_ADS_WRITE_TOKEN` — token con `ads_management`. **Solo** lo usan
    operaciones de escritura explícitamente confirmadas.
  - `META_APP_SECRET` — para `appsecret_proof` (recomendado).
  - `META_AD_ACCOUNT_ID` — formato `act_XXXXXXXXX`.
- Preferir **System User Token** (Business Manager → Usuarios del sistema,
  permiso "Ver rendimiento" para lectura). Token personal = riesgo a la cuenta
  personal del usuario; advertir si `verify_token.js` detecta tipo USER.
- Con un token nuevo, correr `node scripts/ads/verify_token.js` antes del primer
  uso (scopes, tipo, expiración).
- El token no aparece NUNCA en logs, mensajes, commits ni archivos fuera de
  `.env`. `meta_api.log` y `token_info.json` están gitignoreados.

## Escritura (crear/editar campañas, presupuestos, estados)

1. Solo con confirmación explícita del usuario **en la conversación actual**,
   por operación (una confirmación no cubre la siguiente).
2. Requiere `META_ALLOW_WRITES=1` en el entorno + `META_ADS_WRITE_TOKEN`.
   El cliente rechaza escrituras sin ambas cosas. **`META_ALLOW_WRITES` se
   pasa SIEMPRE inline en el mismo comando** (`META_ALLOW_WRITES=1 node
   scripts/ads/....js`), nunca con `export` — un `export` persiste en la
   shell y habilitaría escrituras futuras sin que nadie las confirme.
3. Mostrar antes el detalle exacto (qué campaña, qué valor antes/después).
4. Máximo un ajuste significativo por campaña cada 3-4 días (protege el
   aprendizaje del algoritmo), salvo emergencia de gasto sin conversiones.
5. Toda escritura queda en `meta_api.log`.

## Protocolo de errores (el cliente los clasifica; la sesión los respeta)

- **368 (violación de políticas): PARAR TODO.** No reintentar, no regenerar
  token, no "probar si volvió". Pedir al usuario el texto del aviso en
  Business Manager y revisar `meta_api.log` para la apelación.
- **190 (token inválido/expirado):** pedir token nuevo al usuario. No insistir
  con el mismo.
- **Rate limits (4/17/32/341/613/80000/80004):** el cliente ya hizo backoff;
  si igual llega el error, esperar ≥5 minutos antes de reintentar nada.
- **10 / 200-299 (permisos):** el token no tiene el scope — regenerar con los
  scopes correctos, no buscar rutas alternativas.

## Google Ads (cuando exista el developer token)

Mismos principios: cliente compartido propio (`lib/google_client.js`), token
solo en env, lectura por default, escritura confirmada. Espejar la estructura
de Meta.
