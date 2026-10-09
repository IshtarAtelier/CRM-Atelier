# El embudo de seguimientos — la verdad que hoy está implementada

**Fuente única de verdad** (12/9/2026; **cambio grande el 8/10/2026**, abajo).
Sacado del código y de la base, no de lo que se quiso hacer. Cada fila dice dónde vive en el código. Los documentos
anteriores (`docs/embudo-de-ventas.md`, `docs/plan-motor-seguimientos.md`)
quedan como historia: donde contradicen a este, manda este.

Cuando acá dice "día N" son **bloques de 24 h desde el momento exacto** del
presupuesto o del alta (no días calendario): un presupuesto armado el lunes a
las 18:00 "cumple 2 días" el miércoles a las 18:00, no el miércoles a la
mañana. Los horarios de envío sí son hora de Córdoba.

---

## 0. Desde el 8/10/2026: el embudo no tiene NADA para una persona

Decisión de Ishtar ("en embudo no debe haber nada para humano"), tomada con
estos datos de producción a la vista: 250 tareas del embudo pendientes, las
250 vencidas (111 "Definir: ganado o perdido" que nadie podía cerrar porque no
hay botón, 137 plantillas que el motor vetó y quedaron "para una persona");
Matías y Milena cerraron 11 en todo septiembre; y de 501 oportunidades de
septiembre sin comprar, 142 habían respondido a un seguimiento —casi siempre
un 👍 o un "gracias"— y el motor las había soltado para siempre.

Lo que cambió, y dónde:

- **La charla SIN presupuesto sigue la MISMA cadencia** que la que tiene
  presupuesto (1º toque → invitación → último), con el reloj desde el alta.
  Antes recibía un toque y pasaba a "Falta cotizar" para una persona
  (`playbook.ts`). "Falta cotizar" sigue en la tarjeta como información, pero
  nunca es "para hoy".
- **"Decidir: ganado o perdido" no existe más.** Lo reemplaza `cerrar`, que
  ejecuta el motor: recorrido completo + `CIERRE_TRAS_ULTIMO_TOQUE_DIAS` (7)
  días sin respuesta → etiqueta `Perdido (embudo)` en la ficha, presupuestos
  pendientes a `LOST`, nota firmada 'Sistema' y AuditLog
  (`lib/seguimientos/cierre.ts`). Más viejo que `DIAS_MAX_CIERRE_AUTOMATICO`
  (120 días) no se toca. Salen de a `CIERRES_POR_TICK` (200) por hora.
- **Pasados los 30 días se intenta una vez más antes de cerrar** (Ishtar:
  "obvio que quiero intentar cerrarlos" + "ofreceles un cupón del 10 %"): el
  motor manda `retomar_con_cupon` (texto de Ishtar: 10 % de descuento por
  RESPONDER, botones "¡Sí, quiero mi descuento!" / "Ahora no" + links de
  tienda e Instagram; subida a Meta el 8/10/2026), deja la etiqueta
  `SEGUIMIENTO_RETOME`, y si en 7 días no contesta, cierra. **El 10 % se gana
  respondiendo**: cualquier respuesta que no sea un "no" le pone a la ficha la
  etiqueta `Retome 10%` y una nota; el vendedor lo aplica en la venta como
  descuento especial. "Ahora no" pausa 30 días Y saca la etiqueta del retome:
  al volver se le ofrece otra vez, hasta los 120 días (máximo tres mensajes
  en tres meses). Sin chat no hay a quién escribirle: cierra directo. Una
  plantilla que el espejo `WhatsAppTemplate` no da por APPROVED no se manda
  (una PENDING rebota y tres rebotes frenan el motor). Un presupuesto marcado
  perdido A MANO (botón ✓ de Cierres) saca al lead del embudo: alguien ya decidió.
