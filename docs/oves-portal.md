# OVES — el portal de pedidos de Optovisión, por dentro

Relevamiento del 19/10/2026, solo lectura, desde el Chrome de Ishtar logueada
(usuario `ATEL01`). Es TODO lo que el robot de carga sabe del portal: si el
portal cambia, se corrige acá primero. Capturas en el scratchpad de la sesión
(`oves/01…07`), no en el repo.

## Qué es

- URL: `http://www.optovision.com.ar/oves/lab/` (HTTP, sin TLS). La raíz
  `/oves/` es la tienda de stock; `/oves/lab/` es "Pedidos vía Web" del
  laboratorio (RX). **Es una app de UNA sola página en JavaScript**
  (`/oves/lab/include/index.js`, 320 KB, jQuery 1.9 + jQuery UI): el HTML no
  cambia de URL, todo se pide por AJAX a `include/suggest.php` (GET con
  `?opc=…` para consultas, POST para listar/grabar) y por un RPC viejo
  ("sajax", `x_getPedidos_rx`, `x_grabarPedido`… con parámetros separados por
  `~~|~~`).
- **Una ventana por sesión**: `BroadcastChannel('onlyOneTabOpto')`. Al cargar,
  la pestaña nueva avisa `newTab`; si otra contesta `alreadyOpen`, la nueva se
  vacía y muestra "Ya hay una ventana de la aplicacion abierta". Es solo
  entre pestañas del MISMO navegador: un navegador aparte (el robot) no choca
  con el de una persona. La sesión PHP sí es una por login; `Sesion expirada`
  en una respuesta dispara `location.reload()`.
- **Login**: form `formlogin` (`usr`, `pwd`), `x_checkLogin(usr + "~~|~~" + hex_md5(pwd))`.
  La clave viaja como MD5 (md5.js). Respuesta `resultLogin` con `loggedin`,
  `usuario`, `clientes`, `cliente`, `unidad` (1 piezas / 2 pares — ATEL01 compra
  por PARES), `pwd_change`. Credenciales: SOLO por entorno (`OVES_USER` /
  `OVES_PASSWORD` en Railway), nunca en el código.
- **Filtra por origen de red**: desde la Mac de Ishtar y desde la red de
  Anthropic el puerto 443/80 no contesta (3 días, 2 IPs); desde el celular y
  desde el Chrome con extensión sí. Antes de dar por hecho que el robot entra
  desde Railway hay que probarlo (ver plan, decisión abierta).
- Usuario `ATEL01` es "C" (común): `getTipoUsuario` → `C`. Un usuario especial
  (RX) ve clientes y lugares de entrega; nosotros no.
- Es LENTO: una consulta de catálogo tarda 2–4 s; 15 consultas seguidas pasan
  de 45 s. Todo timeout del robot va ancho (regla de Ishtar, 16/10/2026).

## Menú

`Nuevo Pedido` (`compras_a` → `initialize`) · `Pedidos Lab. RX`
(`historialrx_a` → `historial_rx`) · `Salir` (`sendLogout`). Debajo de Nuevo
Pedido, el menú lateral: **Tallado Digital** (`RXTD`), **Tallado Tradicional**
(`RXTT`), **Stock con Adicionales** (`RXSA`), **Stock Terminados** (`RXST`,
redirige a `../`, la tienda de stock: NO tocarlo desde la app). Los tres
primeros abren el MISMO formulario (`getHtmlFormRX`) con `claseDePedido` =
`RXTD|RXTT|RXSA`; cambia el catálogo que ofrece el autocompletar.

## Listado de pedidos (Pedidos Lab. RX)

`x_getPedidos_rx(st, resultPedidos)` con `st = estado ~~|~~ inicio ~~|~~ S ~~|~~
bus_pedido ~~|~~ bus_optica ~~|~~ bus_fec_dsd ~~|~~ bus_fec_hst ~~|~~ bus_ped_int
~~|~~ bus_cod_glx ~~|~~ bus_nro_glx ~~|~~ bus_refped_int` (estado `Todos` o
`BU` = búsqueda; páginas de 15, `inicio` 0, 15, 30…). Respuesta: `pedidos[]`
con `pedido`, `fecha`, `estado`, `cod_estado`, `solanul` (S en proceso / P
rechazada), `ingreso` (fecha del estado), `pedinterno` (Referencia Cliente),
`observaciones`, `cliente`, `cod_galux` + `nro_galux` (COD RX / NRO RX),
`lugarEntregaLab`; `numpedidos`, `inicio`.

