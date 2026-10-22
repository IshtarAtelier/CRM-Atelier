# Por qué la tienda no vende y cómo seguimos — diez auditorías cruzadas (15/10/2026)

Diez agentes especializados recorrieron producción en paralelo (solo lectura,
entrando por `/interno` para no ensuciar Meta) y la base de producción (solo
SELECT). Informes individuales con capturas en el scratchpad de la sesión
(`agente-checkout`, `agente-ficha`, `agente-configurador`, `agente-precio`,
`agente-confianza`, `agente-datos`, `agente-meta`, `agente-performance`,
`agente-recupero`, `agente-catalogo`). Este documento es el cruce.

## 0. Lo que creíamos y no era así

Tres premisas del informe de la mañana se cayeron con los datos limpios:

| Creíamos | Es |
|---|---|
| "El checkout en celular no deja terminar: 0 de 13" | El formulario **funciona** en WebKit, Chromium y con 3G. De los 13 móviles, 6 eran pruebas nuestras del 25/9 y 1 Matías hoy. De los 7 de escritorio que "sí dejaban datos", 6 eran el **robot de Google Merchant** y 1 Ishtar. Personas reales que llegaron al checkout en 30 días: **7**. Ninguna dejó datos, en ningún dispositivo. |
| "El arreglo del checkout está sin deployar" | `deploy/tienda-10oct` **ya está en `origin/main`** (merge de hoy 16:09, otra sesión). Producción lo tiene. |
| "Nadie agrega sol ni clip-on" | Sí agregan: 10 sol y 9 clip-on en el mes (Siena, Zeus, Torino, Fénix son solares con nombre de Cápsula Escarlata). Convierten la mitad que receta, no cero. |

Y un dato que cambia la lectura de todo el embudo: **la mitad de lo que
contábamos como "intención" era ruido propio.** De 25 inicios de checkout,
17 fueron pruebas internas, el robot de Google o la compra de $1. Hay que
filtrar el bot de Merchant (`storebotmail.joonix.net`), las sesiones del 25/9
y el producto de prueba antes de leer cualquier número, también en el píxel de
Meta (le inflan los InitiateCheckout).

## 1. Las personas reales del mes

- **7 llegaron al checkout.** 6 se fueron sin tocar un campo; las 2 que
  avanzaron se frenaron en envío (probaron local, domicilio y sucursal) y en
  pago (transferencia, después Mercado Pago). 5 venían de anuncios de Meta y
  entraron al checkout entre 44 y 75 segundos después de ver la primera ficha:
  curiosidad, no decisión. 0 `checkout_submit`, 0 `checkout_error`.
- **4 de las 7 volvieron otro día al mismo producto** (una, tres veces).
  Entre las 299 sesiones que miraron 5 o más fichas sin agregar, 127 volvieron
  y 44 tocaron WhatsApp. Hay gente dando vueltas alrededor de la compra.
- **Ningún humano dejó mail ni teléfono en el checkout en 30 días.** Por eso
  los 3 mails de recupero del mes (y los 12 de 90 días) fueron todos al robot
  de Google, y el aviso al equipo a los 45 minutos nunca sonó por una persona.
- **233 clics a WhatsApp en 171 sesiones**, 200 desde celular, 100 desde
  fichas (Victoria C7, Victoria C5, Gala C8 al tope). Google orgánico trae el
  7 % de las sesiones pero el 31 % de los clics a WhatsApp.
- Los 28 contactos "de la tienda" del CRM son **18 personas** (8 filas
  duplicadas de un mismo cliente creadas en el mismo segundo por el bot, y 3
  del robot de Google). 13 recibieron presupuesto, 0 compraron. En 4 de los 17
  chats que tocó el motor de seguimientos, cuando el cliente respondió
  **ningún humano retomó**. Dos tareas "el bot pidió ayuda" llevan 13 y 24
  días vencidas.

## 2. Las causas, en orden de peso

### A. El precio no está justificado donde se compara (precio)

Armazón de receta: moda **$136.000**, contra $30.000 a $75.000 en las tiendas
argentinas que venden volumen online (Opticlick, Pagani, LOF) y $130.000 a
$278.000 en marcas de diseño. Cristal monofocal con antirreflejo **$49.500**:
competitivo. Combo **$185.500**: caro frente a un kit completo de $86.000. El
carrito promedio de $200.000 cae justo donde la persona compara y se va. Sol
$148.000 a $215.000 sin marca, contra Infinit $240.000 con marca, 9 fotos y
garantía explícita. Y la tarjeta apila tachado, "9 % OFF", "15 % transferencia",
"6 sin interés" y "12 fijas" sin decir material, origen ni garantía: nada que
explique por qué vale lo que vale.

