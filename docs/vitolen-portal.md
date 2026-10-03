# Portal de Vitolen (`gestion.vitolen.com`): lo que el robot sabe de él

Relevamiento del 2 y 3/10/2026, **solo lectura** (ningún pedido creado ni
confirmado), con Playwright y las credenciales de `VITOLEN_USER` /
`VITOLEN_PASSWORD`. Es la fuente de `src/services/lab-modules/vitolen/`: si el
portal cambia, primero se corrige acá y después el código.

Cómo se carga un pedido a mano (el video del instructivo) y las promos están en
`docs/vitolen-pedidos-y-promos.md`. El marco de módulos, en `docs/lab-modulos.md`.

## Generalidades

- Aplicación Rails clásica: formularios con `utf8=✓` + `authenticity_token`,
  cookie de sesión `_gestion_session`, respuestas `text/javascript` que
  inyectan HTML con jQuery (`$("#pedidos-container").html("…")`).
- **El certificado TLS viene sin la cadena intermedia.** Chromium lo acepta
  (busca el intermedio solo), pero `fetch` de Node y `page.request` de
  Playwright fallan con `unable to verify the first certificate`. Por eso toda
  petición del módulo se hace **desde adentro de la página**
  (`page.evaluate(fetch, { credentials: 'include' })`), nunca desde Node.
- Cuenta `11302 - ATELIER OPTICA - CORDOBA`, oficina de atención Córdoba,
  transporte `COR - T2 - NORTE`. En la cuenta corriente aparecen dos cuentas
  (ids 12019 y 12020, nombres 11302/11303).
- **El email de la cuenta es `atelier.optica.cerro@gmail.com`** (la casilla del
  local) y tiene prendidas las notificaciones "Pedido Demorado", "Pedido
  Enviado o Listo para Retirar" y "Saldos de Cuenta Corriente (Web y Email)".
  Los saldos son costo: por la regla de la casilla del local conviene cambiar
  ese email en `/perfil` a una casilla privada (decisión de Ishtar).

## Login

| Qué | Valor |
|---|---|
| URL | `GET /session/new` |
| Campos | el primer `input[type=text]` (usuario, es el nº de cuenta) y `input[type=password]`; botón "Entrar" (`input[type=submit]`) |
| Envío | `POST /session` |
| Éxito | redirige a `/` (home con el carrusel de promos) |
| Sesión | cookie `_gestion_session`; "Salir" es `/session` (DELETE) |

Nunca vimos el cartel de clave rechazada (la credencial siempre fue buena); el
módulo detecta rechazo por `/inv[aá]lid|incorrect|no coincide|no v[aá]lid/i`
en pantalla mientras la URL siga en `/session`. Si Vitolen usa otra frase, se
nota porque el módulo diría "no salió del login en 60 s" en vez de
"credencial rechazada": ajustar `TEXTO_DE_RECHAZO` en `vitolen/portal.ts`.

## Menú

| Entrada | URL |
|---|---|
| Lentes de Laboratorio (cargar pedido) | `/ventas/pedidos_laboratorio/new` |
| Stock, Contactología y Armazones | `/ventas/pedidos_reventa/new` |
| Reparaciones | `/ventas/pedidos_reparaciones/new` |
| Ver Pedidos | `/ventas/pedidos` |
| Listas de Precios (PDF) | `/ventas/pdf_comerciales` |
| Lista de Precios Editable (PDF) | `/noticias/lista_editable` |
| Cuenta Corriente | `/contabilidad/movimientos` |
| Amplitude Freestyle IA (cuestionario) | `/ventas/cuestionarios/evolens/new` |
| Mi Perfil / Procesos Lanzados | `/perfil` / `/procesos` |

## Listado de pedidos (`/ventas/pedidos`) — lo que usa el seguimiento

La búsqueda es un `GET` con `Accept: text/javascript` (o `X-Requested-With:
XMLHttpRequest`) y la respuesta es JS que mete la tabla entera en
`#pedidos-container`. El módulo pide esa URL desde la página y extrae el HTML
del literal JS (`pedidos.ts: extraerHtmlDeRespuestaJs`).

```
GET /ventas/pedidos?utf8=%E2%9C%93&q[cargado_en_periodo]=all_history&q[vista]=lista&commit=Buscar
```

Filtros (`q[...]`):