- **La respuesta del cliente se LEE** (`lib/embudo/respuesta.ts`, puro, sin
  IA): "no / ya compré / en otra óptica / no me escriban" → `cierre` (perdido);
  "más adelante / cuando cobre / por ahora no" → `posponer` (pausa 30 días);
  todo lo demás —reacciones, "gracias", "ok", audios, preguntas— → `seguir`:
  la charla viva la atiende el bot y, pasadas las 48 h de silencio, la
  cadencia sigue con el toque que falta. Ante la duda es `seguir`. Un "No"
  pelado solo cuenta si es la primera burbuja después del toque.
- **No se crea ninguna tarea**: ni las EMBUDO del día
  (`sincronizar-tareas.ts` solo cancela lo que quedó) ni las "💬 Respondió al
  seguimiento" (`respuestas-a-seguimientos.ts` y
  `wa-service/transport/inbound.js`). Si el bot necesita a una persona, la
  deriva por su propio camino.
- Lo que el motor hace sin mandar (cierres, lecturas de respuesta) queda en
  `SeguimientoCorrida.vetados` y en la respuesta del endpoint; se ve en
  `/admin/leads/salud`. Lo fija `npm run check:embudo` (CI).

Las tablas de abajo están corregidas a esto; donde una celda viejа diga
"persona", manda esta sección.

---

## 1. Quién está en el embudo

Entra toda ficha que cumpla **todo** esto (`src/services/embudo.service.ts`,
`leadsCalificados`):

