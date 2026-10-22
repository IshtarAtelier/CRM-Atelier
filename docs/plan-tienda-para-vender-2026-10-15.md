# Plan para que la tienda venda — 15/10/2026

Sale del cruce de las diez auditorías del 15/10
(`docs/diagnostico-tienda-10-agentes-2026-10-15.md`). Está escrito para
ejecutarse en ese orden: cada fase deja algo medible y la siguiente no
arranca a ciegas. Cada tarea dice quién la hace (**Código** = lo hace Claude
en una rama y pide OK para deployar; **Ishtar** = decisión o dato que solo
ella tiene; **Equipo** = una persona del local), qué archivos toca, cómo se
comprueba que quedó bien y qué número tiene que mover.

Regla general del plan: **nada se deploya sin pasar `npm run check:orden`,
`check:plata`, `tsc`, `lint`, build y una prueba en celular con Playwright
contra local, y nada se prueba en producción sin abrir `/interno` antes.**

---

## Objetivo y cómo se mide

**Objetivo a 6 semanas:** que la tienda cierre ventas sola, con un embudo
limpio que permita saber por qué sí o por qué no.

Métricas semanales, siempre sin robots, sin pruebas y sin el producto de $1
(ver Fase 0):

| Métrica | Hoy (30 días, limpio) | Meta semana 6 |
|---|---|---|
| Sesiones reales que ven una ficha | ~2.400 | mantener |
| Ficha → carrito | 2,2 % receta · 1,8 % sol · 2,5 % clip-on | 4 % / 4 % / 4 % |
| Carrito → checkout (personas reales) | 7 de ~50 | 20 de 50 |
| Checkout → deja WhatsApp | **0** | 60 % de los que entran |
| Checkout → paga | **0** | 3 a 5 ventas por mes |
| Chats desde la tienda que compran | 0 de 18 | 3 de 18 |
| Configurador: paso 1 → receta | 69 de 218 (32 %) | 55 % |

Dónde se lee: `/admin/analitica` (sección "Dónde se traban") y la consulta
limpia que queda en `scripts/checks/embudo-tienda-limpio.mjs` (Fase 0).

---

## Fase 0 — Ver claro (días 1 y 2)

Sin esto, cualquier cambio después se mide mal. Es lo que hizo que durante
tres semanas creyéramos que el checkout estaba roto.

| # | Tarea | Quién | Cómo se comprueba |
|---|---|---|---|
| 0.1 | Excluir del embudo, del píxel y del CRM al robot de Google Merchant (`storebotmail.joonix.net`, mañanas ~07:30 ART), las sesiones de prueba del 25/9 y todo lo que toque `prueba-compra-un-peso`. Centralizar la regla en `src/lib/checkout/robots.ts` (ya tiene `SIN_ROBOTS`) y usarla también en `/api/web/track` antes de espejar a Meta CAPI. | Código | Query de 30 días: 0 filas con ese mail; InitiateCheckout del píxel baja a ~8 por mes. |
| 0.2 | Script `scripts/checks/embudo-tienda-limpio.mjs --prod` (solo lee): embudo por dispositivo y por fuente con las exclusiones, y el "paso donde se traban" del configurador. Es la foto semanal. | Código | Corre sin red salvo la base; imprime la tabla de arriba. |
| 0.3 | Fusionar los 8 contactos duplicados "Titino" (creados el 21/9 13:08 en el mismo segundo por el bot) y arreglar la carrera en la creación de contactos del bot (`wa-service`, creación por teléfono sin lock). | Código | Un solo contacto; test que crea dos a la vez y queda uno. |
| 0.4 | Despublicar el cristal Essilor de $913.780 sin foto. Despublicar "PRUEBA de compra — no comprar" apenas Matías termine (stock 0, `publishToWeb=false`, borrar la fila de `WebProduct`). | Código, con aviso | Las dos URLs dan 404; `/receta` no las lista. |
| 0.5 | Verificar la compra de $1 de punta a punta cuando Matías pague: orden, `WebPaymentIntent` APPROVED, aviso "PAGADA" en la campanita, mail al cliente, fila en `MetaConversion` enviada. Si algo falla, es prioridad sobre todo el resto del plan. | Código | Checklist de 5 ítems en verde. |
| 0.6 | Decidir qué tarjeta y CUIT facturan la tienda (hay CUIT de Ishtar y de Yani). Pasar razón social, CUIT, y el link del QR F.960/D de Data Fiscal. | **Ishtar** | Los tres datos cargados en `src/lib/business-info.ts`. |

