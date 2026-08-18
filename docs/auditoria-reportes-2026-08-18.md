# Auditoría del módulo de Reportes (P&L) — 18/08/2026

Alcance: `src/services/report.service.ts`, `src/app/api/reports/route.ts`,
`src/app/admin/reportes/page.tsx`, `src/components/admin/reports/*`,
`src/app/api/cron/month-close/route.ts`, `src/app/api/dashboard/route.ts`,
`src/lib/targets.ts`. Solo lectura de código; sin datos de prod.

Disparador: agosto muestra Facturación $16,36M · Cobrado $13,46M · "Costos" $5,55M ·
Resultado neto $925k (6,9%). El neto no cierra con lo que muestran las tarjetas.

---

## 1. Errores que mueven plata (ALTA)

| # | Dónde | Qué pasa | Efecto |
|---|---|---|---|
| A1 | `report.service.ts:178-179` vs `:228-310` | **Ingreso = cobrado, CMV = venta completa.** Una venta con seña tiene todo su costo restado y solo la seña de ingreso. | Los $2,89M pendientes ya tienen su costo restado → neto subestimado ~$2,9M. Meses con muchas señas dan pérdida; el mes siguiente da ganancia sin costo. |
| A2 | `report.service.ts:367, 380-384, 392, 424`; `month-close:316` | **Descuento especial restado dos veces.** `subtotalWithMarkup` ya es neto de `specialDiscount` (PricingService:100/145) y lo cobrado también. | Neto baja por el total de descuentos especiales del mes. También baja la base del honorario médico. |
| A3 | `report.service.ts:352-361`; `constants.ts:62-90` | **Comisión Payway/Naranja Z/Go Cuotas (10–20%) restada del cobrado**, cuando el precio de lista ya la incluye (regla: `price` = 6 cuotas; transferencia = −15%). Quien paga en cuotas "cuesta" 20% más que quien paga por transferencia, siendo el neto real casi igual. | Ganancia fantasma negativa ≈ 20% de todo lo cobrado con tarjeta. |
| A4 | `report.service.ts:278, 289` | **Costo de cristal por par solo si `eye` es `OD/OI`.** Existen ítems `RIGHT/LEFT` (order-pdf-generator:180, sale-recap-text:181) → costo del par por cada ojo. | CMV de cristales duplicado en esas ventas. |
| A5 | `page.tsx:294-297` | Tarjeta **"Costos y gastos totales — Operativos, Proveedores, Comisiones"** muestra `totalCosts` = **CMV** (armazones+cristales+post-venta). Fijos, marketing, comisiones y médicos no están. | El admin no puede reconstruir el neto: hay ~$7M de deducciones que no aparecen en ninguna tarjeta. |
| A6 | `page.tsx:281-283` | **"Facturación total" = `cobrado nominal + pendiente a lista`**, sumado en el cliente. Mezcla bases; el service ya tiene el facturado (`objectiveMonths.billed`) y no lo expone en `summary`. | El $16,36M no es facturado ni lista. |
| A7 | `report.service.ts:200-204, 224-226, 399`; `month-close:120,143`; `dashboard:627,657` | **Vendedor = `order.userId`** (quien creó la ficha). Regla: vendedor = `labSentBy`. Ventas web caen en el usuario sistema. | Ranking por vendedor, objetivos por vendedor y saldos atribuidos mal. |
| A8 | `dashboard/route.ts:185` | **"Total cobrado" del dashboard = Σ `Order.paid`.** Regla: `Order.paid` no prueba cobro. Reportes usa Σ Payment. | Dos pantallas, dos "cobrado" distintos. |
| A9 | `report.service.ts:474-481`; `targets.ts:84-100`; `ObjectivesReport:56,94,172` | Objetivos en USD de **meses pasados convertidos con el blue de hoy**; si falla la cotización tras un deploy (cache in-memory vacío) cae en silencio a defaults ARS 18/24/30M marcados "Personalizado". | El cumplimiento de junio cambia cada día; metas configuradas ignoradas sin aviso. |
| A10 | `page.tsx:141-149`; `route.ts:15-16`; `report.service.ts:17-21` | `fetch` a ámbito directo desde el componente (viola "integraciones solo vía service") y puede diferir del rate del service. `from/to` sin validar → `Invalid Date` → 500. Corte del día en **UTC** (21:00 ART del día anterior); dashboard corta en ART. | USD mostrados ≠ USD de metas; ventas de 21–24h caen en el día/mes equivocado y distinto por pantalla. |

