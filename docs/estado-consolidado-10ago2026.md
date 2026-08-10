# Estado consolidado — 10 de agosto de 2026

Un solo documento con las **tres listas** que hoy están abiertas, porque son cosas distintas y mezclarlas confunde:

| Lista | Qué es | Dónde vive |
|---|---|---|
| **A. Plan de ventas** | Cómo vender más: campañas, landings, retención, placas | `docs/plan-maquina-de-vender.md` |
| **B. Auditoría de arquitectura** | Qué está mal construido y por dónde se pierde plata que ya entra | Este documento, §3 |
| **C. Ya hecho** | Lo desplegado y lo commiteado sin subir | §1 |

> **Lo que hay que entender de la lista B:** no estaba en el plan que se pidió. Apareció al auditar el código. Y hasta ahora encontró cosas **más caras que el plan comercial entero** — un solo hallazgo, el precio de Varilux, valía $673.298 por par.

---

## 1. YA HECHO

### 1.1 En producción (desplegado el 10/8)

40 commits. Verificado en el sitio vivo.

| Qué | Por qué importaba |
|---|---|
| **Precio de Varilux** — la web publicaba $1.346.599 y el checkout cobraba $673.301 | Se perdían **$673.298 por par**, y al laboratorio le iba el cristal equivocado |
| Cartel de cookies tapaba los dos CTAs del hero en celular | El 100% del tráfico pago mobile aterrizaba sin acción visible |
| "Multifocales Varilux · Garantía 30 días" fijo en el hero + en el nav mobile | El producto de ticket alto no se nombraba donde entra el tráfico |
| Los CTAs se desvanecían cada 5 segundos con la rotación del carrusel | El botón principal parpadeaba |
| Carrusel del hero pasaba por pantalla negra | — |
| og:image AVIF → los links compartidos por WhatsApp salían sin foto | WhatsApp es el canal de cierre |
| Compra por transferencia no se medía (ni Meta, ni GA, ni panel propio) | Es el camino con 15% off, probablemente el más usado |
| Doble conteo de compras (el navegador mandaba un UUID al azar como id) | Meta contaba cada venta dos veces |
| `aggregateRating` autodeclarado 5.0/677 | Riesgo de acción manual de Google sobre todo el dominio |
| 46 doorways `/blog/busquedas/` → 301 a la página real | Ídem |
| **Cron de carritos: clave publicada en el repo + bypass con `?x=localhost`** | Cualquiera podía disparar mails a toda la base de clientes |
| **Backup del `.env` con secretos reales fuera del `.gitignore`** | Estaba a un `git add -A` de entrar al repo |
| Checkout: cuotas reales, urgencia falsa, pantalla de transferencia con importe, DNI opcional | 4 puntos donde se perdía una venta ya ganada |
| Stories con precio sin fecha ni guarda de frescura | Podían publicar un precio de hace meses |
| Chat de WhatsApp ↔ ficha del cliente (B5) | Sin eso el ROAS por anuncio subestima |
| Panel de salud de medición + crecimiento mes a mes + techo de inversión | — |
| UTMs en el pipeline social | Separar orgánico de pago |

### 1.2 Commiteado, **falta subir**

```bash
cd /Users/ishtarpissano/proyectos/atelier-auditoria && git push origin deploy/bot-recetas:main
```

| Qué | Medido |
|---|---|
| **Saldo global del dashboard** usaba `lista − cobrado` | Daba $5.583.845 contra $3.419.152 real — **63% inflado**. Además 8 pagos por $2.184.971 sobre presupuestos descontaban deuda de ventas |
| **76 conversiones fantasma** a Google (`Boolean('NONE')` es `true`) | La regla buena cuenta 35 ventas; esa copia contaba 111 |
| Una sola definición de "venta real" (`src/lib/constants/ventas.ts`) | Al unificarla apareció otro bug: el dashboard de marketing contaba pedidos LOST y CANCELED como facturación |

---

## 2. PLAN DE VENTAS — lo que falta

De los 82 ítems: **30 hechos · 9 a medias · 43 pendientes.**

### 2.1 Puedo hacerlo solo (26)

Ordenados por impacto en ventas.

