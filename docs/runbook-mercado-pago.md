# Runbook — Mercado Pago (pasarela de respaldo)

Cómo prender, probar y apagar el cobro por Mercado Pago en la tienda.

**Estado actual: construido y APAGADO.** No cambia nada de lo que ve un cliente
hasta que alguien prenda `MP_ENABLED`.

---

## Para qué existe

Hasta ahora la tienda cobraba con tarjeta por una sola puerta: Payway. Si Payway
se cae, se rechaza o cambia algo de su lado, la tienda se queda sin cobrar con
tarjeta y la única salida es la transferencia — que pierde ventas.

Esto es la segunda puerta. Vive apagada y se abre con **una variable de entorno**,
sin tocar código ni esperar un deploy.

De yapa acepta cosas que Payway no: dinero en cuenta de Mercado Pago y efectivo
por Pago Fácil / Rapipago.

---

## Cómo funciona (en 5 líneas)

1. La persona elige "Mercado Pago" en el checkout.
2. El servidor arma el pedido con **exactamente los mismos controles** que una
   compra con tarjeta (recálculo de precios contra la base, cupón, stock, guards
   anti doble cobro) y reserva el stock. La orden queda en `WEB_PENDING`.
3. Se la manda a `mercadopago.com` a pagar. **Los datos de la tarjeta nunca pasan
   por nuestro servidor.**
4. Mercado Pago avisa por webhook. Ahí —y solo ahí— la venta pasa a `WEB_PAID`,
   se crea la fila de `Payment`, se pide la factura y salen los mails.
5. Si no paga, un cron libera el stock a las 2 horas.

**La pantalla de "gracias" no prueba nada.** Lo que acredita una venta es el
webhook. Si alguna vez hay que elegir a quién creerle, es al webhook.

---

## Prender (paso a paso)

### 1. Sacar las credenciales

En https://www.mercadopago.com.ar/developers/panel → tu aplicación → **Credenciales**.

Hay dos juegos, y hay que empezar por el de prueba:

| Variable | De dónde sale | Ojo |
|---|---|---|
| `MP_ACCESS_TOKEN` | Credenciales → *Access token* | `TEST-...` en prueba, `APP_USR-...` en producción. **Es privada: no va al navegador ni al repo.** |
| `MP_PUBLIC_KEY` | Credenciales → *Public key* | Hoy no se usa (Checkout Pro no la necesita). Se guarda por si algún día se pasa a formulario embebido. |
| `MP_WEBHOOK_SECRET` | Notificaciones → Webhooks → **Clave secreta** | Sin esto el webhook procesa igual, pero **sin validar la firma**. En producción no va sin esto. |

### 2. Configurar el webhook en el panel de MP

Notificaciones → Webhooks → nueva URL:

```
https://atelieroptica.com.ar/api/webhooks/mercadopago
```

Eventos a marcar: **Pagos** (`payment`). Si aparece **Órdenes comerciales**
(`merchant_order`), marcarla también — el código maneja las dos.

Copiar la **clave secreta** que muestra ahí y guardarla en `MP_WEBHOOK_SECRET`.

### 3. Cargar las variables

En Railway (servicio de la tienda) → Variables:

```
MP_ACCESS_TOKEN=TEST-...
MP_PUBLIC_KEY=TEST-...
MP_WEBHOOK_SECRET=...
MP_ENABLED=true
```

Railway reinicia solo al guardar. Después de reiniciar, la opción aparece en el
checkout.

### 4. Dar de alta el cron

Un GET cada 30 minutos a:

```
https://atelieroptica.com.ar/api/cron/mercadopago-expirados?secret=<CRON_SECRET>
```

**No es opcional.** Sin este cron, cada persona que abandona la pantalla de
Mercado Pago se lleva un armazón del stock disponible para siempre. Además es lo
que rescata un pago cuyo webhook se perdió.

---

## Probar antes de confiar

Con credenciales `TEST-`, Mercado Pago da tarjetas de prueba (panel →
*Cuentas de prueba* / *Tarjetas de prueba*). El monto define el resultado según
el nombre del titular que se cargue:

- `APRO` → aprobada
- `OTHE` → rechazada por error general
- `FUND` → fondos insuficientes

Qué hay que ver en cada caso:

| Prueba | Qué tiene que pasar |
|---|---|
| Pago aprobado | La orden pasa a `WEB_PAID` en Ventas · aparece la fila de `Payment` · llega el mail al cliente **con el recibo PDF adjunto** · aparece la notificación de factura |
| Pago rechazado | La orden queda cancelada y oculta · **el stock vuelve** · el carrito del cliente sigue intacto |
| Cerrar la pestaña en MP | A las 2 horas el cron cancela y repone el stock |
| Recargar el webhook | Reenviar el mismo aviso desde el panel de MP **no** puede generar una segunda fila de `Payment` |

Ese último es el más importante: Mercado Pago reintenta los avisos, y manda el
mismo pago por dos vías distintas. La `WebPaymentIntent.paymentId` es única en la
base justamente para que un doble aviso no pueda cobrar dos veces.