| Parámetro | Valores |
|---|---|
| `cargado_en_periodo` | `today`, `this_month`, `previous_month`, `last_30_days`, `last_90_days`, `last_180_days`, `this_year`, `all_history`, `custom` |
| `nro_caso` | texto libre (Nro de Caso Interno) |
| `clase_lente` | `1` Monofocal, `2` Bifocal, `3` Progresivo, `4` Ocupacional |
| `rubro` | id del material |
| `tags_ids[]` | etiquetas del portal (cientos) |
| `vista` | `lista` |

Pase rápido = `last_30_days` (cubre los 21 días del tick); pasada completa =
`all_history` (`pedidos.ts: periodoDeListado`).

Tabla `#pedidos` (`table.datatable.kb-table`), una fila por pedido con
`id="pedido_laboratorio_<id interno>"`:

| Columna (`td.<clase>`) | Ejemplo | Al `PedidoEnPortal` |
|---|---|---|
| `nro_trabajo` | `<a href="/ventas/pedidos_laboratorio/8669159">6981382L</a>` | `portalNumber` = `6981382L` (el nº que ve la óptica; el id interno queda en `raw.id`) |
| `fecha` | `18/10/2024 14:24` | `enteredAt` (hora Argentina, −03:00) |
| `nro_caso` | `Burban Nahuel - padre Juan carlos` | `internalRef` (vacío → `null`); si dice "2do par"/"segundo par", `pair = 2` |
| `estado` | `Despachado` | `statusRaw` → `status` (tabla de abajo) |
| `frd` | `22/10/2024` | `estimatedAt` |
| `actions` | `Imprimir` (`/ventas/pedidos_laboratorio/<id>.pdf`) · `Factura` (`/ventas/facturacion_automatica.pdf?codigo=698138200`) | `raw.pdfPedido`, `raw.pdfFactura`, `raw.codigoFactura` |

El código de la factura es el nº de trabajo sin la `L` y con `00` al final
(`6981382L` → `698138200`); hasta no abrir ese PDF no se sabe el nº de
comprobante ni el importe, así que `invoices` queda vacío en el seguimiento.

Paginación: `div.paginator` con "Mostrando registros **1 - 7** de **7** en
total". Con 7 pedidos históricos no apareció ningún link de página; el parser
igual busca `page=N` en el paginador y el módulo recorre las páginas que
encuentre, y si el total dice más de lo leído lo avisa en el resultado.

Exportaciones (XLSX, mismos filtros): `/ventas/pedidos?format=xlsx&…`, con
`modo=detalle` y `modo=tiempos`. No se usan todavía.

### Estados reales → `EstadoEnPortal`

La barra de progreso del detalle muestra el recorrido completo. Observados en
los 7 pedidos históricos: "Confirmación" y "Despachado". El resto sale de la
barra.

| Estado del portal | `EstadoEnPortal` | Efecto en la venta (`estados.ts` del marco) |
|---|---|---|
| Confirmación | `INGRESADO` | SENT → IN_PROGRESS |
| En Proceso | `EN_PROCESO` | SENT → IN_PROGRESS |
| Tránsito a OF | `EN_PROCESO` | — |
| En Oficina | `TERMINADO` | → FINISHED (aviso "pedido listo") |
| Despachado | `DESPACHADO` | → FINISHED |
| Anulado / Cancelado / Rechazado (no vistos) | `ANULADO` | no frena a los demás pares |
| cualquier otro | `DESCONOCIDO` | no se afirma nada |

"En Oficina" = llegó a la oficina de Córdoba, de donde sale el transporte a la
óptica. Se trata como terminado porque el laboratorio ya no tiene nada que
hacerle; confirmar con Vitolen si prefieren avisar recién en "Despachado"
(cambiar una línea en `vitolen/estados.ts`).

## Detalle de un pedido (`/ventas/pedidos_laboratorio/<id>`)

Barra: Confirmación → En Proceso → Tránsito a OF → En Oficina → Despachado.
Cabecera: Nro de Trabajo, Fecha, Despacho Estimado ("Martes 22 de Octubre"),
Cliente, Nro de Caso Interno, Oficina de Atención, Estado, Transporte.
Receta por ojo (Tipo de Lente, "3492 - Amplitude HD Dual Blue Stock Rango
Extendido", Origen "Bloque/Lente de Vitolen"; Esférico, Cilíndrico, Eje, DNP,
Altura Pupilar), Armazón (Origen "Armazón del cliente", Tipo, Funcionalidad,
Características) y Trabajos (Montajes: Calibrado). Links: `Imprimir` (PDF del
pedido) y `Factura`. No hace falta abrirlo para el seguimiento.

