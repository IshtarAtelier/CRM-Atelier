# Grupo Óptico: cómo cargar un pedido desde la ficha

Guía para el equipo. Desde el 3/10/2026 los pedidos de **Grupo Óptico** (Smart
Free, Smart One, MyoFix, stock…) se cargan en SmartLab **desde la ficha de la
venta**: el robot arma el pedido con el artículo exacto del portal, una persona
lo revisa y lo aprueba. **Nada llega al laboratorio sin esa aprobación.**

> Importante: en SmartLab **guardar es crear** el pedido, y la óptica no lo
> puede anular (solo Grupo Óptico). Por eso se revisa ANTES de aprobar.

## Antes de empezar

El robot carga lo que dice la venta. Si falta algo, no prepara y dice qué.

1. La venta está **enviada a fábrica**.
2. El cristal vendido es **el que se va a fabricar**. Si el cliente pasó a
   Super Blue, fotocromático, Essential, etc., **cambialo en la venta**: el
   robot carga exactamente lo vendido (antes se cambiaba a mano en el portal y
   la venta quedaba diciendo otra cosa).
3. Receta completa (esférico, cilindro con su eje, adición en multifocal),
   DNP de cada ojo **de a 0,5** y **altura de cada armazón en milímetros
   enteros** (en un 2x1, la del 2º armazón también): así las toma el laboratorio.
4. Medidas del armazón (A, B, ED, puente).
5. Si hay teñido (anteojo de sol): la línea de teñido con **estilo, color y
   grado**, y **asignada a su armazón**.

## Paso a paso

En la ficha, columna derecha, el bloque **"Grupo Óptico · carga del pedido"**.

1. Elegí **tipo de armazón** (plástico o metálico). Tipo de aro (aro entero,
   ranurado, perforado) y forma son opcionales.
2. Apretá **"Preparar en Grupo Óptico"**. El robot entra al portal (solo a
   leer) y arma el pedido. Tarda unos segundos.
3. En la ficha aparece **la pantalla de SmartLab con el pedido cargado** (todavía sin guardar). Tocá **"Ver el portal en grande y decidir"** y revisala contra la venta: artículo de cada ojo, material, graduación, DNP, altura, armazón, teñido y observación.
4. Ahí mismo, abajo de la pantalla, decidí:
   - **Aprobar y cargar**: el robot crea el pedido, el **nº de pedido** queda
     en la venta, el cliente recibe el aviso de "pedido procesado" y en la
     ficha queda la pantalla del pedido ya cargado y su PDF.
   - **Rechazar** (con el motivo): no se manda nada. Corregí la venta y volvé
     a preparar.

Es **la misma forma de trabajar que con Vitolen**: preparar, mirar la pantalla
real del laboratorio, aprobar.

## Agregar algo que NO está cobrado (Essential)

El robot carga **exactamente lo que dice la venta**. Si querés que el pedido
lleve Essential y la venta no lo tiene, lo correcto es **cambiar el cristal
en la venta** por la versión Essential (y cobrarlo). Si igual hay que
agregarlo sin cobrar (se lo prometieron, es una compensación, etc.), al lado
de "Preparar" hay un link **"+ Agregar Essential (NO está en la venta)"**:
1. Sale un cartel: "No está cobrado. ¿Estás seguro?", con la explicación.
2. Hay que **escribir el motivo** (sin motivo no deja).
3. Al preparar, queda anotado en la ficha del cliente con tu nombre, en el
   registro del sistema, y **le llega a Ishtar por la mensajería interna**
   (urgente, con copia al celular) con tu motivo tal cual y los datos de la
   venta. El cruce de costos lo va a ver como sobrecosto, porque lo es.

## 2x1 Smart Free

- Son **dos pedidos**: uno **con cargo** y otro **sin cargo**. Primero se
  carga el par con cargo; el sin cargo se habilita cuando el otro ya tiene
  número.
- **Cuál es cuál lo decide el valor** (regla de Ishtar, 8/10/2026): el par de
  cristales **más caros va con cargo**; el más barato va sin cargo. Si los dos
  pares llevan el mismo cristal, queda como siempre: par 1 con cargo, par 2 sin
  cargo. La ficha lo muestra al lado de cada par ("con cargo · 2x1" /
  "SIN CARGO · 2x1") y avisa en amarillo si el valor dio vuelta el orden.
- El par sin cargo lleva en la observación **"2° par SIN CARGO - 1° par n°
  80…"** (el nº de operación del par con cargo): **ese número es lo que hace
  que el laboratorio no lo cobre**.
- Por eso, al apretar **"Aprobar y cargar"** en un par de un 2x1 aparece un
  aviso que te pide confirmar: en el par sin cargo, que la observación tenga
  el nº de operación del otro par; en el par con cargo, que su nº quede en la
  venta antes de preparar el otro. Leelo y recién ahí "Lo revisé: aprobar y
  cargar".
- Si el 2º par es **de sol** (con teñido), el robot lo carga en **Orgánico
  Blanco 1.49** de la misma familia + el teñido: es el único material que el
  laboratorio tiñe. Te lo avisa en amarillo antes de aprobar.

## Si algo falla

| Qué ves | Qué significa | Qué hacer |
|---|---|---|
| "Para prepararlo falta, en la venta: …" | Falta un dato | Completalo en la venta |
| "No se pudo preparar: el portal no ofrece un artículo que corresponda" | Ese producto no existe así en SmartLab (o la tabla no lo tiene) | Avisá a Ishtar; mientras, se carga a mano |
| "Ya tiene pedido en el laboratorio: nº …" | Ese par ya se cargó (por el robot o a mano) | Nada: no se carga dos veces |
| "Aprobado · no se cargó" + **Reintentar la carga** | El portal no respondió | Reintentá: **nunca se duplica**, el robot busca el pedido antes de crearlo |
| "Cambió el producto/la venta después de aprobar" | Se editó la venta entre preparar y aprobar | Volvé a preparar y revisá de nuevo |
| "La cuenta está BLOQUEADA" | Saldo impago con Grupo Óptico | Hablar con administración |

**Plan B**: arriba de la ficha siguen los botones **"A mano · Par 1/2"** (el
favorito de siempre). Usalos solo si el robot no puede; después **tipeá el nº**
en la venta como siempre. Si cargás a mano, el **código interno** tiene que
decir qué armazón es (`#XXXX Nombre 1°par` / `2°par`, como lo escribe el
favorito): es lo que usa el seguimiento para saber de qué par es el pedido. No
alcanza con la observación "2° par SIN CARGO" — ese "2° par" es el de la
promo, y puede ser el armazón 1.
