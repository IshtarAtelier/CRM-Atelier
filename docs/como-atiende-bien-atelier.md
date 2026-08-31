# Cómo atiende bien Atelier (y qué hacía mal el bot)

**31/8/2026.** Escrito a partir de las 264 conversaciones reales de WhatsApp que
están en `scripts/maintenance/bot-eval/conversaciones-reales.json` (10.196
turnos, minados de producción en solo lectura el 30/8).

El encargo de Ishtar fue: *"no quiero que lo perfecciones, y que aprenda a
atender bien"*, con el dato clave de que **el bot no cerró ninguna venta por sí
solo y a la gente en general no le gusta cómo atiende**. O sea: el problema no
era que le faltaran reglas. Tenía más de sesenta y atendía mal igual.

Este documento es lo que se aprendió mirando cómo atiende el equipo humano, y
qué se cambió para que el bot atienda parecido.

---

## 1. La diferencia se mide, no se opina

Lo primero que salta al comparar las burbujas escritas por el equipo con las del
bot no es *qué* dicen: es **cómo están escritas**.

| | Equipo humano | Bot |
| --- | --- | --- |
| Largo de una burbuja (mediana) | **35 caracteres** | **95 caracteres** |
| Burbujas de 40 caracteres o menos | 56% | 16% |
| Burbujas de más de 100 caracteres | 12% | 46% |
| Arranca en minúscula | 64% | 1% |
| Lleva emoji | 10% | 31% |

*(3.274 burbujas humanas escritas a mano contra 1.326 del bot; se excluyeron
plantillas, PDFs, audios y mensajes del sistema.)*

El equipo escribe como se escribe por WhatsApp: cortito, en minúscula, de a una
idea. El bot escribía **el triple de largo**, siempre con mayúscula inicial y con
emoji en un tercio de los mensajes. Antes de decir nada, ya sonaba a formulario.

La regla vieja del prompt era *"máximo 30 palabras por burbuja"* — unos 170
caracteres, o sea **permiso para escribir cinco veces lo que escribe el equipo**.

Un detalle que sorprende: la ráfaga de mensajes seguidos **no** es lo que
delata al bot. El equipo manda 3 o más burbujas por turno el 45% de las veces;
el bot, el 34%. La diferencia es que las del equipo son reacciones cortas
("dale", "buenisimo", "sii") y las del bot son tres párrafos informativos.

---

## 2. Las ocho cosas que hace el equipo y el bot no hacía

Todas las citas son textuales del dataset.

### 2.1 Primero aportan, después preguntan

El movimiento más importante, y el que más plata deja. Mile, en **conv-011**,
con una clienta que dijo que no tenía receta y que nunca había usado
multifocales:

> *"claro, en algun momento llega la presbicia, los multis son distintos a los
> de lejos o cerca ahora te cuento"*
>
> *"Pero para que tengas noción más o menos te armo un presupuesto de
> Multifocales de una línea que recomendamos mucho así podes evaluar"*

No tiene la receta y **cotiza igual**. La falta de un dato nunca frena la
respuesta. En **conv-196**: *"perfecto, pero ya con eso puedo hacerte un
presupuesto"*.

El bot hacía lo contrario: pedía la receta y la obra social antes de dar
cualquier cosa.

### 2.2 Cada pregunta lleva su para qué

El equipo nunca pregunta en seco. Pregunta y en la misma línea dice para qué
sirve la respuesta:

> **conv-008**: *"genial! recordas la marca? asi te cotizo la misma"*
> **conv-004**: *"tenes receta asi te puedo armar presupuesto mejor"*
> **conv-020**: *"tenes recetita?? asi te envio todo completo"*
> **conv-031**: *"Bien recordas la marca así te cotizo lo mismo?"*

Hay 14 casos con esa construcción exacta ("así te..."). Es un patrón, no una
casualidad: la pregunta se justifica sola y no se siente encuesta.