## Cuenta corriente (`/contabilidad/movimientos`) — para la etapa de costos

Filtros: `q[condicion_eq]` (vacío = Todos, `Pendientes`, `Vencidos`,
`A Vencer`), `q[desde]` / `q[hasta]` (dd/mm/aaaa), `q[cuentas_ids]`
(`12019,12020` = las cuentas 11302 y 11303) con `q[cuentas_ids_mode]=include`.
Es una página HTML común (pedida como `text/javascript` da 406), paginada de
a 20 con el paginador suelto ("Mostrando registros 1 - 20 de 22 en total",
links `page=N`). Exporta `format=pdf` y `format=xlsx` con los mismos
parámetros (no se usan). El módulo la lee con
`portal.ts: leerCuentaCorriente` y la parsea `cuenta-corriente.ts`.

Tabla `#movimientos`, con una fila `colspan` por cuenta y luego una por
comprobante:

| Columna | Ejemplo | Nota |
|---|---|---|
| Fecha | `30/07/2024` | |
| Comprobante | `FA 0067-01168210` / `NCA 0067-00012681` / `REC 00890360` | FA y NCA linkean al PDF `/ventas/comprobantes/<id>.pdf` y traen `title="Total: $159.359,90"`; los recibos no tienen link |
| Estado | `Cancelado` | (no se vieron otros; "Pendiente"/"Vencido" según el filtro) |
| Vencimiento | `09/08/2024` | |
| Cancela a | `FA 0067-01186779` | en NCA y REC: qué factura cancelan |
| Debe / Haber / Saldo | `$159.359,90` | miles con punto, decimales con coma |

Histórico 2024: 22 movimientos — 8 facturas, 2 notas de crédito que anulan
enteras a dos facturas del 19 y 20/8 (ida y vuelta de $195.294) y recibos.
**La cuenta corriente no dice a qué pedido pertenece cada factura**: ese
vínculo está en el PDF de cada pedido (`facturacion_automatica.pdf?codigo=…`,
~80 KB, `inline`) o en el PDF del comprobante (~74 KB). Hasta leer uno, el
módulo no puede imputar importes a pedidos.

## Formulario de carga (`/ventas/pedidos_laboratorio/new`) — para la carga asistida

Se arma por pasos y cada paso es un `POST` con `authenticity_token` que
devuelve JS e inyecta la sección siguiente:

1. Clase de lente (radio) → `POST /ventas/pedidos_laboratorio/seleccion_clase`
   → aparecen los logos de diseño en `#modelos-container`.
2. Click en un logo `a.thumbnail.familia-item[data-id]` →
   `POST /ventas/pedidos_laboratorio/seleccion_familia?familia` → se llenan los
   selects de material.
3. Elegir material (select2) → `POST /ventas/pedidos_laboratorio/seleccion_modelo`
   + `cargar_trabajos_disponibles` + `cargar_promos_especiales` → aparece el
   resto del formulario (graduación, promos, prismas, armazón, trabajos).
4. `commit=Crear` (**el robot no lo manda hasta que una persona aprueba**).

Campos (nombres exactos):

