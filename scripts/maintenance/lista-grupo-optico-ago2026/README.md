# Lista Grupo Óptico — Agosto 2026

Carga de familias de cristales de la lista del 10/8/2026 (el ordenado completo
vive en `~/Downloads/Lista_Cristales_Grupo_Optico_Agosto_2026.xlsx`, 8 hojas).
Los dos scripts pegan contra la base de PRODUCCIÓN (`PROD_DATABASE_URL`) y
tienen dry-run por defecto; `--aplicar` para escribir.

## Hecho el 27/8/2026 — familia Bifocal Kriptock Invisible (17 cristales)

- `alta-bifocales-invisibles.mjs`: alta inicial (quedó con el costo pelado).
- `corregir-bifocales-invisibles.mjs`: la corrección definitiva — regla de la
  casa `costo final = pelado + calibrado del lab` (Grupo Óptico: $7.000, IVA 0),
  `baseCost` = pelado, precio = costo final × **2,9418** (markup de Ishtar:
  fotocromático gris $105.715 → $311.000 exacto), redondeo al millar.

Para cargar otra familia de la lista: copiar `alta-...` como plantilla,
cambiar el array `familia` (nombres + pelados del xlsx), definir el precio de
referencia con Ishtar y usar el patrón de `corregir-...` (calibrado incluido
desde el arranque).

## Correcciones del 27/8 (misma tarde)

La carga inicial quedó a medias y se completó en producción con: marca
"Kriptock Invisible", rangos de graduación (orgánico Esf +5,50/−4,00 Cil ±4;
policarbonato Esf +6,50/−5,00 Cil ±6; ADD 0,75–3,50) y el par
baseCost/cost con calibrado. El `alta-...` ya refleja la ficha completa.
**Checklist para futuras familias**: nombre con familia y material · marca ·
categoría/tipo · laboratorio · índice · unitType PAR · baseCost (pelado) ·
cost (pelado+calibrado×IVA) · precio (markup acordado con Ishtar) · rangos
Esf/Cil/ADD de la lista. Nada de campos vacíos.
