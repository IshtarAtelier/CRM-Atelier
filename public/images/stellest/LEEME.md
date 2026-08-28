# Imágenes de Stellest

Gráficas oficiales de Essilor para Stellest (control de la progresión de la
miopía), descargadas de essilor.com/ar-es. Son 900×1600 y traen impresos el
logotipo **Stellest** arriba y el copy de Essilor abajo ("Una constelación de
lentes invisibles*" / "*Acabado estético").

| Archivo | Qué es |
|---|---|
| `stellest-1.jpeg` | Corte del cristal con los rótulos de corrección y control. Lleva una varilla Ray-Ban visible. |
| `stellest-2.jpeg` | Frente del armazón con la sombra de anillos concéntricos. **Original de Essilor.** |
| `stellest-3.jpeg` | Tres cuartos, con las dos sombras de anillos bien visibles. **Original de Essilor.** |
| `stellest-2-cristal.jpeg` | Recorte mecánico de `stellest-2` (banda 21%–67% del alto). |
| `stellest-3-cristal.jpeg` | Recorte mecánico de `stellest-3` (misma banda). |

## Por qué existen los `-cristal`

Las piezas de redes se declaran en JSON y las dibuja `scripts/social/render.mjs`,
que superpone nuestro texto y el pie de Atelier sobre la foto. Con los originales,
**la tipografía de Essilor queda por debajo de la nuestra**: el logotipo Stellest
sale cortado arriba y su copy aparece fantasmeado atrás del logo de Atelier. Se vio
en el 9:16 y en el 1.91:1, donde el encuadre muestra la imagen casi entera.

Los `-cristal` son un recorte a la banda que **no tiene ninguna tipografía**: solo
el armazón y la sombra de anillos concéntricos, que es justo lo que ilustra la
tecnología H.A.L.T. No es un retoque ni un rediseño — es `sharp().extract()` sobre
el original, sin tocar color, escala ni contenido. Los originales quedan intactos.

**Las piezas de redes usan los `-cristal`.** Si hace falta una imagen nueva de
Stellest, recortar igual (banda 21%–67% del alto) antes de usarla a sangre.
