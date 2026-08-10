# Checklist único — Atelier

**Al 10/8/2026.** Todo lo abierto, en un solo lugar. Marcá lo que se va cerrando.

Son **dos listas distintas** y conviene no mezclarlas:

- **A. Plan de ventas** (`plan-maquina-de-vender.md`) — cómo vender más.
- **B. Auditoría de arquitectura** (`auditoria-arquitectura-9ago2026.md`) — por dónde se pierde plata que ya entra. **No estaba en el plan**: apareció al auditar el código, y encontró cosas más caras que el plan entero.

**Leyenda:** ✅ en producción · 🟢 hecho, espera deploy · 🔄 en curso · ⬜ pendiente · 🔒 necesita una decisión tuya

---

## 🎯 ORDENADO POR LO QUE HACE VENDER

Sin importar de qué lista viene cada cosa. Si algo no mueve una venta, está más abajo.

### 1. Plata que se está perdiendo AHORA

| | Qué | Cuánto |
|---|---|---|
| ✅ | Varilux: la web publicaba un precio y el checkout cobraba la mitad | **$673.298 por par** |
| 🟢 | El bot de WhatsApp cotizaba distinto que la tienda | $40.350 de más por cristal |
| 🟢 | El saldo que ve el cliente y el staff estaba mal | **$1.784.348** de deuda invisible en 90 ventas |
| 🔒 | La tienda **no mide nada** desde hoy → cada peso de pauta se decide a ciegas | todo el presupuesto |

### 2. Fricción que hace abandonar la compra

| | Qué |
|---|---|
| ✅ | El cartel de cookies tapaba los dos botones del hero en celular — **el 100% del tráfico pago mobile** |
| ✅ | El checkout mentía en las cuotas y no decía cuánto transferir |
| ✅ | Los links compartidos por WhatsApp salían sin foto |
| 🔒 | Las fichas dicen "En Stock" y **PREVENTA** a la vez |
| 🔄 | La receta que el cliente sube **se tira a la basura** |
| 🔄 | Pagás y no sabés nada de tu pedido hasta que lo retirás |

### 3. Traer gente que compra

| | Qué |
|---|---|
| 🟢 | `/multifocales` — el producto de $834.000 mandaba su tráfico pago a un **404** |
| 🔒 | Google Ads le está enseñando a la puja a comprar clics de "Cómo llegar" — **44% del gasto** |
| 🔒 | Dar de alta los crons: sin eso el carrito abandonado no recupera un peso |
| 🔒 | **Renovación de receta** — el mayor ROI de todo el plan, y **no cuesta un peso de pauta** |
| ✅ | Se sacaron los dos riesgos de sanción de Google (rating autodeclarado y 46 doorways) |

### 4. Que no se rompa lo que ya funciona

| | Qué |
|---|---|
| ✅ | Dos agujeros de seguridad: el cron que cualquiera podía disparar contra tu base de clientes, y el `.env` a un comando de entrar al repo |
| 🟢 | El Copiloto podía mandar a fábrica sin el 50% cobrado |
| ⬜ | Borrar una venta borra sus pagos en duro |
| ⬜ | El PDF que recibe el cliente sale con los números en formato yanqui |

### 5. Lo interno (no lo ve un cliente, pero hace caro cada cambio)

Duplicación de reglas, transacciones, estructura, observabilidad. Detalle en la sección B.

---

## 🔴 LO URGENTE (hoy)

- [ ] 🔒 **Subir los 7 commits pendientes.** Un solo comando:
      `cd /Users/ishtarpissano/proyectos/atelier-auditoria && git push origin deploy/bot-recetas:main`
- [x] ✅ **La tienda volvió a medir.** Verificado el 10/8 contra el HTML servido de atelieroptica.com.ar: GA4 (`G-DGYJPFKJMY`, `G-S4C9E97Q4K`), Google Ads (`AW-16543752866`) y el pixel de Meta (`789449199606215`, detrás del consentimiento, como corresponde). Cero `undefined` horneados. La guarda de build impide que vuelva a pasar.
- [x] ✅ **Sacar el aviso "PREVENTA" de las fichas.** HECHO el 10/8/2026 con tu autorización: 117 descripciones limpias en producción, verificado en la tienda en vivo (teseo-c1, nashira-c3, adhara-c4). El script ahora toma `--produccion` y sigue simulando por defecto:
      `node --env-file=.env scripts/maintenance/sacar-aviso-preventa.mjs --produccion`

---

## A. PLAN DE VENTAS

### A.1 Bloqueantes (B1–B15)

