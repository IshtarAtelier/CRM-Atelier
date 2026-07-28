# Conciliación con Optovisión — investigación y plan

Auditoría del 28/7/2026. Base de evidencia: **las 56 facturas** que Optovisión
mandó por email entre el 1/3/2026 y el 28/7/2026, bajadas y parseadas una por
una, más el código de `src/services/lab-recon/` y el portal de pedidos.

## 1. Cómo factura Optovisión, con números

Hay **tres formas** de comprobante. El sistema entiende bien una sola:

| Forma | Cómo se identifica el pedido | Facturas | ¿Hoy funciona? |
|---|---|---|---|
| **A** | `Ped: TI-7101568(587979)` — nº entre paréntesis | 48 | Sí |
| **B** | `Ped: TM-3578630` — **sin** paréntesis | 4 | **No**: el parser exige paréntesis |
| **C** | Sin línea `Ped:`. Solo la tabla de remito | 4 | **No**: no hay pedido en el papel |

De las 48 de la forma A, **45 traen un solo pedido**; 2 traen dos y 1 trae tres.
El multi‑pedido es el 5% de los casos, pero cae justo en las facturas caras.

Lo que **sí** trae el 100% de las facturas: nº de comprobante, fecha de emisión,
**vencimiento**, CAE, neto/IVA/total y **número de remito** (`E3‑00084770`,
`E4‑00064303`…). Nada de eso se guarda hoy.

## 2. Los seis defectos, en orden de plata

**a) El formato `TM-` se ignora → 4 facturas dadas por huérfanas que no lo son.**
$200.962 c/IVA, todas identificables sin preguntarle nada a nadie:

| Factura | Fecha | Pedido en el papel | Importe c/IVA |
|---|---|---|---|
| 3008‑00049804 | 25/03 | `TM-3551646` | $56.983,49 |
| 3025‑00036353 | 06/05 | `TM-3551647` | $47.486,44 |
| 3025‑00044882 | 10/07 | `TM-3578630` | $48.246,32 |
| 3025‑00045490 | 15/07 | `TM-3578631` | $48.246,32 |

Son pedidos de **stock**, y los números coinciden con ventas que el CRM tiene
cargadas como "sin factura recibida". El dato estaba en el PDF todo el tiempo.

**b) El remito nunca se guarda, y lo que se guarda como remito está mal.**
El código busca `\b(E\d)\s+(\d{5,})\b`, que engancha el `E3 00084770` del
encabezado (el remito de la factura, sí, pero sin distinguirlo) y **no** encuentra
el remito real de las facturas de la forma C, porque ahí viene pegado al importe
(`435446.44E3   85079`) y el `\b` no matchea. Resultado: justo donde el remito es
la única pista, se pierde.

**c) El prorrateo en partes iguales inventa importes.** En `3008-00062896`
(3 pedidos, $1.056.829,90) el sistema le asigna **$352.276,63 a cada uno**. Los
importes reales, deducidos del detalle por artículo, son:

| Pedido | Neto | Con IVA |
|---|---|---|
| el del Varilux Physio | 443.302,89 | **536.396,50** |
| el del Varilux Comfort Max | 362.042,89 | **438.071,90** |
| el del Sapphire HR | 68.067,36 | **82.361,51** |

Suma = subtotal del PDF, exacto. El "+$173.192 de sobrecosto" y el "−$947.273 de
ahorro" del cruce del 18/7 son artefactos del reparto, no plata.

**d) La factura no existe como dato.** La unidad es el pedido; del comprobante
solo sobrevive el nombre del archivo en `sourceFile`. No se puede responder "¿qué
me facturaron en la 62896?" ni "¿esta ya la pagué?". El PDF tampoco se guarda.

**e) Las facturas sin pedido se disfrazan de pedido** (clave inventada
`S/PEDIDO 3008-00069150` ocupando la columna "Nº operación") y **no hay forma de
resolverlas desde el CRM**: no existe ninguna acción "asignar al pedido X".

