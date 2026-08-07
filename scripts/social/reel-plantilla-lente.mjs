/**
 * Plantilla de reel educativo: la LENTE de frente, con sus zonas animadas.
 *
 * Es la serie hermana de la del ojo: aquella muestra el problema (dónde cae el
 * foco), esta muestra la lente que lo resuelve. Tres tipos:
 *
 *   monofocal   toda la superficie con una graduación — una distancia
 *   bifocal     la ventana de cerca con su línea visible — y el salto de
 *               imagen al cruzarla, que es el defecto que la jubiló
 *   progresivo  lejos/intermedio/cerca en gradiente continuo, sin líneas
 *
 * El recurso central es una MIRADA que baja por la lente (una línea de
 * exploración con su punto): en el bifocal la imagen SALTA al cruzar la línea;
 * en el progresivo baja fluida. Ese contraste es el argumento de venta del
 * progresivo, contado sin decirlo.
 *
 * Misma vuelta cinematográfica que la plantilla del ojo v2: viñeta, fondo con
 * profundidad, push-in, textos con fade+rise y CIERRE CON LOGO.
 *
 * Recordatorio para quien edite: nada de backticks en los comentarios dentro
 * del template — cortan el string en silencio. Ya pasó tres veces.
 */

export const DURACION_LENTE_MS = 14000;

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
));
const resaltar = (t) => esc(t).replace(/\*([^*]+)\*/g, '<span class="marca">$1</span>');

const TIPOS = {
    monofocal: {
        titulo: 'La lente *monofocal*',
        bajada: 'Una sola graduación, una distancia perfecta.',
        explica: 'Toda la superficie con *una graduación*',
        explica2: 'Elegís la distancia: lejos, o cerca. Y esa distancia se ve perfecta.',
        remate: 'Simple y *nítida*',
        remate2: 'Ideal si tu receta es de una sola distancia.',
        cierre: '¿Es la tuya? *Se mide*',
        cierre2: 'Atelier Óptica · Cerro de las Rosas. Sin turno previo.',
    },
    bifocal: {
        titulo: 'La lente *bifocal*',
        bajada: 'Dos zonas, una línea... y un salto.',
        explica: 'Una ventana de cerca, *con línea visible*',
        explica2: 'Arriba lejos, abajo cerca. Dos graduaciones separadas.',
        remate: 'Al cruzar la línea, la imagen *salta*',
        remate2: 'Cumplió su época: hoy el progresivo hace lo mismo, sin el salto.',
        cierre: 'Hay algo *mejor*',
        cierre2: 'Preguntanos por los progresivos. Atelier Óptica · Cerro de las Rosas.',
    },
    progresivo: {
        titulo: 'La lente *progresiva*',
        bajada: 'Todas tus distancias, en un solo cristal.',
        explica: 'Lejos, intermedio y cerca *en gradiente*',
        explica2: 'La graduación cambia de forma continua a lo largo de la lente.',
        remate: 'Sin líneas, *sin saltos*',
        remate2: 'La mirada baja y la distancia acompaña. Bien medido, no se nota el pasaje.',
        cierre: 'Bien medido *es la clave*',
        cierre2: 'Medimos con tu armazón puesto. Atelier Óptica · Cerro de las Rosas.',
    },
};