---

## Fase 1 — Que la ficha venda en la primera pantalla (semana 1)

Es donde está el 100 % del tráfico y donde hoy el 97 % se va.

| # | Tarea | Quién | Archivos | Comprobación |
|---|---|---|---|---|
| 1.1 | **El botón pegado de sol y clip-on agrega al carrito.** Hoy hace `scrollIntoView` (`ProductClient.tsx:1197`). Pasa a agregar directo y abrir el carrito. | Código | `src/app/producto/[slug]/ProductClient.tsx` | Playwright iPhone 13: tocar el botón pegado en una ficha de sol → `cart:true`. |
| 1.2 | **Precio y botón en la primera pantalla** (celular): foto, nombre, UN precio grande, una línea de cuotas, y el botón principal, todo antes de los 700 px. El resto (descripción, medidas, acordeones) abajo. | Código | `ProductClient.tsx` | Captura a 390×844 muestra precio y botón sin scroll. |
| 1.3 | **Un solo precio protagonista.** En receta: precio por transferencia grande, debajo "o $X con tarjeta · 3 y 6 cuotas sin interés". Sacar el chip rojo "-9 % OFF" sobre la foto y el tachado cuando ya hay badge; una sola promo visible por ficha. El cálculo sigue en `PricingService.vidrieraDeProducto`; acá solo se elige qué mostrar. | Código | `ProductClient.tsx`, `src/components/Storefront/` (tarjeta) | `check:oferta` y `check:plata` verdes; la ficha muestra 2 números, no 5. |
| 1.4 | **Barra pegada de receta con las dos salidas:** "Solo armazón $X" y "Elegir mis cristales". Hoy la única visible es la segunda y "Comprar solo el armazón" queda a 1.186 px. | Código | `ProductClient.tsx` | Ambos botones visibles en celular en todo el scroll. |
| 1.5 | **Bloque "Qué incluye"** bajo el botón: receta (armazón, calibrado y control, garantía de adaptación 30 días, estuche y paño), sol (UV400 o polarizado según el producto, estuche, paño, garantía legal 6 meses), clip-on (armazón + 2 clips, lo que corresponda). Los datos salen de los campos del producto, no se escriben a mano. | Código + **Ishtar** confirma qué incluye cada categoría | nuevo `src/lib/ficha/que-incluye.ts` (único helper, lo usan ficha y PDF) | Las tres categorías muestran el bloque; `check:ficha` lo exige. |
| 1.6 | **Medidas en los armazones de receta Cápsula Escarlata** (hoy "todavía no tenemos cargadas las medidas" en la ficha que más vende). Script que lee calibre/puente/patilla de la base y lista cuáles faltan; Equipo las mide y carga en /admin. | Código (lista) + **Equipo** (carga) | `scripts/checks/medidas-faltantes.mjs` | 0 fichas de receta sin medidas. |
| 1.7 | **Zoom en fotos** (tap para ampliar, pinch) y sin pantalla en blanco al cambiar de foto (precargar la siguiente). | Código | `ProductClient.tsx` galería | Playwright: doble tap amplía. |
| 1.8 | **Buscador tolerante**: acentos, "ray ban" → "no trabajamos esa marca, mirá estos", "orion" sin tilde. Hoy 56 % de 311 búsquedas sin resultado. | Código | `src/lib/catalog/busqueda-tienda.ts`, `check:busqueda-tienda` | Las 20 búsquedas más frecuentes sin resultado devuelven algo. |

**Número que tiene que moverse:** ficha → carrito de 2,2 % a 4 % en receta y de 1,8 % a 4 % en sol.

---

## Fase 2 — Que el configurador no expulse (semana 1 y 2)