| # | Qué | Esf. |
|---|---|---|
| 1 | **Landing `/multifocales`** — hoy 404. El head term del producto de $834k manda su tráfico pago a la nada. *(a medias: el ancla de precio ya está, faltan 2 archivos)* | M |
| 2 | **La receta que se tira a la basura** — el dropzone del configurador guarda solo el nombre del archivo y descarta los bytes | S |
| 3 | **Badge 2x1 y "se hace de sol con tu receta"** en la ficha | S |
| 4 | **Cross-sell por afinidad** — hoy recomienda los 4 destacados, sin relación con lo que estás mirando | M |
| 5 | **Texto de garantía** duplicado a mano en 6 archivos | S |
| 6 | **`PageView` no se re-dispara al navegar** — los públicos de remarketing por URL salen más chicos de lo real | S |
| 7 | **Huecos de medición** — configurador, armador, quiz y popup no reportan nada: no se sabe dónde abandona la gente el producto de $834k | M |
| 8 | Evento `search` declarado y nunca disparado + mostrar en el panel cuánta gente ignora el cartel de cookies | S |
| 9 | **ISR de /tienda, /lentes-de-sol y /receta** — declaran `revalidate` pero se renderizan dinámicas: letra muerta | M |
| 10 | **150 imágenes de hasta 6064px** (31 MB en `public/`) sin bajar de tamaño | M |
| 11 | **Aviso de despacho post-pago** — hoy el cliente paga y no recibe nada hasta el retiro | M |
| 12 | **Posventa a 10 días** + pedido de reseña encadenado | M |
| 13 | **Reseña de Google automatizada** — las tareas se crean pero nadie las levanta | M |
| 14 | Exclusión mutua de 14 días entre flujos (prerequisito de prender el segundo) | S |
| 15 | Carrito multi-toque + captura de fecha de nacimiento en el checkout | M |
| 16 | **Plantilla de testimonio** para las placas + generador de piezas de multifocal | M/L |
| 17 | 4 piezas nuevas del calendario + campo CTA en las stories | S |

### 2.2 Necesita algo tuyo (17)

| Qué se necesita | Desbloquea |
|---|---|
| **Alta de los crons** en el scheduler (20 min en un panel) | Carrito abandonado, reporte diario de ads, calendario social entero |
| **Cargar 4 variables en Railway** (`NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_GOOGLE_ADS_TAG_ID`, labels de WhatsApp y Llamada) | Hoy **Google no recibe ninguna conversión del sitio**: la pauta optimiza a ciegas |
| **En Google Ads:** pasar a secundarias las 5 acciones locales + la de Tiendanube | Es lo que le enseña a la puja a comprar clics de "Cómo llegar" — el 44% del gasto |
| **Regenerar 3 piezas con precio** (vencen: se generaron el 6/8, la guarda corta a los 10 días) | Dos publicaciones programadas se saltean solas |
| Autorización para leer producción | Limpiar "PREVENTA" de las fichas, aplicar 114 fichas SEO, reactivar 5 productos |
| ¿Qué convenios de obras sociales están activos? | Sitelink, keywords, placa |
| Nombre y matrícula del director técnico | Obligatorio en ópticas argentinas |
| Medir 92 armazones (`frameHeight`) | Badge "apto multifocal" y filtro de sol con receta |
| Definir escalera de precios y qué 3-5 productos van en oferta | El código ya está listo |
| Cloudflare (proxy naranja + SSL) | ~800 ms menos por clic pago |
| Merchant Center, MP Checkout Pro, turnos online, 301 del subdominio promo | — |

---

## 3. AUDITORÍA DE ARQUITECTURA — 31 hallazgos

**3 resueltos, 28 abiertos.** Todos son código: los puedo hacer solo.

### 3.1 El diagnóstico de fondo, en una frase

Las abstracciones correctas **existen y están escritas** (`PricingService`, `factory-gate.ts`, `cron-auth.ts`, `BUSINESS_INFO`, `checkout-pricing.ts`). El problema es que **las copias viejas quedaron vivas al lado** y nada obliga a migrar. En cuatro casos verificados el helper "canónico" hoy no lo llama nadie — así que quien arregle el bug "en el lugar correcto" no toca nada de lo que corre.

Los tres que ya arreglé eran la misma enfermedad: el saldo correcto ya se calculaba al lado y nadie lo sumaba; la exclusión de Varilux existía en la tienda y no en el checkout; la regla de venta estaba bien en dos lugares y mal en uno.

