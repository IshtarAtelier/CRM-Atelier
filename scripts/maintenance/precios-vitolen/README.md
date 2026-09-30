# Lista de precios de Vitolen (Hoya + Pentax)

Vitolen es el distribuidor de Hoya y Pentax. En el sistema el laboratorio se
llama **`VITOLEN`** (`Product.laboratory`), con su fila en Configuración →
Laboratorios para el calibrado y el IVA.

## `hoya-pentax-L96-sep-2026.json`

La lista **L96 - V28 - ARG 09/2026**, transcrita del PDF
`LISTA_DE_PRECIOS_HOYA_PENTAX_96-original.pdf` (6 páginas): 118 renglones con
precio, y para cada uno el rango (pág. 6) y el código de producto (pág. 5).

| Página | Qué trae |
|---|---|
| 2 | Progresivos Hoya: Lifestyle 4, Array 2, Summit, Argos y Mi Primer Hoya (Array 2 / Summit) |
| 3 | Ocupacional Tact, monofocales Nulux, Sync III y Visión Simple (sin AR / con AR), y los dos terminados |
| 4 | Pentax: Allfocus Pro, Allfocus Flex y Pentax Office |
| 5 | Códigos de producto |
| 6 | Rangos disponibles y marcas de agua |

Los precios son **por par, sin IVA y de lista**. Mi Primer Hoya es el único que
la lista declara como "precio final neto ya bonificado"; de los demás no se
sabe todavía qué descuento viene en la factura.

### Cómo se verificó

Cada precio, código y rango se comparó fila por fila contra el texto del PDF
(336 datos, 0 diferencias) y la columna de cada precio se miró contra la
imagen de la página. Controles de coherencia que tienen que seguir dando bien
con una lista nueva: Array > Summit > Argos > Mi Primer Hoya en cada material,
Sync > Nulux, y Visión Simple con AR = sin AR + $41.500.

### Lo que la lista deja sin resolver

- **Visión Simple 1.59 Polarized** tiene precio en la página 3 pero no figura
  en códigos ni en rangos. Está en el JSON marcado `aConfirmar` y no se carga.
- **Array Wrap** tiene códigos y rangos, pero la página de precios no trae su
  columna. No se carga.
- **Los dos terminados** (Hoya 1.50 Clear + Super Hi-Vision, $26.800, y Pentax
  Asférico 1.60 Sensity Grey + Innocare, $93.700) vienen "con pegatinas para
  su calibrado", o sea sin calibrar. Hasta saber si Vitolen cobra el calibrado
  y quién lo hace, están marcados `aConfirmar` y no se cargan (Ishtar, 30/9/2026).
- **Mi Primer Hoya** no tiene rangos propios en la lista: se le copian los de
  Array 2 y Summit del mismo material, porque son esos diseños (marca de agua
  AA / Y). La adición sí es propia: 0.75 a 1.75.
- **Pentax** no trae rangos: quedan vacíos.

## `subir-catalogo-vitolen.mjs`

Da de alta los cristales. Costo = (lista + calibrado) × (1 + IVA), con el
calibrado y el IVA leídos de la fila `VITOLEN` de la base de destino. Precio =
costo × 2,50. Por defecto es un ensayo contra la base local.

```bash
node scripts/maintenance/precios-vitolen/subir-catalogo-vitolen.mjs
```

Solo da de alta lo que falta (compara por nombre dentro de VITOLEN), firma cada
alta en el AuditLog y no toca lo ya cargado. Todos entran con `is2x1` apagado y
sin publicar en la web.

Variantes que comparten precio van en UNA ficha, con las variantes en el
modelo: Lifestyle 4 (Urban / Indoor / Outdoor), Tact (40 / 60), Sync III
(5 / 9 / 13) y Pentax Office (DP40 / SP60).

## Decisiones que faltan antes de producción

1. **Calibrado e IVA de Vitolen:** $23.000 y 21%, confirmados por Ishtar el
   30/9/2026 (igual que Optovisión).
2. **Promos del laboratorio.** Hoya regala el segundo par en Lifestyle, Array,
   Summit y Argos; Pentax da 80% en el segundo par. Por ahora todo se sube SIN
   2x1 (Ishtar, 30/9/2026); cuando lleguen las bases, se decide si esas cuatro
   líneas se marcan `is2x1` como los Varilux.
3. **Terminados:** fuera de la carga hasta averiguar el calibrado (ver arriba).

## Lo que el sistema todavía no hace para este laboratorio

- El cruce de facturas (`lab-recon`) solo conoce Optovisión y Grupo Óptico: lo
  que facture Vitolen no se compara contra el costo cargado.
- El seguimiento automático de pedidos (SmartLab) es de Grupo Óptico.

## Cuando llegue una lista nueva

Copiar el JSON a `hoya-pentax-L<nº>-<mes>-<año>.json` y transcribir la nueva.
No pisar el archivo viejo: comparar dos listas es la única forma de medir el
aumento real.
