# Embudo de ventas — cómo funciona (desde el 5/9/2026)

Dos embudos, un solo motor. Este documento es el mapa; el código manda y está
señalado en cada punto.

## Regla madre

**Nada le escribe solo al cliente.** Desde la migración a la API oficial de
WhatsApp (18/8/2026) los seguimientos automáticos por IA no existen más. El
sistema **propone** (qué lead, qué plantilla aprobada, qué día), una **persona
confirma y manda**, y **ese envío mueve la tarjeta**. Si una tarjeta dice
"Sin contactar", es verdad: nadie le escribió.

## Piezas (una sola definición de cada cosa)

| Qué | Dónde | Quién lo lee |
|---|---|---|
| Columnas y plazos (48h / 4 días / 15 días) | `src/lib/leads-pipeline.ts`, `src/types/leads.ts` | tablero, playbook |
| Qué toca hacer con cada lead y con qué plantilla | `src/lib/embudo/playbook.ts` | tablero, resumen diario |
| El tablero (leads, columnas, "para hoy") | `src/services/embudo.service.ts` | `/api/leads/pipeline`, resumen diario |
| El rastro de un seguimiento enviado (mueve la tarjeta) | `src/lib/embudo/registrar-seguimiento.ts` | `/api/whatsapp/send` |
| Quién NO es cliente (proveedor, laboratorio, mayorista, equipo) | `src/lib/no-cliente.ts` + `wa-service/transport/alta-de-ficha.js` | tablero, Oportunidades, alta de ficha |
| Materializar "para hoy" como tarea real | `src/lib/embudo/sincronizar-tareas.ts` | dashboard (TasksPanel), ficha del cliente (TaskManager) |
| Plantillas aprobadas | `src/lib/whatsapp/templates.ts` (Meta las aprueba; `scripts/checks/whatsapp-cloud-check.mjs` vigila) | buzón, playbook |

## Embudo 1 — WhatsApp (venta y seguimiento)

```
escribe por WhatsApp
   └─ alta de ficha automática (nombre del perfil + teléfono)      alta-de-ficha.js
        · si es proveedor / mayorista / equipo → NO_CLIENTE, sin ficha
   └─ [Primer Contacto] → receta → [Nueva Receta] → presupuesto → [Cotización Enviada]
        · sin presupuesto y sin charla hace >48h → "Hoy: Retomar la charla" (seguimiento_lentes)
   └─ +48h sin toque   → [Seguimiento 1]  "Hoy: Seguimiento del presupuesto" (seguimiento_presupuesto)
   └─ +4 días          → [Seguimiento 2]  "Hoy: Invitar al local"            (invitacion_local_v2)
   └─ +15 días         → [Frío]           "Hoy: Último seguimiento"          (ultimo_seguimiento, MARKETING: tiene costo)
   └─ todo mandado     → "Decidir: ganado o perdido" (botones ✓ / ✗ de la tarjeta)
   └─ +30 días         → fuera del embudo activo: "Frío hace N días: cerrar o archivar".
                          No cuenta para "Para hoy" ni propone plantilla — reactivar es tarea de campaña.
```

- La tarjeta muestra el paso del día. Su botón de WhatsApp abre el buzón con la
  plantilla **lista para confirmar** (`/admin/whatsapp?phone=…&plantilla=…`).
- Al confirmar, `/api/whatsapp/send` deja: etiqueta `SEGUIMIENTO_DIA_1/4/15` en
  el chat, nota firmada en la ficha, tareas FOLLOWUP pendientes canceladas,
  AuditLog. La tarjeta pasa a "Seguimiento enviado" y a la columna que
  corresponde.
- **"Para hoy"** (barra del tablero) = leads con un paso vencido. El mismo
  número llega a los ADMIN en el resumen diario de las 9:00, y ADEMÁS queda
  como una `ClientTask` real (`type: 'TASK'`) — la misma que ya muestran el
  dashboard y la ficha del cliente. Sin esto, un vendedor que no abre
  /admin/leads no tenía dónde enterarse de "a quién escribirle hoy".
  `EmbudoService.correrDiario()` la sincroniza UNA VEZ POR DÍA (la corrida del
  resumen), no en cada carga del tablero — evita duplicar la tarea en cada
  poll del navegador. Una tarea viva por cliente (se actualiza si el paso
  cambió, no se apila); si el vendedor manda el seguimiento, la tarea se
  cierra en el momento y a SU nombre (cuenta en su resumen diario); si el
  lead deja de tener nada vencido por otro motivo (cotizó, se cerró, se
  descartó), se cancela sola al otro día.
- Salida del embudo: ✓ Ganado (ficha → CONFIRMED), ✗ Desinteresado (etiqueta
  "no interesado"), o etiqueta de no-cliente.

## Embudo 2 — Tienda online (carrito)

```
inicia checkout → CheckoutSession PENDING
   └─ compra → COMPLETED (o RECOVERED si antes recibió un toque)
   └─ abandona:
        · ~1h  → mail recordatorio, sin cupón          (cron cada hora, instrumentation.ts)
        · ~24h → mail con cupón                        (mismo cron)
        · aparece en Oportunidades de Cierre con ficha automática ("Carrito Web")
          → una persona lo toca por WhatsApp (seguimiento_carrito) si tiene chat
        · >72h → ya no se recupera, se persigue desde Oportunidades
```

- Los dos toques salen por **mail**. El toque por WhatsApp es humano, desde
  Oportunidades (el botón registra la Interaction).
- `RECOVERED` es la métrica del recupero: cuántos volvieron después de un
  toque. Se ve en la salud de la tienda (`src/lib/tienda/salud.ts`).
- **Campaña de carritos por WhatsApp** (`/api/cron/campania-carritos`): retoma
  por WhatsApp a quien abandonó un carrito con la plantilla aprobada
  `seguimiento_carrito`. Misma mecánica que las otras campañas: tandas
  chicas, dedup por etiqueta "Campaña Carrito WhatsApp", respeta el
  interruptor "Campañas" y el horario. **`dryRun` es el default**: lista la
  audiencia y el texto; manda solo con `&dryRun=0`. Deja el mismo rastro que
  un seguimiento del embudo.
  - **Ventana con tope duro en `VENTANA_EMBUDO_DIAS`** (los mismos 30 días del
    embudo, `leads-pipeline.ts`): más viejo que eso quedó atrás para siempre,
    no solo hasta el próximo dry-run — `?dias=` no puede pedir más. Decisión
    de Ishtar del 5/9/26 después de que un `&dias=90` a mano trajera a alguien
    de hace 5 semanas y un carrito de prueba de hace más de dos meses.
  - También respeta `Client.opportunityDismissedAt`: si una vendedora ya
    descartó a esa persona desde Oportunidades de Cierre, la campaña no la
    reactiva (misma señal que usa ese panel — descartar en un lugar vale en
    los dos).

## Qué NO hace el sistema (a propósito)

- No manda seguimientos solo. No decide "ganado/perdido" solo.
- No crea ficha sin un nombre real de perfil (la crea una persona desde el buzón).
- No toca por WhatsApp a quien nunca escribió.

## Cómo cambiar algo

- Un plazo: `SEG1_HOURS / SEG2_HOURS / FRIO_HOURS / VENTANA_EMBUDO_DIAS` en `leads-pipeline.ts`.
- La plantilla de un escalón: `PLANTILLA_POR_ESCALON` en `playbook.ts` (y que
  esté aprobada en Meta — correr `node scripts/checks/whatsapp-cloud-check.mjs`).
- Una etiqueta que excluye: `TAGS_NO_CLIENTE` en `no-cliente.ts`.
