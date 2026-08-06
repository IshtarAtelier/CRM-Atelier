/**
 * Plantilla de reel educativo: el ojo en corte, con los rayos de luz animados.
 *
 * Explica miopía, hipermetropía, presbicia o Stellest mostrando DÓNDE cae el
 * foco y cómo la lente lo corrige. Es motion graphics de diagrama, no
 * fotorealismo: un ojo esquemático elegante en los colores de la marca.
 *
 * La física está simplificada A PROPÓSITO: rayos que quiebran una sola vez y
 * un foco que se desliza. Es un diagrama didáctico, no un trazado de rayos.
 *
 * La vuelta cinematográfica (v2):
 * - viñeta radial y fondo con profundidad, en vez del marrón plano
 * - los rayos tienen glow (una copia desenfocada debajo del trazo)
 * - la cámara hace un push-in lentísimo sobre el diagrama
 * - los textos entran con fade + rise, no solo fade
 * - CIERRE CON LOGO: todo funde a negro-marrón y el isologo escala al centro
 *   con una línea de bronce que se abre debajo. Ningún reel termina cortado.
 *
 * Timeline (14 s): título → problema → corrección → mensaje → logo.
 *
 * OJO AL ESCRIBIR ACÁ: nada de backticks en los comentarios de adentro del
 * template — cortan el string en silencio y el error no dice por qué. Ya pasó
 * tres veces.
 */

export const DURACION_OJO_MS = 14000;

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
));
const resaltar = (t) => esc(t).replace(/\*([^*]+)\*/g, '<span class="marca">$1</span>');

/**
 * Qué cambia entre condiciones. fxMal es dónde cae el foco sin corregir (la
 * retina arranca en x=897); lente dibuja divergente o convergente; cerca hace
 * salir los rayos de un punto próximo (presbicia); crecer alarga el globo
 * durante la fase del problema (Stellest: la miopía avanza con el ojo);
 * puntitos dibuja las micro-lentes sobre la lente (Stellest).
 */
const CONDICIONES = {
    miopia: {
        titulo: '¿Qué es la *miopía*?',
        bajada: 'Por qué lo lejano se ve borroso, en 10 segundos.',
        fxMal: 745, lente: 'concava', cerca: false, crecer: false, puntitos: false,
        problema: 'La imagen se forma *antes* de la retina',
        problema2: 'A la retina llega desenfocada: lo lejano se ve borroso.',
        arreglo: 'Una lente *divergente* corre el foco hacia atrás',
        arreglo2: 'La imagen cae en la retina. Nítido de nuevo.',
        cierre: 'La graduación exacta *se mide*',
        cierre2: 'Atelier Óptica · Cerro de las Rosas. Sin turno previo.',
    },
    hipermetropia: {
        titulo: '¿Qué es la *hipermetropía*?',
        bajada: 'Por qué te cansa enfocar de cerca, en 10 segundos.',
        fxMal: 1055, lente: 'convexa', cerca: false, crecer: false, puntitos: false,
        problema: 'La imagen se formaría *detrás* de la retina',
        problema2: 'El ojo compensa forzando el cristalino: por eso el cansancio.',
        arreglo: 'Una lente *convergente* adelanta el foco',
        arreglo2: 'La imagen cae en la retina, sin esfuerzo.',
        cierre: 'La graduación exacta *se mide*',
        cierre2: 'Atelier Óptica · Cerro de las Rosas. Sin turno previo.',
    },
    presbicia: {
        titulo: '¿Qué es la *presbicia*?',
        bajada: 'Por qué alejás el celular para leer, en 10 segundos.',
        fxMal: 1055, lente: 'convexa', cerca: true, crecer: false, puntitos: false,
        problema: 'Con los años, el cristalino *pierde flexibilidad*',
        problema2: 'Lo cercano ya no enfoca: la imagen caería detrás de la retina.',
        arreglo: 'Una lente *de cerca* hace el trabajo que el cristalino ya no hace',
        arreglo2: 'Y el celular vuelve a leerse a distancia normal.',
        cierre: 'La graduación exacta *se mide*',
        cierre2: 'Atelier Óptica · Cerro de las Rosas. Sin turno previo.',
    },
    stellest: {
        titulo: '¿La miopía de tu hijo *se puede frenar*?',
        bajada: 'Stellest: el lente que controla la miopía infantil.',
        fxMal: 762, lente: 'concava', cerca: false, crecer: true, puntitos: true,
        problema: 'La miopía infantil *avanza* a medida que el ojo crece',
        problema2: 'Cada año, el foco queda un poco más lejos de la retina.',
        arreglo: 'Stellest corrige *y le pide al ojo que deje de crecer*',
        arreglo2: 'Más de mil micro-lentes generan la señal que frena el alargamiento.',
        cierre: 'Hasta *67% menos* de avance',
        cierre2: 'En promedio, según los estudios clínicos de Essilor. El control a tiempo hace la diferencia.',
    },
};