## 2. Fórmula actual vs. estructura real del negocio

Hoy (`report.service.ts:424`):
```
neto = cobrado − CMV − Payway − médicos − fijos − marketing − descEspecial
```
Estructura declarada por el negocio: **producto (cristal + armazón)** + **fijos (sueldos, alquiler, campañas)** + **Payway**.

Correcto:
```
Ingreso devengado = precio real de la venta (lista neta de descuentos), cobrada o no
− CMV (cristales por par + armazones + post-venta)         → costo del producto
− Costo financiero real de tarjeta (ver decisión D1)
− Honorarios médico (15% sobre la venta, no sobre el cobrado)
= Margen bruto
− Fijos + sueldos + marketing del mes (prorrateados si el rango es parcial, o
  mostrados aparte con aviso "mes en curso")
= Resultado neto
Aparte (caja, no resultado): cobrado / pendiente en equivalente de lista.
```

## 3. Inconsistencias (MEDIA)

**Service**
- `M1` `:24-38` no filtra `WEB_PENDING` ni ningún estado: carritos web abandonados cuentan como venta con revenue 0 y CMV completo (baja ticket, sube CMV). Ningún módulo aplica "venta real = Payment o labStatus".
- `M2` `:100-125` FixedCost por mes calendario completo contra rango parcial (hoy 18/8 resta el mes entero); solo `to` → todos los fijos de la historia; solo `from` → todo el año; `PROVEEDOR` se calcula y no entra en nada.
- `M3` `:352-357` `getCommissionRate` por match exacto: `'TARJETA'` (ventas web) → 0%; `CREDIT`=0 vs `CREDIT_6`=20%; pago sin método → CASH.
- `M4` `:364-370` honorario médico sobre cobrado − comisión − especial, con `max(0,…)` que no recupera lo perdido en el mes de la seña.
- `M5` `:248-250` `productCostSnapshot = 0` se acepta como costo real → margen 100% sin aviso.
- `M6` `:243, 283-294` `is2x1Order` es true con cualquier cristal a $0 aunque no haya promo → se costea como calibrado ($15.000×1,21 hardcodeado).
- `M7` `:184, 221` `billed = subtotalWithMarkup || total`: ventas web (sin `subtotalWithMarkup`) entran con `total` ya descontado 15%.
- `M8` `:188` `calculateOrderFinancials` usa `paidReal = max(pagos, Order.paid)` (PricingService:180) — contradice "Order.paid no prueba cobro".
- `M9` `:190-193` `totalMarkup` = `subtotalWithMarkup − Σ price×qty`, pero `subtotalWithMarkup` es neto de promo y especial → markup negativo con 2x1.
- `M10` `:131-140` "Conversión" = ventas de cualquier cliente / contactos nuevos del período; puede superar 100%. `quotedContactsCount` no filtra fecha del QUOTE. "Sin atender" = contactos − cotizados (otro significado que en el buzón).
- `M11` `:209-216` pagos sumados completos sin mirar `Payment.date`; agrupación por mes con `getMonth()` local en servidor UTC.
- `M12` `:326-327` qty de cristales `/2` sin mirar `eye` → "0,5 pares".
- `M13` `:334-347` vs `:444-456` labProfitStats/labOrderIds con claves normalizadas distinto → `ordersCount` parcial; `productTypeSnapshot` seleccionado y no usado (`:268`).
- `M14` `:427-430` `invoices` sin `select` explícito (regla prod).

**Cierre de mes / dashboard**
- `M15` `month-close:99-109` `select` sin `total` → ventas web nunca aparecen en "saldos pendientes".
- `M16` `month-close:138` `projectedProfit = neto + pendiente a lista` (sin descuentos ni comisiones, y con `Order.paid` como failsafe).
- `M17` `dashboard:415-486` duplica el cálculo de CMV/2x1 del service (regla: un helper en `src/lib/`).
- `M18` `dashboard:497` período anterior filtra solo `labSentAt`; actual usa `labSentAt ?? createdAt` → tendencia peras con manzanas.
- `M19` Ticket promedio: dashboard = lista/órdenes; reportes = cobrado/órdenes.