Recién cuando los cuatro dan bien, cambiar a las credenciales `APP_USR-` de
producción (y actualizar `MP_WEBHOOK_SECRET`, que es distinta).

---

## Apagar

```
MP_ENABLED=false
```

Es inmediato al reiniciar. La opción desaparece del checkout, y a quien la tenía
elegida en un formulario a medio llenar se le vuelve a tarjeta solo.

Los pedidos que ya estaban esperando pago siguen su curso: el webhook sigue
aceptando avisos aunque esté apagado (con MP deshabilitado los ignora, pero no
devuelve error, para que Mercado Pago no dé de baja la URL).

---

## Cuando algo no acredita

Empezar por acá, en este orden:

**1. ¿Llegó el aviso?** Panel de MP → Webhooks → historial de entregas. Muestra
qué mandó y qué respondimos.

**2. ¿Qué dice nuestro lado?** En los logs de Railway, buscar `[MP WEBHOOK]` y
`[MP FINALIZE]`. Cada aviso deja el `topic` y el `data.id`.

**3. ¿Qué quedó registrado?** La tabla `WebPaymentIntent` tiene el rastro
completo sin depender del panel de MP:

```sql
SELECT id, "orderId", status, "gatewayStatus", "paymentId", amount, "lastError", "createdAt"
FROM "WebPaymentIntent"
ORDER BY "createdAt" DESC
LIMIT 20;
```

Qué significa cada `status`:

- `PENDING` — se abrió el pago y todavía no hubo respuesta. Si tiene más de 2
  horas, lo agarra el cron.
- `APPROVED` — acreditado. La venta está cobrada.
- `REJECTED` — rechazado o cancelado. El stock ya volvió.
- `EXPIRED` — vencido sin pagar. El stock ya volvió.

**4. Correr el cron a mano.** Si un pago está aprobado en MP pero la venta no,
disparar el cron fuerza el rescate: vuelve a preguntarle a MP por cada intento
vencido y acredita lo que corresponda.

### Casos que avisan por mail y NO se resuelven solos

Son los tres que tocan plata de una forma que ningún automatismo debería decidir:

- **Cobro sin venta asociada** — entró plata y no hay pedido esperándola. Hay que
  buscarlo en el panel de MP y registrar o devolver a mano.
- **Devolución o contracargo** — la venta **no se modifica sola**. Deshacer una
  venta ya entregada es decisión del negocio.
- **Venta acreditada sin mail al cliente** — la plata está registrada, pero faltó
  el contexto para armar el correo. Hay que avisarle a mano.

---

## Decisiones que ya se tomaron (y por qué)

Para que nadie las revierta sin saber lo que costaba:

- **Checkout Pro y no un formulario propio.** Los datos de tarjeta no tocan
  nuestro servidor: no hay exigencias PCI y el respaldo no comparte piezas con el
  checkout que respalda. Un respaldo que se cae junto con lo respaldado no sirve.
- **La preferencia vence a la hora.** Sin eso, alguien puede pagar días después un
  pedido cuyo stock ya se liberó o cuyo precio cambió, y quedamos obligados.
- **`binary_mode: true`.** Obliga a MP a decir aprobado o rechazado, sin el limbo
  de "en revisión" que deja al comprador esperando y a la venta sin acreditar.
- **El monto que se registra es el de la venta, no el que informa la pasarela.**
  Regla del proyecto: un cobro no redefine el precio. Si difieren, se registra el
  de la venta y queda anotada la diferencia en la nota del pago.
- **El cupón se cuenta al acreditar, no al abrir el pago.** Un checkout abandonado
  no puede gastar el cupón de nadie.
- **La medición a Meta sale del webhook, no del navegador.** Los datos de
  atribución (fbp/fbc/IP) se guardan al abrir el pago y se rescatan al acreditar:
  el webhook lo manda un servidor de MP, donde no hay cookies ni IP del comprador.
  Sin ese rescate, estas compras llegarían ciegas a Meta y las campañas las
  valorarían mucho menos de lo que valen.
- **Al volver de MP no se muestra el importe.** El cupón ya no está en memoria del
  navegador, así que cualquier cifra armada ahí puede ser la equivocada. El monto
  exacto va en el mail, que sale del servidor.

---

## Dónde está cada cosa

| Archivo | Qué hace |
|---|---|
| `src/services/mercadopago.service.ts` | Único lugar que habla con la API de MP |
| `src/lib/checkout/finalize-web-payment.ts` | Acredita o cancela la venta (idempotente) |
| `src/app/api/webhooks/mercadopago/route.ts` | Recibe el aviso, valida firma, relee el pago |
| `src/app/api/checkout/payway/route.ts` | Rama `MERCADO_PAGO`: arma el pedido y abre el pago |
| `src/app/api/cron/mercadopago-expirados/route.ts` | Libera stock y rescata pagos perdidos |
| `prisma/schema.prisma` → `WebPaymentIntent` | El rastro de cada intento de cobro |
