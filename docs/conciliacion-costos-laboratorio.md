# Conciliación de costos de laboratorio

Cruce automático, por número de pedido, entre el **costo de lista del CRM** y el
**costo real que cobra cada laboratorio**, más el control inverso: **pedidos que
existen en el laboratorio y no responden a ninguna venta del sistema**.

## Arquitectura (modular por diseño)

```
┌─────────────────────────── Proveedores (1 por laboratorio) ──────────────────────────┐
│  OPTOVISION                          GRUPO_OPTICO                                    │
│  Facturas PDF por email (IMAP)       API JSON del portal SmartLab                    │
│  → nº pedido + importe               → todos los pedidos + nº de factura             │
└──────────────────────┬───────────────────────────┬───────────────────────────────────┘
                       ▼                           ▼
              LabCostReconciliationService.upsertEntry()   ← idempotente (lab + nº únicos)
                       │        nunca pisa facturación previa; conserva notas
                       ▼
                  LabCostEntry ──── estados: OK / OVERCOST / UNDERCOST / PENDING / UNMATCHED
                       │
        ┌──────────────┼─────────────────────────┐
        ▼              ▼                         ▼
  Reporte mensual   Página /admin/laboratorio/costos   Alertas por email
  (se arma en vivo,  (resumen, filtros, import          (sobrecosto nuevo,
  se completa solo)   planilla, barridos a demanda)      fuente caída 3+ días)
```

- **Agregar un laboratorio nuevo** = escribir un proveedor (`src/services/lab-providers/`)
  y sumarlo a `LAB_PROVIDERS`. El cron, la tabla, la página y los reportes no cambian.
- **Idempotencia**: la clave única `(lab, nº de pedido)` hace que cualquier corrida se
  pueda repetir sin duplicar ni romper nada.
- **Una fuente sin importes jamás pisa una con importes**: el barrido del portal
  (que no trae plata) preserva el costo cargado por planilla o PDF.

## Ciclo diario (`/api/cron/lab-invoices?secret=CRON_SECRET`)

1. **Optovision**: escanea el Gmail (IMAP), parsea las facturas PDF de
   `procesos@optovisionsa.com.ar` → registra costo real y alerta sobrecostos nuevos.
2. **Grupo Óptico**: pagina la API del portal (`smartlab-api-v2 → laboratory/order/list`)
   desde el pedido más nuevo hasta el inicio de la auditoría → registra todos los
   pedidos de la era CRM; los que no matchean quedan **"Sin venta"** (huérfanos).
   Además descarga el **PDF de facturas del rango** (`laboratory/order/invoice?cl&t=2&c=1&s&e`),
   lo parsea (`grupo-optico-invoices.ts`) y asigna a cada pedido su **costo real**
   por número de factura → totalmente automático, sin planilla.
3. **Re-cruce**: lo que estaba sin match se vuelve a cruzar (números cargados tarde).
4. **Watchdog**: si una fuente lleva 3+ días sin corrida exitosa (estado en
   `SystemSetting: lab-provider:*:lastOkAt`), email de alerta — un pipeline caído
   en silencio es un agujero de auditoría.

Cada paso tolera la falla de los demás. El sync de estado de SmartLab (cada 15 min)
además registra huérfanos de los últimos 100 pedidos visibles, para latencia intra-día.

## Estados de una entrada

| Estado | Significado |
|---|---|
| `OK` | Costo facturado ≈ costo de lista (tolerancia $100) |
| `OVERCOST` | El lab cobró de más **o** la venta se cargó con otro producto → email |
| `UNDERCOST` | El lab cobró menos que la lista |
| `PENDING` | Pedido con venta, esperando el costo facturado |
| `UNMATCHED` | **Sin venta en el sistema** (huérfano) — plata sin venta que la respalde |

## Configuración

| Variable | Uso |
|---|---|
| `CRON_SECRET` | Auth del cron |
| `IMAP_USER` / `IMAP_PASSWORD` | Casilla que recibe las facturas de Optovision (app password de Gmail) |
| `SMARTLAB_USER` / `SMARTLAB_PASSWORD` / `SMARTLAB_CLIENT_ID` | Login del portal Grupo Óptico (fallback a los valores actuales) |
| `LAB_AUDIT_START_ISO` (constants.ts) | Inicio de la auditoría (primera venta del CRM: 2026-04-08) |

## Puesta en marcha / pendientes

1. Regenerar la **app password de Gmail** y actualizar `IMAP_PASSWORD` (local y Railway) — hoy inválida.
2. Deploy (merge `desarrollo` → `main`); la migración `20260715120000_add_lab_cost_entry` se aplica sola.
3. **Alta en cron-job.org**: GET diario a `https://atelieroptica.com.ar/api/cron/lab-invoices?secret=…`.
4. Primer corrida = backfill automático de Grupo Óptico (toda la era CRM). Optovision
   histórico: correr una vez con `&days=120` cuando esté la clave IMAP.
5. Fase 2 (opcional): importes de Grupo Óptico desde la cuenta corriente del portal
   (`/smartlab/system/currentAcount`, descarga de facturas por rango) cruzando el nº de
   factura que ya guardamos por pedido en `sourceFile`.

## Auditoría histórica del 2026-07-15 (hecha a mano, base del backfill)

Portal completo descargado (1.351 pedidos desde sept 2024). Era CRM (desde 8/4):
242 pedidos válidos → 168 con venta, **74 sin venta** (abr 22, may 18, jun 25, jul 9),
corroborado contra producción. Mayoría con pinta de reprocesos/garantías/segundos
pares pedidos al lab sin registrarse en el CRM. CSV entregado al administrador.