| # | Tarea | Quién | Archivos | Comprobación |
|---|---|---|---|---|
| 2.1 | **Paso 1 con las opciones a la vista en celular.** Cabecera comprimida (título + "1 de 3"), el banner "Hacelos de sol" y "Tengo dudas" van abajo de las opciones, la barra fija del total se achica cuando no hay nada elegido (hoy 168 px). | Código | `src/components/Storefront/LensConfigurator.tsx` | Captura iPhone 13: las 4 opciones del paso 1 visibles sin scroll. |
| 2.2 | **Contador real "1 de 3"** y una frase por tipo que diga para quién es ("Monofocal: ves mal de lejos o de cerca, una sola graduación"; "Multifocal: lejos y cerca en el mismo lente, a partir de los 40"). | Código + **Ishtar** valida las frases | mismo archivo; textos en `src/lib/cristales-web/` | Las frases pasan por Ishtar antes del deploy. |
| 2.3 | **Un solo total** en barra y desglose (el de transferencia, con "o $X con tarjeta" chico). Sacar "(sin protección)" de Básico; jerga ("Antirreflex Premium", "Policarbonato") en un plegable "¿qué es esto?". | Código | `LensConfigurator.tsx`, `src/lib/cristales-web/calculo.ts` sigue siendo la única fuente | `check:cristales` verde; la barra muestra un número. |
| 2.4 | **Explicar los saltos de precio**: cuando una opción suma más de $300.000 (Varilux +$1.404.103), una línea que diga por qué ("progresivo premium, fabricado a medida"). Umbral en constante, texto desde el producto. | Código | `LensConfigurator.tsx` | La opción cara muestra la explicación. |
| 2.5 | En `/arma-tus-lentes` la foto del modelo empuja el paso 1 a 842 px: la foto pasa a un carrusel chico arriba, o a la derecha en escritorio. | Código | `src/app/arma-tus-lentes` | Paso 1 visible sin scroll. |

**Número:** paso 1 → receta de 32 % a 55 %; configurador completo de 24 a 50 por mes.

---

## Fase 3 — Pedir el contacto antes de que se vaya y seguirlo (semana 2)

| # | Tarea | Quién | Archivos | Comprobación |
|---|---|---|---|---|
| 3.1 | **WhatsApp como primer campo del checkout y crear la sesión de recupero apenas lo escribe** (hoy la fila nace cuando hay mail válido, `CheckoutClient.tsx:479`, y los 7 reales se fueron antes). Validar el número en vivo. | Código | `src/app/checkout/CheckoutClient.tsx`, `src/app/api/checkout/session/route.ts` | Playwright: escribir un teléfono y cerrar → existe `CheckoutSession` PENDING con phone. |
| 3.2 | **Sacar el botón flotante de WhatsApp de `/checkout`** (pisa Nombre/Apellido) y **el resumen de escritorio que se renderiza duplicado** debajo del botón de pago en celular (la página mide 4.343 px). | Código | `CheckoutClient.tsx`, `CheckoutResumenCelular.tsx` | Página de checkout en celular < 2.000 px; sin flotante. |
| 3.3 | **Envío y cuotas visibles antes del checkout**: en el carrito, "Envío gratis a todo el país · retiro en el local" y la cuota. Las 2 personas que avanzaron se frenaron en envío y pago. | Código | componente del carrito | El carrito muestra envío y cuota. |
| 3.4 | **Recupero por WhatsApp, no solo por mail**: a los 45 minutos con teléfono cargado, aviso al equipo por mensajería interna con link a la ficha del cliente y botón "escribirle"; a las 24 h, si nadie escribió, plantilla aprobada de Meta con el carrito. Respeta `TIER_250` y el motor de seguimientos. | Código + **Ishtar** aprueba el texto de la plantilla | `src/lib/checkout/aviso-equipo.ts`, `src/services/cart-recovery.service.ts`, `wa-service` | Prueba en local con una sesión falsa: llega el aviso; a las 24 h se encola la plantilla. |
| 3.5 | **Cuando un cliente responde al bot o al motor, un humano lo ve el mismo día**: aviso interno + tarea con vencimiento ese día; el motor no cierra con "seguinos en Instagram" mientras haya un `BUDGET_SENT` sin respuesta humana posterior. | Código | `src/lib/seguimientos/politica.ts`, `check:motor` | `check:motor` cubre el caso; en 4 chats del mes nadie retomó. |
| 3.6 | **Hoy**: una persona retoma los 13 presupuestos abiertos de la tienda con una pregunta concreta ("¿te lo reservo para probártelo el jueves?") y cierra las 2 tareas "el bot pidió ayuda" vencidas hace 13 y 24 días. | **Equipo** | Panel Oportunidades de cierre | 13 chats con mensaje humano fechado hoy. |
| 3.7 | **El origen "Tienda online" se ve en la ficha del cliente y en Cierres**, con el producto que miraba (hoy se asigna solo pero no cuenta qué miró). | Código | `WhatsAppAttribution`, `cierres.service.ts` | La tarjeta de Cierres muestra "miraba Victoria C7". |

