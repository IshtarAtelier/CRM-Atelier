# Fotos de sesión → fotos para la tienda y stories

Lleva las fotos de una sesión con modelo (originales de 4032×6048 exportados de
Lightroom) a las fotos de la ficha de la tienda (1200×1200 WebP) y a stories de
Instagram (1080×1920). Lo armamos el 15-16/10/2026 con la sesión de **Massaru**.
Los criterios los fue fijando Ishtar sobre muestras, y tres rondas de auditores
revisaron foto por foto. **No los cambies sin mostrarle antes.**

Escribe archivos, no la base. Las fotos se vinculan a las fichas con
`scripts/maintenance/vincular-fotos-look.mjs --sesion <nombre> --hover`.

## Archivos

| Archivo | Qué hace |
|---|---|
| `analizar.swift` | Corre Vision (macOS) sobre cada foto y devuelve la cara, los rasgos (ojos, cejas, nariz, labios), las manos, el tope del pelo y la máscara de la persona. Se compila con `swiftc -O -o analizar analizar.swift`. |
| `editar.mjs` | La edición. Con `MEDIO=1 FUERZA_SOMBRA=0.5` da la foto de tienda. Con `STORY=1` da además la franja 9:16 para stories; con `STORY=1 CUADRADO=1`, también el cuadrado entero de 1920 (`<n>-cuadrado.jpg`), que es lo que leen los carruseles 4:5 del feed (`scripts/social/generar-feed-modelos.mjs`). |
| `especiales.mjs` | Recorte a mano para las fotos sin cara utilizable (anteojo en la mano, cuerpo entero). No cambia el fondo; corrige el granito con coordenadas a mano. |
| `armar.mjs` | Copia las fotos con el nombre del producto (`<producto>-<sesión>-<n>.webp`) y arma las láminas de auditoría (original \| editada \| ficha). |
| `massaru/` | Los datos de la sesión Massaru: `mapa.json` (qué foto es qué armazón, por claqueta y hora EXIF), `usables.json` y `especiales.json`. |

## Criterios de edición (los que pidió Ishtar)

- **Encuadre.** Cabeza casi entera, con orejas y nuca; del pelo se recorta solo la puntita. El mentón entra siempre, con aire. El anteojo nunca se corta.
- **Luz.** Cálida en la piel, suave en el resto, así el armazón conserva su color real. El lado en sombra se ilumina con un relleno solo sobre la piel, con el lado iluminado como ejemplo. El tono de piel se iguala en toda la serie.
- **Sombras del anteojo sobre la cara.** Se suavizan A LA MITAD. Borrarlas del todo deja la piel "muy irreal".
- **Imperfecciones.** Solo el granito de la frente, con pincel corrector. Los lunares no se tocan.
- **Fondo.** Blanco cálido (238, 236, 232). Se conserva el detalle fino y oscuro que se ve a través de los cristales al aire (logo KAZWINI, contorno del cristal).

## Trampas que costaron una ronda de auditoría cada una

- **Máscara de Vision.** Viene en 3:4: se estira (`fit: 'fill'`) o deja un halo.
- **Pesos duros.** Un peso por píxel (piel sí o no) deja manchas tipo "leopardo" en el cuello y la barba. Los pesos son siempre suaves.
- **Cristales de sol.** Una caja dura para proteger los cristales dejaba un rectángulo de luz en la mejilla. La protección es por luz, esfumada.
- **Pelo rapado.** El degradé deja ver piel entre los pelitos, y el relleno lo volvía una "calvicie". Ahí lo frena la densidad de pelo.
- **Valores intermedios.** Pueden pasar de 255 (el tope va al final). Todo buffer de 8 bits se guarda escalado ×0,65.
- **Rasgos mal ubicados.** Con anteojos grandes, Vision ubica mal los labios. Solo se les cree si miden más de 0,22 del ancho de la cara; si no, el mentón sale de la proporción de la cabeza.

## Cómo se corrió con Massaru (16/10/2026)

```
swiftc -O -o /tmp/analizar scripts/maintenance/fotos-sesion/analizar.swift
/tmp/analizar <mascaras> <fotos...> > analisis.json
MEDIO=1 FUERZA_SOMBRA=0.5 [SOL=1] node scripts/maintenance/fotos-sesion/editar.mjs <originales> <mascaras> analisis.json <salida> <números...>
STORY=1 MEDIO=1 FUERZA_SOMBRA=0.5 [SOL=1] node ... (lo mismo, para las stories)
STORY=1 CUADRADO=1 AIRE_STORY=0.12 MEDIO=1 FUERZA_SOMBRA=0.5 [SOL=1] node ... (lo mismo + el cuadrado de 1920 para el feed, con más aire arriba;
   el 16/10/2026 se dejaron en "Contenido de Atelier/Sesión Massaru - oct 2026 (cuadrados editados)")
node scripts/maintenance/fotos-sesion/especiales.mjs <originales> <salida> scripts/maintenance/fotos-sesion/massaru/especiales.json
```

`SOL=1` para los anteojos de sol: protege lo que se ve a través del cristal.