### 3.2 Abiertos, por severidad

**🟠 Alta (7)**

| # | Qué | Por qué importa |
|---|---|---|
| 4 | **El Copiloto se saltea el gate de fábrica** | Cualquier vendedor puede escribirle "pasá a enviado el pedido de Juan" y sale sin el 50%, sin foto de receta, sin alturas ni DP. Tu regla existe en el código (`authorizedByAdmin`, solo ADMIN) — esta es una puerta lateral |
| 5 | **El bot de WhatsApp inventa los precios** | Toma la lista como si fuera contado y le suma 15% llamándolo "sin interés" |
| 6 | `saldo = total − paid` re-implementado en **6 consumidores**, incluido el que le habla al staff | La fórmula prohibida, otra vez |
| 9 | El cobro con tarjeta trata "indeterminado" como "no se cobró" | Sin forma de reconciliar |
| 13 | `Order.paid` entra como piso en `PricingService` y termina siendo el techo de lo facturable ante ARCA | — |
| 14 | El camino de recuperación del cobro escribe `paid` **sin crear la fila de `Payment`** | Rompe la única prueba de venta real |
| 22 | Borrar una venta hace **hard-delete de todos sus pagos** y esquiva el candado de rendición | Se pierde el rastro del dinero |

**🟡 Media (21)** — resumidas por familia:

- **Duplicación de reglas de negocio:** costo de cristales por par (5 copias), regla del 50% (4 copias existiendo `factory-gate.ts`), condiciones comerciales (8 pantallas + feed + bot), qué es "efectivo" (11 declaraciones ya divergidas), normalización de teléfono (7 veces — Meta recibe un formato y Google otro), datos del negocio hardcodeados en 15+ lugares.
- **Concurrencia y transacciones:** el ajuste de stock se commitea aparte 1200 líneas antes del update y sin guarda; la compensación de stock del checkout vive solo en la RAM del request; el email de carrito abandonado marca después de mandar, con la marca silenciada.
- **Estructura:** la ruta de Payway es un monolito de 1233 líneas; el alta de órdenes tiene tres implementaciones divergidas; `order.service.ts` importa `NextResponse` y un GET de orden inexistente responde 200 con `{}`; dos rutas se llaman a sí mismas por HTTP y el middleware las rechaza con 403.
- **Observabilidad:** 708 `console.error` contra 8 `captureError`; `withErrorHandler` se usa en 1 de 186 rutas; 17 de 20 crons copian la autenticación con tres semánticas incompatibles; no hay formateador de plata (236 `toLocaleString()` sin locale — **el PDF que recibe el cliente sale en formato yanqui**).
- **Trazabilidad:** `labSentBy` —el campo que `CLAUDE.md` declara fuente de verdad del vendedor— no lo escribe nadie.

### 3.3 Salvedad honesta

**37 de 99 agentes fallaron** por errores de conexión, así que ~20 hallazgos quedaron sin verificar y no entraron acá. Este informe **está incompleto**. Convendría volver a correrlo.

---

## 4. LO QUE DEPENDE DE UNA DECISIÓN TUYA

1. **Subir los 2 commits pendientes** (comando arriba).
2. **El Copiloto y fábrica:** ¿que pueda mandar a fábrica pasando por el gate (y si falta algo te diga qué falta)? ¿Que no pueda mandar a fábrica pero sí lo demás? ¿Solo ADMIN?
3. **Dónde trabajo:** la carpeta principal la tiene otra sesión; estoy en el worktree `atelier-auditoria` con bloqueos intermitentes de permisos.
4. Los 17 ítems de §2.2.

---

## 5. QUÉ HARÍA YO, EN ORDEN

1. **Subir los 2 commits.** El saldo inflado 63% es el número que mirás todos los días.
2. **Las 4 variables de Railway.** Hoy Google no ve una sola conversión del sitio: cada peso de esa pauta se decide a ciegas.
3. **El alta de los crons.** Código terminado hace días esperando 20 minutos de panel.
4. **El Copiloto** (con tu decisión) y **el bot que inventa precios**. Los dos tocan plata.
5. **La landing `/multifocales`.** Es el único ítem del plan comercial que está en el top: el producto que más factura manda su tráfico pago a un 404.
