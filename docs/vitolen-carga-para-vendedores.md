# Vitolen: cómo cargar un pedido desde la ficha (guía para vendedores)

Desde el 3/10/2026 los pedidos de Vitolen (cristales Hoya y Pentax) se cargan
en el portal del laboratorio **desde la ficha de la venta**, sin tipear nada
en gestion.vitolen.com. El robot llena el formulario; una persona revisa y
aprueba. Nada se manda al laboratorio sin esa aprobación.

## Antes de empezar

1. La venta tiene que estar **enviada a fábrica** (botón de siempre). Si no,
   el bloque te lo dice y no deja preparar.
2. La venta necesita: receta completa (esférico, cilindro con su eje,
   adición en progresivos), DNP de cada ojo, altura pupilar y las medidas del
   armazón (A, B, DBL). Si falta algo, el bloque lista qué.
3. Si el cristal es fotocromático (Sensity) o polarizado, la venta tiene que
   tener el **color** cargado en el ítem (gris, marrón o verde).

## Paso a paso

1. Abrí la venta. Abajo está el bloque **"Vitolen · pedido en el portal"**.
2. Elegí la **forma del armazón** (Forma 1 a 12: las mismas tarjetas que
   muestra el portal) y el **eje de la diagonal mayor** (0 a 180; el ángulo de
   la diagonal más larga del aro, el que pide el portal en "¿Cómo tomar las
   medidas?"). Si el cristal viene en variantes (Lifestyle: Urban / Indoor /
   Outdoor), elegila.
3. Apretá **"Preparar en Vitolen"**. Tarda 10‑20 segundos: el robot entra al
   portal, llena los 35 campos y crea el pedido como **borrador sin
   confirmar**. Vuelve con la captura del resumen que muestra Vitolen.
4. **Revisá la captura contra la venta**: cristal (el código de lista va
   adelante, p. ej. "10070 - Array 2 1.60 Hilux MR-8 Clear"), graduación,
   DNP, alturas, armazón, forma, calibrado, antirreflejo.
   - Si está bien → **Aprobar**. El robot confirma en el portal, el nº de
     trabajo queda en la venta y **al cliente le llega el aviso de "pedido
     procesado"** (igual que cuando se carga el nº a mano).
   - Si algo está mal → **Rechazar** con el motivo. El robot cancela el
     borrador en el portal. Corregí la venta y volvé a preparar.
   - Si es un detalle chico, el link "abrilo en el portal" lleva al borrador:
     se corrige con **Modificar** en Vitolen y después se aprueba acá.
5. **Segundo par de la promo Hoya**: el bloque te lo marca en amarillo. Antes
   de aprobar, abrí el borrador en el portal con "Modificar" y asociá el
   **pedido origen** (el nº del primer par) con la promoción HOYALUX. El
   robot todavía no lo hace solo.

## Qué hace el sistema después, solo

- Cada media hora mira el portal: cuando Vitolen pasa el pedido a "En
  Proceso" la venta queda **en proceso**; cuando llega a "En Oficina" o
  "Despachado", **Finalizado (Lab)**, con la campanita de "pedido fabricado".
- **Diferencia con Grupo Óptico**: con GO, a las 24 h de terminado el sistema
  le avisa solo al cliente y pasa la venta a "Listo p/ Retirar". Con Vitolen
  **todavía no** (no sabemos cuánto tarda en llegar al local): cuando el
  pedido llega, el vendedor lo marca "Listo p/ Retirar" y ahí sale el aviso
  al cliente, como siempre.
- Si un pedido se cargó a mano en el portal, poné el **código corto de la
  venta** (el `#XXXX` que muestra el CRM) en "Nro de Caso Interno": así el
  sistema lo reconoce igual.

## Si algo falla

- **"El robot no pudo…"**: el motivo queda escrito en el bloque. Lo típico:
  un dato que falta en la venta, o el portal caído. Se puede volver a
  preparar.
- **"Quedó un pedido sin confirmar en el portal"** (amarillo): el robot lo
  creó pero algo se cortó. Botón **"Cancelar en el portal"** y volvé a
  preparar. Hasta cancelarlo no se puede preparar otro para esa venta.
- **Aprobado pero "no se pudo confirmar"**: botón **"Reintentar la
  confirmación"**. Nunca se crea un pedido duplicado: si Vitolen ya lo tomó,
  el robot lee el nº y listo.
- Un pedido **ya confirmado** no se cancela desde el sistema: se habla con
  Vitolen (03492‑434037).