export function htmlDeReelOjo(reel, id, logoUri) {
    const cond = CONDICIONES[reel.condicion];
    if (!cond) {
        throw new Error(`Condición desconocida: "${reel.condicion}". Hay: ${Object.keys(CONDICIONES).join(', ')}.`);
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
  #titulo h1 { font-size:100px; line-height:1.06; font-weight:900; letter-spacing:-.025em; }
  #titulo p  { margin-top:30px; font-size:42px; opacity:.85; }
  .texto { top:1310px; }
  .texto h2 { font-size:56px; line-height:1.12; font-weight:900; letter-spacing:-.02em; }
  .texto p  { margin-top:22px; font-size:38px; line-height:1.35; opacity:.88; }
  #cierre { top:1310px; }
  #cierre h2 { font-size:74px; line-height:1.08; font-weight:900; letter-spacing:-.02em; }
  #cierre p { margin-top:24px; font-size:36px; line-height:1.35; opacity:.85; }
  .marca { color:${bronce}; }
  #lienzo { position:absolute; top:430px; left:0; width:1080px; height:850px; }
  #escena { width:100%; height:100%; }
  .pie { position:absolute; left:88px; right:88px; bottom:110px;
         display:flex; align-items:center; gap:22px; }
  .logo { height:60px; filter:brightness(0) invert(1); opacity:.95; }
  .handle { font-size:30px; font-weight:500; letter-spacing:.06em; opacity:.72; }
  .barra { position:absolute; left:0; top:0; height:8px; background:${bronce}; width:0; }

  /* El cierre con logo: el isologo escala al centro con una línea de bronce
     que se abre debajo. */
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
    <h1>${resaltar(cond.titulo)}</h1>
    <p>${esc(cond.bajada)}</p>
  </div>

  <div id="lienzo"><svg id="escena" viewBox="0 0 1080 850" fill="none">
    <defs>
      <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="7"/>
      </filter>
    </defs>
    <ellipse id="ojo" cx="620" cy="425" rx="280" ry="280" stroke="#ffffff" stroke-width="5" opacity=".85"/>
    <path id="retina" d="" stroke="${bronce}" stroke-width="9" stroke-linecap="round" opacity=".9"/>
    <ellipse cx="365" cy="425" rx="34" ry="98" stroke="#ffffff" stroke-width="4" opacity=".7"/>
    <g id="lente" opacity="0"></g>
    <g id="puntitos" opacity="0"></g>
    <g id="rayosGlow" filter="url(#glow)" opacity=".55"></g>
    <g id="rayos"></g>
    <line id="mancha" stroke="#e8b4a0" stroke-width="10" stroke-linecap="round" opacity="0"/>
    <circle id="focoHalo" r="30" fill="${bronce}" opacity="0" filter="url(#glow)"/>
    <circle id="foco" r="14" fill="${bronce}" opacity="0"/>
    <text id="etiqueta-retina" x="940" y="200" fill="#ffffff" opacity=".55"
          font-family="sans-serif" font-size="30">retina</text>
  </svg></div>

  <div class="fase texto" id="problema"><h2>${resaltar(cond.problema)}</h2><p>${esc(cond.problema2)}</p></div>
  <div class="fase texto" id="arreglo"><h2>${resaltar(cond.arreglo)}</h2><p>${esc(cond.arreglo2)}</p></div>
  <div class="fase" id="cierre"><h2>${resaltar(cond.cierre)}</h2><p>${esc(cond.cierre2)}</p></div>

  <div class="pie" id="pie"><img class="logo" src="${logoUri}" alt=""><span class="handle">${esc(id.handle)}</span></div>
  <div class="vineta"></div>

  <div id="outro">
    <img src="${logoUri}" alt="">
    <div class="linea" id="outroLinea"></div>
    <div class="h">${esc(id.handle)}</div>
  </div>

<script>
  const DUR = ${DURACION_OJO_MS};
  const FX_MAL = ${cond.fxMal};
  const CONCAVA = ${cond.lente === 'concava'};
  const CERCA = ${cond.cerca};
  const CRECER = ${cond.crecer};
  const PUNTITOS = ${cond.puntitos};
  const CY = 425, CRISTALINO_X = 365, LENTE_X = 235, RX_BASE = 280;

  const $ = (s) => document.querySelector(s);
  const suave = (x) => x < .5 ? 4*x*x*x : 1 - Math.pow(-2*x + 2, 3) / 2;
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const fase = (t, a, b) => t < a ? 0 : t > b ? 0 : Math.min(suave(clamp01((t-a)/380)), suave(clamp01((b-t)/380)));
  // fade + rise: la fase sube 26 px mientras aparece
  const subir = (el, f) => { el.style.opacity = f; el.style.transform = 'translateY(' + ((1-f)*26) + 'px)'; };

  const NS = 'http://www.w3.org/2000/svg';
  function retinaPath(rx) {
    const pts = [];
    for (let a = -50; a <= 50; a += 5) {
      const r = a * Math.PI / 180;
      pts.push((620 + (rx-3)*Math.cos(r)) + ',' + (CY + 277*Math.sin(r)));
    }
    return 'M' + pts.join(' L');
  }

  // La lente correctora
  (function(){
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('stroke', '${bronce}'); p.setAttribute('stroke-width', '7');
    p.setAttribute('fill', CONCAVA ? 'none' : '${bronce}22');
    p.setAttribute('d', CONCAVA
      ? \`M \${LENTE_X-14} \${CY-120} Q \${LENTE_X+26} \${CY} \${LENTE_X-14} \${CY+120}
         M \${LENTE_X+14} \${CY-120} Q \${LENTE_X-26} \${CY} \${LENTE_X+14} \${CY+120}\`
      : \`M \${LENTE_X} \${CY-120} Q \${LENTE_X+42} \${CY} \${LENTE_X} \${CY-120+240}
         Q \${LENTE_X-42} \${CY} \${LENTE_X} \${CY-120}\`);
    $('#lente').appendChild(p);
  })();

  // Las micro-lentes de Stellest: anillos de puntitos sobre la lente, con la
  // zona central libre (así es el diseño real: el centro corrige, los anillos
  // periféricos generan el desenfoque que frena el crecimiento).
  const puntos = [];
  if (PUNTITOS) {
    for (const colX of [LENTE_X - 8, LENTE_X + 8]) {
      for (let y = CY - 104; y <= CY + 104; y += 16) {
        if (Math.abs(y - CY) < 30) continue;
        const c = document.createElementNS(NS, 'circle');
        c.setAttribute('cx', String(colX + (Math.abs(y-CY) % 2 ? 4 : -4)));
        c.setAttribute('cy', String(y));
        c.setAttribute('r', '4.5');
        c.setAttribute('fill', '${bronce}');
        $('#puntitos').appendChild(c);
        puntos.push(c);
      }
    }
  }

  // Cinco rayos, cada uno con su copia de glow debajo
  const OFFS = [-110, -55, 0, 55, 110];
  const mkRayo = (g, w) => OFFS.map(() => {
    const l = document.createElementNS(NS, 'polyline');
    l.setAttribute('stroke', '${bronce}'); l.setAttribute('stroke-width', String(w));
    l.setAttribute('stroke-linecap', 'round'); l.setAttribute('fill', 'none');
    g.appendChild(l); return l;
  });
  const rayos = mkRayo($('#rayos'), 5);
  const rayosGlow = mkRayo($('#rayosGlow'), 9);

  window.__dibujar = function (t) {
    $('#barra').style.width = ((t % DUR) / DUR * 100) + '%';

    subir($('#titulo'),   fase(t, 150, 2500));
    subir($('#problema'), fase(t, 2500, 6200));
    subir($('#arreglo'),  fase(t, 6200, 9400));
    subir($('#cierre'),   fase(t, 9400, 11800));

    // El cierre con logo: entra cuando todo lo demás se fue
    const fOutro = suave(clamp01((t - 11750) / 500)) * suave(clamp01((DUR - 120 - t) / 400));
    const o = $('#outro');
    o.style.opacity = fOutro;
    o.style.transform = 'scale(' + (0.94 + 0.06 * suave(clamp01((t - 11750) / 900))) + ')';
    $('#outroLinea').style.width = (suave(clamp01((t - 12250) / 800)) * 260) + 'px';
    $('#pie').style.opacity = String(1 - fOutro);

    // La cámara: push-in lentísimo sobre el diagrama, ida sola (no vuelve:
    // el corte al outro tapa el regreso y el loop no se nota)
    const vivo = clamp01((t - 2300) / 500);
    const pushIn = 1 + 0.05 * suave(clamp01((t - 2300) / 9000));
    const lienzo = $('#lienzo');
    lienzo.style.transform = 'scale(' + pushIn + ')';
    lienzo.style.opacity = (0.15 + 0.85 * vivo) * (t > 9400 ? 0.33 : 1) * (1 - fOutro);

    // Stellest: el globo se alarga durante el problema y se frena al corregir
    const crecido = CRECER ? suave(clamp01((t - 3300) / 2400)) : 0;
    const rx = RX_BASE + 26 * crecido;
    $('#ojo').setAttribute('rx', String(rx));
    $('#retina').setAttribute('d', retinaPath(rx));
    const RETINA_X = 620 + (rx - 3);

    // Cuánta corrección hay puesta
    const corr = suave(clamp01((t - 6500) / 1600));
    $('#lente').setAttribute('opacity', String(corr * 0.95));
    if (PUNTITOS) {
        $('#puntitos').setAttribute('opacity', '1');
        puntos.forEach((c, i) => {
            const f = suave(clamp01((t - 6900 - i * 28) / 380)) * corr;
            c.setAttribute('opacity', String(f * 0.9));
        });
    }

    const fx = FX_MAL + (RETINA_X - FX_MAL) * corr;
    const traza = suave(clamp01((t - 2600) / 900));

    OFFS.forEach((off, i) => {
        const y0 = CY + off;
        const yOrigen = CERCA ? CY + off * 0.25 : y0;
        const xOrigen = CERCA ? 60 : 0;
        const yLente = y0 + (CONCAVA ? 1 : -1) * corr * off * 0.18;
        const m = (CY - yLente) / (fx - CRISTALINO_X);
        const yRetina = yLente + m * (RETINA_X - CRISTALINO_X);
        const pts = [[xOrigen, yOrigen], [LENTE_X, y0], [CRISTALINO_X, yLente], [RETINA_X, yRetina]];
        const xMax = xOrigen + (RETINA_X - xOrigen) * traza;
        const vis = [];
        for (let k = 0; k < pts.length; k++) {
            const [x, y] = pts[k];
            if (x <= xMax) { vis.push(x + ',' + y); continue; }
            const [xa, ya] = pts[k - 1] || [x, y];
            const f = (xMax - xa) / (x - xa || 1);
            if (f > 0) vis.push((xa + (x - xa) * f) + ',' + (ya + (y - ya) * f));
            break;
        }
        const cadena = vis.join(' ');
        rayos[i].setAttribute('points', cadena);
        rayos[i].setAttribute('opacity', String(0.35 + 0.5 * traza));
        rayosGlow[i].setAttribute('points', cadena);
        rayosGlow[i].setAttribute('opacity', String(0.5 * traza));
    });

    // La mancha de desenfoque sobre la retina
    const yTope = CY + 110 + ((CY - (CY + 110)) / (fx - CRISTALINO_X)) * (RETINA_X - CRISTALINO_X);
    const alto = Math.max(6, Math.abs(yTope - CY)) * (1 - corr * 0.96);
    $('#mancha').setAttribute('x1', String(RETINA_X)); $('#mancha').setAttribute('x2', String(RETINA_X));
    $('#mancha').setAttribute('y1', String(CY - alto)); $('#mancha').setAttribute('y2', String(CY + alto));
    $('#mancha').setAttribute('opacity', String(traza * (1 - corr) * 0.8));

    // El punto de foco con su halo
    const pulso = 1 + 0.25 * Math.sin(t / 180);
    for (const idSel of ['#foco', '#focoHalo']) {
        $(idSel).setAttribute('cx', String(fx));
        $(idSel).setAttribute('cy', String(CY));
    }
    $('#foco').setAttribute('r', String(14 * (corr > 0.9 ? 1.15 : pulso)));
    $('#foco').setAttribute('fill', corr > 0.6 ? '${bronce}' : '#e8b4a0');
    $('#foco').setAttribute('opacity', String(traza * 0.95));
    $('#focoHalo').setAttribute('r', String(30 * pulso));
    $('#focoHalo').setAttribute('opacity', String(traza * (corr > 0.6 ? 0.5 : 0.3)));
  };

  window.__dibujar(0);
</script>
</body></html>`;
}