| Sección | Campo | Valores |
|---|---|---|
| Cabecera | `pedido[nro_caso]` | texto: el código corto de la venta `#A1B2` |
| Receta | `pedido[tipo_receta_id]` | `1` Ambos Ojos, `2` Ojo Derecho, `3` Ojo Izquierdo |
| | `pedido[extension_attributes][clase_lente_id]` | `1` Monofocal, `2` Bifocal, `4` Ocupacional, `3` Progresivo |
| Diseño | logo `a.familia-item[data-id]` | ver tabla de diseños |
| Material | `pedido[lentes_attributes][0|1][rubro_id]` (OD / OI) | id del material del portal (ej. `1635`) |
| Graduación | `pedido[lentes_attributes][N][esferico|cilindrico|eje_cilindrico|base_especial]` | texto; eje 1 a 180; base 0 a 16 |
| | `pedido[lentes_attributes][N][adicion]` | select `0.75` … `3.5` (valor `1.0`, `1.5`, `2.0`…) |
| Promos | `pedido[origen_promo_especial_attributes][origen_id]` | "N° Pedido del 1er PAR" (select2 con búsqueda) |
| | `promo` | select: `96`, `125`, `133`, `134`, `135`, `136` (HOYALUX Array 2 grupos 1‑6) y `150` SEGURO DE REPOSICIÓN 24 meses |
| Armazón | `pedido[armazones_attributes][0][tipo_medida_id]` | `2` Medidas, `3` Diámetro |
| | forma | 12 tarjetas "Forma OD - 1" … "Forma OD - 12" (clic) |
| | `pedido[lentes_attributes][N][dnpl|altura|distancia_vertice|angulo_pantoscopico|angulo_envolvencia]` | DNP 20‑80, altura 14‑50, vértice 10‑20 (default 12), pantoscópico 0‑30 (default 8), envolvencia 0‑30 (default 4) |
| | `pedido[armazones_attributes][0][largo|altura|diagonal_mayor|eje|puente]` | largo 20‑80, altura 20‑80, diagonal 30‑90, eje 0‑180, puente 10‑25 |
| | `pedido[armazones_attributes][0][tipo_armazon_id]` | `1` Metálico, `2` Zilo, `3` Ranurado, `4` Perforado |
| | `pedido[armazones_attributes][0][funcionalidad_id]` | `1` Aro Convencional, `2` Clip-On Externo, `3` Adaptador Interno, `4` Envolvente |
| | `pedido[armazones_attributes][0][caracteristicas]` | "Marca, modelo, color, etc." |
| Trabajos | `pedido[trabajos_realizados_attributes][i][seleccionado]` | checkboxes, en este orden para Array: 0 Antirreflejo Hi-Vision Ultra ("Recomendado", viene tildado), 1 Reflejo Residual Azul (Spectrum Sky+), 2 Color, 3 Filtros, 4 Sacar Laca, 5 Sacar Color, **6 Calibrado**, 7 Formas Especiales, 8 Modif. Form. Plant. Orig., 9‑16 reparaciones |
| | `pedido[observaciones]` | textarea |

OJO: el orden de los trabajos lo manda `cargar_trabajos_disponibles` para ESE
material: el robot tiene que ubicar "Calibrado" por su etiqueta, no por el
índice. Los defaults del portal (vértice 12, pantoscópico 8) difieren de los
del video (14 y 6) que usa `carga.ts`; el payload manda lo que dice la venta.

### Diseños (logos) y materiales

| # | `data-id` | Diseño | Materiales (ids del portal) |
|---|---|---|---|
| 0 | 17 | Amplitude Freestyle IA (Pentax) | 22 (`1955`… Orgánico Blanco / Smart Control / SUNMATIC…) |
| 1 | 18 | Amplitude Plus | 24 (`1978`…) — soporta campo preferente |
| 2 | 19 | Amplitude View | 23 (`2001`…) — soporta campo preferente |
| 3 | 21 | Amplitude Classic | 20 (`2035`…) |
| 4 | 22 | Amplitude First (Plus/View, add hasta 1.75) | 11 (`2023`…) |
| 5 | 56 | Hoya Lifestyle 4 (IDLS4 Urban / Indoor / Outdoor) | 7 (`2256`, `2259`, `2260`, `2261`, `2264`…) |
| 6 | 23 | Hoya Array 2 / Array Wrap | 33 (`1635` Array 2 1.50 Clear Blue Filter … `1670` Array Wrap 1.74) |
| 7 | 25 | Hoya Summit Premium | 19 (`1606`…) |
| 8 | 26 | Hoya Argos BKS | 14 (`1623`…) |
| 9 | 84 | Mi Primer Hoya (Array, add hasta 1.75) | 25 (`2300`…) |

La lista completa de materiales por diseño quedó en el relevamiento
(`hallazgos-4.json`, scratchpad del 3/10/2026); para la carga asistida se eligen
**por texto** ("Array 2 1.60 Hilux MR-8 Clear") y no por id, así un cambio de
ids en el portal rompe ruidosamente en vez de cargar otro cristal. Con
Progresivo elegido solo aparecen esos 10 logos; Monofocal/Ocupacional tienen
los suyos (sin relevar: no hacía falta para el seguimiento).

## Pedidos históricos en la cuenta (2024)

7 pedidos entre julio y octubre de 2024, todos `Despachado` salvo dos de
Tarcisio Granadillo Martinez que quedaron en "Confirmación" desde el 26/7/2024
(¿se anularon sin reflejarlo?). Ninguno corresponde a una venta del CRM
actual: el espejo los guarda pero no los vincula.
