/**
 * El HTML animado de un reel: 1080x1920, en loop perfecto.
 *
 * POR QUÉ EL LOOP TIENE QUE CERRAR EXACTO
 * Un reel se repite solo. Si el último frame no empalma con el primero, se ve
 * un salto cada vuelta y no hay forma de disimularlo. Por eso la animación se
 * define con una duración fija (`DURACION_MS`) y cada escena calcula su
 * posición a partir del tiempo transcurrido — nada de `animation` de CSS con
 * duraciones distintas, que desincronizan y el corte cae en cualquier lado.
 *
 * CÓMO SE ANIMA
 * No se usan animaciones de CSS: el script de captura avanza un reloj
 * (`window.__t`) y pide un frame. Así el video no depende de la velocidad real
 * de la máquina — grabar 30 fps "en vivo" produce frames repetidos y saltos
 * cuando el navegador se atrasa. Acá cada frame se dibuja en su tiempo exacto.
 *
 * Los colores y la tipografía salen de `identidad.mjs`, o sea de globals.css,
 * como el resto del sistema.
 */

/** Duración del loop. 6 s es lo que aguanta un reel sin contenido nuevo. */
// 9 s: eran 6 cuando el reel era mudo. Con voz hacen falta ~7 s de narración
// y 2.2 s para el cierre con logo, igual que las plantillas educativas.
export const DURACION_MS = 9000;
export const OUTRO_MS = 2200;
export const FPS = 30;

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
));

/** Convierte "texto *resaltado*" en HTML con la marca. */
const resaltar = (t) => esc(t).replace(/\*([^*]+)\*/g, '<span class="marca">$1</span>');

/**
 * @param {object} reel   definición declarativa (ver contenido/reels/*.json)
 * @param {object} id     identidad de marca
 * @param {string} fondoUri  data URI de la foto de fondo
 * @param {string} logoUri   data URI del logo
 */
