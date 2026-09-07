# Motor automático de seguimientos por WhatsApp

Diseño pedido por Ishtar el 7/9/2026: *"yo limpiaría y levantaría solo
algunos, y me ocuparía de que el pipeline funcione perfecto. Diseñá algo que
sea escalable y modular."*

**Estado: DISEÑO. No construido.**

---

## 1. El hallazgo que cambia el tamaño del trabajo

El pipeline **ya está construido casi entero**. Lo que falta es una pieza, y es
chica.

Hoy el sistema ya sabe, para cada lead, qué toque le corresponde y con qué
plantilla. Eso vive en `src/lib/embudo/playbook.ts`, que su propio comentario
define como *"la única definición del siguiente paso"*, y lo leen el tablero
(`/admin/leads`), el resumen diario del equipo y el registro de envíos.

Lo que NO existe es quien apriete el gatillo. Por decisión del 18/8/2026, al
migrar a la API oficial: *"NADA sale solo hacia el cliente. El motor no manda:
dice qué plantilla corresponde hoy, una persona la confirma desde el buzón, y
ESE envío mueve la tarjeta."*

O sea: **los seguimientos no se envían porque se decidió que los mandara una
persona, y nadie los está mandando.** No es una falla técnica.

### Lo que ya funciona y NO se toca

| Pieza | Qué hace |
|---|---|
| `src/lib/embudo/playbook.ts` | Decide el toque y la plantilla. Única fuente. |
| `src/lib/embudo/registrar-seguimiento.ts` | Deja el rastro que mueve la tarjeta. |
| `src/services/embudo.service.ts` | Quién está en cada columna. |
| `src/instrumentation.ts` | El reloj horario que SÍ corre en Railway. |
| 5 plantillas en Meta | `seguimiento_presupuesto`, `seguimiento_lentes`, `invitacion_local_v2`, `ultimo_seguimiento`, `retomar_conversacion` — **todas aprobadas, ninguna usada**. |

### Lo que hay que tirar

`wa-service/sales-followups.js` y `wa-service/followups/*` son el motor viejo.
No sirven, y no por estar mal cableados:

1. Piden el enviador de WhatsApp Web (`whatsapp/client.js`), que ya no existe
   en producción.
2. **Redactan cada mensaje con IA.** Meta no permite eso fuera de la ventana
   de 24 h, y un seguimiento va días después: la ventana siempre está cerrada.

El punto 2 no se arregla cableando. Por eso el motor nuevo **elige plantillas,
no escribe texto**.

---

## 2. El diseño

Un ejecutor automático que hace exactamente lo que hoy hace una persona:
lee la recomendación del playbook, manda, y registra. Cuatro piezas
independientes, cada una testeable sola.

```
  embudo.service ──► seleccion.ts ──► politica.ts ──► ejecutor.ts ──► registrar-
   (quién hay)       (a quién le      (compuertas:     (manda la      seguimiento
                      toca hoy)        ¿se puede?)      plantilla)    (mueve la
                          ▲                                            tarjeta)
                          │
                     playbook.ts
                  (qué toque y qué plantilla — YA EXISTE)
```

### `src/lib/seguimientos/politica.ts` — las compuertas

Cada regla es una **función pura** `(lead, contexto) => Veto | null`. La
política es la lista; el motor no sabe qué hay adentro.

- ya se le mandó este escalón (lo dice la etiqueta del chat)
- contestó después del último toque → sale del automático, es del vendedor
- etiqueta de exclusión, o `followUpPausedUntil` vigente
- más viejo que el corte de antigüedad
- fuera de horario comercial
- cupo diario agotado

Agregar o sacar una regla es tocar la lista, nunca el motor. **Ante la duda,
vetar**: un seguimiento que no sale se recupera mañana; uno de más, no.

### `src/lib/seguimientos/seleccion.ts` — a quién le toca

Toma los leads del embudo, les pide el toque al playbook, aplica las
compuertas, ordena por prioridad (el más caliente primero) y corta en el cupo.
**Función pura sobre datos ya leídos**: se puede probar sin base y sin red.

### `src/lib/seguimientos/ejecutor.ts` — manda

Por cada elegido: envía la plantilla y llama a `registrarSeguimientoEnviado`
con `SYSTEM_ACTOR`. Cero lógica de negocio: si hay que decidir algo, se decide
más arriba.

Es el MISMO registro que usa el envío humano, así que la tarjeta se mueve
igual y la ficha queda firmada igual, la haya mandado una persona o el sistema.

### `src/app/api/cron/seguimientos/route.ts` — el disparador

Colgado de `instrumentation.ts`, como el pickup-reminder y los carritos. Nunca
de un scheduler externo: los que se declararon en `vercel.json` **nunca
corrieron**, porque Railway no lo ejecuta y nadie los dio de alta afuera.

Devuelve qué salió y **qué se vetó y por qué**. Sin eso, un motor que no manda
nada es indistinguible de un motor que anda bien y no tenía a quién mandarle.

---

## 3. Por qué esto escala

- **Un toque nuevo = una fila en el playbook.** Cero código en el motor.
- **Una regla nueva = una función en la lista de compuertas.** No se toca nada más.
- **Un canal nuevo (mail, SMS) = otro ejecutor.** La selección y la política se reusan tal cual.
- **Una sola definición del paso siguiente**, compartida por el tablero, el
  resumen diario, el envío humano y el automático. No pueden divergir.

---

## 4. Qué levantar, y qué no

Levantar **tres**, que son los que el playbook ya define:

| Toque | Cuándo | Plantilla |
|---|---|---|
| Primer toque | 48 h sin respuesta | `seguimiento_presupuesto` |
| Segundo toque | 4 días | `invitacion_local_v2` |
| Último | 15 días | `ultimo_seguimiento` |

Retirar del automático:
- `seguimiento_carrito` — ya lo cubre el cron de carritos abandonados.
- `seguimiento_lentes` — duplica el primer toque; que quede para envío manual.
- `retomar_conversacion` — hoy la usan Matías e Ishtar a mano, y está bien así.

Borrar `wa-service/sales-followups.js` y `wa-service/followups/` una vez que el
motor nuevo esté andando.

---

## 5. Decisiones de Ishtar, antes de construir

**Cupo diario.** El número tiene 250 conversaciones por día, compartidas con
las campañas. Hay 779 leads dormidos de más de un mes: vaciar esa cola son
varios días. Propuesta: **30 por día**, ajustable desde `SystemSetting` sin
deploy.

**Corte de antigüedad.** Hay 126 leads de más de tres meses. Escribirle a
alguien que preguntó en junio se lee como spam y un bloqueo sí le pega a la
calidad del número (hoy GREEN). Propuesta: **nada de más de 60 días**.

**Arranque en seco.** Primer día en `dryRun`, mirando a quién le habría
escrito, antes de dejarlo mandar de verdad.

---

## 6. Lo que NO resuelve

Los 1.182 leads acumulados no se vacían solos ni con este motor: con 30 por
día son semanas, y los más viejos quedan fuera por el corte. El motor evita que
la cola siga creciendo; la cola vieja es una decisión comercial aparte.