### B. La ficha no vende en la primera pantalla (ficha + catálogo)

- Precio grande y botón real quedan a 800 a 1.280 px: dos pantallas abajo.
- **En sol y clip-on, el botón pegado "Comprar" no agrega al carrito: hace
  scroll** (`ProductClient.tsx:1197`). Es el único botón visible sin bajar.
- Receta muestra tres precios y dos descuentos ($123.250, "15 % OFF",
  $136.000 tachado, "9 % OFF", "$145.000 con tarjeta", chip rojo sobre la foto).
- La ficha que más vende dice "todavía no tenemos cargadas las medidas".
- 37 de 66 solares tienen una sola foto; ningún clip-on muestra el clip
  puesto; Florence C2 usa la foto del catálogo chino con el código impreso;
  Deneb y Zeus muestran "KAZWINI" en la patilla con marca Cápsula Escarlata.
- Sin zoom en las fotos. Sin "qué incluye" en sol (UV, estuche, garantía).
- 56 % de las 311 búsquedas sin resultado ("ray ban", "vulk", "orion").
- Publicadas y visibles: "PRUEBA de compra — no comprar" a $1 y un cristal
  Essilor a $913.780 sin foto.

### C. El configurador pierde a un tercio en el primer paso (configurador)

218 abren → **78 se van en el paso 1** (72 en celular) → 69 en la receta →
24 al carrito → 2 al checkout. En celular el paso 1 abre con título,
"Asistencia", el banner "Hacelos de sol", "Paso 1 de 4" y una barra fija de
168 px: la primera opción queda tapada y las otras tres debajo de la pantalla.
La persona ve un "Agregar al carrito" gris y nada para tocar. Cierra el modal,
no el sitio (sigue 52 segundos de mediana). Contador inconsistente (dice 4
pasos, son 3), jerga ("sin protección", "Antirreflex Premium"), dos totales
distintos, Varilux a +$1.404.103 sin explicación.

### D. Nadie pide el contacto antes de que se vaya (recupero)

La fila de recupero se crea recién cuando la persona escribe un mail o
teléfono válido. Los 7 reales se fueron antes. No hay forma de seguirlos, y
el único camino a un humano es el botón de WhatsApp. Cuando llegan por ahí,
la primera respuesta humana tarda 30 minutos de mediana pero 5 casos tardaron
entre 12 y 63 horas, y el seguimiento automático cierra con "seguinos en
Instagram" sin que nadie haya retomado.

### E. Falta lo que da confianza y lo que exige la ley (confianza)

Sin razón social ni CUIT en ninguna página. "Data Fiscal" es texto muerto sin
QR ni link. `/arrepentimiento` da 404 (la rama `feat/boton-arrepentimiento`
no está en main; la norma venció el 3/11/2025). Sin link a Defensa del
Consumidor. Políticas sin revocación de 10 días ni garantía legal de 6 meses.
Sin aceptación de términos antes de pagar. T&C y privacidad nombran Payway
pero se cobra por Mercado Pago. Plazos de entrega distintos en ficha (2
días), términos (5 a 7) y checkout (3 a 5). Lo que está bien: HTTPS, reseñas
5,0 con 739 opiniones visibles, links legales en todo el pie.

### F. La pauta manda curiosos, a una lista, con un objetivo que no aprende (Meta)

USD 90 en 30 días → 2.153 clics, 1.850 vistas, 28 carritos, 3 checkouts, 0
compras. No es la pauta (CTR 5 a 7 %, CPC USD 0,04). Es: objetivo
"agregar al carrito" con 28 eventos al mes (Meta no aprende con menos de 50
por semana), destino a `/tienda?genero=femme` donde el primer producto
aparece a 1.450 px (la persona ya eligió un modelo en el carrusel y cae en
una lista de 82), y armazones de receta a todo el país. Hombres gastó USD
1,29 en 30 días: no entrega. Frecuencia 2,8 a 3,0 en mujeres.

### G. Velocidad: ya no es el freno, pero regala un segundo (rendimiento)

