# Estado de la tienda y de las campañas — 15/10/2026

Todo lo de acá salió de producción (base, Meta Ads y Google Ads), solo lectura,
ventana 15/9 → 15/10 salvo que diga otra cosa. Nada se tocó.

## 1. La tienda, en números

| Paso | 30 días | Últimos 7 días |
|---|---|---|
| Visitas (sesiones) | 5.690 | 980 |
| Vieron una ficha | 2.557 | 660 |
| Agregaron al carrito | 69 | 21 |
| Llegaron al checkout | 25 | 2 |
| Dejaron sus datos | 7 | 0 |
| Pagaron | **0** | **0** |

Las dos únicas órdenes web del período son pruebas nuestras (la de $136.000 del
18/9 y la de $1 del 8/10, las dos marcadas `test`). **La tienda sigue sin una
sola venta real**, igual que en las auditorías del 25/9 y del 8/10.

### Celular vs. computadora (30 días)

| | Celular | Computadora |
|---|---|---|
| Visitas | 3.097 | 2.608 |
| Fichas | 1.787 | 775 |
| Carrito | 53 | 16 |
| Checkout | 13 | 12 |
| Dejaron datos | **0** | **7** |

El celular trae el 70 % de las fichas y el 77 % de los carritos, y **ninguna
persona completó el formulario desde el teléfono**. Es el mismo patrón del 25/9
(10 → 0) y del 8/10 (10 → 0). El 8/10 se reprodujo en local y se encontró la
causa probable: la pastilla "Presupuesto" tapaba el campo Apellido en el
checkout. **Ese arreglo está en la rama `deploy/tienda-10oct` (24 commits) y
NO se deployó**: producción sigue con el checkout de antes.

### De dónde viene la gente y qué hace

| Fuente | Visitas | Fichas | Carrito | Checkout | Dejó datos |
|---|---|---|---|---|---|
| Directo / orgánico / WhatsApp | 4.070 | 1.305 | 31 | 20 | 7 |
| Meta pago (campaña de la tienda) | 1.409 | 1.148 | 37 | 4 | **0** |
| ChatGPT | 92 | 44 | 0 | 0 | 0 |
| Ficha de Google | 50 | 16 | 0 | 0 | 0 |
| Google Ads | 1 | 0 | 0 | 0 | 0 |

**171 sesiones hicieron clic en WhatsApp desde el sitio** (34 desde /tienda, 24
desde la landing de recetados, 9 desde la ficha de Victoria C7). La web sí
genera conversaciones; lo que no genera es pagos.

## 2. Las campañas, en números

### Meta — campaña "Ventas | Tienda online" (USD 5/día, prendida el 28/9)

- Gasto 30 días: ~USD 92. Clics al sitio: 2.650. CTR entre 5 % y 15 % (muy bueno).
- Compras: **0**. Datos dejados: **0**. De 1.148 personas que vieron una ficha,
  37 agregaron al carrito y 4 llegaron al checkout.
- Lo que vende: el carrusel de armazones de receta para mujeres (1.709 clics,
  USD 48). Hombres casi no recibe entrega (USD 2 en total).
- Conclusión: **los anuncios funcionan, la tienda no cierra.** El problema no
  está en la pauta.

### Meta — campaña "Mensajes" (a WhatsApp)

| Anuncio | Gasto | Chats | Cierres | Vendió | ROAS |
|---|---|---|---|---|---|
| ishvarilux | $131.440 | 73 | 1 | $972.070 | 7,4× |
| clip | $115.678 | 155 | 2 | $477.194 | 4,1× |
| agos | $41.071 | 30 | 0 | — | — |
| clipsjav | $25.638 | 16 | 0 | — | — |
| Total (con remarketing y placas) | $340.188 | 322 | 6 | $2.437.603 | **7,2×** |

195 de 322 chats recibieron presupuesto y 6 compraron (1,9 %). Es la campaña
que paga el resto. En el CRM, los contactos nuevos con origen Meta fueron 328 y
**16 compraron** (el ROAS de arriba solo cuenta los que traen etiqueta de
anuncio; los otros 10 llegaron por Meta sin etiqueta).

### Google Ads (Search - Recetados + Search - Multifocales)

- Gasto 30 días: $164.265. 539 clics. 178 "conversiones" reportadas, pero el
  76 % son "cómo llegar" (ya visto el 8/10).
