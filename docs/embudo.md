# El embudo de seguimientos — la verdad que hoy está implementada

**Fuente única de verdad** (12/9/2026). Sacado del código y de la base, no de
lo que se quiso hacer. Cada fila dice dónde vive en el código. Los documentos
anteriores (`docs/embudo-de-ventas.md`, `docs/plan-motor-seguimientos.md`)
quedan como historia: donde contradicen a este, manda este.

Cuando acá dice "día N" son **bloques de 24 h desde el momento exacto** del
presupuesto o del alta (no días calendario): un presupuesto armado el lunes a
las 18:00 "cumple 2 días" el miércoles a las 18:00, no el miércoles a la
mañana. Los horarios de envío sí son hora de Córdoba.

---

## 1. Quién está en el embudo

Entra toda ficha que cumpla **todo** esto (`src/services/embudo.service.ts`,
`leadsCalificados`):

- estado `CONTACT` (todavía no es cliente) y no borrada;
- **ninguna** venta ni pedido (`Order` de tipo `SALE`/`ORDER`, no borrada);
- ninguna etiqueta de exclusión en la ficha: `no interesado`, `cancelar bot`,
  `spam`, `no bot`, `cerrado`, `post-venta`, ni las de "no es cliente"
  (`no cliente`, `proveedor`, `laboratorio`, `mayorista` — `src/lib/no-cliente.ts`).

**Sale del embudo** cuando: se le carga una venta/pedido; se le pone una de
esas etiquetas; o su ficha pasa a `CLIENT`. No hay otra salida (ver ambigüedad
B: "ganado/perdido" no existe como acción).

La ficha se crea sola con el primer WhatsApp entrante
(`wa-service/transport/alta-de-ficha.js`), salvo perfiles sin nombre de
persona o marcados como no-cliente.

---

## 2. Los seis estados y cómo se calcula en cuál está cada uno

Columnas del tablero `/admin/leads` (`src/types/leads.ts`, `PIPELINE_COLUMNS`)
y la regla que las decide (`src/lib/leads-pipeline.ts`, `classifyLead`):

| Estado (título en pantalla) | Cómo se llega |
|---|---|
| **Primer Contacto** | Sin presupuesto enviado y sin receta cargada. |
| **Nueva Receta** | Sin presupuesto enviado, con receta cargada. |
| **Cotización Enviada** | Hay un presupuesto **enviado** hace menos de 48 h. |
| **Seguimiento 1** *(título dice "24-48h")* | Presupuesto de más de **48 h** (o etiqueta `SEGUIMIENTO_DIA_1`). |
| **Seguimiento 2** *(título dice "2-10 días")* | Presupuesto de más de **96 h = 4 días** (o `SEGUIMIENTO_DIA_4`). |
| **Frío** *(título dice "+10 días")* | Presupuesto de más de **360 h = 15 días** (o `SEGUIMIENTO_DIA_15`). |

Reglas finas:

- El estado es el **mayor** entre (a) el que da el reloj desde el presupuesto y
  (b) el que dan las etiquetas de seguimiento ya enviadas. Si el reloj va más
  adelante que las etiquetas, "el toque de hoy se debe" (`escalonCubierto=false`).
- Un **mensaje escrito por una persona del equipo** después del presupuesto
  cuenta como haber cubierto el escalón vigente ese día (`ultimoMensajeHumano`).
  Los robots (`Bot`, `Sistema`, `Sistema Atelier`) no cuentan.
- **"Presupuesto enviado" exige prueba** (desde el 12/9/2026,
  `src/lib/embudo/presupuesto-enviado.ts`): la nota "📄 Presupuesto enviado"
  que deja el envío del PDF, o un WhatsApp de una persona posterior a armarlo.
  Un presupuesto armado en el CRM y nunca mandado deja al lead en Primer
  Contacto / Nueva Receta con la tarjeta "Presupuesto armado el dd/MM y NUNCA
  enviado: mandarlo".
- Las etiquetas viven en el **chat de WhatsApp más reciente** del cliente
  (`chatLabels`); también se leen las etiquetas de la ficha "Seguimiento 1",
  "Seguimiento 2", "Frío" (ver ambigüedad D).

---

## 3. La cadencia: estado → día → mensaje → quién → cómo sigue