Columnas visibles: PEDIDO · FECHA PEDIDO · ESTADO · FECHA ESTADO · Referencia
Cliente (nro u otro) · OBSERVACIONES · CLIENTE · COD RX · NRO RX · Lugar Entrega.

- **Nº de pedido web**: 6 dígitos (`628517`). Es el que el equipo guarda en la
  venta ("626134 - 626139": uno por par).
- **COD RX / NRO RX**: `TI` + 7 dígitos (`7104272`). Es el nº de la factura:
  `TI-7101568(587979)` = NRO RX con el nº de pedido web entre paréntesis.
  Un pedido recién grabado todavía no tiene NRO RX (queda `0`, se muestra vacío).
- **Estados vistos**: `Preparado`, `Listo`. En el código: `AN` = anulado;
  ` *` solicitud de anulación en proceso; ` **` rechazada. Faltan ver los
  intermedios (en fabricación, despachado) con pedidos en curso.
- Lugar de entrega: `LUIS JOSE DE TEJEDA 4380`.
- Buscador (vista `Busqueda`, campos `bus_pedido`, `bus_cod_glx`, `bus_nro_glx`,
  `bus_refped_int`, `bus_ped_int`, `bus_fec_dsd`, `bus_fec_hst`, botón
  `buscar_rx`). Con `bus_pedido` se busca por nº web exacto; con
  `bus_refped_int` por Referencia Cliente (ahí va `#XXXX Nombre n°par`, lo que
  permite al seguimiento encontrar la venta sin tipear el nº).
- Clic en el nº → `mostrarGrillaRX('RX', nro)`: el mismo formulario, cargado
  con `GET include/suggest.php?opc=consulta&nroPed=NNN` (JSON con campos
  `pel_*`, ver abajo) y TODO deshabilitado; botones `Imprimir`
  (`impresionrx.html?nroPed=NNN`, nueva pestaña: sirve como "documento" del
  pedido) y `Solicitar Anulacion` (abre diálogo con motivo → `marcarSolicitud`;
  el robot NO lo usa).

## Cómo escribe el equipo hoy (ejemplos reales del listado, 10/2026)

| Referencia Cliente | Observación |
|---|---|
| `Juan San Martin 1° par` | `Promo 2x1 Crizal eyezen 1°par` |
| `Juan San Martin 2° par Sol` | `Promo 2x1 crizal Eyezen 2do par, color Gris 3. Vincular a pedido 628515` |
| `Devereux Patricia 1°par` | `Promo varilux 2x1 vouCher VA7AGQWN 1° par` |
| `Devereux Patricia 2°par Sol` | `Promo 2x1 2do par Varilux vinculada a pedido 628377 Coloracion Sepia 3` |
| `Vadora Samuel 1° par` | `Promo Varilux doble disfrute 1° para voucher VAUV2XMV` |
| `Monteoliva Enrique 1° par` | `Promo kodak 2x1- 1er par voucher KOEUXPQC` |
| `598454` (reproceso) | `PSI- CAMBIO DE RECETA Y ALT CORRESPONDE A 598454-7102273 COLOR GRIS 3 PLENO` |

Los vouchers son 8 caracteres: `VA…` Varilux, `KO…` Kodak. El 2º par siempre
nombra el nº web del 1º ("vinculada a pedido 628377"). Un reproceso pone el nº
original en Referencia y `PSI- … CORRESPONDE A <web>-<rx>` en la observación.

## Formulario de nuevo pedido (`getHtmlFormRX`, `form#form`)

Secciones y campos (name/id), en orden:

- **Ocultos**: `uuidHidden` (UUID v4 que genera el JS por pedido, anti doble
  envío), `claseDePedido` (`RXTD|RXTT|RXSA`), `hLineaRX` (id `hiddenLineaRX`,
  el VALOR del producto elegido, ver catálogo), `lugarEntregaLabItem`.
