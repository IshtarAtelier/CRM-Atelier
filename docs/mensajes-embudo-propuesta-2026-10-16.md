# Los tres mensajes del embudo, cortos y humanos — propuesta (16/10/2026)

Pedido de Ishtar: "los mensajes están siendo demasiado largos, engorrosos y se
nota que son todos de robot. Mensajes mucho más breves, más humanos, que
respeten lo mismo que les sugerimos a los vendedores".

## Lo que dicen los datos (auditoría del 8/10, producción)

| Toque | Cuándo | Envíos | Respuestas | Ventas |
|---|---|---|---|---|
| 1 · "¿pudiste ver el presupuesto?" | 48 h | 364 | 100 | 6 |
| 2 · invitación al local | día 4 | 386 (los dos juntos) | — | **0** |
| 3 · "seguinos en Instagram" + descuento | día 15 | | | **0** |
| 4 · retome con cupón 10 % | día 30 | nuevo (8/10) | — | — |

El primero funciona. El segundo y el tercero no vendieron ni una vez en un
mes, y son los más largos (el de día 4 tiene dirección, link, horarios y "somos
la óptica mejor calificada"; el de día 15 arranca con Instagram).

## Lo que les pedimos a los vendedores (y los mensajes no cumplen)

1. Nombre de pila y **quién escribe** (una persona, no "Atelier Óptica").
2. **Una sola pregunta**, concreta, que se contesta en una palabra.
3. Sin repetir lo que ya sabe (dirección, horarios, reseñas, links).
4. Ofrecer algo (reservar, probar, un día), no "contame qué te pareció".
5. Darle una salida digna: "si ya lo resolviste, contame y no te escribo más".

## Propuesta: dos toques y un cierre

Saco el de día 4 (cero ventas, el más largo) y junto el de día 15 con el
cupón. Queda así. `{{1}}` es el nombre de pila; `{{2}}` quien escribe (el
vendedor que atendió el chat; si no hubo, "Mati"); el cupón y la fecha salen
del cupón de recupero de /admin/web (hoy VOLVE10, 31/10).

**Toque 1 · a las 48 h del presupuesto** (`seguimiento_presupuesto_v2`, utilidad)

> Hola {{1}}! Soy {{2}}, de Atelier. Qué te pareció el presu, es lo que estabas
> buscando o querés que veamos una opción más económica? Contame, te quedaría
> cómodo venir al local esta semana?
>
> (texto de Ishtar, 16/10)

Botones: *Voy a pasar* · *Lo estoy pensando* · *Ya lo resolví*

**Toque 2 · día 7** (`seguimiento_segundo_v1`, utilidad)

> Hola {{1}}, seguís pensándolo? Si hay algo que te frena, decímelo y lo vemos.

Botones: *Tengo una duda* · *Ya lo resolví*

**Cierre · día 15** (`ultimo_seguimiento_v2`, marketing)

> Hola {{1}}, te dejo un {{3}} con el código {{4}} hasta el {{5}}, por si te
> sirve. Si ya lo resolviste, no hay drama, avisame y listo. Y si querés ver lo
> que va entrando, acá está nuestro Instagram: https://www.instagram.com/atelieroptica_

Botones: *Quiero el descuento* · *Ya lo resolví*

Después del cierre: 7 días de silencio y se marca perdido, como hoy. El
retome del día 30 con cupón deja de existir (es lo mismo que el cierre, 15
días después y más largo).

## Qué cambia por debajo

- "Ya lo resolví" en cualquier botón cierra el embudo al instante y no manda
  nada más (hoy eso lo adivina un patrón de texto; con botón es exacto).
- "Lo estoy pensando" pausa 10 días (no 30) y vuelve con el cierre.
- "Tengo una duda" / "Quiero reservarlo" abre tarea para hoy a quien atendió
  el chat y avisa por la mensajería (el carril que agregamos el 15/10).
- Los mismos tres textos pasan a ser las respuestas rápidas del buzón, así el
  vendedor y el motor dicen lo mismo (hoy el buzón sugiere las versiones largas).
- Un solo mensaje por toque. Ningún link, ninguna dirección, ninguna reseña:
  todo eso ya se lo dijo el bot el primer día.

## Lo que hace falta de Ishtar

1. OK a los tres textos (o corregirlos: son tres frases).
2. OK a sacar el toque del día 4 y el retome del día 30.
3. Con eso, se cargan las plantillas y se mandan a Meta a aprobar (la de
   cierre lleva descuento: es "marketing" y tarda hasta un par de días; las
   otras dos suelen aprobarse en minutos). Hasta que Meta apruebe, el motor
   sigue con las de ahora.