- estado `CONTACT` (todavía no es cliente) y no borrada;
- **ninguna** señal de compra: ni venta ni pedido (`Order` de tipo
  `SALE`/`ORDER`), ni presupuesto **CONFIRMADO**, ni pedido enviado a fábrica,
  ni un peso pagado, ni fila de `Payment` (Ishtar, 8/10/2026: "que no se le
  envíe a nadie que haya comprado o esté en confirmados");
- ninguna etiqueta de exclusión en la ficha: `no interesado`, `cancelar bot`,
  `spam`, `no bot`, `cerrado`, `post-venta`, ni las de "no es cliente"
  (`no cliente`, `proveedor`, `laboratorio`, `mayorista` — `src/lib/no-cliente.ts`).

**Sale del embudo** cuando: se le carga una venta/pedido; se le pone una de
esas etiquetas (incluida `Perdido (embudo)`, que pone el motor al cerrar); o
su ficha pasa a `CLIENT`.

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
  prueba que lo contactaron (la tarjeta no dice "Sin contactar") pero, desde el
  8/10/2026, **no cubre el escalón**: el toque sigue debiéndose y el motor lo
  manda cuando pasan 48 h sin mensajes. Los robots no cuentan.
- **"Presupuesto enviado" exige prueba** (desde el 12/9/2026,
  `src/lib/embudo/presupuesto-enviado.ts`): la nota "📄 Presupuesto enviado"
  que deja el envío del PDF, un WhatsApp de una persona posterior a armarlo, o
  (desde el 8/10/2026) que el cliente haya pasado por el local — se lo
  mostraron en el mostrador.
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

Misma cadencia que 3b, con el reloj desde el **alta** y los escalones leídos
de las etiquetas del chat (`SEGUIMIENTO_DIA_1/4/15`).

| Día (desde el alta) | Qué toca | Mensaje | Quién | Pasa a / sale |
|---|---|---|---|---|
| 0 a 2 | "Falta cotizar" (informa, no vence) | — | — | Al armar **y enviar** el presupuesto → 3b. |
| **> 2** (48 h), con chat, sin DIA_1 | 1er toque | `seguimiento_lentes_sin_receta` o, con receta, `seguimiento_lentes_con_receta` | **motor** | Deja `SEGUIMIENTO_DIA_1`. |
| **> 4**, con DIA_1 y sin DIA_4 | 2º toque | `invitacion_local_v4` | **motor** | Deja `SEGUIMIENTO_DIA_4`. (Si ya vino al local, se saltea.) |
| **> 15**, con DIA_4 y sin DIA_15 | 3er y último toque | `ultimo_seguimiento` | **motor** | Deja `SEGUIMIENTO_DIA_15`. |
| DIA_15 + 7 días sin respuesta | `cerrar` | — | **motor** | Etiqueta `Perdido (embudo)`: sale del embudo. |
| **> 30**, sin `SEGUIMIENTO_RETOME` | último intento | `retomar_con_cupon` | **motor** | Deja `SEGUIMIENTO_RETOME`; 7 días después sin respuesta → `cerrar`. |
| sin chat de WhatsApp | esperar | — | — | No recibe nada; se cierra solo al día 30. |

### 3b. Con presupuesto enviado

| Día (desde el presupuesto) | Estado | Qué toca | Mensaje | Quién | Pasa a / sale |
|---|---|---|---|---|---|
| 0 a 2 | Cotización Enviada | Esperar ("Próximo toque en N días") | — | — | A las 48 h → Seguimiento 1. |
| **2** (48 h), sin `SEGUIMIENTO_DIA_1` | Seguimiento 1 | 1er toque | `seguimiento_presupuesto` ("¿pudiste ver el presupuesto que te pasamos?…") | **motor** o persona | Deja `SEGUIMIENTO_DIA_1`. Espera al día 4. |
| **4** (96 h), con DIA_1 y sin `SEGUIMIENTO_DIA_4` | Seguimiento 2 | 2º toque | `invitacion_local_v4` (invitación al local con dirección y horarios) | **motor** o persona | Deja `SEGUIMIENTO_DIA_4`. Espera al día 15. |
| 4, **ya vino al local** (botón "Visita", turno cumplido o etiqueta de visita) | Seguimiento 2 | Esperar ("Ya vino al local") | — | — | Se saltea la invitación. Espera al día 15. |
| **15** (360 h), con DIA_4 y sin `SEGUIMIENTO_DIA_15` | Frío | 3er y último toque | `ultimo_seguimiento` (Instagram + "tengo un descuento especial para hacerte") | **motor** o persona | Deja `SEGUIMIENTO_DIA_15`. |
| DIA_15 + **7 días** sin respuesta | Frío | `cerrar` | — | **motor** | Etiqueta `Perdido (embudo)` + presupuestos pendientes a `LOST`. Sale del embudo. |
| **> 30** (hasta 120), sin `SEGUIMIENTO_RETOME` | Frío | último intento | `retomar_con_cupon` | **motor** | Deja `SEGUIMIENTO_RETOME`; 7 días después sin respuesta → `cerrar`. Más de 120 días: "fuera del embudo", no se toca. |

Si el cliente **responde** cualquiera de los toques, el motor lee qué dijo
(`lib/embudo/respuesta.ts`, sección 0): un "no" lo cierra como perdido, un
"más adelante" lo pausa 30 días, y lo demás no cambia nada — el bot atiende la
charla y la cadencia sigue cuando pasan 48 h de silencio. No se crea ninguna
tarea (hasta el 8/10/2026 sí: "💬 Respondió al seguimiento").

Si un toque se hace **a mano fuera de su día** (por ejemplo el 1er toque a las
3 h), la etiqueta manda: el estado avanza igual.

**Los toques van en orden, aunque el lead llegue atrasado** (desde el 12/9):
a alguien de 20 días sin ningún toque le sale el 1º ("¿pudiste ver el
presupuesto?"), a las 48 h el 2º y a las 48 h el 3º — no el "último
seguimiento" con descuento de entrada (`playbook.ts`, `cubiertoHasta`).

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
| Calidad de WhatsApp | 1 vez por día | Mensaje del sistema a los ADMIN (mensajería interna; hasta el 8/10/2026 era mail): conexión, calidad del número, plantillas, rechazos de Meta, lint del prompt del bot. | `whatsapp-calidad` |
| **Salud del embudo** | 1 vez por día, **19:30** | Mensaje del sistema a los ADMIN en la mensajería interna (siempre, con ⚠️ si hay problema; hasta el 8/10/2026 era mail): motor que no corrió alguna hora, corrió sin mandar, fallas, freno, leads olvidados (toque vencido +24 h y nadie les escribió). Vista: **/admin/leads/salud** (últimos 7 días). | `embudo-salud`, `src/lib/seguimientos/salud.ts` |

**Compuertas del motor** (`src/lib/seguimientos/politica.ts`, en este orden;
la primera que aplica veta):

1. el paso no tiene plantilla (`cerrar` va por otro camino; `cotizar` solo informa);
2. la plantilla no está habilitada para automático (solo las 6 de
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
12. el cliente respondió al último seguimiento **y dijo que no** (se cierra) o
    **pidió más adelante** (se pausa). Una reacción, un "gracias" o una
    pregunta NO vetan (hasta el 8/10/2026 cualquier respuesta vetaba para siempre).

**Registro de corridas y envíos (desde el 12/9).** Cada tick escribe una fila
en `SeguimientoCorrida` (candidatos, elegidos, enviados, fallidos, en espera,
vetados por motivo con nombres, error, duración). Cada envío automático
reclama ANTES de mandar una fila en `SeguimientoEnvio` con clave única
**chat + plantilla + día de Córdoba**: si el tick corre dos veces, o lo corren
las dos instancias, o se reintenta, la segunda choca con la fila y no manda.
El tope diario se cuenta sobre esas filas (`resultado = ENVIADO`).
(`src/lib/seguimientos/registro.ts`, `prisma/schema.prisma`.)

**Freno.** Tres fallas seguidas al mandar cortan la tanda, frenan el motor
2 horas (`SystemSetting.seguimientos_freno_hasta`) y avisan a los admin por la mensajería interna (urgente): tres rebotes
seguidos son la cuenta o la API, no tres clientes. Los que quedaron sin
mandar vuelven a evaluarse en el tick siguiente (`ejecutor.ts`, `debeFrenar`).

**Si el proceso muere con la hora reclamada** (deploy en el minuto del tick),
`SIGTERM` devuelve la hora y la instancia nueva la corre
(`instrumentation.ts`); el envío es idempotente, así que no duplica.

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
| Rechazo de Meta a un automático | webhook de estado | pausa 30 días; si el cliente pidió no recibir marketing (130472), `SIN_SEGUIMIENTO` definitivo (8/10/2026) |

---

## 5. Lo ambiguo, duplicado o contradictorio (marcado a propósito)

- **A. ~~Los títulos de las columnas mienten sobre los plazos.~~** Resuelto el
  8/10/2026: dicen "día 2", "día 4" y "día 15", que es cuando se entra.
- **B. ~~"Decidir: ganado o perdido" no existe como acción.~~** Resuelto el
  8/10/2026: lo cierra el motor (`cerrar`, sección 0) con nota y AuditLog.
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
- **F. ~~Cualquier mensaje humano cuenta como "toque hecho".~~** Resuelto el
  8/10/2026: el mensaje humano prueba el CONTACTO (la tarjeta) pero ya no
  cubre el escalón; la compuerta de 48 h del motor es la que respeta la
  charla. Medido: 41 de 51 leads sin ningún toque estaban "cubiertos" por un
  mensaje del vendedor.
- **G. Sin chat de WhatsApp no hay embudo automático.** Un lead que llegó por
  teléfono o mail no recibe nada; desde el 8/10/2026 ya no es "para hoy" y se
  cierra solo al día 30.
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
- **M. ~~Sin registro de corridas.~~** Resuelto el 12/9: `SeguimientoCorrida`
  + mail diario 19:30 + `/admin/leads/salud`.
- **N. ~~La hora reclamada se pierde si el proceso muere.~~** Resuelto el 12/9:
  `SIGTERM` la devuelve; y aunque se corriera dos veces, la clave única no
  deja duplicar.