**Número:** checkout → deja WhatsApp de 0 a 60 %; chats de la tienda que compran de 0 a 3 de 18.

---

## Fase 4 — Confianza y ley (semana 2)

| # | Tarea | Quién | Archivos | Comprobación |
|---|---|---|---|---|
| 4.1 | **Razón social, CUIT, dirección y teléfono en el pie** de todo el sitio público, con el **QR de Data Fiscal real** (logo F.960/D con link). | **Ishtar** (datos) + Código | `src/lib/business-info.ts`, `StorefrontFooter.tsx`, `StorefrontFooterStatic.tsx`, `check:businessinfo` | El pie muestra CUIT y el QR linkea a AFIP. |
| 4.2 | **Botón de arrepentimiento**: rebasear `feat/boton-arrepentimiento` sobre `origin/main` y deployar (`/arrepentimiento` hoy da 404; norma vencida el 3/11/2025). Link en el pie y a la Ventanilla Federal. | Código | rama existente (4 commits) | `/arrepentimiento` responde; genera código ARR-…; mail al cliente. |
| 4.3 | **Políticas**: derecho de revocación 10 días (art. 34), garantía legal 6 meses (art. 11), cambios, envío; reemplazar Payway por Mercado Pago; **un solo plazo de entrega** en ficha, términos y checkout (hoy 2 / 5-7 / 3-5). | **Ishtar** decide plazo y condiciones; Código las carga; abogado revisa `docs/legales-tienda-borrador-revision.md` | `src/app/terminos*`, `politicas-*` | Las tres páginas coinciden; `check:politica` verde. |
| 4.4 | **Aceptar términos antes de pagar** (checkbox con link) y página de éxito real (`/checkout/aprobado` no existe; hoy es un toast). | Código | `CheckoutClient.tsx`, nueva `src/app/checkout/aprobado` | Sin tilde no se puede continuar; MP vuelve a una página con el pedido. |
| 4.5 | Logos de medios de pago (Mercado Pago, tarjetas) junto al botón de pagar; privacidad que mencione cookies y píxeles. | Código | checkout, `politicas-de-privacidad` | Visible en celular. |
| 4.6 | Cartel superior y T&C sin "efectivo o transferencia" ni "12 sin interés" (el `/admin/web` nuevo ya los rechaza; revisar el texto guardado en `SystemSetting.web_announcement_text`). | **Ishtar** desde /admin/web | — | Captura del cartel. |

---

## Fase 5 — Precio y oferta (semana 3; decisiones de Ishtar, el código las ejecuta)

Lo que dicen los datos: armazón $136.000 contra $30.000 a $75.000 en las
tiendas de volumen; cristal competitivo; combo $185.500 contra kits de
$86.000; sol $148.000 a $215.000 sin marca contra $240.000 con marca y 9
fotos. No hay que regalar nada: hay que **mostrar el valor donde se compara**
y tener **una puerta de entrada**.