export function htmlDeReelLente(reel, id, logoUri) {
    const tipo = TIPOS[reel.tipoLente];
    if (!tipo) {
        throw new Error(`Tipo de lente desconocido: "${reel.tipoLente}". Hay: ${Object.keys(TIPOS).join(', ')}.`);
    }
    const fondo = id.oscuro;
    const bronce = id.colores.marca;

    return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${id.googleFonts}" rel="stylesheet">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:1080px; height:1920px; color:#fff;
         background:radial-gradient(120% 90% at 50% 38%, #3a2e27 0%, ${fondo} 58%, #1c1613 100%);
         font-family:${id.fuentes.texto}; position:relative; overflow:hidden;
         -webkit-font-smoothing:antialiased; }
  .vineta { position:absolute; inset:0; pointer-events:none;
            background:radial-gradient(140% 110% at 50% 45%, transparent 55%, rgba(0,0,0,.42) 100%); }
  .fase { position:absolute; left:88px; right:88px; opacity:0; }
  #titulo { top:300px; }
  #titulo h1 { font-size:104px; line-height:1.06; font-weight:900; letter-spacing:-.025em; }
  #titulo p  { margin-top:30px; font-size:42px; opacity:.85; }
  .texto { top:1330px; }
  .texto h2 { font-size:58px; line-height:1.12; font-weight:900; letter-spacing:-.02em; }
  .texto p  { margin-top:22px; font-size:38px; line-height:1.35; opacity:.88; }
  #cierre { top:1330px; }
  #cierre h2 { font-size:74px; line-height:1.08; font-weight:900; letter-spacing:-.02em; }
  #cierre p { margin-top:24px; font-size:36px; line-height:1.35; opacity:.85; }
  .marca { color:${bronce}; }
  #lienzo { position:absolute; top:440px; left:0; width:1080px; height:860px; }
  .pie { position:absolute; left:88px; right:88px; bottom:110px;
         display:flex; align-items:center; gap:22px; }
  .logo { height:60px; filter:brightness(0) invert(1); opacity:.95; }
  .handle { font-size:30px; font-weight:500; letter-spacing:.06em; opacity:.72; }
  .barra { position:absolute; left:0; top:0; height:8px; background:${bronce}; width:0; }
  #outro { position:absolute; inset:0; display:flex; flex-direction:column;
           align-items:center; justify-content:center; gap:44px; opacity:0;
           background:radial-gradient(120% 90% at 50% 46%, #33281f 0%, #211a15 62%, #171310 100%); }
  #outro img { height:150px; filter:brightness(0) invert(1); }
  #outro .linea { height:4px; width:0; background:${bronce}; border-radius:2px; }
  #outro .h { font-size:34px; letter-spacing:.14em; opacity:.75; }
</style></head>
<body>
  <div class="barra" id="barra"></div>

  <div class="fase" id="titulo">
    <h1>${resaltar(tipo.titulo)}</h1>
    <p>${esc(tipo.bajada)}</p>
  </div>

  <div id="lienzo"><svg id="escena" viewBox="0 0 1080 860" fill="none">
    <defs>
      <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="7"/>
      </filter>
      <clipPath id="clipLente"><ellipse cx="500" cy="420" rx="300" ry="330"/></clipPath>
      <linearGradient id="gradProgresivo" x1="0" y1="90" x2="0" y2="750" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="${bronce}" stop-opacity=".10"/>
        <stop offset=".5" stop-color="${bronce}" stop-opacity=".26"/>
        <stop offset="1" stop-color="${bronce}" stop-opacity=".48"/>
      </linearGradient>
    </defs>

    <ellipse cx="500" cy="420" rx="300" ry="330" stroke="#ffffff" stroke-width="6" opacity=".9"/>
    <ellipse cx="500" cy="420" rx="300" ry="330" fill="#ffffff" opacity=".04"/>

    <g clip-path="url(#clipLente)">
      <rect id="zonaUniforme" x="200" y="90" width="600" height="660" fill="${bronce}" opacity="0"/>
      <rect id="zonaGradiente" x="200" y="90" width="600" height="660" fill="url(#gradProgresivo)" opacity="0"/>
      <path id="ventanaCerca" d="M 340 560 A 175 175 0 0 0 660 560 L 340 560 Z" fill="${bronce}" opacity="0"/>
      <line id="lineaBifocal" x1="340" y1="560" x2="660" y2="560" stroke="#ffffff" stroke-width="6" opacity="0"/>
    </g>

    <!-- Las etiquetas van a la IZQUIERDA: a la derecha vive la tarjeta de
         vista y se pisaban (INTERMEDIO quedaba abajo de la tarjeta). -->
    <g id="etiquetas" font-family="sans-serif" font-size="26" fill="#ffffff">
      <text id="etq1" x="46" y="205" opacity="0">LEJOS</text>
      <text id="etq2" x="46" y="435" opacity="0">INTERMEDIO</text>
      <text id="etq3" x="46" y="665" opacity="0">CERCA</text>
    </g>

    <line id="mirada" x1="220" x2="780" y1="240" y2="240" stroke="${bronce}" stroke-width="4" opacity="0"/>
    <circle id="miradaPunto" cx="500" r="13" fill="${bronce}" opacity="0"/>
    <circle id="miradaHalo" cx="500" r="28" fill="${bronce}" opacity="0" filter="url(#glow)"/>

    <g id="tarjetaVista" opacity="0">
      <rect x="885" y="330" width="150" height="180" rx="16" fill="#ffffff" opacity=".12"/>
      <rect id="vistaImg" x="912" y="365" width="96" height="66" rx="8" fill="${bronce}" opacity=".85"/>
      <rect x="912" y="452" width="96" height="10" rx="5" fill="#ffffff" opacity=".5"/>
      <rect x="912" y="472" width="66" height="10" rx="5" fill="#ffffff" opacity=".35"/>
    </g>
  </svg></div>

  <div class="fase texto" id="explica"><h2>${resaltar(tipo.explica)}</h2><p>${esc(tipo.explica2)}</p></div>
  <div class="fase texto" id="remate"><h2>${resaltar(tipo.remate)}</h2><p>${esc(tipo.remate2)}</p></div>
  <div class="fase" id="cierre"><h2>${resaltar(tipo.cierre)}</h2><p>${esc(tipo.cierre2)}</p></div>

  <div class="pie" id="pie"><img class="logo" src="${logoUri}" alt=""><span class="handle">${esc(id.handle)}</span></div>
  <div class="vineta"></div>

  <div id="outro">
    <img src="${logoUri}" alt="">
    <div class="linea" id="outroLinea"></div>
    <div class="h">${esc(id.handle)}</div>
  </div>

<script>
  const DUR = ${DURACION_LENTE_MS};
  const TIPO = '${reel.tipoLente}';
  const LINEA_Y = 560;

  const $ = (s) => document.querySelector(s);
  const suave = (x) => x < .5 ? 4*x*x*x : 1 - Math.pow(-2*x + 2, 3) / 2;
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const fase = (t, a, b) => t < a ? 0 : t > b ? 0 : Math.min(suave(clamp01((t-a)/380)), suave(clamp01((b-t)/380)));
  const subir = (el, f) => { el.style.opacity = f; el.style.transform = 'translateY(' + ((1-f)*26) + 'px)'; };

  window.__dibujar = function (t) {
    $('#barra').style.width = ((t % DUR) / DUR * 100) + '%';

    subir($('#titulo'),  fase(t, 150, 2500));
    subir($('#explica'), fase(t, 2500, 6600));
    subir($('#remate'),  fase(t, 6600, 9600));
    subir($('#cierre'),  fase(t, 9600, 11800));

    const fOutro = suave(clamp01((t - 11750) / 500)) * suave(clamp01((DUR - 120 - t) / 400));
    const o = $('#outro');
    o.style.opacity = fOutro;
    o.style.transform = 'scale(' + (0.94 + 0.06 * suave(clamp01((t - 11750) / 900))) + ')';
    $('#outroLinea').style.width = (suave(clamp01((t - 12250) / 800)) * 260) + 'px';
    $('#pie').style.opacity = String(1 - fOutro);

    const vivo = clamp01((t - 2300) / 500);
    const pushIn = 1 + 0.05 * suave(clamp01((t - 2300) / 9000));
    const lienzo = $('#lienzo');
    lienzo.style.transform = 'scale(' + pushIn + ')';
    lienzo.style.opacity = (0.15 + 0.85 * vivo) * (t > 9600 ? 0.33 : 1) * (1 - fOutro);

    // Las zonas de la lente aparecen durante la explicación
    const zona = suave(clamp01((t - 2700) / 1100));
    if (TIPO === 'monofocal')  $('#zonaUniforme').setAttribute('opacity', String(zona * 0.26));
    if (TIPO === 'progresivo') $('#zonaGradiente').setAttribute('opacity', String(zona));
    if (TIPO === 'bifocal') {
        $('#zonaUniforme').setAttribute('opacity', String(zona * 0.12));
        $('#ventanaCerca').setAttribute('opacity', String(zona * 0.4));
        $('#lineaBifocal').setAttribute('opacity', String(zona * 0.95));
    }

    // Las etiquetas de distancia: en el progresivo las tres; en los otros, lo suyo
    const etq = (sel, f) => $(sel).setAttribute('opacity', String(f * 0.6));
    if (TIPO === 'progresivo') {
        etq('#etq1', suave(clamp01((t - 3100) / 400)));
        etq('#etq2', suave(clamp01((t - 3500) / 400)));
        etq('#etq3', suave(clamp01((t - 3900) / 400)));
    } else if (TIPO === 'bifocal') {
        etq('#etq1', suave(clamp01((t - 3100) / 400)));
        etq('#etq3', suave(clamp01((t - 3500) / 400)));
    } else {
        etq('#etq1', suave(clamp01((t - 3100) / 400)));
    }

    // LA MIRADA QUE BAJA: el corazón de la pieza. Baja durante el remate.
    // En el progresivo baja fluida; en el bifocal, al cruzar la línea, la
    // tarjetita de "vista" SALTA — ese salto es el argumento contra el bifocal.
    const bajando = suave(clamp01((t - 6800) / 2300));
    const yMirada = 200 + bajando * 460;
    const fMirada = fase(t, 6700, 9500);
    $('#mirada').setAttribute('y1', String(yMirada));
    $('#mirada').setAttribute('y2', String(yMirada));
    $('#mirada').setAttribute('opacity', String(fMirada * 0.7));
    for (const sel of ['#miradaPunto', '#miradaHalo']) $(sel).setAttribute('cy', String(yMirada));
    $('#miradaPunto').setAttribute('opacity', String(fMirada * 0.95));
    $('#miradaHalo').setAttribute('opacity', String(fMirada * 0.4));

    // La tarjeta de vista, a la derecha: muestra el efecto del salto
    $('#tarjetaVista').setAttribute('opacity', String(fMirada));
    let brinco = 0;
    if (TIPO === 'bifocal' && yMirada > LINEA_Y) {
        // El brinco: desplaza la "imagen" de golpe y decae en 300 ms
        const desde = (yMirada - LINEA_Y) / 460;
        brinco = Math.max(0, 1 - desde * 6) * 26;
    }
    $('#vistaImg').setAttribute('transform', 'translate(0 ' + brinco + ')');
  };

  window.__dibujar(0);
</script>
</body></html>`;
}
