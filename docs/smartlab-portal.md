# Portal SmartLab (Grupo Óptico): relevamiento para el módulo

Relevado el 3/10/2026 en solo lectura, con la cuenta de la óptica (variables
`SMARTLAB_USER` / `SMARTLAB_PASSWORD`, cliente `SMARTLAB_CLIENT_ID` = 2462).
Es la base de `src/services/lab-modules/grupo-optico/`. Lo que acá dice "visto"
se comprobó contra el portal; lo que dice "deducido" sale del JS del portal
(`_next/static/chunks/…`) y se confirma con la primera carga real.

## Qué es

`https://grupooptico.dyndns.info/smartlab/` es una app Next.js (React + MUI)
sobre una API JSON propia: `https://grupooptico.dyndns.info/smartlab-api-v2/public/index.php/…`.
Las pantallas no tienen nada que la API no tenga: **el módulo habla con la
API** (pedida desde adentro de la página con la sesión, como ya hacía el
proveedor de costos) y NO raspa HTML ni llena formularios React. Es lo que
hace al robot confiable: no hay "primera opción" que elegir mal.

- Login: `/smartlab/auth/authSmartlab/login`, dos `input` (usuario, clave) y
  un botón "Iniciar sesión". La sesión queda en cookie. Rechazo: la URL se
  queda en `/login` y el cuerpo dice "usuario o contraseña incorrectos"
  (`/incorrect|no se pudo iniciar sesi|credenciales inv/i`). Lento: hasta
  5 minutos por paso durante la migración de servidor de 2026.
- Hace falta `--disable-http2` en Chromium: el servidor negocia mal HTTP/2
  desde el contenedor.

## Listado de pedidos (seguimiento y vinculación)

`GET …/laboratory/order/list?rowPerPage=100&current=N&isClient=1&isSeller=0&userId=2462&sellerId=0&search=&invoiceNumber=&sector=0&client=null&invoice=0&lensType=0&calibratedBy=0&zone=0`
→ `{ rows: [...] }`, más nuevos primero, 100 por página. Campos que usa el módulo:

| Campo | Qué es | Ejemplo |
|---|---|---|
| `IdPedido` | nº de pedido (el "80xxxxxx" de las facturas) | `"80549878"` |
| `FechaRegistro` | ingreso, hora Argentina | `"2026-09-18 17:59:01.000"` |
| `FechaFin` | cuándo terminó (null hasta entonces) | `"2026-09-22 16:00:23.000"` |
| `FechaFinEstimada` | **no sirve**: casi siempre igual a `FechaRegistro` | |
| `CodigoOptica` | el "Código interno" que cargó la óptica | `"Laura Santucho 1°par"` |
| `Observacion` | la observación cargada | ver 2x1 abajo |
| `sector` / `sector_id` | dónde está | `"Pedido en proceso de validación"` / 2 |
| `progress` | 0 a 100 | `100` |
| `Anulado` | `"1"` si se anuló | `"0"` |
| `is_rework` | reproceso | `false` |
| `validated` / `validator_name` | cuándo y quién validó en el lab | |
| `invoices[]` | `{ letter, number, type: 'r' remito / factura, salesId }` | |
| `IdTipoLente` / `tipoLente` | 1 Monofocal lejos · 3 Bifocal Kri · 5 Multifocal · 6 Ocupacional · 7 Pase Cristales | |
| `IdMaterial` / `material` | material del portal (ver catálogo) | `"20"` / `"ORG BLUE LIGHT 1.56"` |
| `IdColor` / `colorLente`, `IdMarca`, `CristalDeStock` | color, marca, stock (1) o laboratorio (0) | |
| `A`, `B`, `ED`, `Puente`, `AltPupila`, `AltPupilaOI`, `DistInterpupilar`, `DistMecanica` | medidas | |

Sectores vistos (`sector_id`: texto): 2 Pedido en proceso de validación ·
10 Teñido de lente sin calibrar · 14 Trazado y bloqueado de calibrado ·
15 Calibrado Automático · 17 Facturación finalizado · 20 Entregado ·
27 Bloqueo de superficie.

Mapeo a `EstadoEnPortal`: `Anulado === '1'` → ANULADO; `sector_id === 20` →
DESPACHADO; `progress >= 100` o `FechaFin` → TERMINADO; `progress > 0` →
EN_PROCESO; si no → INGRESADO. "Trabado" = en validación (`sector_id` 2) o
`progress < 15` con dos días o más desde `FechaRegistro`.

