/**
 * Plantilla de reel educativo: el ojo en corte, con los rayos de luz animados.
 *
 * Explica miopía, hipermetropía o presbicia mostrando DÓNDE cae el foco y cómo
 * la lente lo corrige. Es motion graphics de diagrama, no fotorealismo: un ojo
 * esquemático elegante en los colores de la marca. El fotorealismo no se puede
 * producir con HTML+CSS y prometerlo sería mentir; un diagrama claro explica
 * mejor que un render 3D, que es lo que hacen los explicadores profesionales.
 *
 * La física está simplificada A PROPÓSITO: rayos que quiebran una sola vez y
 * un foco que se desliza. Es un diagrama didáctico, no un trazado de rayos —
 * lo que importa es que se ENTIENDA dónde cae la imagen y qué hace la lente.
 *
 * Timeline (12 s, cuatro fases):
 *   1. título              2. el problema: el foco cae donde no debe
 *   3. la corrección: entra la lente y el foco se desliza a la retina
 *   4. cierre con CTA
 */

export const DURACION_OJO_MS = 12000;

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
));
const resaltar = (t) => esc(t).replace(/\*([^*]+)\*/g, '<span class="marca">$1</span>');

/**
 * Qué cambia entre condiciones. `fxMal` es dónde cae el foco sin corregir
 * (la retina está en x=900); `lente` dibuja divergente (cóncava) o
 * convergente (convexa); `cerca` arranca los rayos desde un punto cercano
 * (presbicia: el problema es leer, no el horizonte).
 */