- [x] ✅ **B1** — Banner de cookies tapaba los dos CTAs del hero en celular
- [ ] 🔒 **B2** — Higiene de conversiones en Google Ads: pasar a secundarias las 5 acciones locales y la de Tiendanube. *Es lo que le enseña a la puja a comprar clics de "Cómo llegar" — el 44% del gasto.* **NO cargar la etiqueta de compra**: ya entra por GA4 y contaría doble
- [x] ✅ **B3** — Purchase en las 3 ramas de pago + se cerró un doble conteo
- [x] ✅ **B4** — Consent Mode v2 + medir cuánta gente ignora el cartel
- [x] ✅ **B5** — Chat de WhatsApp ↔ ficha del cliente
- [x] 🟢 **B6** — Landing `/multifocales` *(el head term mandaba su tráfico a un 404)*
- [x] ✅ **B7** — `aggregateRating` self-serving fuera *(riesgo de sanción de Google)*
- [x] ✅ **B8** — 46 doorways → 301 + fuera del sitemap
- [ ] 🔒 **B9** — Conversiones offline a Google Ads. **Código listo**: `findClickIds()` recupera el click id y la venta se sube al cerrarse; además `wbraid`/`gbraid` ahora viajan en el evento (se capturaban y nunca subían — en iOS Google no manda `gclid`, así que esas ventas quedaban sin atribuir). *Falta crear la acción de conversión en la cuenta de Google Ads — eso es tuyo*
- [ ] 🔒 **B10** — Alta en Merchant Center *(requiere B2 y sacar PREVENTA primero)*
- [x] ✅ **B11** — UTMs en el pipeline social
- [ ] 🔒 **B12** — Dar de alta los crons en el scheduler. *Código terminado; sin esto el carrito abandonado no recupera un peso y no sale el reporte diario*
- [ ] 🔒 **B13** — 301 del subdominio `promo.atelieroptica.com.ar` *(no se resuelve desde este repo)*
- [ ] 🔒 **B14** — Removal en Search Console del subdominio del CRM
- [ ] 🔒 **B15** — ¿Qué convenios de obras sociales están activos? *(define sitelink, keywords y placa)*

### A.2 Quick wins (QW1–QW15)

- [x] ✅ **QW1** — CTAs mobile destapados
- [x] ✅ **QW2** — Sacar "PREVENTA" de las fichas *(117 fichas, hecho el 10/8)*
- [x] ✅ **QW3** — Multifocales en el hero y en el nav *(también en el menú mobile, que decía "Cristales")*
- [x] ✅ **QW4** — Carrusel sin pantalla negra + CTAs que dejaron de parpadear
- [x] ✅ **QW5** — og:image AVIF → WebP *(los links de WhatsApp salían sin foto)*
- [x] ✅ **QW6** — FloatingWhatsApp: 1,5s, etiqueta "Presupuesto", y dejó de taparle el CTA al hero
- [x] ✅ **QW7** — Microcopy del checkout, 4 de 4
- [ ] 🔄 **QW8** — La receta que se tira a la basura + medir dónde abandona la gente
- [ ] 🔄 **QW9** — Lote confianza: helper de garantía *(el texto está repetido a mano)*
- [ ] 🔒 **QW9b** — Nombre y matrícula del director técnico *(obligatorio en ópticas argentinas)*
- [x] ✅ **QW9c** — Link a Obras Sociales en el footer principal
- [ ] 🔄 **QW10** — Badge "2º armazón bonificado" *(el flag existe en la base y no llega a la ficha)*
- [ ] 🔄 **QW11** — Cross-sell por afinidad *(hoy recomienda titanio masculino a quien mira acetato femenino)*
- [ ] 🔒 **QW12** — Cloudflare: proxy naranja + SSL *(~800 ms menos por clic pago)*
- [ ] 🔒 **QW13** — Sacar el eslogan del nombre en Google Business *(riesgo de suspensión)*
- [ ] ⬜ **QW14** — Definir si el título de la home lleva "Córdoba" *(hoy og:title y title se contradicen)*
- [ ] 🔒 **QW15** — Aplicar las 114 fichas SEO + reactivar 5 productos *(requiere producción)*

### A.3 Estructurales