Vinculación con la venta: hasta el 3/10/2026 el "Código interno" llevaba el
nombre del cliente; desde la carga asistida lleva el **código corto de la
venta** (`#A1B2`) más el nombre, así el espejo vincula con certeza
(`lab-modules/espejo.ts`).

## Cómo se cargan hoy los 2x1 de Smart Free (visto en el portal)

Un 2x1 son **dos pedidos**. El portal no los relaciona entre sí: la relación
va en la observación, y es lo que el laboratorio lee para no cobrar el segundo.

| | Código interno | Observación |
|---|---|---|
| 1º par (80549878) | `Laura Santucho 1°par` | `Promo smart free 2x1 1°par` |
| 2º par (80549885) | `Laura Santucho 2°par Sol` | `Promo smartfree 2x1 -2°par vinculado a 80549878` |
| 1º par (80548395) | `Ana Claudia Zorrilla 1°par` | `promo smart free 2x1 1°par, cuidar los Cristales…` |
| 2º par (80548398) | `Ana Claudia Zorrilla 2°par` | `Promo smart free 2x1 vincular al 1°par pedido 80548395` |

Regla del módulo (Ishtar, 3/10/2026): el 2º par lleva en la observación el nº
de operación del 1º y que es el par sin cargo. Formato fijo:
`Promo 2x1 Smart Free · 1° par` y
`Promo 2x1 Smart Free · 2° par SIN CARGO, vinculado al 1° par <nº>`.
El 2º par solo se prepara con el 1º ya cargado (tiene que existir el nº).

## Alta de un pedido

Pantalla `/smartlab/laboratory/new` ("Pedidos Stock/Laboratorio | Nuevo").
Botones de tipo: Monofocal · Bifocal Kri · Bifocal Ft · Multifocal ·
Ocupacional · Pase de cristales. Campos (ids del DOM, por si hace falta
mirarlos): `optical-code-text` (Código interno), `*-eye-far-spherical|cylindrical|axis-autocomplete`,
`*-eye-near-*`, `*-eye-addition-text`, `switch-is-laboratory` / `switch-is-stock`
(Lentes Laboratorio / Lentes Stock-Rango Ext), `material-autocomplete`,
`color-autocomplete` (dos con el mismo id: Color y Marca), `switch-optic-calibrate`
("Calibra en óptica"), `diameter-autocomplete` (stock), `*-interpupillary-distance-autocomplete`,
`*-pupillary-height-autocomplete`, `right|left-eye-article-select` (Artículo
por ojo, con "Cristal propio"), radios `treatment` (`"<id>|<articleId>"`),
`frame-type-select` (Tipo de aro), `pupillary-height-right-eye-select` (sic:
Tipo armazón), `comment-textarea` (Observación), `frame-and-model-textarea`,
`tinted-type|color|intensity-select`, `pte|a|b|ed-autocomplete`, radios
`frame-shape-radio` 1 a 9 (Forma Armazón), `patient-text` (Nombre y Apellido
del Paciente, para la garantía digital). Botón "Guardar pedido".

**"Guardar pedido" crea el pedido en el acto** (deducido del JS: `POST
…/laboratory/order/createupdate` con `action: "insert"` → `{ orderId, message,
promotionsGranted }`; con 400 → `{ error }`). No hay borrador ni paso de
confirmación como en Vitolen, y **"Anular" solo aparece para admin/operador
del laboratorio** (`GET …/laboratory/order/cancel?id=`), no para la óptica.
Por eso en Grupo Óptico el OK humano va ANTES de guardar, y lo que se revisa
son los datos exactos que se van a mandar, con las etiquetas del catálogo del
portal.

Payload de `createupdate` (claves, del JS):
`lensTypeId`, `rightEye|leftEye` × `FarSpherical, FarCylindrical, FarAxis,
NearSpherical, NearCylindrical, NearAxis, PupillaryHeight,
InterpupillaryDistance, FilmHeight, Article, StockArticle, Addition, Prism,
PrismBase, PrismAxis`, `materialId`, `colorId`, `calibrated` (1), `blockBase`,
`frameType` (texto: `ZILO` / `METALICO` / `PLÁSTICO`), `typeRimId`,
`typeRimArticleId`, `calibratedCrystalPass`, `treatmentId`,
`treatmentArticleId`, `frameWait`, `frameBrought`, `rightEyeCrystalBrought`,
`leftEyeCrystalBrought`, `opticsCode` (Código interno), `opticsComment`
(Observación), `tintedId`, `tintedArticleId`, `tintedColor`,
`tintedIntensity`, `frameModel` (Armazón y Modelo), `diameter`, `bridge` (Pte),
`bridgeA`, `bridgeB`, `bridgeED`, `angleED`, `frameShape` (1-9), `brandId`,
`clientId`, `patientId`, `sellerId`, `warrantyPatientName`,
`crystalPassDescription`, `additionDifference`, `signDifference`, `isClient`
(true), `userId`, `orderId` (null), `isEdit` (false), `giftClaimId`,
`prismEnabled`, `noFrameAllowed`, `action` ("insert"), `isExpress`,
`ownRightEyeChecked`, `ownLeftEyeChecked`.
`GET …/data/laboratoryorder/get?id=<nº>` devuelve un pedido con esos mismos
nombres: es la referencia para ver cómo quedó cargado uno real.