const CONDICIONES = {
    miopia: {
        titulo: '¿Qué es la *miopía*?',
        bajada: 'Por qué lo lejano se ve borroso, en 10 segundos.',
        fxMal: 745,
        lente: 'concava',
        cerca: false,
        problema: 'La imagen se forma *antes* de la retina',
        problema2: 'A la retina llega desenfocada: lo lejano se ve borroso.',
        arreglo: 'Una lente *divergente* corre el foco hacia atrás',
        arreglo2: 'La imagen cae en la retina. Nítido de nuevo.',
    },
    hipermetropia: {
        titulo: '¿Qué es la *hipermetropía*?',
        bajada: 'Por qué te cansa enfocar de cerca, en 10 segundos.',
        fxMal: 1055,
        lente: 'convexa',
        cerca: false,
        problema: 'La imagen se formaría *detrás* de la retina',
        problema2: 'El ojo compensa forzando el cristalino: por eso el cansancio.',
        arreglo: 'Una lente *convergente* adelanta el foco',
        arreglo2: 'La imagen cae en la retina, sin esfuerzo.',
    },
    presbicia: {
        titulo: '¿Qué es la *presbicia*?',
        bajada: 'Por qué alejás el celular para leer, en 10 segundos.',
        fxMal: 1055,
        lente: 'convexa',
        cerca: true,
        problema: 'Con los años, el cristalino *pierde flexibilidad*',
        problema2: 'Lo cercano ya no enfoca: la imagen caería detrás de la retina.',
        arreglo: 'Una lente *de cerca* hace el trabajo que el cristalino ya no hace',
        arreglo2: 'Y el celular vuelve a leerse a distancia normal.',
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
  body { width:1080px; height:1920px; background:${fondo}; color:#fff;
         font-family:${id.fuentes.texto}; position:relative; overflow:hidden;
         -webkit-font-smoothing:antialiased; }
  .fase { position:absolute; left:88px; right:88px; opacity:0; }
  #titulo { top:300px; }
  #titulo h1 { font-size:104px; line-height:1.05; font-weight:900; letter-spacing:-.025em; }
  #titulo p  { margin-top:30px; font-size:42px; opacity:.85; }
  .texto { top:1310px; }
  .texto h2 { font-size:56px; line-height:1.12; font-weight:900; letter-spacing:-.02em; }
  .texto p  { margin-top:22px; font-size:38px; line-height:1.35; opacity:.88; }
  #cierre { top:1330px; }
  #cierre h2 { font-size:64px; font-weight:900; letter-spacing:-.02em; }
  #cierre p { margin-top:24px; font-size:40px; opacity:.88; }
  .marca { color:${bronce}; }
  #escena { position:absolute; top:430px; left:0; width:1080px; height:850px; }
  .pie { position:absolute; left:88px; right:88px; bottom:110px;
         display:flex; align-items:center; gap:22px; }
  .logo { height:60px; filter:brightness(0) invert(1); opacity:.95; }
  .handle { font-size:30px; font-weight:500; letter-spacing:.06em; opacity:.72; }
  .barra { position:absolute; left:0; top:0; height:8px; background:${bronce}; width:0; }
</style></head>
<body>
  <div class="barra" id="barra"></div>

  <div class="fase" id="titulo">
    <h1>${resaltar(cond.titulo)}</h1>
    <p>${esc(cond.bajada)}</p>
  </div>

  <svg id="escena" viewBox="0 0 1080 850" fill="none">
    <!-- globo ocular: corte lateral, la luz entra por la izquierda -->
    <circle id="ojo" cx="620" cy="425" r="280" stroke="#ffffff" stroke-width="5" opacity=".85"/>
    <!-- retina: la pared interna derecha -->
    <path id="retina" d="" stroke="${bronce}" stroke-width="9" stroke-linecap="round" opacity=".9"/>
    <!-- cristalino -->
    <ellipse cx="365" cy="425" rx="34" ry="98" stroke="#ffffff" stroke-width="4" opacity=".7"/>
    <!-- lente correctora (entra en la fase 3) -->
    <g id="lente" opacity="0"></g>
    <!-- los rayos -->
    <g id="rayos"></g>
    <!-- la mancha de desenfoque sobre la retina, y el punto de foco -->
    <line id="mancha" x1="897" x2="897" stroke="#e8b4a0" stroke-width="10" stroke-linecap="round" opacity="0"/>
    <circle id="foco" r="14" fill="${bronce}" opacity="0"/>
    <text id="etiqueta-retina" x="940" y="200" fill="#ffffff" opacity=".55"
          font-family="sans-serif" font-size="30">retina</text>
  </svg>

  <div class="fase texto" id="problema"><h2>${resaltar(cond.problema)}</h2><p>${esc(cond.problema2)}</p></div>
  <div class="fase texto" id="arreglo"><h2>${resaltar(cond.arreglo)}</h2><p>${esc(cond.arreglo2)}</p></div>
  <div class="fase" id="cierre">
    <h2>La graduación exacta *se mide*</h2>
    <p>Atelier Óptica · Cerro de las Rosas. Sin turno previo.</p>
  </div>

  <div class="pie"><img class="logo" src="${logoUri}" alt=""><span class="handle">${esc(id.handle)}</span></div>

<script>
  const DUR = ${DURACION_OJO_MS};
  const FX_MAL = ${cond.fxMal};
  const CONCAVA = ${cond.lente === 'concava'};
  const CERCA = ${cond.cerca};
  const RETINA_X = 897, CY = 425, CRISTALINO_X = 365, LENTE_X = 235;

  const $ = (s) => document.querySelector(s);
  const suave = (x) => x < .5 ? 4*x*x*x : 1 - Math.pow(-2*x + 2, 3) / 2;
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  // Progreso 0..1 dentro de [a,b] ms, con fundido de salida en los últimos 350 ms
  const fase = (t, a, b) => t < a ? 0 : t > b ? 0 : Math.min(suave(clamp01((t-a)/350)), suave(clamp01((b-t)/350)));

  // La retina: arco sobre la pared interna derecha del globo
  (function(){
    const pts = [];
    for (let a = -50; a <= 50; a += 5) {
      const r = a * Math.PI / 180;
      pts.push((620 + 277*Math.cos(r)) + ',' + (CY + 277*Math.sin(r)));
    }
    $('#retina').setAttribute('d', 'M' + pts.join(' L'));
  })();

  // La lente correctora: dos arcos (cóncava) o una almendra (convexa)
  (function(){
    const g = $('#lente'), NS = 'http://www.w3.org/2000/svg';
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('stroke', '${bronce}'); p.setAttribute('stroke-width', '7');
    p.setAttribute('fill', CONCAVA ? 'none' : '${bronce}22');
    p.setAttribute('d', CONCAVA
      ? \`M \${LENTE_X-14} \${CY-120} Q \${LENTE_X+26} \${CY} \${LENTE_X-14} \${CY+120}
         M \${LENTE_X+14} \${CY-120} Q \${LENTE_X-26} \${CY} \${LENTE_X+14} \${CY+120}\`
      : \`M \${LENTE_X} \${CY-120} Q \${LENTE_X+42} \${CY} \${LENTE_X} \${CY+120}
         Q \${LENTE_X-42} \${CY} \${LENTE_X} \${CY-120}\`);
    g.appendChild(p);
  })();

  // Cinco rayos. Cada uno: origen → (lente) → cristalino → foco → retina.
  const OFFS = [-110, -55, 0, 55, 110];
  const NS = 'http://www.w3.org/2000/svg';
  const rayos = OFFS.map(() => {
    const l = document.createElementNS(NS, 'polyline');
    l.setAttribute('stroke', '${bronce}'); l.setAttribute('stroke-width', '5');
    l.setAttribute('stroke-linecap', 'round'); l.setAttribute('fill', 'none');
    $('#rayos').appendChild(l);
    return l;
  });

  window.__dibujar = function (t) {
    $('#barra').style.width = ((t % DUR) / DUR * 100) + '%';

    const fTitulo   = fase(t, 150, 2600);
    const fProblema = fase(t, 2600, 6300);
    const fArreglo  = fase(t, 6300, 9800);
    const fCierre   = fase(t, 9800, DUR - 100);
    $('#titulo').style.opacity = fTitulo;
    $('#problema').style.opacity = fProblema;
    $('#arreglo').style.opacity = fArreglo;
    $('#cierre').style.opacity = fCierre;

    // El diagrama vive de la fase 2 en adelante, y se atenúa en el cierre
    const vivo = clamp01((t - 2400) / 500);
    $('#escena').style.opacity = (0.15 + 0.85 * vivo) * (fCierre > 0 ? 0.35 : 1);

    // Cuánta corrección hay puesta (0 = sin lente, 1 = corregido)
    const corr = suave(clamp01((t - 6600) / 1600));
    $('#lente').setAttribute('opacity', String(corr * 0.95));

    // El foco se desliza de FX_MAL hasta la retina
    const fx = FX_MAL + (RETINA_X - FX_MAL) * corr;

    // Qué tan "dibujados" están los rayos (entran en la fase 2)
    const traza = suave(clamp01((t - 2700) / 900));

    rayos.forEach((el, i) => {
        const y0 = CY + OFFS[i];
        // presbicia: los rayos salen ABIERTOS desde un punto cercano
        const yOrigen = CERCA ? CY + OFFS[i] * 0.25 : y0;
        const xOrigen = CERCA ? 60 : 0;
        // con la lente puesta, el rayo quiebra ahí; sin ella sigue derecho
        const yLente = y0 + (CONCAVA ? 1 : -1) * corr * OFFS[i] * 0.18;
        // pendiente hacia el foco desde el cristalino, extendida hasta la retina
        const m = (CY - yLente) / (fx - CRISTALINO_X);
        const yRetina = yLente + m * (RETINA_X - CRISTALINO_X);
        const puntos = [
            [xOrigen, yOrigen],
            [LENTE_X, y0],
            [CRISTALINO_X, yLente],
            [RETINA_X, yRetina],
        ];
        // recorte del trazo segun el avance (se dibuja de izquierda a derecha)
        const xMax = xOrigen + (RETINA_X - xOrigen) * traza;
        const visibles = [];
        for (let k = 0; k < puntos.length; k++) {
            const [x, y] = puntos[k];
            if (x <= xMax) { visibles.push(x + ',' + y); continue; }
            const [xa, ya] = puntos[k - 1] || [x, y];
            const f = (xMax - xa) / (x - xa || 1);
            if (f > 0) visibles.push((xa + (x - xa) * f) + ',' + (ya + (y - ya) * f));
            break;
        }
        el.setAttribute('points', visibles.join(' '));
        el.setAttribute('opacity', String(0.35 + 0.5 * traza));
    });

    // La mancha de desenfoque en la retina: alta sin corrección, un punto al corregir
    const spreadRetina = Math.abs((CY + 110) - (CY + 110 + ((CY - (CY+110)) / (fx - CRISTALINO_X)) * (RETINA_X - CRISTALINO_X)));
    const alto = Math.max(6, spreadRetina) * (1 - corr * 0.96);
    $('#mancha').setAttribute('y1', String(CY - alto));
    $('#mancha').setAttribute('y2', String(CY + alto));
    $('#mancha').setAttribute('opacity', String(traza * (1 - corr) * 0.8));

    // El punto de foco: rojo suave donde cae mal, bronce firme sobre la retina
    $('#foco').setAttribute('cx', String(fx));
    $('#foco').setAttribute('cy', String(CY));
    const pulso = 1 + 0.25 * Math.sin(t / 180);
    $('#foco').setAttribute('r', String(14 * (corr > 0.9 ? 1.15 : pulso)));
    $('#foco').setAttribute('fill', corr > 0.6 ? '${bronce}' : '#e8b4a0');
    $('#foco').setAttribute('opacity', String(traza * 0.95));
  };

  window.__dibujar(0);
</script>
</body></html>`;
}