| # | Decisión / tarea | Quién | Comprobación |
|---|---|---|---|
| 5.1 | **"Anteojo completo desde $X" en tarjeta y ficha de receta**, calculado por `PricingService` con el cristal base. La rama `feat/anteojo-completo-desde` ya existe; falta que Ishtar elija el cristal base (`CRISTAL_BASE_ANTEOJO_COMPLETO`, propuesto monofocal orgánico AR $49.500) y rebasearla. | **Ishtar** elige + Código | `check:anteojo-completo` verde; la tarjeta muestra "completo desde". |
| 5.2 | **Una línea de entrada** de $90.000 a $100.000 (armazón) o rebaja real en los 40 modelos que hoy llevan "9 % OFF" (que parece sumarse al 15 %). Alternativa sin tocar precio: el 9 % pasa a ser "precio de tienda" fijo y desaparece el badge. | **Ishtar** | Precio cargado en /admin; `check:aumento-precios` verde. |
| 5.3 | **Justificar el precio en ficha y tarjeta**: material (acetato / TR90 / metal), origen, garantía, "calibrado y control incluidos", "lo medimos con vos por WhatsApp". Sale de los campos del producto (Fase 1.5). | Código + **Ishtar** valida textos | La ficha dice de qué está hecho. |
| 5.4 | **Sol**: definir qué es el producto (¿polarizado? ¿UV400?) y decirlo; evaluar bajar la mediana ($215.000, más que receta) o justificarla. 2x1 web sigue apagado (`eligible2x1Web = 0`): decidir si se prende para sol como gancho. | **Ishtar** | Decisión escrita; si se prende el 2x1, `check:promo2x1web` verde. |
| 5.5 | Tramos del filtro de precio por categoría (hoy "Hasta $140.000" en sol devuelve 0). | Código | `src/lib/catalog/rango-precio.ts` | Ningún tramo vacío. |

---

## Fase 6 — Fotos y catálogo (semanas 2 a 4, en paralelo)

| # | Tarea | Quién | Comprobación |
|---|---|---|---|
| 6.1 | Lista automática de fichas con una sola foto (37 de 66 solares) y sin foto en rostro (44 de 66 sol+clip). | Código | `scripts/checks/fotos-faltantes.mjs --prod` |
| 6.2 | Sesión de fotos: frente + en rostro para los 44 solares; **clip puesto** en los 10 clip-on; reemplazar Florence C2 (foto del catálogo chino con código) y Deneb/Zeus (patilla "KAZWINI"). Mismas reglas que las stories de Agostina (frente y perfil, sin la foto en manos). | **Equipo** + Código para cargar | 0 fichas en la lista de 6.1. |
| 6.3 | Nombres sin código de fábrica ("Zeus C33-P86" → "Zeus Negro"), marca uniforme en tarjeta (hoy ATELIER / CÁPSULA ESCARLATA / alt "undefined"). Las fichas renombradas redirigen (`fix/fichas-renombradas-redirigen`). | Código + **Ishtar** valida nombres | `check:seo-tienda` verde; sin alt "undefined". |
| 6.4 | Colección "Polarizados" y "Más vendidos" (los 10 más agregados: Calipso Oval Negro, Artemis, Dionisio C4, Minerva C2, Rigel C3, Calipso Carey, Siena, Olimpia, Victoria C7, Gala C8) arriba de /tienda. | Código | Orden visible. |

---

## Fase 7 — Pauta (semana 3, después de Fases 1 a 3; todo con OK explícito)

| # | Tarea | Quién | Costo |
|---|---|---|---|
| 7.1 | **Pausar "Ventas | Tienda online"** (USD 5/día, 0 compras, sin aprendizaje que perder). | **Ishtar** pega el comando | ahorra USD 150/mes |
| 7.2 | **Campaña nueva "Tienda | Sol"**: objetivo compras, catálogo filtrado sol + clip-on, destino **la ficha** (no la lista), mujeres 25 a 54, Córdoba + ciudades grandes, exclusión de compradores 180 días. Se arma con `crear_campania_ventas_tienda.js` adaptado, pausada, se prende con OK. | Código + **Ishtar** | USD 5/día |
| 7.3 | **Receta a WhatsApp**: anuncio `metaAtpReceta` ya existente ("mandá la foto de tu receta"), conjunto nuevo en Mensajes. | Código + **Ishtar** | USD 2 a 3/día |
| 7.4 | **Remarketing a compras** sobre los 1.850 visitantes/mes de la tienda y los que vuelven a la misma ficha, recién cuando la tienda tenga 2 semanas de Fases 1 a 3. | Código + **Ishtar** | USD 1 a 2/día |
| 7.5 | **Google**: no tocar Recetados ni Multifocales (13 ventas de 31 contactos). Sumar "Search - Stellest" (validada). Search - Marca: evaluar el 22/10. | **Ishtar** OK | $3.000/día Stellest |
| 7.6 | Destinos de pauta con `?utm_content=<id del anuncio>` y la ficha como landing; el feed de Merchant/Meta ya lleva `custom_label_3`. | Código | utm llega a `AnalyticsEvent`. |

