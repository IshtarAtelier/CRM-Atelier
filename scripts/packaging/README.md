# Packaging impreso

Generadores de piezas físicas: troquel + arte listos para llevar a la imprenta.

## Caja de anteojos

```bash
node scripts/packaging/caja-anteojos.mjs
```

Caja plegadiza de **20 × 10 × 10 cm** (largo × ancho × alto). Deja en `salida/`:

| Archivo | Para qué |
|---|---|
| `...-arte.pdf` | Lo que se imprime. Escala 1:1, 3 mm de sangrado. Es el archivo que va a la imprenta. |
| `...-troquel.pdf` | Solo corte y hendido + la ficha técnica (material, gramaje, terminación). Para el troquelador. |
| `...-preview.png` | El desarrollo con las líneas encima, para revisarlo de un vistazo. |
| `...-mockup.png` | La caja armada. Es el que se manda a aprobar. |

Opciones:

```bash
node scripts/packaging/caja-anteojos.mjs --tema oscuro
node scripts/packaging/caja-anteojos.mjs --largo 180 --ancho 90 --alto 90
```

`salida/` está gitigneada: son archivos generados y pesan. Se regeneran corriendo
el script.

## Reglas

- **Los colores salen de `globals.css`** (vía `scripts/social/identidad.mjs`),
  igual que las piezas de redes. No se escribe un color dentro del script.
- **Los datos de contacto se leen de `src/lib/business-info.ts`.** Una dirección
  vieja en una caja no se corrige con un deploy: se tira la tirada.
- **Lo que dice la caja está en la constante `TEXTOS`**, arriba de todo. Para
  cambiar el texto se toca eso y se vuelve a correr, no se edita un PDF.
- **La caja se declara, el troquel se calcula.** Cambiar `--largo` recalcula
  solapas, uñas, ranuras y sangrado. Ningún milímetro está dibujado a mano.
- **Texto chico siempre en tinta oscura.** El bronce sobre crema da 3,5:1: sirve
  para filetes e íconos, no para datos que hay que leer.

## Antes de mandar a imprimir

1. Abrir el `arte.pdf` al 100% y verificar que la dirección y el teléfono son los
   de hoy.
2. Confirmar con la imprenta el gramaje: 300 g alcanza para la caja sola, 350 g
   si adentro va un estuche rígido.
3. Pedir **prueba de color impresa** antes de la tirada. El crema `#faf8f5` sobre
   cartulina sin recubrir levanta más amarillo que en pantalla.
4. El logo se aplica desde un PNG de 2337 px (~200 mm a 300 dpi). Si la imprenta
   pide vectores, hay que pedirle el `.ai`/`.svg` original a quien hizo la marca:
   en el repo no está.
