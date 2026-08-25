# Lista de precios de Optovisión (Essilor)

Qué hay acá y para qué sirve.

## `varilux-agosto-2026.json`

La lista del laboratorio del **3/8/2026**, transcrita del PDF
`Lista de Precios Optovision - 03 de Agosto 2026.pdf`: los **8 diseños Varilux**
con sus 62 combinaciones de material × tratamiento, más los **Crizal**.

**Por qué está transcrito a mano y no extraído a máquina.** En el PDF los
precios están repartidos en cuatro páginas (5, 6, 7 y 8) y el nombre de cada
diseño —Varilux XR pro, XR design, Physio 3.0, Comfort Max, Liberty 3.0,
Digitime, Physio, Comfort— está puesto como **logo, no como texto**. Extraerlo
con `pdftotext` devuelve tablas de precios sin dueño: los números salen bien,
pero no se sabe de qué diseño son. Cada número de este archivo se verificó
contra el texto extraído del PDF **y** contra la imagen de la página.

## 🔴 Estos números NO son el costo final

- Son precios de **LISTA** y **SIN IVA**.
- En la factura, Optovisión aplica **descuentos** — en la 3008-00062896 se
  vieron 15%, 20% y 23,5% según el renglón — y recién después suma el IVA.
- El costo real de un par **sale de la factura**, no de esta lista. Cargar la
  lista como costo infla el costo y ensucia todo el cruce de sobrecostos.

## Los Crizal son dos cosas distintas

- **Tratamiento RX**: lo que cuesta agregarle Crizal a una lente que se fabrica
  a medida. En la factura va como **renglón aparte** de la lente
  (`TRA_TRA_FUV_UNI`).
- **Lente de stock con Crizal**: ya viene con el tratamiento puesto. Es una
  **lente entera**, no un tratamiento — no se suma a la de arriba.

## `cuadro-varilux.mjs`

Arma un HTML con todo junto, para mirarlo de una. No toca la base ni la red.

```bash
node scripts/maintenance/precios-optovision/cuadro-varilux.mjs salida.html
```

## Cuando llegue una lista nueva

Copiar el JSON a `varilux-<mes>-<año>.json` y transcribir la nueva. **No pisar
el archivo viejo**: comparar dos listas es la única forma de saber cuánto
aumentó el laboratorio de verdad.
