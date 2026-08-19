# Limpieza de etiquetas (19/8/2026)

## Qué pasó

La herramienta `addTagToClient` del bot (`wa-service/tools.js`) hacía un `upsert`:
la IA mandaba cualquier texto y la etiqueta nacía. El 19/8 la base de producción
tenía **407 etiquetas**, de las cuales ~330 colgaban de **un solo cliente** y eran
la descripción de una charla, no una categoría:

    Armazones - Cat Eye, Acetato
    Anteojos (miopía y astigmatismo), Lentes de Contacto
    Armazones Metálicos Económicos + Chequeo Visual
    Lentes con IA, Fotocromatico Blue, Antireflex, Filtro Azul

Además el mismo concepto vivía partido en variantes que dividían el dato:
`Multifocal` (353) · `Multifocales` (178) · `Lentes Multifocales` (28), o
`visita showroom ` con un espacio al final conviviendo con `visita showroom`.

## Qué se hizo

- `scripts/checks/etiquetas-inventario.check.mjs` — inventario (SOLO LEE).
  Deduce el origen de cada etiqueta cruzando los literales del código, el
  `AuditLog` de creación y el resto.
- `limpiar-etiquetas.mjs` — fusiona variantes y borra la cola inventada.
  Dry-run por defecto; `--apply` para escribir. Guarda `respaldo-prod.json`
  (qué cliente tenía qué) **antes** de tocar nada.

**Fusionar no es borrar**: los clientes de un alias se conectan a la etiqueta
canónica y recién cuando no le cuelga nadie se borra la fila.

Resultado en producción: **407 → 44 etiquetas**. Ningún cliente perdió su marca.

## Por qué no vuelve a pasar

`addTagToClient` ya no crea nada: busca la etiqueta y si no existe, no hace nada
y le avisa a la IA que el catálogo es cerrado. **Crear etiquetas es del equipo,
desde el panel** — el único camino que además firma quién la creó en el `AuditLog`.

## El respaldo

`respaldo-prod.json` está gitignoreado: son IDs de clientes de producción y no
van al repo. Vive en la máquina donde se corrió. Para revertir, se recorre el
JSON reconectando cada cliente a su etiqueta.