- [ ] 🔄 **E1** — ISR real en /tienda, /lentes-de-sol y /receta *(hoy el `revalidate` es letra muerta)*
- [ ] 🔄 **E2** — Bajar 150 imágenes de hasta 6064px *(31 MB en `public/`)*
- [x] ✅ **E3** — Sacar `priority` de las miniaturas del carrusel *(competían con el LCP del hero)*
- [ ] 🔒 **E4** — Mercado Pago Checkout Pro y 9/12 cuotas
- [ ] 🔒 **E5** — Turnos online
- [ ] 🔒 **E6** — Atar las ventas de mostrador al producto real *(hoy van contra SKUs genéricos)*
- [ ] 🔒 **E7** — Escalera de precios y 3-5 ofertas rotativas *(el código ya está listo)*
- [ ] 🔒 **E8** — Medir 92 armazones *(para el badge "apto multifocal" y el filtro de sol con receta)*
- [ ] 🔄 **E9** — Aviso de despacho post-pago *(hoy pagás y no sabés nada hasta retirar)*

### A.4 Retención

- [ ] 🔒 **Flujo 1** — Prender el carrito abandonado *(código terminado, falta el alta del cron)*
- [x] 🚫 **Flujo 2** — ~~Reseña de Google automatizada~~ **DESCARTADO 10/8/2026, decisión del dueño.** Pedirle la reseña a alguien que está esperando un pedido demorado o que tuvo un problema de posventa cosecha una estrella, y una reseña mala no se borra. El pedido lo sigue haciendo una persona. Las tareas `REVIEW_REQUEST` se crean igual al entregar (`order.service.ts`) y las levanta el mostrador; el bot no las toca (`createdBy: 'Sistema'` no está en la lista blanca, y `[RESENA]` se sacó de `AUTO_SENDABLE_TASK_PREFIXES`). **El área de reseñas queda como está.**
- [x] ✅ **Flujo 3** — Habilitante del pipeline *(whitelist a array + firma `Bot`)*
- [ ] 🔄 **Flujo 4** — Posventa a los 10 días *(sin reseña encadenada — ver Flujo 2)*
- [ ] 🔒 **Flujo 5** — Renovación de receta a 12-18 meses. **El mayor ROI del plan**: a $834.000 el ticket, 5 reactivaciones al mes lo pagan todo. *Requiere dimensionar la cohorte contra producción*
- [x] ✅ **Flujo 6** — Carrito multi-toque *(2º toque + canal WhatsApp con reclamo atómico; migración aplicada. Sigue esperando el alta del cron — Flujo 1)*
- [ ] 🔒 **Flujo 7** — Segundo par con descuento *(falta aprobar el cupón)*
- [ ] ⬜ **Flujo 8** — Capturar fecha de nacimiento en el checkout *(hoy 2 de 1096 fichas la tienen)*
- [ ] ⬜ **Infra** — Exclusión mutua de 14 días entre flujos *(prerequisito de prender el segundo)*

### A.5 Placas y contenido

- [ ] 🔒 **Regenerar 3 piezas con precio** ⏰ *(se generaron el 6/8 y la guarda corta a los 10 días: dos publicaciones programadas se van a saltear solas)*
- [x] ✅ Plantilla de testimonio *(con validación anti-cita-inventada: sin `resena:{autor, fuente}` no renderiza)*
- [x] ✅ Generador de piezas de multifocal desde la base *(carrusel + 4 tamaños de ad + el ancla de la landing, todo del mismo cálculo)*
- [x] ✅ 4 piezas nuevas del calendario + campo CTA en las stories *(el CTA se escribía y no se dibujaba; ahora se renderiza y R6 lo revisa)*
- [x] ✅ Guarda de frescura en las stories con precio *(podían publicar un precio de hace meses)*
- [x] ✅ **La frescura ahora mira contra QUÉ base se generó**, no solo cuándo. Una pieza hecha contra docker traía precios de semanas atrás y salía marcada como fresca; los dos crons usan el mismo helper (antes el del feed tenía su propia copia de la regla)
- [ ] 🔒 **Regenerar las 5 piezas de multifocal con `--produccion`** *(hoy están selladas `local` y la guarda las bloquea, que es lo correcto. Requiere tu OK para leer la base de producción)*

### A.6 Inversión

- [ ] 🔒 **Aprobar la reasignación.** Techo acordado: **$1.000.000/mes** entre Google y Meta. Google $420.000 (−19%) + Meta ~US$369 en la cuenta USD + cuenta ARS en cero
- [ ] 🔒 Método de pago y tope de gasto por cuenta

---

## B. AUDITORÍA DE ARQUITECTURA

**31 hallazgos · 5 resueltos · 1 a medias · 25 abiertos.** Todos son código: los puedo hacer solo.

### B.1 Resueltos