- En el CRM: **31 contactos nuevos con origen Google Ads, 13 compraron (42 %)**.
  Es, por lejos, el origen que mejor cierra, aunque casi ninguno chatea: llaman
  o van al local. Google trae gente que ya decidió comprar.
- Search - Marca: $0 gastados, 3 impresiones. Sigue sin tomar las búsquedas de
  marca (se subió la puja el 8/10; evaluar ~22/10).

### Cómo cierra cada origen (contactos nuevos del mes, CRM)

| Origen | Contactos | Compraron | Tasa |
|---|---|---|---|
| Google Ads | 31 | 13 | 42 % |
| Calle | 23 | 12 | 52 % |
| Referido | 6 | 3 | 50 % |
| Google Maps | 10 | 2 | 20 % |
| Meta | 328 | 16 | 5 % |
| **Tienda online + Carrito web** | **28** | **0** | **0 %** |
| Sin origen | 95 | 0 | — |

Ventas totales del mes (enviadas a fábrica): 73, $25,2 M. **La web aportó $0.**

## 3. Por qué la tienda no vende (evaluación)

1. **Lo que la gente compra necesita receta y medición; la tienda vende
   armazones sueltos.** El 95,5 % de la facturación lleva cristales (auditoría
   del 25/9). Una persona con receta llega a la ficha, ve el armazón, y lo
   lógico es escribir por WhatsApp, no pagar un armazón sin saber qué cristal
   va. Por eso 171 clics a WhatsApp y 0 pagos: **la tienda ya funciona como
   vidriera, y como vidriera rinde**; como carrito, no.
2. **El checkout en celular no deja terminar.** 0 de 13 en 30 días, 0 de 10 en
   cada una de las dos mediciones anteriores. El arreglo existe desde el 8/10 y
   está sin deployar.
3. **Nunca se hizo una compra real de punta a punta.** La prueba de $1 del 8/10
   falló porque Mercado Pago no deja pagarse a uno mismo. No sabemos si el
   cobro, el webhook y el aviso funcionan con plata de verdad.
4. **La campaña de la tienda manda 1.400 personas al mes a un checkout que no
   cierra en celular**, y el 70 % del tráfico de Meta es celular. Cada dólar ahí
   hoy compra visitas, no ventas.
5. **Promesas que todavía están mal en producción**: el cartel superior dice
   "15% OFF en Efectivo o Transferencia • Hasta 12 Pagos" (la regla es "por
   transferencia", y "12 cuotas fijas"); se corrige en /admin/web (texto
   `web_announcement_text`) y la rama sin deploy ya rechaza esos textos.
6. **Las ventas se pierden después del clic, no antes.** Los 95 contactos sin
   origen y los 25 de "Tienda online" que no compraron son conversaciones que
   alguien tiene que seguir. El 8/10 se midió: ~59 chats quedaban colgados
   después de la primera respuesta.

## 4. Qué conviene hacer, en orden

1. **Deployar `deploy/tienda-10oct`** (rearmarla sobre el `main` de hoy, que
   avanzó 7 commits). Es lo único que puede mover el 0 del celular. No tiene
   migraciones ni decisiones pendientes.
2. **Una compra real de $1 con una tarjeta que no sea la de Ishtar** (Yani,
   Milena, Matías), con el producto de prueba republicado un rato. Verificar
   orden, pago, webhook, aviso y el envío a Meta. Hasta eso, no sabemos si la
   tienda puede cobrar.
3. **Mientras 1 y 2 no estén, pausar "Ventas | Tienda online"** (USD 5/día).
   No aprendió nada que valga la pena conservar: 0 compras. Esa plata rinde más
   en "Mensajes" (7,2×) o en la campaña de Stellest propuesta. Decisión de
   Ishtar; se pausa con un comando.
4. **Darle a la tienda el rol que ya tiene: vidriera con WhatsApp.** En
   celular, el botón principal de la ficha de un armazón de receta debería
   ser "Consultar por WhatsApp con mi receta", y "Comprar" el secundario. El
   carrito queda para sol y clip-on, que no necesitan receta.
5. **Google Ads: no tocar.** 13 ventas de 31 contactos. Sumar la campaña de
   Stellest aparte (ya validada) y seguir mirando Search - Marca el 22/10.
6. **Seguir los chats.** 95 contactos sin origen + 25 de tienda sin una venta:
   ahí hay más plata que en cualquier cambio de la tienda. El panel
   "Oportunidades de cierre" ya los lista.