**f) La respuesta del laboratorio no se guarda en ningún lado.** "Pregunté y me
dijeron que la 63271 es el 588062" queda en el WhatsApp: sin fecha, sin quién
preguntó, sin respaldo para el reclamo.

## 3. Las únicas 4 que hay que consultarle al laboratorio

Son las de la forma C. Con el remito ya extraído, la consulta es de diez segundos:

| Factura | Fecha | Remito | Importe c/IVA | Pedido |
|---|---|---|---|---|
| 3008‑00052707 | 13/04 | `E3-71459` | $237.163,79 | **falta preguntar** |
| 3008‑00063271 | 19/06 | `E3-85079` | $438.071,90 | 588062 ✅ |
| 3008‑00067549 | 17/07 | `E4-65290` | $17.173,71 | **falta preguntar** |
| 3008‑00069150 | 24/07 | `E3-92257` | $575.952,61 | 595000 ✅ |

Cuatro en cinco meses. Ese es el volumen real del problema.

## 4. El portal: no conviene automatizarlo

`optovision.com.ar/oves/` es una aplicación vieja — VBScript en el cliente, MD5
en el navegador, formularios por GET, sin API. Automatizarla sería scraping
frágil, y habría que guardar las credenciales para que un proceso las use.
Con cuatro consultas cada cinco meses, **no se justifica**. El email con el PDF
sigue siendo la fuente confiable; el portal queda como consulta manual.

## 5. El plan

**Etapa 0 — arreglar el parseo (chico, esta semana).**
Aceptar el formato `TM-`; extraer el remito de verdad (y distinguirlo del código
de cuenta); guardar fecha de emisión, vencimiento y CAE **del PDF** en vez de la
fecha del email. Las 4 huérfanas falsas se resuelven solas y las 4 reales pasan a
mostrar su remito. *Ya hecho de esta etapa: nº de operación, comprobante y fecha
en todas las filas de los avisos.*

**Etapa 1 — la factura como entidad.**
`LabInvoice` (serie‑nro, tipo, fecha, vencimiento, CAE, neto/IVA/total, remito,
PDF guardado, estado) + `LabInvoiceLine` (artículo, cantidad, unitario, importe,
pedido si se pudo atribuir, y **cómo** se atribuyó: PDF / remito / respuesta del
lab / a mano). El pedido (`LabCostEntry`) sigue siendo la unidad de cruce contra
la venta, pero su importe pasa a ser **la suma de sus líneas**.

**Etapa 2 — la bandeja "Facturas a identificar".**
Pantalla con importe, fecha, remito y PDF a la vista, botón **Asignar pedido** y
campo **respuesta del laboratorio** (con fecha y quién consultó, firmado en el
AuditLog). Y separar las dos alertas que hoy van en la misma bolsa:
*factura sin identificar* (preguntale al lab) ≠ *pedido facturado sin venta*.

**Etapa 3 — matar el prorrateo.**
Atribución por artículo: cada línea de cristal con `Cant 2` es un par, o sea un
pedido; las líneas compartidas (tratamientos, calibrados) se reparten por par
según el tipo — multifocal con los multifocales, stock con los de stock. Se cruza
la descripción contra los ítems de cada venta candidata. Lo que no cierre contra
el subtotal queda marcado *a revisar*; nunca un reparto silencioso.

**Etapa 4 — la cuenta corriente cruzada.**
Cada fila del resumen de Essilor matchea por serie‑nro con su factura. Tablero:
conciliado / a identificar / en reclamo / pagado, con los vencimientos a la vista
para no pagar tarde. Ese es el resumen completo y curado.

## 6. Lo que queda pendiente de decisión

- Cargar en producción los dos mapeos ya confirmados
  (`3008-00069150 → 595000`, `3008-00063271 → 588062`).
- Preguntarle al laboratorio por las dos facturas que faltan
  (remitos `E3-71459` y `E4-65290`).
- Qué hacer con Grupo Óptico ahora que el lab activo es solo Optovisión: apagar
  su barrido y sus alertas conservando el histórico, o dejarlo como está.
