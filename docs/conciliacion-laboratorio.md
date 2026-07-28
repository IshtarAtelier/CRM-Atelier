# Conciliación con laboratorios — auditoría y modelo propuesto

Auditoría del 28/7/2026, sobre Optovisión (Essilor). Verificada contra los PDF
reales de la casilla (`FA_3008-00062896`, `FA_3008-00069150`) y el código de
`src/services/lab-recon/`.

## Las tres reglas del negocio que el sistema tiene que respetar

1. Una factura puede incluir **más de un pedido**.
2. Cada pedido tiene que quedar **relacionado con una venta (o un caso de postventa)** del sistema.
3. Si la factura **no dice a qué pedido corresponde**, eso no es un error a esconder:
   es un aviso para preguntarle al laboratorio, y la respuesta hay que guardarla.

## Cómo factura Optovisión (verificado sobre los PDF)

Hay **dos formas** de comprobante, y el sistema hoy solo entiende bien una:

**(a) Factura por pedido(s)** — `FA_3008-00062896`, $1.056.829,90:
encabezado `Ped: TI-7101568(587979) /TI-7101583(588049) /TI-7101638(588966)` y el
detalle **por artículo**, no por pedido:

| Artículo | Descripción | Cant | Importe |
|---|---|---|---|
| 5522_540_77 | Varilux Physio 3.0 Orma Blue UV | 2 | 364.314,24 |
| 5522_540_77 | Varilux Comfort Max 3.0 Orma Blue UV | 2 | 283.054,24 |
| TRA_TRA_FUV_UNI | Tratamiento Crizal Forte Uv | 4 | 129.591,00 |
| 3522_SAPPHD_946 | Orma Blue UV Crizal Sapphire HR | 2 | 62.352,00 |
| KL_COM_ORG_STK_1/2 | Cal Stock Org Común | 2 | 5.715,36 |
| KL_COM_ORG_MUL_1/2 | Cal Multifocal Org Común | 4 | 28.386,30 |

**(b) Factura contra remito** — `FA_3008-00069150`, $575.952,61: no hay línea
`Ped:` ni artículos. El detalle es una sola línea: `Remito E3 92257 · 23/07/2026 ·
importe 569.506,44 · desc. −93.512,55 · total 475.993,89`. El pedido vive en el
remito, no en la factura. (Este es el caso que resultó ser el pedido
**595000/7102030, Varilux XR Design Orma Blanco**, confirmado con el laboratorio.)

## Qué está mal hoy

1. **La factura no existe como dato.** La unidad es el pedido (`LabCostEntry`,
   clave `lab + labOrderNumber`). Del comprobante solo sobrevive el nombre del
   archivo en `sourceFile`. No se puede responder "¿qué me facturaron en la
   3008‑00062896?" ni "¿esta factura ya la pagué?".
2. **El prorrateo inventa números.** Cuando la factura agrupa varios pedidos, el
   importe se divide **en partes iguales** (`invoice.total / peds.length`). En la
   62896 eso le asigna $352.277 a cada uno de los tres pedidos, cuando las líneas
   reales van de $5.715 a $364.314. De ahí salieron el "+$173.192 de sobrecosto" y
   el "−$947.273 de ahorro" del cruce del 18/7: los dos son artefactos del reparto.
   Las líneas del PDF, que son la verdad, se descartan.
3. **Las facturas sin pedido se disfrazan de pedido.** Se registran con la clave
   inventada `S/PEDIDO 3008-00069150`, que ocupa la columna "Nº operación" y
   contamina el total de huérfanos ($3,7M en 82 "pedidos sin venta", donde hay
   mezcladas dos cosas distintas).
4. **No hay forma de resolverlas desde el CRM.** No existe ninguna acción
   "asignar esta factura al pedido X": el único camino manual es una importación
   CSV por nº de pedido. Una huérfana queda huérfana para siempre salvo que se
   toque la base a mano.
5. **La consulta al laboratorio no se guarda en ningún lado.** "Pregunté y me
   dijeron que la 3008‑00063271 es el 588062" hoy vive en el WhatsApp. Sin fecha,
   sin quién preguntó, sin respaldo para el reclamo.
