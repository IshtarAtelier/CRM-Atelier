/**
 * Plantilla de reel educativo: la LENTE de frente, con sus zonas animadas. v2
 *
 * Cinco tipos:
 *   monofocal    toda la superficie con una graduación
 *   bifocal      la LUPITA incorporada: la ventana de cerca con su línea — y
 *                el salto de imagen al cruzarla, que es el defecto que la jubiló
 *   progresivo   lejos/intermedio/cerca en gradiente continuo, sin líneas
 *   stellest     centro que corrige + ANILLOS de micro-lentes (control de
 *                miopía infantil, Essilor)
 *   myofix       centro que corrige + PANAL de micro-segmentos (control de
 *                miopía infantil)
 *
 * Level up de diseño (v2, a pedido):
 * - la lente ya no es un óvalo: es la forma real de un cristal de anteojo
 *   (rectángulo blando), con brillo de vidrio y un DESTELLO diagonal que la
 *   recorre una vez — el gesto que la hace leerse como vidrio y no como globo
 * - la bifocal muestra la lupita DE VERDAD: una letra chica arriba de la
 *   línea y la misma letra agrandada adentro de la ventana
 * - stellest y myofix laten: los anillos/panal emiten ondas durante el remate,
 *   que es la "señal" de la que habla el guion
 * - EL PIE SUBE a 280 px del borde: abajo queda la zona donde el pulgar tapa
 *   y donde Instagram pone sus controles
 *
 * Recordatorio: nada de backticks en los comentarios de adentro del template.
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
        bajada: 'Una lupita incorporada... y un salto.',
        explica: 'Como una *lupita* en la parte de abajo',
        explica2: 'La ventana de cerca agranda lo próximo, separada por su línea visible.',
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
    stellest: {
        titulo: 'El lente *Stellest*',
        bajada: 'Corrige y controla la miopía infantil.',
        explica: 'Un centro que corrige, *anillos que frenan*',
        explica2: 'Más de mil micro-lentes en once anillos rodean la zona de visión.',
        remate: 'La señal que le pide al ojo *no alargarse*',
        remate2: 'Hasta 67% menos de avance en promedio, según estudios clínicos de Essilor.',
        cierre: 'El control a tiempo *cambia todo*',
        cierre2: 'Atelier Óptica · Cerro de las Rosas. Sin turno previo.',
    },
    myofix: {
        titulo: 'El lente *MyoFix*',
        bajada: 'Control de miopía infantil.',
        explica: 'Zona central nítida, *panal que controla*',
        explica2: 'Cientos de micro-segmentos rodean el centro de visión.',
        remate: 'Desenfoque periférico: la señal de *no crecer*',
        remate2: 'Corrige la visión de tu hijo mientras acompaña el crecimiento del ojo.',
        cierre: 'Pediatría visual *en serio*',
        cierre2: 'Atelier Óptica · Cerro de las Rosas. Sin turno previo.',
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
  #titulo { top:290px; }
  #titulo h1 { font-size:100px; line-height:1.06; font-weight:900; letter-spacing:-.025em; }
  #titulo p  { margin-top:30px; font-size:42px; opacity:.85; }
  .texto { top:1290px; }
  .texto h2 { font-size:58px; line-height:1.12; font-weight:900; letter-spacing:-.02em; }
  .texto p  { margin-top:22px; font-size:38px; line-height:1.35; opacity:.88; }
  #cierre { top:1290px; }
  #cierre h2 { font-size:72px; line-height:1.08; font-weight:900; letter-spacing:-.02em; }
  #cierre p { margin-top:24px; font-size:36px; line-height:1.35; opacity:.85; }
  .marca { color:${bronce}; }
  #lienzo { position:absolute; top:430px; left:0; width:1080px; height:840px; }
  /* El pie va a 280 px del borde: más abajo queda la zona del pulgar y de los
     controles de Instagram. Lo pidió el usuario mirando el reel en el celu. */
  .pie { position:absolute; left:88px; right:88px; bottom:280px;
         display:flex; align-items:center; gap:22px; }
  .logo { height:56px; filter:brightness(0) invert(1); opacity:.95; }
  .handle { font-size:28px; font-weight:500; letter-spacing:.06em; opacity:.72; }
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

  <div id="lienzo"><svg id="escena" viewBox="0 0 1080 840" fill="none">
    <defs>
      <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="7"/>
      </filter>
      <clipPath id="clipLente"><circle cx="500" cy="415" r="318"/></clipPath>
      <linearGradient id="gradProgresivo" x1="0" y1="95" x2="0" y2="735" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="${bronce}" stop-opacity=".10"/>
        <stop offset=".5" stop-color="${bronce}" stop-opacity=".26"/>
        <stop offset="1" stop-color="${bronce}" stop-opacity=".48"/>
      </linearGradient>
      <linearGradient id="gradDestello" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0"/>
        <stop offset=".5" stop-color="#ffffff" stop-opacity=".16"/>
        <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="gradBorde" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffffff"/>
        <stop offset="1" stop-color="${bronce}"/>
      </linearGradient>
    </defs>

    <!-- el cristal: REDONDO (lo pidio el usuario), con vidrio y borde vivo -->
    <circle cx="500" cy="415" r="318" fill="#ffffff" opacity=".05"/>
    <circle cx="500" cy="415" r="318" stroke="url(#gradBorde)" stroke-width="7" opacity=".95"/>

    <g clip-path="url(#clipLente)">
      <rect id="zonaUniforme" x="180" y="95" width="640" height="640" fill="${bronce}" opacity="0"/>
      <rect id="zonaGradiente" x="180" y="95" width="640" height="640" fill="url(#gradProgresivo)" opacity="0"/>

      <!-- bifocal: la lupita — ventana con borde propio y la letra agrandada -->
      <g id="grupoBifocal" opacity="0">
        <path d="M 350 555 A 168 168 0 0 0 650 555 Z" fill="${bronce}" opacity=".30"/>
        <path d="M 350 555 A 168 168 0 0 0 650 555" stroke="#ffffff" stroke-width="6"/>
        <line x1="350" y1="555" x2="650" y2="555" stroke="#ffffff" stroke-width="6"/>
        <text x="404" y="500" font-family="Georgia, serif" font-size="66" fill="#ffffff" opacity=".8">A</text>
        <text id="letraGrande" x="462" y="682" font-family="Georgia, serif" font-size="132" fill="#ffffff">A</text>
      </g>

      <!-- stellest: anillos de micro-lentes / myofix: panal -->
      <circle id="zonaCentral" cx="500" cy="415" r="108" stroke="${bronce}" stroke-width="4" opacity="0" stroke-dasharray="10 12"/>
      <g id="microlentes"></g>
      <circle id="onda1" cx="500" cy="415" r="120" stroke="${bronce}" stroke-width="5" opacity="0"/>
      <circle id="onda2" cx="500" cy="415" r="120" stroke="${bronce}" stroke-width="5" opacity="0"/>

      <!-- el destello de vidrio que recorre la lente una vez -->
      <rect id="destello" x="-400" y="-100" width="260" height="1100" fill="url(#gradDestello)" transform="rotate(18 500 415)"/>
    </g>

    <g id="etiquetas" font-family="sans-serif" font-size="26" fill="#ffffff">
      <text id="etq1" x="46" y="205" opacity="0">LEJOS</text>
      <text id="etq2" x="46" y="430" opacity="0">INTERMEDIO</text>
      <text id="etq3" x="46" y="655" opacity="0">CERCA</text>
    </g>

    <line id="mirada" x1="245" x2="755" y1="240" y2="240" stroke="${bronce}" stroke-width="4" opacity="0"/>
    <circle id="miradaPunto" cx="500" r="13" fill="${bronce}" opacity="0"/>
    <circle id="miradaHalo" cx="500" r="28" fill="${bronce}" opacity="0" filter="url(#glow)"/>

    <g id="tarjetaVista" opacity="0">
      <rect x="870" y="320" width="150" height="180" rx="16" fill="#ffffff" opacity=".12"/>
      <rect id="vistaImg" x="897" y="355" width="96" height="66" rx="8" fill="${bronce}" opacity=".85"/>
      <rect x="897" y="442" width="96" height="10" rx="5" fill="#ffffff" opacity=".5"/>
      <rect x="897" y="462" width="66" height="10" rx="5" fill="#ffffff" opacity=".35"/>
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
  const LINEA_Y = 555;
  const CX = 500, CYL = 415;

  const $ = (s) => document.querySelector(s);
  const suave = (x) => x < .5 ? 4*x*x*x : 1 - Math.pow(-2*x + 2, 3) / 2;
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const fase = (t, a, b) => t < a ? 0 : t > b ? 0 : Math.min(suave(clamp01((t-a)/380)), suave(clamp01((b-t)/380)));
  const subir = (el, f) => { el.style.opacity = f; el.style.transform = 'translateY(' + ((1-f)*26) + 'px)'; };

  // Las micro-lentes: anillos concentricos (stellest) o panal (myofix).
  // Se generan una vez; cada punto guarda su orden para el pop escalonado.
  const NS = 'http://www.w3.org/2000/svg';
  const micro = [];
  if (TIPO === 'stellest') {
    const radios = [150, 185, 220, 255, 290, 325];
    radios.forEach((r, ri) => {
      const n = Math.round((2 * Math.PI * r) / 26);
      for (let k = 0; k < n; k++) {
        const a = (k / n) * 2 * Math.PI;
        const c = document.createElementNS(NS, 'circle');
        c.setAttribute('cx', String(CX + r * Math.cos(a)));
        c.setAttribute('cy', String(CYL + r * Math.sin(a)));
        c.setAttribute('r', '5'); c.setAttribute('fill', '${bronce}'); c.setAttribute('opacity', '0');
        $('#microlentes').appendChild(c);
        micro.push({ el: c, orden: ri });
      }
    });
  }
  if (TIPO === 'myofix') {
    let fila = 0;
    for (let y = 130; y <= 710; y += 34) {
      const off = (fila % 2) ? 19 : 0;
      for (let x = 250 + off; x <= 750; x += 38) {
        const d = Math.hypot(x - CX, y - CYL);
        if (d < 118) continue;
        const c = document.createElementNS(NS, 'circle');
        c.setAttribute('cx', String(x)); c.setAttribute('cy', String(y));
        c.setAttribute('r', '6'); c.setAttribute('fill', '${bronce}'); c.setAttribute('opacity', '0');
        $('#microlentes').appendChild(c);
        micro.push({ el: c, orden: Math.floor(d / 60) });
      }
      fila++;
    }
  }
  const esControl = TIPO === 'stellest' || TIPO === 'myofix';

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

    // El destello de vidrio: recorre la lente UNA vez apenas aparece
    const barrida = suave(clamp01((t - 2700) / 1400));
    $('#destello').setAttribute('transform', 'translate(' + (barrida * 1500 - 400) + ' 0) rotate(18 500 415)');

    // Las zonas, por tipo
    const zona = suave(clamp01((t - 2700) / 1100));
    if (TIPO === 'monofocal')  $('#zonaUniforme').setAttribute('opacity', String(zona * 0.26));
    if (TIPO === 'progresivo') $('#zonaGradiente').setAttribute('opacity', String(zona));
    if (TIPO === 'bifocal') {
        $('#zonaUniforme').setAttribute('opacity', String(zona * 0.10));
        $('#grupoBifocal').setAttribute('opacity', String(zona));
        // La letra de la lupita "respira" apenas, para que se lea como aumento
        const respiro = 1 + 0.03 * Math.sin(t / 300);
        $('#letraGrande').setAttribute('transform', 'scale(' + respiro + ')');
        $('#letraGrande').setAttribute('transform-origin', '500 640');
    }
    if (esControl) {
        $('#zonaCentral').setAttribute('opacity', String(zona * 0.85));
        micro.forEach(({ el, orden }) => {
            const f = suave(clamp01((t - 3000 - orden * 260) / 420)) * zona;
            el.setAttribute('opacity', String(f * 0.85));
        });
        // El latido de la señal, durante el remate: dos ondas que se expanden
        for (const [sel, desfase] of [['#onda1', 0], ['#onda2', 900]]) {
            const ciclo = ((t - 6800 - desfase) % 1800) / 1800;
            const activa = t > 6800 + desfase && t < 9600 ? 1 : 0;
            const r = 120 + ciclo * 230;
            $(sel).setAttribute('r', String(Math.max(120, r)));
            $(sel).setAttribute('opacity', String(activa * (1 - ciclo) * 0.5));
        }
    }

    // Las etiquetas de distancia (solo tipos "clásicos")
    const etq = (sel, f) => $(sel).setAttribute('opacity', String(f * 0.6));
    if (TIPO === 'progresivo') {
        etq('#etq1', suave(clamp01((t - 3100) / 400)));
        etq('#etq2', suave(clamp01((t - 3500) / 400)));
        etq('#etq3', suave(clamp01((t - 3900) / 400)));
    } else if (TIPO === 'bifocal') {
        etq('#etq1', suave(clamp01((t - 3100) / 400)));
        etq('#etq3', suave(clamp01((t - 3500) / 400)));
    } else if (TIPO === 'monofocal') {
        etq('#etq1', suave(clamp01((t - 3100) / 400)));
    }

    // La mirada que baja (solo mono/bi/progresivo): fluida o con salto
    if (!esControl) {
        const bajando = suave(clamp01((t - 6800) / 2300));
        const yMirada = 200 + bajando * 450;
        const fMirada = fase(t, 6700, 9500);
        $('#mirada').setAttribute('y1', String(yMirada));
        $('#mirada').setAttribute('y2', String(yMirada));
        $('#mirada').setAttribute('opacity', String(fMirada * 0.7));
        for (const sel of ['#miradaPunto', '#miradaHalo']) $(sel).setAttribute('cy', String(yMirada));
        $('#miradaPunto').setAttribute('opacity', String(fMirada * 0.95));
        $('#miradaHalo').setAttribute('opacity', String(fMirada * 0.4));

        $('#tarjetaVista').setAttribute('opacity', String(fMirada));
        let brinco = 0;
        if (TIPO === 'bifocal' && yMirada > LINEA_Y) {
            const desde = (yMirada - LINEA_Y) / 450;
            brinco = Math.max(0, 1 - desde * 6) * 26;
        }
        $('#vistaImg').setAttribute('transform', 'translate(0 ' + brinco + ')');
    }
  };

  window.__dibujar(0);
</script>
</body></html>`;
}