- **Produccion**: radio `lentes` = `AO` (ambos, default) | `OD` | `OI`; checkbox
  `checksinReceta` (solo RXSA).
- **Lente**: `lineaRX` (autocomplete, `GET suggest.php?opc=producto&term=…&claseDePedido=…`,
  mínimo 2 letras; al elegir, `change` vuelve a pedir con `exact=<label>` y
  si vuelve 1 solo, pone `hiddenLineaRX = value + "promoDest=S|N|promoCode=…|"`
  y recién ahí carga servicios y validaciones). `marca`, `material`, `diseno`
  de solo lectura (salen del value).
- **Promo** (fila `trVXP`, aparece con `checkVXP` cuando el producto es
  `promoDest=S`): `pedidovoucherPromo` (9 chars, "Pedido original / Voucher"),
  `oriVXP` (nº pedido original), `productoVXP`/`hProductoVXP`, `opticavxp`.
  Es la promo "XPERIO" del portal (código `VXXP`), NO el procedimiento que nos
  dio Optovisión (cupón + mail + observaciones): el equipo hoy NO usa esta
  fila, escribe el voucher en la observación. Ver §Promos.
- **Servicios**: selects `serviciosTRAT`, `serviciosCAL`, `serviciosCOL`,
  `serviciosOTR` (opciones por producto: `GET suggest.php?opc=servicio&srvParam=TRAT<value>&clienteadj=`;
  cada opción trae `key`, `descripcion`, `sugerido` S/N, `llevarReferencia`
  S/N → si S aparece el texto `servicios<X>Referencia`, 60 chars). Para
  "Eyezen Start Orma Blue UV": TRAT = Crizal Forte UV / Crizal Prevencia /
  Trio Cliean Blue / Multicot / Numax / sin tratamiento / Crizal Sapphire;
  CAL = Calibrado Comun / perforado / perforado con cambio de forma / ranurado /
  ranurado con cambio de forma / sin calibrado; COL = color pleno / degrade /
  muestra / sin color; OTR = sin otros servicios / Pack 3 paños. **En un pedido
  NUEVO el value de cada opción es la CLAVE** (`|WR|EYST|TRAT|2`, `|WR|EYST|CAL|1`,
  `|WR|EYST|COL|3`, `|WR|EYST|OTR|6`): es lo que viaja en el POST de grabar.
  (En la consulta de un pedido ya cargado el select se rellena con la
  descripción, por eso ahí se ve el texto.)