Lo decide `src/lib/embudo/playbook.ts` (`proximaAccion`). Los plazos:
`SEG1_HOURS=48`, `SEG2_HOURS=96`, `FRIO_HOURS=360`, `VENTANA_EMBUDO_DIAS=30`
(`src/lib/leads-pipeline.ts`).

### 3a. Sin presupuesto enviado (Primer Contacto / Nueva Receta)

| Día (desde el alta) | Qué toca | Mensaje | Quién lo hace | Pasa a / sale |
|---|---|---|---|---|
| 0 a 2 | "Falta cotizar" | — | persona | Al armar **y enviar** el presupuesto → Cotización Enviada. |
| 0 a 2, con presupuesto armado y no enviado | "Presupuesto armado el dd/MM y NUNCA enviado: mandarlo" (para hoy) | — | persona | Al enviarlo → Cotización Enviada. |
| **> 2** (48 h), con chat, sin `SEGUIMIENTO_DIA_1` | Retomar la charla | `seguimiento_lentes_sin_receta` ("¿seguís interesado…? recordá enviarme la recetita…") o, si tiene receta, `seguimiento_lentes_con_receta` ("¿retomamos el armado de tu presupuesto?") | **motor automático** (o persona) | Queda `SEGUIMIENTO_DIA_1`; después vuelve a "Falta cotizar" (persona). No hay 2º toque automático sin presupuesto. |
| > 2, sin chat de WhatsApp | "Falta cotizar" | — | persona | Nunca recibe nada automático (ambigüedad G). |
| **> 30** | "Sin presupuesto hace N días: cerrar o archivar" | — | persona | No cuenta para hoy; se queda en la columna hasta que alguien lo etiquete. |

### 3b. Con presupuesto enviado

| Día (desde el presupuesto) | Estado | Qué toca | Mensaje | Quién | Pasa a / sale |
|---|---|---|---|---|---|
| 0 a 2 | Cotización Enviada | Esperar ("Próximo toque en N días") | — | — | A las 48 h → Seguimiento 1. |
| **2** (48 h), sin `SEGUIMIENTO_DIA_1` | Seguimiento 1 | 1er toque | `seguimiento_presupuesto` ("¿pudiste ver el presupuesto que te pasamos?…") | **motor** o persona | Deja `SEGUIMIENTO_DIA_1`. Espera al día 4. |
| **4** (96 h), con DIA_1 y sin `SEGUIMIENTO_DIA_4` | Seguimiento 2 | 2º toque | `invitacion_local_v4` (invitación al local con dirección y horarios) | **motor** o persona | Deja `SEGUIMIENTO_DIA_4`. Espera al día 15. |
| 4, **ya vino al local** (botón "Visita", turno cumplido o etiqueta de visita) | Seguimiento 2 | Esperar ("Ya vino al local") | — | — | Se saltea la invitación. Espera al día 15. |
| **15** (360 h), con DIA_4 y sin `SEGUIMIENTO_DIA_15` | Frío | 3er y último toque | `ultimo_seguimiento` (Instagram + "tengo un descuento especial para hacerte") | **motor** o persona | Deja `SEGUIMIENTO_DIA_15`. |
| 15 a 30, con DIA_15 | Frío | "Decidir: ganado o perdido" (para hoy) | — | persona | No hay botón (ambigüedad B): sale solo por venta o etiqueta. |
| **> 30** | Frío | "Frío hace N días: cerrar o archivar" | — | persona | No cuenta para hoy. Se queda listado. |

Si el cliente **responde** cualquiera de los toques, el motor no le manda más
(compuerta "respondió al último seguimiento: sigue una persona") y **se crea
una tarea del vendedor con el texto de la respuesta** (desde el 12/9,
`wa-service/shared/respuesta-a-seguimiento.js`); el estado no cambia solo — lo
mueve la venta, la etiqueta o una persona.

Si un toque se hace **a mano fuera de su día** (por ejemplo el 1er toque a las
3 h), la etiqueta manda: el estado avanza igual.

### 3c. Fuera del embudo pero relacionado

| Qué | Día | Mensaje | Quién | Dónde |
|---|---|---|---|---|
| Carrito abandonado en la tienda | ~1 h y ~24 h de la última actividad (piso 72 h) | **mail** corto sin cupón, y mail con cupón | automático, cada hora 9–20 | `src/app/api/cron/abandoned-carts/route.ts` |
| Carrito abandonado por WhatsApp | manual, últimos 30 días | `seguimiento_carrito` | persona (o campaña en seco por defecto) | `src/app/api/cron/campania-carritos/route.ts`; deja `SEGUIMIENTO_DIA_1` |
| Campañas puntuales (SOYCLIENTE, armazones, 12 cuotas) | una vez | plantillas propias | persona, tandas | `campania-seguimiento`, `campania-mp-12-cuotas` |
| Bot conversacional | cuando el cliente escribe | respuesta libre + herramientas | automático | `wa-service/bot-cloud.js` |

