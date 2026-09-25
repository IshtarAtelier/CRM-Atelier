# Compras informadas a Meta (Conversions API)

Regla de Ishtar, 25/9/2026: **el sistema le informa a Meta cada compra, sí o sí.**
Meta usa esas compras para que las campañas aprendan quién termina comprando; una
venta que no llega es una señal que la pauta nunca ve.

## Qué pasaba antes (auditoría del 25/9/2026)

- El envío era un `fetch` fire-and-forget: sin registro, sin reintento. Una caída
  de Meta, un token vencido (pasó el 10/9) o un reinicio del contenedor a mitad del
  request perdían la compra sin que nadie se enterara.
- La venta del local viajaba con `createdAt`, la fecha del **presupuesto**. Meta
  rechaza cualquier evento con más de 7 días, así que toda venta cerrada sobre un
  presupuesto de la semana anterior se rechazaba en silencio.
- La venta del local iba sin `event_id`, con lo que reintentar habría duplicado.

## Cómo funciona ahora

1. Toda compra se **anota** en la tabla `MetaConversion` (una fila por orden y
   fuente: `website` o `physical_store`) con el payload exacto, ya hasheado.
2. Se intenta mandar en el momento. Si Meta no la acepta queda `FAILED` con un
   próximo turno (10 min, 20, 40 … tope 6 h).
3. El cron `/api/cron/meta-conversiones` corre cada 10 minutos, las 24 h, desde
   `instrumentation.ts`, y reintenta todo lo pendiente. `event_id = order.id`
   garantiza que insistir nunca cuenta doble: Meta descarta el repetido.
4. Lo que ya no va a entrar (`EXPIRED`: venció la ventana de 7 días; `REJECTED`:
   Meta lo rechazó en firme) y lo que lleva 3 intentos fallando **avisa por mail**
   a `ADMIN_ALERT_EMAILS`, una sola vez por compra.

Dónde se anota cada compra:

| Camino | Archivo | Fecha del evento |
|---|---|---|
| Presupuesto convertido en venta (CRM) | `src/services/order.service.ts` (`updateOrder`, rama `orderType === 'SALE'`) | `labSentAt` |
| Checkout con Payway o transferencia | `src/app/api/checkout/payway/route.ts` | `createdAt` de la orden |
| Webhook de Mercado Pago | `src/lib/checkout/finalize-web-payment.ts` | `createdAt` de la orden |

Los pedidos **mayoristas** no se informan a propósito (son ópticas del canal
Cápsula Escarlata, no clientes que vinieron de un anuncio).

## Qué hacer cuando llega el mail "compras sin informar a Meta"

- **Varias "sigue sin entrar" juntas** → casi seguro es el token del Conversions
  API. Verificar `META_ACCESS_TOKEN` en Railway (comparar huella contra el `.env`
  local, sin imprimirlo) y probarlo con `debug_token`. Al reponerlo, el cron
  manda solo todo lo que quedó, mientras siga dentro de los 7 días.
- **"venció la ventana"** → esa compra ya no entra. Si son muchas seguidas, el
  token estuvo caído más de una semana: revisar por qué nadie vio los mails.
- **"Meta la rechazó en firme"** → mirar `lastError` en la fila; suele ser un
  dato mal formado. Es un bug nuestro, no de Meta.

## Recuperar las ventas que Meta rechazó antes del deploy

`scripts/maintenance/meta-compras-recuperar.mjs` busca las ventas del local de
los últimos 7 días cuyo presupuesto tenía más de una semana al convertirse
(esas Meta seguro las rechazó) y las anota en la outbox con la fecha correcta
para que el cron de producción las mande. Sin `--aplicar` solo muestra. No le
habla a Meta desde la Mac: anota, y el cron manda. Requiere el deploy hecho
(la tabla tiene que existir) y OK para leer producción.

```bash
node --experimental-strip-types --import ./scripts/checks/_alias.mjs scripts/maintenance/meta-compras-recuperar.mjs --produccion
```

Las ventas cuyo presupuesto tenía menos de 7 días probablemente ya entraron
(iban sin `event_id`, así que reenviarlas contaría doble): se saltean salvo
`--tambien-las-dudosas`.

## Cómo verificar

- `npm run check:capi` — sin red ni base: payload hasheado, `event_id`, fecha de
  la venta, reintentos, vencimiento, idempotencia. Corre también en CI.
- `npm run check:meta-compras -- --prod --dias 14` — solo lee producción: cruza
  las ventas contra la outbox y lista lo que no llegó. Pedir OK antes de correrlo.
- `node --env-file=.env scripts/checks/pixel-salud.mjs` — qué eventos recibió el
  píxel. OJO: las estadísticas del píxel **no cuentan** los eventos
  `physical_store`; para esos, la prueba de recepción es la fila `SENT`
  (Meta respondió `events_received: 1`) y el Administrador de eventos.
- `META_ALLOW_WRITES=1 META_ADS_WRITE_TOKEN=<token CAPI> META_PIXEL_ID=<id> node scripts/ads/capi_test.js TESTxxxx`
  — manda un Purchase de prueba con `test_event_code` (no ensucia los datos).