- [x] ✅ 🔴 **#1 Precio de Varilux** — la web publicaba $1.346.599 y el checkout cobraba $673.301. **$673.298 por par**, y al laboratorio le iba el cristal que la exclusión existía para no vender
- [x] 🟢 🟠 **#2 Saldo global del dashboard** — `lista − cobrado`: $5.583.845 contra $3.419.152 real
- [x] 🟢 🟠 **#3 76 conversiones fantasma a Google** — `Boolean('NONE')` es `true`
- [x] 🟢 🟠 **#4 El Copiloto se salteaba el gate de fábrica** — se podía mandar a laboratorio sin el 50% cobrado
- [x] 🟢 🟠 **#5 El bot inventaba los precios** — pedía $40.350 de más al contado y llamaba "sin interés" a un recargo del 15%

### B.2 A medias

- [ ] 🟢 🟠 **#6 `saldo = total − paid` en 9 lugares** — migrados los 2 que le muestran plata a una persona (el PDF del cliente y el Copiloto). *Medido: sobre 90 ventas, 26 difieren >$1.000 y la resta **subestima la deuda en $1.784.348***. Quedan 7: pantalla de ventas, confirmación de venta web, export, presupuestos, BalancePanel

### B.3 Altos abiertos

- [ ] ⬜ 🟠 **#9** — El cobro con tarjeta trata "indeterminado" como "no se cobró", sin forma de reconciliar
- [ ] ⬜ 🟠 **#13** — `Order.paid` entra como piso en PricingService y termina siendo el techo de lo facturable ante ARCA
- [ ] ⬜ 🟠 **#14** — El camino de recuperación del cobro escribe `paid` **sin crear la fila de `Payment`** *(rompe la única prueba de venta real)*
- [ ] ⬜ 🟠 **#22** — Borrar una venta hace **hard-delete de todos sus pagos** y esquiva el candado de rendición

### B.4 Medios abiertos (21) — por familia

- [ ] ⬜ **Duplicación de reglas de negocio** (#7, #16, #19, #20, #28, #29): costo de cristales por par en 5 copias · la regla del 50% en 4 · condiciones comerciales en 8 pantallas + feed + bot · qué es "efectivo" declarado 11 veces y ya divergido · normalización de teléfono 7 veces *(Meta recibe un formato y Google otro)* · datos del negocio hardcodeados en 15+ lugares
- [ ] ⬜ **Concurrencia y transacciones** (#12, #23, #24): el ajuste de stock se commitea aparte 1200 líneas antes y sin guarda · la compensación de stock del checkout vive solo en la RAM · el email de carrito marca después de mandar, con la marca silenciada
- [ ] ⬜ **Estructura** (#10, #11, #25, #26): la ruta de Payway es un monolito de 1233 líneas · el alta de órdenes tiene 3 implementaciones divergidas · `order.service` importa `NextResponse` y un GET inexistente responde 200 con `{}` · dos rutas se llaman a sí mismas por HTTP y el middleware las rechaza
- [ ] ⬜ **Observabilidad** (#17, #27, #30, #31): 17 de 20 crons copian la auth con 3 semánticas incompatibles · **el PDF que recibe el cliente sale con los números en formato yanqui** · 708 `console.error` contra 8 `captureError` · la taxonomía de errores es comparación de substrings
- [ ] ⬜ **Trazabilidad** (#18): `labSentBy` —el campo que `CLAUDE.md` declara fuente de verdad del vendedor— no lo escribe nadie
- [ ] ⬜ **Opt-out** (#8, #15, #21): "Sin Seguimiento" tiene dos fuentes de verdad · el aviso "tu pedido está listo" está escrito 3 veces y el botón vivo puede mentir · el saldo tiene un segundo cuerpo en SQL crudo

> ⚠️ **El informe de arquitectura está incompleto:** 37 de 99 agentes fallaron por errores de conexión y ~20 hallazgos quedaron sin verificar. Conviene volver a correrlo.

---

## RESUMEN

| | Total | Cerrados | Abiertos | Los puedo hacer solo | Te necesitan |
|---|---:|---:|---:|---:|---:|
| Plan de ventas | 82 | 32 | 50 | 24 | 26 |
| Arquitectura | 31 | 5 | 26 | 26 | 0 |
| **Total** | **113** | **37** | **76** | **50** | **26** |

### Los 5 que más mueven la aguja

1. **Subir los 3 commits** — devuelve la medición y sube 6 arreglos de plata.
2. **Dar de alta los crons** — 20 minutos de panel; el código está terminado hace días.
3. **Higiene de conversiones en Google Ads** — hoy la puja aprende a comprar clics de dirección.
4. **Sacar el PREVENTA** — las fichas se contradicen y bloquea Merchant Center.
5. **Renovación de receta** (flujo 5) — el mayor ROI del plan, y no necesita un peso de pauta.
