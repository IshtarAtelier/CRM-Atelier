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
   DNP de cada ojo y **altura de cada armazón** (en un 2x1, la del 2º armazón
   también).
4. Medidas del armazón (A, B, ED, puente).
5. Si hay teñido (anteojo de sol): la línea de teñido con **estilo, color y
   grado**, y **asignada a su armazón**.

## Paso a paso

En la ficha, columna derecha, el bloque **"Grupo Óptico · carga del pedido"**.

1. Elegí **tipo de armazón** (plástico o metálico). Tipo de aro (aro entero,
   ranurado, perforado) y forma son opcionales.
2. Apretá **"Preparar en Grupo Óptico"**. El robot entra al portal (solo a
   leer) y arma el pedido. Tarda unos segundos.
3. **Revisá** lo que va a cargar, renglón por renglón contra la venta: el
   **artículo** de cada ojo (grande, en negrita), material, color, teñido,
   graduación, DNP, altura, armazón, código y observación.
4. Decidí:
   - **Aprobar y cargar**: el robot crea el pedido, el **nº de pedido** queda
     en la venta, el cliente recibe el aviso de "pedido procesado" y en la
     ficha aparece **"Ver el pedido del laboratorio (PDF)"**.
   - **Rechazar** (con el motivo): no se manda nada. Corregí la venta y volvé
     a preparar.

## 2x1 Smart Free

- Son **dos pedidos**. Primero se carga el **1er par**; el 2º se habilita
  cuando el 1º ya tiene número.
- El 2º par lleva en la observación **"2° par SIN CARGO - 1° par n° 80…"**:
  así el laboratorio no lo cobra.
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
en la venta como siempre.