**UI**
- `M20` `SalesDetailSection:134-136, 207-224` totales mensuales y márgenes recalculados en el cliente; `monthlyStats` del service se ignora.
- `M21` `page.tsx:369-417` P&L omite `totalCostOther`, `totalSpecialDiscounts`, `totalProviderCosts` → las barras no reconstruyen el neto.
- `M22` `page.tsx:309-315` vs `:341-347` "Operaciones" y "Ventas efectuadas" son la misma tarjeta.
- `M23` `page.tsx:163-182` fetch sin AbortController ni "última gana"; `!res.ok` no muestra error.
- `M24` `page.tsx:103-128` "Trimestre" es rolling 3 meses; `'year'` muerto; "Aplicar" sin fechas trae toda la historia.
- `M25` `LaboratoryStats:47` "ventas" cuenta ítems (2 por par); `ordersCount` del service descartado.
- `M26` `ObjectivesReport:92-96` mes en curso parcial vs objetivo y fijos de mes completo, sin aviso.
- `M27` `SalesDetailSection:246-248` fecha "18 ago" (regla dd/MM/yyyy); `toLocaleString()` sin locale en 20+ lugares vs `formatCurrency` es-AR.
- `M28` `SalesDetailSection:251-260` muestra `% ef` y `% tr` juntos aunque se pagó con un solo método.
- `M29` `SalesDetailSection:76-82` `expandedMonths` no se resetea al cambiar de rango.

## 4. Menores (BAJA)
`route.ts:9` rol default `'STAFF'` en vez de `getActor`; `route.ts:19` cache `any` y tipos duplicados a mano en `page.tsx:66-99`; `import { CostRow as ProfitLossChart }`; `key={v.name}`; `maxRev` dentro del map; sin `aria-label`/`role`; profitMargin sobre cobrado (puede dar −150% con seña); redondeos a 2 decimales en detalle y no en totales; costos post-venta imputados al mes de la venta y sin filtrar anulados; `productStats.revenue`/`labStats.revenue` en precio de ítem sin markup mientras el resumen es cobrado.

## 5. Decisiones de negocio necesarias antes de corregir
- **D1 Payway.** ¿Se muestra el costo financiero de tarjeta? Opciones: (a) no restar nada (ya está en el precio de lista; el "costo" es no haber cobrado el −15% de transferencia); (b) restar lo que Payway efectivamente retiene por liquidación (dato real, no 20% fijo). Recomendación: (a) en el neto + una tarjeta informativa "descuentos por medio de pago".
- **D2 Criterio de resultado.** Devengado (venta = ingreso, cobrada o no) con caja aparte. Recomendación: sí.
- **D3 Fijos en rango parcial.** Prorratear por días o mostrar aparte con aviso. Recomendación: mostrar "mes en curso: fijos completos" y prorratear solo en la proyección.
- **D4 Blue histórico.** Guardar la cotización usada al cierre de cada mes (SystemSetting o columna en MonthlyTarget).

## 6. Plan de corrección (arquitectura)
1. `src/lib/pnl/` — un único motor: `computeOrderEconomics(order)` (ingreso devengado, CMV por par, honorarios, descuentos informativos) y `aggregatePnl(orders, fixedCosts, range)`; tipado, sin `any`, con tests unitarios sobre casos: seña, 2x1, RIGHT/LEFT, venta web, WEB_PENDING, especial, médico.
2. `report.service`, `month-close`, `dashboard` consumen ese motor. Se borra el CMV duplicado del dashboard.
3. `summary` expone todo lo que la UI muestra (`totalBilled`, `totalExpenses`, `avgTicket`, `unattendedCount`, `conversion`, `breakdown[]`). La UI no suma nada.
4. Rango en ART, validado en `route.ts` (400 si inválido); un solo `formatCurrency`/`formatDate`.
5. Vendedor = `labSentById ?? userId` en los 3 módulos.
6. Filtro de venta real (excluir `WEB_PENDING`, exigir Payment o labStatus).
7. Cotización por mes persistida; aviso visible cuando falta.