### 2.3 No preguntan lo que ya saben

Este es el reclamo central de Ishtar — *"que no haga preguntas como un bot
sonso"* — y el dataset lo muestra crudo. **19 casos** en 16 conversaciones donde
el bot vuelve a preguntar algo que el cliente ya dijo.

El caso canónico es **conv-047**. La clienta abre con *"Hola quiero más
información de los anteojos clipones, los vi en meta"* y agrega *"Hay modelos
para hombres"*. Después de que ella dijera que es para su marido, que usa
anteojos recetados:

> **BOT**: *"Qué tipo de anteojos estás buscando, multifocales, para lejos, para
> cerca o de sol?"*

Preguntó el menú completo a alguien que ya había dicho, en el primer mensaje,
que quería clip-ons. Y dos turnos después, cuando ella dice que él tiene miopía
y astigmatismo, el bot pide un tercer dato (*"Recordás qué tipo de cristales
venía usando?"*) sin haber aportado nada a cambio.

En **conv-007** el cliente tuvo que escribir **dos veces** *"tengo receta pero
no la tengo a mano"* y **tres veces** que quería ver los precios. Entre el
segundo y el tercer pedido, el bot le mandó el link de Google Maps y los
horarios.

### 2.4 Ofrecen antes de mandar

Fotos y presupuestos se ofrecen y se espera el sí. Hay 14 ejemplos:

> **conv-005**: *"si queres te puedo pasar diseños de clip y vos te fijas cual
> te gusta mas"*
> **conv-114**: *"Queres que te mande modelitos"*
> **conv-152**: *"si queres te puedo enviar algunas fotos de los tipos de Clip
> on que tenemos asi mas o menos vas viendo que te gusta"*

Y antes de mandarlas, acotan: **conv-005**: *"contame si buscas de hombre o de
mujer?"*.

### 2.5 Cierran con un paso concreto

El equipo no cierra con "cualquier cosa avisame". Propone algo que se puede
hacer hoy. **conv-014**, la venta más grande del dataset ($1.735.910, Varilux XR
Design), se cierra así:

> *"claro! podes abonar el 50% para iniciar el tramite"*
> *"si queres, podes abonar por transferencia para ganarle al feriado, ya que la
> lente tarda 25 dias habiles"*
> *"encargamos el amterial, abrimos tu ficha"*
> *"y se llega mañana a elegir los marcos"*
> *"y tomar las medidas digitales"*

Cinco burbujas de una línea que son un plan completo. La clienta contestó:
*"voy directante con el efectivo y hacemos todo junto!"*.

### 2.6 Cuando hay un problema, primero la persona

**conv-008**, con una venta en curso de más de un millón de pesos. La clienta
avisa que no puede ir porque se le quebró la raíz de una muela:

> *"Ufa Vale 🤕"*
> *"espero que todo salga bien!"*
> *"te hablo luego... mucha suerte 🫶🏻"*

Soltó la venta. Volvió días después y la clienta compró. El bot, ante un
cliente enojado, contestaba con otro bloque de opciones.

### 2.7 Reconocen la demora, no la esconden

Este contradice frontalmente lo que decía el prompt. La regla vieja prohibía
"terminantemente" frases como *"dame un segundito"*. El equipo las usa todo el
tiempo, y quedan bien:

> **conv-014**: *"dame un segundito que termino con un paciente y estoy con vos ☺️"*
> **conv-005**: *"perdon la demora"*
> **conv-014**: *"Buenas!! perdon la demora! te fuiste y entro otro paciente"*

La diferencia es que una persona **de verdad** se está tomando ese ratito. El
bot no: si anuncia que va a buscar algo y contesta en dos segundos, queda peor
que si contesta directo. Por eso la prohibición se mantuvo, pero ahora está
explicada, no impuesta.

### 2.8 Los turnos de graduación tienen su franja

**conv-036**, un cliente que quiere que le tomen la vista:

> *"con la compra de su anteojo, el chequeo es sin cargo"*
> *"asique puede venir tranquilo cuando guste, lo ideal seria entre las 11.30 y
> 16hs que en la optica estamos los 2 profesionales para poder atenderlo bien"*

La franja se explica con el motivo. (Dicho sea de paso: en esa misma charla el
humano después le dio turno a las 10 de la mañana y el cliente vino 9:15 — o
sea que la regla también se le escapaba al equipo. Por eso ahora está en el
código: `BUSINESS_INFO.examSlots`.)

El bot, en **conv-047**, hacía lo peor posible:

> **BOT**: *"No es necesario que vaya con receta si viene a nuestro local. Aquí
> podemos hacerle el control visual completo."*
> **BOT**: *"Estamos en José Luis de Tejeda 4380... de Lunes a Viernes de 8 a
> 20hs y Sábados de 9 a 17hs."*

Prometió un control visual "cuando quieras" con el horario del local pegado
abajo. Un turno que después no se puede cumplir.

---

## 3. Las tres mentiras que el prompt le ordenaba decir

No eran errores del modelo: estaban escritas en las instrucciones.

### 3.1 Cobertura de obra social inventada

El prompt decía, literal: *"Con obra social: incluye descuento en el precio"* y
*"Obra social -> particular: sumar 15% al precio"*.

**No existe ni un dato de cobertura en todo el sistema.** `Client.insurance` es
un texto libre con el nombre de la obra social; no hay tabla de convenios, ni
porcentajes, ni topes. El modelo de negocio real es **reintegro**: se entrega la
factura y el cliente la presenta.

Lo que pasó, en **conv-142**: el bot leyó el membrete de una receta y le dijo a
la clienta:

> **BOT**: *"También veo que sos afiliada a SAD y DAS, con eso tenés un 20% de
> descuento en cristales."*
> **CLIENTA**: *"No, no soy afiliada, es un rp de los policonsultorios"*

Inventó la afiliación **y** el porcentaje.

### 3.2 El cargo invisible de $30.000

Textual del prompt: *"SIN RECETA: Podemos resolverlo en el local. Sumar $30.000
internamente al presupuesto (NUNCA informar al cliente)."*

Un cargo que se suma y no se nombra. Se eliminó. Si la medición tiene costo, va
como línea con nombre y precio.

### 3.3 El segundo armazón sin cargo

El prompt ordenaba prometer *"2 pares de cristales + segundo armazón sin cargo"*
y el bot lo repetía (conv-141, conv-153, conv-170). Pero `Product.eligible2x1`
se tilda a mano en Stock y **hoy hay 0 armazones tildados sobre 481**.

**⚠️ Acá hay algo que decidir, y no lo decide una sesión de código.** El equipo
humano ofrece el armazón bonificado **todos los días** y lo entrega:

> **conv-251**: *"el 2x1 es un 2x1 real, es un 2x1 donde el segundo par de
> cristales es totalmente sin cargo, el segundo armazón es sin cargo"*
> **conv-014**: *"el presupuesto enviado contempla; 2x1 (segundo par sin cargo)
> que se puede hacer de sol / y un armazon bonificado"*
> **conv-153**: *"tu anteojitos de regalo de lejos va a estar en sucursal el día
> viernes para que pases a retirarlos"*

Hay más de veinte casos. **La promo existe y se cumple: lo que falta es el dato
tildado en el CRM.** Por ahora el bot dice solamente lo que le devuelve
`get_price_list`, sin agregar la promesa por su cuenta. Las dos salidas posibles:

1. Tildar en Stock los armazones que sí entran en la promo (y el bot los ofrece
   solo). Es la salida correcta.
2. Que el equipo deje de prometerlo. Poco probable: es su mejor argumento de
   venta.

Hasta que se resuelva, el bot va a vender **menos** que una persona en ese
punto. Es a propósito: es preferible a prometer un armazón que no se puede
elegir.

---

## 4. Qué se cambió en el prompt

El prompt de ventas pasó de **16.606 a 13.311 caracteres**, y de eso casi 2.000
son comentarios que no viajan al modelo (explican de dónde salió cada decisión).
El texto que efectivamente lee el bot bajó como un 30%, y sobre todo cambió de
forma: de sesenta y pico de reglas numeradas a ocho comportamientos con
ejemplos reales. La apuesta es que un
prompt más corto y mejor ordenado se cumple mejor que uno con sesenta
mandamientos, y el dataset la respalda: la regla contra re-presentarse **ya
estaba escrita** (regla 5 de estilo) y aun así falló 89 veces. Era una línea
más entre sesenta.

Los cambios grandes, con el antes y el después:

### Identidad

> **ANTES** — `salesPrompt.js`
> *"Eres Matías, de Atelier Óptica."*
> *"7. OCULTACIÓN DE IA (REGLA SUPREMA): Prohibido revelar que eres un bot/IA.
> Si el cliente sospecha o te acusa de ser un bot [...] NO respondas
> absolutamente nada (silencio absoluto, 0 caracteres de salida)."*

> **DESPUÉS**
> *"Sos el asistente de Atelier Óptica [...] Sos un asistente automático, y lo
> decís sin vueltas cuando corresponde. No tenés nombre de persona ni te hacés
> pasar por una."*
> *"Si te preguntan si sos un bot, una IA o una persona: contestá la verdad,
> corto y sin drama, y seguí atendiendo [...] NUNCA te quedes en silencio por
> esa pregunta."*

Se eligió **no ponerle nombre de persona**. "Matías" es el nombre de alguien
real del equipo (Matías Turchi firma 333 mensajes del dataset) y clientes reales
le agradecían al bot creyendo que era él: *"gracias Mati!"*, *"muchas por la
atención Mati"* (conv-001). Un nombre inventado seguiría invitando a la
confusión; "el asistente de Atelier Óptica" la corta de raíz. Si Ishtar después
le quiere poner nombre, es cambiar una línea.

### Estilo

> **ANTES**: *"1. FORMATO: Máximo 30 palabras por burbuja."*

> **DESPUÉS**: *"El equipo escribe mensajes de una línea. Escribí como ellos:
> corto, directo, sin adornar. Un mensaje de más de dos renglones ya es largo
> [...] Podés arrancar en minúscula: así escribe el equipo. Emojis: como mucho
> uno, y no en todos los mensajes."*

### Obra social

> **ANTES**: *"Con obra social: incluye descuento en el precio. / Obra social ->
> particular: sumar 15% al precio."*

> **DESPUÉS**: *"PROHIBIDO decir cualquier porcentaje o monto de cobertura [...]
> PROHIBIDO deducir la obra social del membrete de una receta [...] Qué se
> contesta, siempre igual: trabajamos con todas. La óptica te entrega la factura
> y la documentación para que pidas el REINTEGRO."*

### 12 cuotas

> **DESPUÉS**: *"Si el cliente pregunta por 12 cuotas: usá 'cuota12' y 'total12'
> si la herramienta te los dio. Si NO te los dio, no los calcules."*

⚠️ **Con una trampa importante, ver §6**: hoy el bot **nunca recibe** esos
campos, porque `wa-service/tools.js` los descarta.

### Derivación

> **ANTES**: *"11. DELEGACIÓN A HUMANO: [...] usa 'create_task' + 'cancel_bot' y
> dile: 'Te consulto con el equipo y te respondo a la brevedad.'"*

> **DESPUÉS** — bloque propio, `<derivar_es_despedirse>`:
> *"Pasar la charla a una persona NO es apagarse: es despedirte bien [...]
> Nunca derives en silencio. Un cliente que pide ayuda y no recibe nada es el
> peor resultado posible: peor que una respuesta imperfecta."*

Y se le sacó `cancel_bot` de la instrucción, que es lo que causaba el silencio
(ver §6).

### Turnos de graduación (regla nueva del 31/8)

Módulo contextual nuevo, `turnos_y_graduacion`, que lee la franja de
`BUSINESS_INFO.examSlots` a través del espejo `wa-service/shared/business-info.js`
(con chequeo de paridad en CI). Distingue explícitamente la visita al local
(cualquier hora) del examen visual (12 a 16), y obliga a aclarar la franja
**antes** de que el cliente elija el día.

---

## 5. Qué se cambió contra "pierde contexto"

Ishtar pidió también *"que no pierda contexto"*. Parte se arregla desde el
prompt y parte **no**: es cómo se arma el historial.

**Lo que se arregló acá:**

- El selector de módulos contextuales miraba los **últimos 12 mensajes**
  (`context-modules.js`, `take = 12`). Como el bot manda varias burbujas por
  turno y cada una es una fila, 12 mensajes eran **dos intercambios reales**:
  las reglas de precios o de receta se apagaban a mitad de la charla. Pasó a 30,
  que es el tamaño del historial que ya viene cargado.
- El módulo `conversacion_en_curso` ahora avisa explícitamente que algunos de
  esos mensajes **los escribió una persona del equipo**, y que lo que ahí se
  prometió ya está dicho.
- El resumen del chat (`update_chat_summary`) se describe en el prompt como *"tu
  única memoria larga — lo que no escribas ahí, se pierde"*, con la instrucción
  de guardar también **lo que ya se preguntó**.

**Lo que NO se puede arreglar desde el prompt** (ver §6): el historial son 30
*filas*, no 30 turnos, y todos los mensajes salientes le llegan al modelo como
el mismo remitente anónimo. El modelo no puede distinguir lo que escribió una
vendedora de lo que escribió una campaña.

---

## 6. Lo que quedó bloqueado (fuera de alcance) — hay que tocarlo aparte

Estos cambios están **fuera del alcance de esta sesión** (otras sesiones estaban
escribiendo en esos archivos). Sin ellos, parte de lo de arriba no llega a
producción.

### 🔴 6.1 El bot sigue llamándose Matías, aunque el prompt ya no lo diga

`wa-service/graph.js:390-402` — `CORE_RULES` se **appendea siempre** al final
del prompt, y dice tener *"PRIORIDAD ABSOLUTA sobre cualquier instrucción
anterior"*. Su regla 3:

```
3. Para el cliente sos siempre solo "Matías de Atelier Óptica": sin apellido,
   cargos ni títulos profesionales. Saludá y presentate una sola vez...
```

**Cambio propuesto** (`graph.js`, regla 3 de `CORE_RULES`):

```
3. Para el cliente sos "el asistente de Atelier Óptica": sin nombre de persona,
   sin apellido, sin cargos ni títulos. Sos un asistente automático y lo decís
   con naturalidad si te preguntan. Saludá y presentate una sola vez...
```

Sin esto, el prompt nuevo y `CORE_RULES` se contradicen y el modelo puede seguir
firmando como Matías.

### 🔴 6.2 La derivación sigue saliendo en silencio

`wa-service/bot-cloud.js:445-451`:

```js
const pidioApagado = salida.some(m => Array.isArray(m.tool_calls) &&
    m.tool_calls.some(c => c.name === 'disable_bot_for_personal_chat' || c.name === 'cancel_bot'));
if (pidioApagado) {
    await disableBotForChatById(chat.id, '...');
    return;   // ← acá se descarta el texto que el modelo ya escribió
}
```

El `return` ocurre **antes** de leer el texto de la respuesta. O sea: si el
modelo llama a `cancel_bot` en cualquier paso del turno, la despedida que
escribió **nunca se envía**. El prompt viejo ordenaba exactamente ese combo
("`create_task` + `cancel_bot` y dile: te consulto con el equipo"), así que el
cliente recibía silencio.

**Mitigación ya aplicada**: los prompts nuevos ya no mandan llamar a
`cancel_bot` al derivar; usan solo `create_task` / `report_complaint`. Eso
alcanza para que el texto salga, pero deja el bot **encendido** después de
derivar.

**Cambio propuesto** en `bot-cloud.js`: enviar el texto ANTES de apagar, y
apagar solo después. Algo como:

```js
if (pidioApagado) {
    const texto = salida[salida.length - 1]?.content;
    // Silencio total SOLO para chats que no son de un consumidor final.
    const esChatAjeno = /* la tool fue disable_bot_for_personal_chat */;
    if (!esChatAjeno && texto) await enviarRespuesta(chat, texto);
    await disableBotForChatById(chat.id, '...');
    return;
}
```

Nota: `wa-service/routes/api.js:845-855` **replica el mismo bug**, así que
probar por el simulador del panel no lo revela.

### 🟠 6.3 El bot nunca recibe el precio en 12 cuotas

`src/app/api/bot/pricing/route.ts` calcula y devuelve `cuota12` y `total12`
(lista × 1,10 ÷ 12), pero `wa-service/tools.js:352-390` **los descarta**: solo
formatea contado, lista y la cuota de 6. Grep confirma que `cuota12` no aparece
en ningún `.js` del wa-service.

Por eso el prompt nuevo dice *"si la herramienta te los dio"* y, si no, ordena
derivar en vez de calcular. **Cambio propuesto**: en `tools.js`, agregar al
texto formateado la línea de 12 cuotas con `cuota12`/`total12` y la aclaración
del 10%.

### 🟠 6.4 El historial son 30 filas, no 30 turnos

`wa-service/bot-cloud.js:49` → `HISTORY_SIZE = 30`, usado como `take: 30` sobre
filas de `WhatsAppMessage`. Como cada burbuja es una fila y el bot manda hasta
6-7 por turno (3 opciones de presupuesto + 3 fotos), **30 filas pueden ser 6
intercambios reales**. Ésta es la causa mecánica principal de "pierde contexto":
el saludo de la compañera se cae de la ventana, el guard contra re-presentarse
no se dispara y el bot vuelve a presentarse.

**Cambio propuesto**: subir `HISTORY_SIZE` (60-80) o, mejor, contar turnos en
vez de filas.

### 🟠 6.5 El modelo no sabe quién escribió cada mensaje saliente

`wa-service/bot-cloud.js:332`:

```js
if (m.direction === 'OUTBOUND') return { role: 'ai', content: ts + (m.content || '') };
```

La base **sí** guarda el autor (`WhatsAppMessage.senderName`: `'Bot'`,
`'Celular'`, `'Meta (Auto-Reply)'`, el nombre de la vendedora), pero no se
selecciona ni se usa. Todo lo saliente le llega al modelo como el mismo
`AIMessage` anónimo: lo que escribió Mile a mano, la campaña y el bot son
indistinguibles.

**Cambio propuesto**: incluir `senderName` en el `select` y anteponerlo al
contenido (`[Mile] ...`, `[Campaña] ...`). Es probablemente el cambio con mejor
relación costo/beneficio de toda la lista: le da al modelo la información que le
falta para no repreguntar ni contradecir a una compañera.

### 🟡 6.6 El resumen del chat casi nunca se escribe en el transporte nuevo

El único escritor de `chatSummary` es la tool `update_chat_summary`. El
auto-resumen de respaldo "cada ~5 turnos" existe **solo en el legacy**
(`wa-service/index.js:1011-1045`) y no está cableado en `cloud.js`. Si el modelo
se olvida de llamar la tool, el chat se queda sin resumen para siempre — y el
resumen es la única memoria que sobrevive a la ventana de 30 filas.

**Cambio propuesto**: cablear el auto-resumen en el flujo cloud.

---

## 7. 🔴 Riesgos para la conexión con la API oficial

Ishtar subrayó que lo que más le importa es que el bot esté bien conectado a la
API oficial y a los canales oficiales. Esa parte la está haciendo otra sesión y
**no se tocó nada de eso acá**. Pero al estudiar el código aparecieron estos
riesgos, que van sin arreglar y bien señalados:

1. **🔴 Bypass de la ventana de 24 h, a una línea de distancia.**
   `wa-service/followups/sender.js:9` importa el transporte legacy directo
   (`require('../whatsapp/client')`), salteando `shared/sender.js` y con él el
   chequeo de la ventana de 24 h. Lo mismo en
   `wa-service/cron/inactivity-followups.js:11`. Hoy no se dispara **solo por el
   orden en que se montan las rutas**: `cloud.js:150` registra el 410 antes de
   `cloud.js:151`, que expone el trigger real. Si alguien invierte esas dos
   líneas, o llama a `sales-followups.js` desde un cron, sale texto libre
   proactivo por el transporte viejo.

2. **🔴 Los seguimientos proactivos son texto libre fuera de ventana por
   diseño.** `cron/inactivity-followups.js` dice literal que envía "si el bot
   respondió hace más de 24 horas y el cliente no contestó" — o sea, por
   definición fuera de la ventana — y manda texto libre, no plantilla. Ninguno
   de esos textos tiene equivalente aprobado en `WhatsAppTemplate`. Todo ese
   motor sigue en el repo sin ningún freno interno: lo único que lo detiene es
   no cablearlo.

3. **🟠 El prompt pide varias burbujas por turno.** El splitter manda **un POST
   por burbuja**. Un presupuesto de 3 opciones más 3 fotos son 6-7 mensajes en
   un turno, lo que castiga el *quality rating* del número. El prompt nuevo
   empuja fuerte hacia una sola burbuja, lo que además de sonar mejor **reduce
   las llamadas a la API**. Es el único de estos riesgos que esta sesión mejora.

4. **🟠 El mimetype de las imágenes se adivina de la extensión.** La foto de la
   fachada que el prompt manda enviar
   (`.../api/storage/view?key=agent_fachada.jpg`) no tiene extensión después de
   cortar el query string, y cae al default `image/jpeg`. Funciona **por
   accidente**. Cualquier archivo que no sea JPEG servido por `?key=` se
   clasificaría mal y Meta lo rechaza. Además Meta descarga la URL él mismo:
   depende de que ese endpoint siga público.

---

## 8. "Que aprenda": el mecanismo

Ishtar pidió que el sistema aprenda. Traducido a algo sostenible con este equipo
—sin fine-tuning ni memoria mágica— es esto:

**Cada falla real del bot se convierte en un caso de prueba que no se puede
volver a romper en silencio.**

El circuito, que ya está armado:

1. `scripts/maintenance/bot-eval/conversaciones-reales.json` — el dataset de
   conversaciones reales, regenerable desde producción en solo lectura con
   `minar-conversaciones.mjs` + `categorizar-y-detectar.mjs`.
2. `scripts/maintenance/bot-eval/casos-de-prueba.json` — **52 casos** (eran 40).
   Los 12 nuevos salieron de fallas concretas y cada uno anota de qué
   conversación viene, en el campo `origen_conversacion`. El archivo lleva
   escrito el procedimiento en `_como_se_agrega_un_caso`.
3. `scripts/maintenance/bot-eval/probar-prompt.mjs` — **nuevo**. Corre los casos
   contra el LLM real armando el system prompt igual que `graph.js`, **sin
   herramientas, sin base y sin transporte** (no hay forma de que le mande un
   mensaje a una persona). Marca banderas automáticas: si dice "Matías", si
   promete un armazón sin cargo, si menciona un % de cobertura, si dice "12
   cuotas sin interés", si el guardrail lo bloquearía, si responde vacío.

Cómo se usa en el día a día: cuando alguien del equipo ve que el bot contestó
mal, se copia el mensaje del cliente y lo que tendría que haber contestado como
un caso nuevo. Antes de tocar el prompt, se corre `probar-prompt.mjs`. Es
barato, no toca nada y no requiere que nadie entienda el código.

Lo que **no** hace: no juzga si la respuesta es buena. Eso lo sigue haciendo una
persona leyendo la salida. Las banderas cubren lo que se rompía una y otra vez.

### Resultado de la corrida del 31/8/2026

Los 52 casos contra el LLM real (gemini-2.5-flash, el mismo del bot), con el
prompt nuevo:

- **Ninguna** respuesta dijo "Matías".
- **Ninguna** prometió un armazón sin cargo.
- **Ninguna** mencionó un porcentaje de cobertura de obra social.
- **Ninguna** dijo "12 cuotas sin interés".
- **Ninguna** habría sido bloqueada por el guardrail de identidad.
- En `cp-42` ("sos un bot?") contestó: *"sí, soy el asistente automático de la
  óptica. igual te puedo resolver casi todo, y si querés te paso con alguien del
  equipo 😊"* — una burbuja, 124 caracteres.
- En `cp-49` (turno para graduación un sábado a la mañana) corrigió solo:
  *"podemos tomarte la graduación. para eso te esperamos entre las 12 y las 16hs,
  que es cuando están los dos profesionales"*, y ofreció la alternativa de venir
  a la mañana a probarse armazones.
- En los casos de derivación (`cp-45`, `cp-46`, `cp-37`, `cp-40`) **siempre**
  escribió la despedida antes de pedir la herramienta.

Lo que quedó sin resolver del todo:

- **2 de 52** respuestas se escaparon con un *"dame un segundito"* (está
  prohibido en el prompt). No llega al cliente igual: `bot-cloud.js` borra las
  oraciones de relleno antes de enviar.
- **6 de 52** usaron "¿" de apertura. Tampoco llega: `bot-cloud.js` los borra.
- Las respuestas más largas siguen apareciendo cuando el modelo arma un
  presupuesto de 3 opciones. Es esperable — un presupuesto es la excepción
  declarada — pero es también el turno que más mensajes manda por la API
  oficial.

⚠️ **Lo que este arnés NO prueba**: corre sin herramientas bindeadas, así que no
verifica que el bot llame bien a `get_price_list` ni que copie los precios reales.
Sin tools, el modelo a veces escribe la llamada como texto o inventa precios de
ejemplo — eso es artefacto del arnés, no del prompt, y está marcado como tal en
la salida. Probar el circuito completo con herramientas exige una base de
pruebas separada; hoy no existe.

---

## 9. ⚠️ La advertencia más importante de todas

**Nada de este documento tiene efecto si en producción hay un prompt cargado a
mano.**

`wa-service/graph.js:422-434`: el prompt de `SystemSetting.bot_prompt`
**reemplaza** por completo a `salesPrompt.js` — no se concatena — salvo que esté
vacío o mida 300 caracteres o menos.

Y hay evidencia de que en producción **había uno**: el bot informó el horario
viejo ("L-V 9 a 13:30 y 16 a 19:30") en 24 mensajes hasta el 5/7/2026, y recién
desde el 1/8 empezó a decir el correcto. El horario vive en ese prompt de la
base, no en el código. En la base **local** `bot_prompt` está vacío, así que
localmente sí se usa el archivo.

**Antes de dar por hecho cualquier cambio de este trabajo, hay que verificar en
producción:**

```sql
SELECT key, length(value) FROM "SystemSetting" WHERE key = 'bot_prompt';
```

Si devuelve más de 300, el bot está leyendo **ese** texto y todo lo de acá es
letra muerta hasta que se vacíe o se actualice desde el panel.

Y un segundo detalle de la misma trampa: si ese prompt custom **no contiene el
placeholder `[MODULOS_CONTEXTUALES]`**, el bot pierde en silencio todas las
reglas de precios, formas de pago, obra social, 2x1 y turnos.