---

## 4. Qué corre solo, y cuándo

Todo lo automático vive en el reloj interno de la app
(`src/instrumentation.ts`, un tick cada **10 minutos**; no hay scheduler
externo). Corren dos instancias de la app: cada corrida se **reclama** en la
base (`SystemSetting`, `reclamarCorrida`) para que la haga una sola.

| Robot | Cadencia | Qué hace | Dónde |
|---|---|---|---|
| **Motor de seguimientos** | 1 vez por hora, **10 a 19** hs Córdoba (el reloj lo llama de 9 a 20; la ruta filtra 10–19) | Toma "para hoy" del tablero, se queda con lo que tenga plantilla, pasa las compuertas, manda de a **15 por hora** con pausas de 8–12 s, tope **120 por día** (hasta el 11/9: 5 y 30). | `src/app/api/cron/seguimientos/route.ts`, `src/lib/seguimientos/*`, `src/lib/constants/seguimientos.ts` |
| Tareas del día + mail al equipo | 1 vez por día, desde las **9:00** | Materializa "para hoy" como tareas `EMBUDO` (una viva por cliente; cancela las que ya no tocan) y manda el resumen. | `resumen-diario-equipo`, `src/lib/embudo/sincronizar-tareas.ts` |
| Carritos (mail) | cada hora, 9–20 | Los dos mails del carrito. | `abandoned-carts` |
| Calidad de WhatsApp | 1 vez por día | Mail: conexión, calidad del número, plantillas, rechazos de Meta, lint del prompt del bot. | `whatsapp-calidad` |

**Compuertas del motor** (`src/lib/seguimientos/politica.ts`, en este orden;
la primera que aplica veta):

1. el paso no tiene plantilla (cotizar/decidir = persona);
2. la plantilla no está habilitada para automático (solo las 5 de
   `PLANTILLAS_AUTOMATICAS`);
3. lead anterior a `MOTOR_SEGUIMIENTOS_DESDE` (hoy `null`: **entran todos**
   los de la ventana de 30 días; hasta el 11/9 era el 7/9);
4. sin chat de WhatsApp;
5. sin nombre de pila válido (emojis, "anteojo de cerca", "El Flaco"…);
6. el chat no existe;
7. **seguimiento apagado** desde el chat (`SIN_SEGUIMIENTO`) o la ficha
   ("Sin Seguimiento", "no interesado");
8. pausado (`followUpPausedUntil` en el futuro);
9. ya se le mandó un seguimiento hace < 48 h;
10. alguien le escribió hace < 48 h;
11. el cliente escribió hace < 48 h (charla viva);
12. el cliente respondió al último seguimiento.

**Rastro de cada envío** (igual para persona y motor,
`src/lib/embudo/registrar-seguimiento.ts`): etiqueta `SEGUIMIENTO_DIA_x` en
el chat + `lastFollowUpAt` + nota `FOLLOWUP` firmada en la ficha + AuditLog +
cierre de la tarea EMBUDO del día. Si Meta después **rechaza** el mensaje, el
sistema deshace el rastro, pausa 30 días y avisa al equipo
(`wa-service/shared/seguimiento-fallido.js`, desde el 11/9).

**Interruptores**

| Interruptor | Dónde | Efecto |
|---|---|---|
| `followups_enabled` | panel WhatsApp / `SystemSetting` | apaga motor y campañas |
| `seguimientos_auto_modo` = `seco`/`real` | `SystemSetting` (default `real` desde 11/9, `MODO_POR_DEFECTO`) | seco = lista y no manda |
| `seguimientos_cupo_diario` | `SystemSetting` (default 120) | tope diario |
| "Sin seguimiento" | cabecera del chat en el buzón / etiqueta de ficha | apaga por persona |
| Retroceder la tarjeta en el tablero | `/api/leads/pipeline/move` | pausa 14 días |
| Rechazo de Meta a un automático | webhook de estado | pausa 30 días |

---

## 5. Lo ambiguo, duplicado o contradictorio (marcado a propósito)