- **Mensajes**: `mensajeRX` — si tiene texto, `Grabar` se niega ("Hay datos
  pendientes de corregir").
- **Prescripcion** (por ojo, sufijo `_d` / `_i`): `esf`, `cil`, `eje` (texto);
  `adic` (select 0.75…4.00), `prish` (select 0.50…7.00), `baseph` (N/T),
  `prisv`, `basepv` (S/I), `dnpx`, `dnpcerca`, `altura` (texto 1 decimal),
  `basecli` (select 0.00…5.00), `espesorct`, `espesoret`, `equilibrio`
  (select). `diametro` (natural). Esf/cil con signo y 2 decimales (`-0.50`).
- **Parametros de Personalizacion**: `coefhe`, `coefst`, `iniciales`,
  `altprog` (14–18), `vertex_d/_i`, `ctrorotojo_d/_i`, `wrapangle`, `panto`, `cvc`.
- **Armazon**: radio `armazonLente` = forma 1,2,3,5,6,7,8,9,10,11,13,14,15
  (dibujos `images/mod_NN.gif`; `armazonoblig` marca cuándo es obligatoria);
  `tipoarm` select 1 Zilo/Acetato · 2 Metal · 3 Montura al aire · 4 Hilo Nylon
  · 5 Hilo de Acero (fijo, `cargarTA`); `armazona`, `armazonb`, `armazoned`,
  `puente` (1 decimal); `ojodom` select; `dstlectura`; `enviaarm` No/Si (con
  Si aparece `marcaarm`, "Marca Armazon", texto libre: `Ray Ban 3548N`);
  `materialarm` existe pero va deshabilitado.
- **Otros**: `pedinterno` ("Referencia Cliente (nro u otro)"), `paciente`
  ("Nombre Paciente", obligatorio), `observacion` (textarea).
- Botones: `grabar`, `limpiar`; en consulta `imprimir` y `anulacion`.

### Reglas por producto (`GET suggest.php?opc=talladoval&linea=<cod>&tped=<linea>&regla=…`)

`linea` y `tped` salen del value (`|WR|EYST|…` → linea=WR, tped=EYST). Reglas:
`INHABDATO` (campos que se deshabilitan y se vacían), `SUGERIR` (valores por
defecto), `OBLIG` (obligatorios: `grabar` corta con "Faltan datos obligatorios"
si uno visible está vacío), `VALIDAR` (expresiones sobre `esf_x`, `cil_x`,
`altura_x`…). Para Eyezen Start Orma: INHABDATO = adic, dnpcerca, wrapangle,
panto, vertex, ojodom, ctrorotojo, coefst, coefhe, dstlectura, iniciales,
altprog, cvc, diametro; OBLIG = esf, cil, dnpx, altura (ambos ojos) y
paciente; VALIDAR = esf+cil entre −10 y +8, cil entre −6 y 0, esf entre −10 y
+6, altura 0 o ≥ 10. **El robot tiene que pedir estas reglas por producto y
respetarlas antes de llenar**: lo que está en INHABDATO no se manda.

### Grabar (`grabarPedidoRX`)

1. Si `mensajeRX` tiene texto → no graba. Si falta un OBLIG visible → alerta.
2. `confirm('CONFIRMA EL PEDIDO?')` — **ese confirm es la "pantalla real" que
   ve la persona en la carga asistida: el robot llena hasta acá, captura y
   frena; con el OK humano acepta el confirm.**
3. `POST include/suggest.php?opc=grabar` con body
   `lentes=AO&sinReceta=N&ojovirtual=&<producto[8]>&` + `$('#form').serialize()`
   (`producto[8]` es `promoDest=…|promoCode=…|`, viene del hidden). Respuesta
   JSON `{ error, errorValidacion, mensaje }`: con `error=false` el `mensaje`
   es HTML que se pinta en `bottomcontent` — **ahí viene el nº de pedido
   creado** (falta ver el texto exacto con una carga real; el equipo dice que
   "al guardar OVES devuelve un nº, ej. 623012").
4. El pedido nuevo aparece en el listado con estado `Preparado` y NRO RX vacío.

### Consulta (`opc=consulta&nroPed=`) — campos del JSON

`pel_rcd_ojo` (AO/OD/OI), `producto`, `marca`, `lpl_xob_material`,
`lpl_xob_diseno`, `servicioTRAT/CAL/COL/OTR` (+ `pel_ede_servicios<X>Referencia`),
`serviciota` (tipo armazón), `enviaarm`, `pel_ede_armazonref` (marca armazón),
`pel_nro_armazonforma`, `pel_qt4_armazona/b/ed/puente`, `pel_qty_distancialect`,
`pel_ecd_esferico_od/oi`, `pel_ecd_cilindro_*`, `pel_nro_eje_*`,
`pel_qt4_adicion_*`, `pel_ecd_prismah_*`, `pel_ecd_prismav_*`,
`pel_est_baseph_*` (N/T), `pel_est_basepv_*` (S/I), `pel_nro_dnp_*`,
`pel_nro_dnpcerca_*`, `pel_nro_altura_*`, `pel_qt4_base_*`, `pel_qt4_ct_*`,
`pel_qt4_et_*`, `pel_ecd_eq_*`, `pel_nro_vertex_*`, `pel_nro_ctrrotacion_*`,
`pel_nro_wrap`, `pel_nro_panto`, `pel_cd7_cvc`, `pel_pre_movojocab`,
`pel_pre_coefestab`, `pel_qty_alturaprog`, `pel_des_iniciales`,
`pel_nro_diametro`, `pel_fec_pedido`, `pel_est_sinReceta`,
`pel_nro_numeroPedidoInterno`, `pel_cod_promo`, `pel_est_promo` (O/U),
`productoVXP`, `opticaVXP`, `originalVXP`, `pedidovoucherPromo`,
`pel_est_solanul`, `pel_obs_solanul`, `pel_cod_estado`, `cliente`.

Pedido real 628517 (Juan San Martin 2° par Sol): producto `Eyezen Start Orma
Blue UV` (value `|WR|EYST|Eyezen Start|Orma|MONOFOCAL|EYST|`), Crizal Forte UV,
Calibrado Comun, color pleno, sin otros servicios; OD −0.50 −1.50 90 DNP 34
alt 30; OI −1.00 −2.00 92 DNP 33 alt 30; forma 11, Metal, A 57 B 50 ED 57
puente 21, Envia Armazon Si, Ray Ban 3548N.

## Catálogo del portal (`opc=producto`)

Cada producto es `{ label, value, promoCode, promoDest }` con
`value = |<cod>|<linea>|<marca>|<material>|<diseño>|<linea>|` (ej.
`|WS|VXCO|Varilux Comfort|Airwear 1.59|MULTIFOCAL|VXCO|`). `promoDest=S` +
`promoCode=VXXP` marca los que pueden ser 2º par de la promo XPERIO del
portal. Relevado con las cinco vocales como `term` por clase: **622 en
Tallado Digital, 42 en Tallado Tradicional, 21 en Stock con Adicionales
(685 en total)**. La fuente es
`scripts/maintenance/precios-optovision/oves-catalogo.tsv` (verificada byte a
byte contra el portal: hash FNV-1a `a3b060ab` de las 685 filas ordenadas, en
los dos lados) y de ahí se GENERA `src/lib/laboratorios/oves-catalogo.ts`
con `generar-oves-catalogo.mjs`. **OJO: 44 nombres traen espacios dobles**
(`Multilutz  Short`, `Kodak SV Digital  Airwear 1.59 …`, `… Orma  Blue UV`):
el portal los guarda así y la búsqueda `exact=` es literal. Nunca "limpiar"
esos nombres.

## Promos — lo que el portal sabe vs. el procedimiento de Optovisión

El portal tiene una promo propia ("XPERIO", `checkVXP` + voucher en
`pedidovoucherPromo`, que encadena un segundo pedido `vxxp_*` en el mismo
POST). El procedimiento que nos pasó Noelia Vivas (23/9/2026) es OTRO: cupón
en la web de la promo, mail a promociones@ y cordoba@, observación del 1º par
con el cupón, observación del 2º con el nº del 1º. El equipo hoy hace lo
segundo (ver tabla de ejemplos) y NO tilda `checkVXP`. El módulo hace lo
mismo (`lab-modules/optovision/promo.ts`), y no toca la fila Promo del portal.

## Comprobado el 20/10/2026 (segunda sesión logueada)

- `opc=consulta&nroPed=` de un nº inexistente devuelve `[]` (el robot lo toma
  como "no existe"). De uno real: 103 claves; el paciente va en
  `pel_des_usuarionombre` y la "Referencia Cliente" en `pel_des_pedinterno`;
  `pel_cod_estado` = `EM` para "Preparado", `LI` para "Listo" (`AN` = anulado, por el código); la observación va en `pel_obs_pedido`;
  `pel_est_solanul` = `N` sin solicitud de anulación.
- El RPC viejo (sajax) manda `rs=x_…` por **POST a `/oves/lab/`** (no a
  `suggest.php`); el bloqueo de solo lectura del robot mira url + body, así
  que lo ataja igual. Grabar un pedido RX NO pasa por ahí: es
  `POST include/suggest.php?opc=grabar`.
- Ids del DOM que usa el robot, todos presentes: `lentesAO/OD/OI`,
  `claseDePedido`, `uuidHidden`, `RXcontent`, `bloqueo`, `mensajeRX`, `grabar`,
  `side-menu` con `li#RXTD/#RXTT/#RXSA`, `historialrx_a`, `compras_a`,
  `topmenu`, `user`, `respuesta`, `formlogin`.
- Las 13 formas del armazón están capturadas en
  `public/laboratorios/optovision/formas/forma-NN.png`.

## Lo que falta ver (necesita una carga real o un pedido en curso)

- El HTML exacto de `mensaje` tras grabar (dónde viene el nº de pedido).
- Los estados intermedios del listado (fabricación / despachado) y cuánto
  tarda `Preparado` → `Listo`.
- Si `impresionrx.html?nroPed=` sirve como PDF del pedido para la ficha.
- Si Railway llega al portal (filtro de red).
