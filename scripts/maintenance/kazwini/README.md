# Carga de armazones Kazwini

Un JSON por armazón (una ficha por color, como pide la tienda). Lo aplica
`scripts/maintenance/cargar-armazon-kazwini.mjs`, que pasa por la API del dev
server con sesión de admin — nunca por prisma directo para el producto ni la
ficha.

```
node --env-file=.env scripts/maintenance/cargar-armazon-kazwini.mjs scripts/maintenance/kazwini/<spec>.json            # simula
node --env-file=.env scripts/maintenance/cargar-armazon-kazwini.mjs scripts/maintenance/kazwini/<spec>.json --aplicar  # escribe
```

De dónde sale cada dato:
- `model`: código Kazwini + color, con espacio (`1111 C3`), como Teseo/Rhea.
  Es la clave para detectar recompras: el script no carga si ya existe.
- Medidas y foto: del portal https://www.kazwiniopticalgroup.com/shop (buscador
  por código; la foto por color sale del swatch `alt="C3"`,
  `/storage/product/<hash>.avif`). La foto se copia a
  `public/assets/products/<material>/<codigo>-<color>-<material>.avif` (+ .webp),
  lado largo 2000 px (`achicar-fotos-producto.mjs`).
- Precio/costo/mayorista: los de los hermanos del mismo catálogo
  (titanio/metal Kazwini hoy: 160.000 / 15.000 / 32.000).
- `seoTags`: "<Forma>, <Material>" con una forma de `src/lib/catalog/forma-armazon.ts`.

| spec | pedido | modelo | nombre |
|---|---|---|---|
| cratos-1111-c3.json | PED-003510 | 1111 C3 · Titanium montura al aire | Cratos |
| mercurio-tg2808-c4.json | PED-003510 | TG2808 C4 · Kazwini Titanium (semi al aire) | Mercurio |
| neptuno-gt9615-c1.json | PED-003516 | GT9615 C1 · Titanium diseño femenino | Neptuno |
| semele-c3-tl5213-c3.json | PED-003512 | TL5213 C3 · Metal inoxidable premium (color nuevo de Semele = C4) | Semele C3 |