- **A. Los títulos de las columnas mienten sobre los plazos.** "Seguimiento 1
  (24-48h)" se entra a las 48 h; "Seguimiento 2 (2-10 días)" a los 4 días;
  "Frío (+10 días)" a los 15. `src/types/leads.ts:80-82` vs
  `src/lib/leads-pipeline.ts:43-45`.
- **B. "Decidir: ganado o perdido" no existe como acción.** El playbook lo
  propone, pero no hay botón ni etiqueta "perdido": el lead sale solo si se le
  carga una venta o se le pone una etiqueta de exclusión a mano. Un lead en
  Frío sin venta queda listado para siempre (después del día 30, sin contar
  "para hoy"). Nadie lo cierra ni se registra por qué.
- **C. `docs/embudo-de-ventas.md` dice "nada le escribe solo al cliente".**
  Desde el 11/9/2026 el motor manda solo. Ese documento quedó viejo.
- **D. Dos lugares para la misma etiqueta.** El estado se lee de
  `chatLabels` del chat (`SEGUIMIENTO_DIA_1/4/15`) **y** de etiquetas de la
  ficha ("Seguimiento 1", "Seguimiento 2", "Frío"). Mover la tarjeta escribe
  las dos; el motor y el buzón escriben solo la del chat. Pueden decir cosas
  distintas.
- **E. El toque de carrito pisa el del embudo.** `seguimiento_carrito` deja
  `SEGUIMIENTO_DIA_1`; para el embudo eso significa "ya se retomó la charla"
  y no vuelve a mandar el toque de retomar (3a). Son dos conversaciones
  distintas con la misma etiqueta.
- **F. Cualquier mensaje humano cuenta como "toque hecho".** Un "hola, ¿cómo
  va?" del equipo el día 4 marca el 2º toque como cubierto aunque no haya sido
  la invitación al local. Es a propósito (evitar plantilla encima de charla),
  pero no queda registrado *qué* se cubrió.
- **G. Sin chat de WhatsApp no hay embudo automático.** Un lead que llegó por
  teléfono o mail queda en "Falta cotizar" / "para hoy" indefinidamente y
  nunca recibe nada; solo lo ve una persona en la tarea del día.
- **H. Hasta el 11/9 los leads anteriores al 7/9 estaban fuera del motor**
  ("a los viejos a mano"): eran ~370 de los ~400 "para hoy", el tablero los
  pedía todos los días y nadie llegaba. Causa principal de "días con pocos
  envíos". Desde el 12/9 entran todos los de la ventana de 30 días, a 15 por
  hora y 120 por día: el atraso se absorbe en unos 3 días, del más atrasado
  al menos.
- **I. Días de 24 h vs días calendario.** Los plazos se miden en horas exactas
  desde el presupuesto; el horario de envío es 10–19 Córdoba. Un presupuesto
  de las 18:30 vence a las 18:30 del día 2: entra en el tick de las 18 → sale
  al día siguiente (a las 10). Detalle de zona horaria para la auditoría.
- **J. Código viejo con otra cadencia.** `wa-service/followups/config.js`
  (DIA_1/4/15 a 48/96/360 h), `sales-followups.js`, `inactivity-followups.js`
  y `smart-task-executor.js` siguen en el repo pero **no corren** con la API
  oficial (`cloud.js` no los carga). Misma cadencia escrita dos veces.
- **K. Dos números para "pausar".** Retroceder una tarjeta pausa 14 días
  (`PAUSE_DAYS_ON_BACKWARD_MOVE`); un rechazo de Meta pausa 30 (`PAUSA_DIAS`).
- **L. Tope 120 por día, ritmo 135.** 15 por hora × 9 horas = 135, el tope
  corta en 120; el límite de Meta es 250 conversaciones/día compartidas con
  todo lo que sale (campañas, avisos, lo que manda el equipo).
- **M. Sin registro de corridas.** El motor deja rastro por envío (ficha) y
  una línea de log por tick, pero **ninguna tabla** dice "el día X corrió N
  veces, evaluó A, mandó B, vetó C". Si un día no corre, nadie se entera
  (objeto del paso 5 de la auditoría).
- **N. La hora reclamada se pierde si el proceso muere.** Si un deploy cae en
  el minuto del tick, la hora queda reclamada y sin correr; se recupera en la
  siguiente (máximo 5 personas demoradas 1 h). Pasó el 11/9 a las 13:00.