LCP 2,9 s en ficha, 4,0 s en Armá tus lentes (mejor que el 28/9). TTFB 0,6 a
0,9 s por Railway en Singapur sin CDN (Cloudflare en gris, confirmado). 500 KB
de JS compartido en todas las rutas; el píxel de Meta y gtag cargan hasta en
el checkout. Un toque en "Comprar" se pierde a los 3,0 s de cargar la ficha.
Sin saltos de layout, sin errores de consola salvo un 401 inútil.

## 3. Diagnóstico en una frase

**La tienda no tiene un bug que impida comprar: tiene un producto caro para
el canal, presentado sin justificación, en una ficha que esconde el precio y
el botón, con un configurador que expulsa en el primer paso, sin pedir el
contacto a tiempo, sin los datos legales que dan confianza, y con pauta que
trae gente que todavía no decidió.** Cada una de esas cosas sola no explica
el cero; juntas, sí.

## 4. Cómo seguimos

### Esta semana (sin decisiones de precio, todo código o carga de datos)

1. **Higiene del embudo y de la base**: excluir el robot de Merchant, las
   pruebas y el producto de prueba de analítica, píxel y CRM; fusionar los 8
   duplicados; despublicar el cristal de $913.780. Despublicar la prueba de $1
   apenas Matías pague.
2. **Ficha**: el botón pegado de sol y clip-on agrega al carrito; precio y
   botón en la primera pantalla; un solo precio protagonista con una línea de
   cuotas; bloque "qué incluye"; medidas de los Cápsula Escarlata de receta.
3. **Configurador**: opciones del paso 1 a la vista en celular (banner de sol
   y "Tengo dudas" abajo, barra fija chica sin selección), contador "1 de 3",
   una frase por tipo que diga para quién es, un solo total.
4. **Checkout**: WhatsApp como primer campo y crear la sesión de recupero
   apenas lo escribe; sacar el botón flotante de WhatsApp de `/checkout`;
   sacar el resumen de escritorio duplicado abajo del botón de pago.
5. **Legales**: deployar `feat/boton-arrepentimiento` rebaseada; Ishtar pasa
   razón social, CUIT y el link del QR de Data Fiscal; checkbox de términos
   antes de pagar; unificar plazos de entrega; reemplazar Payway por Mercado
   Pago en las políticas.
6. **Seguimiento humano**: cuando un cliente responde al bot o al motor, aviso
   por mensajería interna y tarea para el mismo día; no cerrar con "seguinos
   en Instagram" mientras haya un presupuesto sin respuesta humana; alguien
   trabaja hoy los 13 presupuestos abiertos y cierra las 2 tareas vencidas.

### Decisiones de Ishtar (no las toma el código)

7. **Precio y oferta**: mostrar en la tarjeta "anteojo completo desde $X"
   calculado por `PricingService`; evaluar una línea de entrada de $90.000 a
   $100.000 o una rebaja real en los 40 modelos que hoy llevan el 9 %; dejar
   una sola promo visible por ficha; justificar el precio en la ficha
   (material, garantía, calibrado y control incluidos).
8. **Pauta**: pausar "Ventas | Tienda online" (USD 150 al mes, 0 compras, sin
   aprendizaje que perder). Campaña nueva "Tienda | Sol" con objetivo compras,
   catálogo solo sol y clip-on, destino la ficha, mujeres 25 a 54, USD 5 por
   día, evaluar a 14 días. Receta a WhatsApp con el anuncio `metaAtpReceta`
   (USD 2 a 3 por día) y remarketing a compras sobre los 1.850 visitantes del
   mes (USD 1 a 2 por día). Total igual o menor al actual.
9. **Fotos**: frente y en rostro para los 44 solares de una sola foto; clip
   puesto en los 10 clip-on; reemplazar las que muestran KAZWINI o códigos.
10. **Cloudflare en naranja** con caché de estáticos e imágenes: un segundo
    menos en todo el sitio sin tocar código. Decisión de infraestructura.

### Cómo sabremos si funcionó

Con el embudo limpio (sin bot ni pruebas), medir 4 semanas después de los
puntos 1 a 6: personas reales que llegan al checkout, cuántas dejan WhatsApp,
cuántas pagan, y cuántas de las que vuelven al mismo producto terminan
comprando por WhatsApp o por la tienda. Si con 50 o más carritos reales sigue
habiendo 0 pagos, la tienda queda como vidriera y la pauta va toda a Mensajes.