6. **Datos del comprobante que están en el PDF y se tiran**: nº de factura,
   fecha de emisión, **vencimiento (VTO)**, CAE, neto/IVA/total, remito, y el PDF
   mismo. `invoiceDate` guarda la fecha del **email**, no la del comprobante.
7. **El resumen de cuenta vive aparte.** `LabAccountStatement.rows` es un JSON sin
   vínculo con las facturas ni los pedidos: el cruce factura ↔ deuda se rehace a
   mano cada vez y no hay estado "pagada" ni "en reclamo".

Grupo Óptico, en cambio, **ya está una generación adelante**: su parser
(`grupo-optico-invoices.ts`) lee el detalle **línea por línea con su nº de pedido**
y reparte explícitamente las líneas que vienen sin pedido. El modelo de abajo es,
en buena medida, llevar Optovisión a ese nivel y unificar a los dos.

## El modelo que conviene

**`LabInvoice` — el comprobante** (lo que el lab te reclama)
`lab · serie · nro (3008-00069150) · tipo (FACTURA/REMITO/NC) · fechaEmisión ·
vencimiento · CAE · neto · iva · total · remito · pdf · estado`

Estado: `SIN_IDENTIFICAR → IDENTIFICADA → CONCILIADA → PAGADA`, más `EN_RECLAMO`.
Campos de gestión: **fecha de consulta al laboratorio, quién consultó y qué
contestó** (la respuesta que hoy se pierde).

**`LabInvoiceLine` — la línea del PDF**
`artículo · descripción · cantidad · unitario · descuento · importe ·
labOrderNumber (si se pudo atribuir) · atribuidoPor: PDF | REMITO | LAB | MANUAL ·
quién y cuándo`

**`LabCostEntry` — el pedido** sigue siendo la unidad de cruce contra la venta,
pero su importe facturado pasa a ser **la suma de sus líneas** (no un prorrateo), y
la relación factura↔pedido queda como lo que es: muchos a muchos, a través de las
líneas.

## El flujo

1. **Ingesta**: la factura se guarda **entera y siempre** (cabecera + líneas + PDF).
   Ninguna se descarta ni se resume a un promedio.
2. **Atribución en cascada**:
   a. Encabezado `Ped:` con un solo pedido → todo a ese pedido.
   b. Encabezado con varios → repartir **por artículo**, cruzando la descripción de
      la línea contra los ítems de cada venta candidata. Lo que no cierre queda
      marcado `A_REVISAR` — nunca un prorrateo silencioso.
   c. Sin `Ped:` → buscar por **remito**; si no aparece, `SIN_IDENTIFICAR`.
3. **Bandeja "Facturas a identificar"** en `/admin/laboratorio/costos`: importe,
   fecha, remito, PDF a la vista, botón **Asignar pedido** y campo **respuesta del
   laboratorio**. Al asignar se recalcula el cruce y queda firmado en el AuditLog.
4. **Dos alertas distintas** (hoy son una sola bolsa):
   - *Factura sin indicación de pedido* → "preguntale al lab", con remito, importe
     y fecha listos para la consulta.
   - *Pedido facturado sin venta en el sistema* → lo que ya avisa hoy.
5. **Cuenta corriente**: cada fila del resumen de Essilor matchea por serie‑nro con
   su `LabInvoice`. Tablero: conciliado / a identificar / en reclamo / pagado, y
   los **vencimientos** para no pagar tarde.

## Etapas

- **Etapa 1** — bandeja de facturas a identificar + acción "asignar pedido" con la
  respuesta del laboratorio; guardar remito, fecha de emisión y vencimiento del
  PDF. Con esto se cargan hoy mismo los dos casos ya resueltos
  (`3008-00069150 → 595000`, `3008-00063271 → 588062`) y dejan de ser ruido.
- **Etapa 2** — `LabInvoice` + `LabInvoiceLine`, migración de lo existente, y
  **muerte del prorrateo** (atribución por artículo, lo dudoso marcado).
- **Etapa 3** — cruce con el resumen de cuenta, estados de pago y reclamo,
  vencimientos, y el tablero completo de la cuenta corriente.
