# Actualización de costos de Optovisión — el proceso

Cada vez que Essilor manda lista nueva, esto es lo que se hace, en este orden.
Escrito el 26/8/2026, después de la primera pasada completa (lista del 3/8/2026).

## La decisión de fondo (auditada, no cambiarla sin motivo)

**Se guardan LOS DOS costos en cada producto:**

| Campo | Qué es | Quién lo usa |
|---|---|---|
| `baseCost` | El **pelado**: el precio de lista del laboratorio, tal cual el PDF | Solo la pantalla de inventario, para recalcular |
| `cost` | El **final**: `(pelado + calibrado) × (1 + IVA)` | **Todo lo que opera**: ventas, reportes, cruce de facturas |

Por qué así y no de otra forma:
- Reportes y ventas leen `cost` tal cual está: cargar el pelado en `cost`
  inflaría todos los márgenes sin que nadie lo note.
- Desde el 26/8/2026, **si la carga trae el pelado y no trae `cost`, el sistema
  calcula el final solo — una vez, al guardar** (alta, edición y carga masiva).
  Si la carga trae `cost` explícito, se respeta. Verificado por
  `npm run check:costo-pelado` (8 comprobaciones).
- Sin el pelado guardado no se puede recalcular cuando cambia el calibrado o el
  IVA sin volver a aplicar la fórmula sobre un número que ya la tenía adentro
  (ese era el bug de duplicación del botón "Calcular Final").
- Calibrado e IVA viven en **Configuración → Laboratorios** (Optovisión:
  $23.000 y 21% al 26/8/2026). El respaldo del código es
  `CALIBRADO_POR_DEFECTO` en `lens-cost.ts` — un solo lugar.

**Reglas que no se negocian:**
- La sincronización de costos **nunca toca `price`**. El precio al cliente se
  maneja aparte, en **Stock y Productos → Aumentar Precios** (deja historial).
- En un 2x1, el segundo par cuesta **solo calibrado con IVA** ($27.830 hoy).
- Los "Mi Primer Varilux" son la promo del 50%: su costo es **media lista**.
- Un costo que BAJA es sospechoso hasta demostrar lo contrario: casi siempre es
  un tratamiento mal deducido, no una baja real del laboratorio.

## El proceso, paso a paso

### 1. Transcribir la lista nueva
- El PDF llega por WhatsApp/mail. Guardarlo.
- Transcribir a `scripts/maintenance/precios-optovision/varilux-<mes>-<año>.json`
  (copiar la estructura del anterior). **No pisar el JSON viejo**: comparar dos
  listas es la única forma de medir el aumento real del laboratorio.
- Trampas conocidas del PDF:
  - Los nombres de los diseños son **logos, no texto**: `pdftotext` da tablas
    sin dueño. Verificar cada bloque contra la **imagen** de la página.
  - Varilux y Kodak (págs. 5–17) traen el antirreflejo **incluido**; los
    monofocales (pág. 20) y Sygnus (23–24) vienen **SIN AR** — el tratamiento
    se suma aparte.
  - En Kodak Softwear y SV Digital hay **dos filas "ORMA TRANSITIONS GEN S"**
    con precios distintos: transcribir tal cual, no adivinar cuál es cuál.
  - Los precios son **sin IVA** y hay descuentos en factura: la lista NO es el
    costo real pagado.
- Si aparecen familias nuevas, agregarlas a `emparejador.mjs`.

### 2. Traer producción a la base local
```bash
node scripts/maintenance/traer-precios-de-produccion.mjs --aplicar
```
Copia precios y costos actuales de producción a local (tiene candado: solo
escribe en localhost). Todo lo que sigue se calcula sobre estos valores.

### 3. Emparejar y revisar el informe de costos
```bash
node scripts/maintenance/precios-optovision/listado-costos.mjs salida.html
```
Muestra costo de hoy vs. costo según lista, producto por producto. Desde el
26/8/2026 rige la **política del Crizal más caro**: todo renglón con columnas
Crizal se costea con la más cara (el Crizal real es dato de la venta, de
elección obligatoria — ver plan-crizal-obligatorio.md). Solo quedan en ámbar
los renglones sin columnas Crizal o sin precio: esos sí, preguntarle a Ishtar.

### 4. Ensayo en desarrollo
```bash
node scripts/maintenance/precios-optovision/sincronizar-costos.mjs            # ensayo
node scripts/maintenance/precios-optovision/sincronizar-costos.mjs --aplicar  # escribe en LOCAL
```
El ensayo muestra el markup resultante de cada producto (el precio queda quieto
y el costo se mueve). Mirar los marcados "margen bajo".

### 5. Entregar el informe del aumento
Con el ensayo hecho, informar a Ishtar:
- % de aumento por familia (mediana y promedio) y el rango
- cuáles **bajan** y por qué (los que bajan de verdad son raros)
- cuáles quedan con markup por debajo del objetivo (hoy ×2,40)
- los que no cruzaron y qué les falta (familia sin transcribir / nombre)

### 6. Aplicar en producción (lo corre Ishtar)
```bash
node scripts/maintenance/precios-optovision/sincronizar-costos.mjs --produccion            # ensayo contra prod
node scripts/maintenance/precios-optovision/sincronizar-costos.mjs --produccion --aplicar  # escribe
```
Escribe `baseCost` + `cost`, solo en los que cambian, y firma cada uno en el
AuditLog con el renglón de la lista del que salió.

### 7. Verificar y cerrar
- Re-correr el listado contra producción y confirmar que quedó lo esperado.
- Commitear el JSON nuevo y cualquier ajuste del emparejador.
- **Los precios al cliente son una decisión aparte**: si corresponde ajustarlos,
  se hace desde la pantalla Aumentar Precios (queda en el historial con firma).

## Pendientes conocidos de este proceso
- 44 Varilux con el tratamiento sin confirmar (26/8/2026) — el catálogo dice
  que XR series y Línea 3.0 llevan Forte UV de fábrica; falta el OK de Ishtar.
- `Orma Blue UV Crizal Saphire HR` en producción tiene `baseCost` viejo
  ($70.940) incoherente con su `cost` ($141.497), y markup ×1,29.
- `KODAK PRECISE - ORMA ACCLIMATES` no existe en la lista del laboratorio y
  nunca se vendió: borrarlo (confirmado por Ishtar el 26/8).
- Familias sin transcribir: Eyezen (pág. 11), Eyezen Kids (12), Myopilux (13),
  Stellest (13), Espace Plus (18), Interview (18). Los New Editions son packs
  propios: no están en la lista, su costeo es otra conversación.
- ~~Mejora futura~~ **HECHO (26/8/2026)**: al guardar un cristal con el pelado
  y sin `cost`, el sistema calcula el final solo — una vez, al guardar
  (`costoDesdeElPelado` en `product.service.ts`, test `check:costo-pelado`).

## Sumado al plan el 29/8/2026 — facturación con precio de EFECTIVO
El dashboard muestra dos facturaciones que no cierran entre sí (el resumen de
origen suma ~$24M y la facturación histórica del mismo período ~$30,9M). La
regla que definió Ishtar: **toda facturación se informa al precio de EFECTIVO**
— el recargo de cuotas/tarjeta es COSTO FINANCIERO, no venta, y hoy se cuenta
como si fuera facturación. Pendiente: unificar TODOS los reportes (dashboard,
facturación histórica, reportes mensuales) para que usen la misma base de
efectivo y el costo financiero se vea aparte. Tocará report.service y
dashboard/route — hacer con test, es plata contada.