## Catálogos (la equivalencia producto del CRM → artículo del portal)

Listas `[{ value, label }]`, en cadena: el tipo de lente y stock/laboratorio
deciden los materiales; el material decide colores y tratamientos; material +
color + marca + graduación deciden los artículos.

- `…/data/material/list?current=1&rowCount=100000&lensTypeId=<1-6>&artODStock=<0|1>`
- `…/data/color/list?current=1&rowCount=100000&lensTypeId=&materialId=`
- `…/data/brand/list?current=1&rowCount=100000&lensTypeId=&materialId=&colorId=&rightEyeStockArticle=<0|1>&clientId=2462&isAdmin=0`
- `…/data/article/list?lensTypeId=&isStock=&materialId=&colorId=&brandId=&spherical=+0.75&cylindrical=-1.00&clientId=2462&isAdmin=0`
- `…/data/treatment/list?materialId=&type=<1|2>`
- `…/data/typeRim/list?lensTypeId=&isStock=&materialId=&colorId=&brandId=`

Materiales de LABORATORIO (`artODStock=0`), id = etiqueta: 1 MINERAL CROWN 1.53 ·
3 ORG BLANCO 1.49 · 5 ORG ALTO INDICE 1.67 · 6 POLI BLANCO 1.59 · 7 POLI CON
AR 1.59 · 15 ORG ALTO INDICE 1.74 · 16 ORG FOTO 1.56 · 17 ORG FOTO 1.67 ·
20 ORG BLUE LIGHT 1.56 · 21 POLI FOTO 1.59 · 22 ORG POLARIZADO 1.49 · 24 ORG
FOTO ESPEJADO 1.56 · 27 POLI BLUE 1.59 · 28 ORG SUPER BLUE 1.60 · 29 ORG
ESPEJADO 1.49 · 31 ORG BLUE ALTO INDICE 1.67 · 33 ORG FOTO BLUE 1.56 · 35 ORG
ALTO INDICE 1.60 · 36 ORG FOTO ALTO INDICE 1.6 · 37 ORG BLUE ANTI AGE 1.60 ·
38 ORG SOL 1.49. (No todos para todos los tipos: Multifocal no ofrece el
mineral; Ocupacional no ofrece fotocromáticos.)

Materiales de STOCK (`artODStock=1`, los mismos para todos los tipos): 3 Org
Blanco 1.49 · 19 Org c/Ar 1.56 · 8 Org Blue c/Ar 1.56 · 14 Org S.Blue c/Ar
1.60 · 26 Org Foto C/ar 1.56 · 6 Poli Blanco 1.59 · 7 Poli Blanco C/ar ·
1 Mineral Blanco · 18 Mineral Foto · 72 Org S.blue C/ar 1.74 · 39 Org Sol
1.49 · 37 Org Polarizado 1.49 · 36 Org Foto Espejado 1.56 · 68 Org Espejado
1.49. (Ojo: los ids 36 y 37 significan otra cosa en laboratorio que en stock.)

Marcas vistas en pedidos reales: 145 "Smart Lens Digital" (los multifocales
Smart Free) y 135 (los de stock). La tabla completa producto → (tipo, stock,
material, color, marca, artículo) vive en
`src/services/lab-modules/grupo-optico/catalogo.ts`, y el robot la **verifica
contra el portal en cada carga**: si la etiqueta no existe con ese id, no
carga y lo dice.

## Documentos

- PDF del pedido: `GET …/laboratory/order/print?id=<nº>` (el que el portal
  abre al guardar; es la captura "final" que se guarda en el borrador).
- Comprobantes: `…/laboratory/order/invoice…` (ya lo usa `grupo-optico-invoices.ts`).