export function htmlDeReel(reel, id, fondoUri, logoUri) {
    const oscuro = reel.theme !== 'light';
    const fondo = oscuro ? id.oscuro : id.colores.fondo;
    const texto = oscuro ? '#ffffff' : id.colores.texto;

    const escenas = (reel.escenas || []).map((e, i) => `
      <div class="escena" data-i="${i}">
        ${e.rotulo ? `<p class="rotulo">${resaltar(e.rotulo)}</p>` : ''}
        ${e.titulo ? `<h1>${resaltar(e.titulo)}</h1>` : ''}
        ${e.dato ? `<p class="dato">${esc(e.dato)}</p>` : ''}
        ${e.pie ? `<p class="cuerpo">${resaltar(e.pie)}</p>` : ''}
      </div>`).join('');

    return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${id.googleFonts}" rel="stylesheet">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    width:1080px; height:1920px; background:${fondo}; color:${texto};
    font-family:${id.fuentes.texto}; position:relative; overflow:hidden;
    -webkit-font-smoothing:antialiased;
  }

  /* La foto hace un zoom lentísimo de ida y vuelta. Va y VUELVE al mismo punto:
     si solo se acercara, el corte del loop sería un salto de escala. */
  .foto {
    position:absolute; inset:-6%;
    background-image:url('${fondoUri}');
    background-size:cover; background-position:center;
    will-change:transform;
  }
  .velo {
    position:absolute; inset:0;
    background:linear-gradient(180deg,
      ${oscuro ? 'rgba(42,33,28,.55)' : 'rgba(250,248,245,.62)'} 0%,
      ${oscuro ? 'rgba(42,33,28,.86)' : 'rgba(250,248,245,.92)'} 55%,
      ${oscuro ? 'rgba(42,33,28,.96)' : 'rgba(250,248,245,.97)'} 100%);
  }

  .escenario { position:absolute; inset:0; padding:150px 96px 420px;
               display:flex; flex-direction:column; justify-content:center; }
  .escena { position:absolute; left:96px; right:96px; opacity:0; will-change:opacity,transform; }

  .rotulo { font-size:40px; font-weight:700; letter-spacing:-.01em; opacity:.88; margin-bottom:22px; }
  h1 { font-size:96px; line-height:1.05; font-weight:900; letter-spacing:-.025em; }
  .dato { font-size:150px; font-weight:900; letter-spacing:-.03em; line-height:1;
          margin-top:26px; color:${id.colores.marca}; }
  .cuerpo { margin-top:34px; font-size:42px; line-height:1.35; font-weight:400; opacity:.9; }
  .marca { color:${id.colores.marca}; }

  .pie { position:absolute; left:96px; right:96px; bottom:380px;
         display:flex; align-items:center; gap:22px; }
  .logo { height:60px; ${oscuro ? 'filter:brightness(0) invert(1);' : ''} opacity:.95; }
  .handle { font-size:30px; font-weight:500; letter-spacing:.06em; opacity:.72; }

  /* Barra de progreso del loop: da sensación de que algo avanza, que es lo que
     retiene en los primeros segundos. */
  .barra { position:absolute; left:0; top:0; height:8px; background:${id.colores.marca}; width:0; }
  #outro { position:absolute; inset:0; display:flex; flex-direction:column;
           align-items:center; justify-content:center; gap:44px; opacity:0;
           background:radial-gradient(120% 90% at 50% 46%, #33281f 0%, #211a15 62%, #171310 100%); }
  #outro img { height:150px; filter:brightness(0) invert(1); }
  #outro .linea { height:4px; width:0; background:${id.colores.marca}; border-radius:2px; }
  #outro .h { font-size:34px; letter-spacing:.14em; opacity:.75; }
</style></head>
<body>
  <div class="foto" id="foto"></div>
  <div class="velo"></div>
  <div class="barra" id="barra"></div>
  <div class="escenario">${escenas}</div>
  <div class="pie" id="pie">
    <img class="logo" src="${logoUri}" alt="">
    <span class="handle">${esc(id.handle)}</span>
  </div>

  <div id="outro">
    <img src="${logoUri}" alt="">
    <div class="linea" id="outroLinea"></div>
    <div class="h">${esc(id.handle)}</div>
  </div>

<script>
  const DUR = ${DURACION_MS};
  const escenas = [...document.querySelectorAll('.escena')];
  const foto = document.getElementById('foto');
  const barra = document.getElementById('barra');

  // Suavizado: entra y sale sin tirones. Es la misma curva que usa el CSS de
  // la web (ease-in-out), escrita a mano para poder evaluarla en un tiempo dado.
  const suave = (x) => x < .5 ? 4*x*x*x : 1 - Math.pow(-2*x + 2, 3) / 2;

  /**
   * Dibuja el frame correspondiente al milisegundo \`t\` del loop.
   * La llama el script de captura para cada frame; no hay requestAnimationFrame
   * porque el video no debe depender de la velocidad de la máquina.
   */
  const OUTRO = ${OUTRO_MS};
  window.__dibujar = function (t) {
    const tl = t % DUR;
    // Las escenas se reparten lo que queda despues del outro del logo
    const p = Math.min(1, tl / (DUR - OUTRO));
    const n = escenas.length;
    const porEscena = 1 / n;

    const fOutro = suave(Math.max(0, Math.min(1, (tl - (DUR - OUTRO - 50)) / 500)))
                 * suave(Math.max(0, Math.min(1, (DUR - 120 - tl) / 400)));
    const o = document.getElementById('outro');
    o.style.opacity = fOutro;
    o.style.transform = 'scale(' + (0.94 + 0.06 * suave(Math.max(0, Math.min(1, (tl - (DUR - OUTRO)) / 900)))) + ')';
    document.getElementById('outroLinea').style.width =
        (suave(Math.max(0, Math.min(1, (tl - (DUR - OUTRO + 500)) / 800))) * 260) + 'px';
    document.getElementById('pie').style.opacity = String(1 - fOutro);

    escenas.forEach((el, i) => {
      const inicio = i * porEscena;
      let local = (p - inicio) / porEscena;  // 0..1 dentro de su turno
      let op = 0, dy = 40;
      if (local >= 0 && local <= 1) {
        // Entra en el primer 18%, se queda, y sale en el último 18%.
        const ent = Math.min(1, local / .18);
        const sal = Math.min(1, (1 - local) / .18);
        op = Math.min(suave(ent), suave(sal));
        dy = (1 - suave(ent)) * 40;
      }
      el.style.opacity = op;
      el.style.transform = 'translateY(' + dy + 'px)';
    });

    // Zoom de ida y vuelta: en la mitad del loop está en el máximo y vuelve,
    // así el primer y el último frame tienen exactamente la misma escala.
    const vaivén = Math.sin(p * Math.PI);
    foto.style.transform = 'scale(' + (1 + .06 * vaivén) + ')';

    barra.style.width = (p * 100) + '%';
  };

  window.__dibujar(0);
</script>
</body></html>`;
}