Total de pauta hacia la tienda: igual o menor al actual (USD 8 a 10/día).

---

## Fase 8 — Infraestructura (cuando Ishtar decida; media hora)

| # | Tarea | Quién | Efecto |
|---|---|---|---|
| 8.1 | **Cloudflare en naranja** con caché de `/_next/static` e `/_next/image` (hoy DNS en gris, Railway en Singapur, TTFB 0,6 a 0,9 s). | **Ishtar** en el panel de Cloudflare, con guía de un paso por vez | TTFB ~0,15 s, ~1 s menos de LCP en todo el sitio |
| 8.2 | JS compartido de 500 a ~300 KB; píxel de Meta y gtag diferidos (no en el checkout); `/api/auth/me` no se llama para anónimos. | Código | FCP 2,8 → ~1,6 s |
| 8.3 | `priority` y `sizes` en la foto del configurador; hero de la ficha fuera del `motion.div`; `revalidate` en `/cristales-opticos`. | Código | Armá tus lentes 4,0 → ~2,3 s |

---

## Calendario

| Semana | Qué sale | Qué se mide al final |
|---|---|---|
| 1 (16 al 22/10) | Fase 0 entera · Fase 1 (1.1 a 1.4, 1.8) · Fase 2 (2.1 a 2.3) · 3.6 (hoy) | Embudo limpio publicado; ficha → carrito; paso 1 del configurador |
| 2 (23 al 29/10) | Fase 1 (1.5 a 1.7) · Fase 3 (3.1 a 3.5, 3.7) · Fase 4 (4.1 a 4.6) · 6.1 | Checkout → WhatsApp; primer recupero humano |
| 3 (30/10 al 5/11) | Fase 5 (decisiones + código) · Fase 7 (7.1 a 7.3, 7.5) · 6.2 arranca | Carrito promedio y tasa carrito → checkout con el precio nuevo |
| 4 y 5 | 6.2 a 6.4 · 7.4 · Fase 8 | Sol: ficha → carrito; LCP |
| 6 (hasta el 26/11) | Lectura con el criterio fijado | Ver abajo |

## Criterio de corte (fijado ahora, no después)

Al cierre de la semana 6, con el embudo limpio:

- **Si hay 3 o más ventas pagadas en la tienda** o 3 o más ventas por
  WhatsApp nacidas en un carrito de la tienda: la tienda vende. Se sigue con
  remarketing y se mira qué categoría cierra.
- **Si con 50 o más carritos reales sigue habiendo 0 pagos y menos de 3
  cierres por WhatsApp desde carritos**: la tienda queda como vidriera con
  WhatsApp, la pauta va toda a "Mensajes" y a Stellest, y no se invierte más
  en checkout.

Lo que no se hace en ningún caso: cambiar el embudo y la pauta a la vez sin
haber limpiado la medición (Fase 0), porque es exactamente lo que nos hizo
leer mal durante tres semanas.

## Qué necesito de Ishtar para arrancar mañana

1. Razón social, CUIT y link del QR de Data Fiscal (0.6 / 4.1).
2. Qué incluye cada categoría (1.5) y el plazo de entrega único (4.3).
3. El cristal base del "completo desde" (5.1).
4. OK a arrancar las Fases 0, 1, 2 y 3 en código (no gastan plata ni cambian precios).
