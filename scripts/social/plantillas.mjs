/**
 * Las plantillas de cada tipo de slide, en HTML + CSS.
 *
 * Se dibuja con el navegador y no con una librería de canvas porque el tipógrafo
 * lo hace el navegador: saltos de línea, kerning y ajuste del texto largo salen
 * gratis. Y se puede abrir la pieza en Chrome para ajustar el diseño en vivo.
 *
 * PROHIBIDO escribir un color o una fuente literal acá: todo sale de
 * `identidad.mjs`, que a su vez lee `globals.css`.
 *
 * Se arranca con TRES tipos (cover, list, cta). La guía propone ocho; cada uno
 * es una plantilla más para mantener, así que se suman cuando una pieza real los
 * necesite, no antes.
 */

/** Escapa el texto para que un `&` o un `<` en el contenido no rompa el HTML. */
const esc = (s) => String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Los asteriscos resaltan en el color de marca: `*así*`.
 * Es el ÚNICO formato del texto — sin negritas, sin cursivas, sin nada más.
 * Menos opciones, menos formas de que quede feo.
 */
const resaltar = (texto) =>
    esc(texto).replace(/\*([^*]+)\*/g, '<span class="marca">$1</span>');

/**
 * Las imágenes llegan ya convertidas a data URI por render.mjs.
 *
 * No se usan rutas `file://`: cuando el HTML se carga con setContent(), el
 * documento no tiene origen de archivo y el navegador BLOQUEA esas URLs — la
 * pieza sale con el fondo liso y sin logo, y no avisa. Se descubrió mirando la
 * primera captura.
 */
const comoUrl = (dataUri) => dataUri;

function pie(id) {
    // El logo va alineado VERTICALMENTE AL CENTRO con el handle, no al fondo de
    // la caja: alineado abajo se ve mal y no se entiende por qué hasta que se
    // mide con una regla (pozo documentado en la guía).
    return `
    <footer class="pie">
      <img class="logo" src="${comoUrl(id.logo)}" alt="">
      <span class="handle">${esc(id.handle)}</span>
    </footer>`;
}

function fondoDeImagen(imagen) {
    if (!imagen) return '';
    return `<div class="foto" style="background-image:url('${comoUrl(imagen)}')"></div>
            <div class="velo"></div>`;
}

const PLANTILLAS = {
    /** Portada: el gancho. Título fuerte, bajada corta, imagen de fondo. */
    cover: (slide, id) => `
    ${fondoDeImagen(slide.imagenResuelta)}
    <div class="contenido cover">
      <h1>${resaltar(slide.title)}</h1>
      ${slide.subtitle ? `<p class="bajada">${resaltar(slide.subtitle)}</p>` : ''}
    </div>
    ${pie(id)}`,

    /** Lista: de tres a cinco puntos. El caballito del pilar Educación. */
    list: (slide, id) => `
    ${fondoDeImagen(slide.imagenResuelta)}
    <div class="contenido list${slide.imagenResuelta ? ' con-foto' : ''}">
      <h2>${resaltar(slide.title)}</h2>
      <ul>
        ${(slide.items || []).map(i => `<li>${resaltar(i)}</li>`).join('')}
      </ul>
    </div>
    ${pie(id)}`,

    /**
     * Número: un dato grande. La guía lo recomienda para precios y plazos, y es
     * el que usan las piezas de producto que salen de la base.
     * La foto va ARRIBA y sin velo pesado: en un armazón la foto ES el producto,
     * no un fondo decorativo.
     */
    number: (slide, id) => `
    ${slide.imagenResuelta ? `<div class="producto" style="background-image:url('${comoUrl(slide.imagenResuelta)}')"></div>` : ''}
    <div class="contenido number">
      <p class="rotulo">${resaltar(slide.title)}</p>
      <p class="dato">${esc(slide.dato)}</p>
      ${slide.body ? `<p class="cuerpo">${resaltar(slide.body)}</p>` : ''}
    </div>
    ${pie(id)}`,

    /** Cierre: qué hacer ahora. Una sola acción concreta. */
    cta: (slide, id) => `
    ${fondoDeImagen(slide.imagenResuelta)}
    <div class="contenido cta">
      <h2>${resaltar(slide.title)}</h2>
      ${slide.body ? `<p class="cuerpo">${resaltar(slide.body)}</p>` : ''}
    </div>
    ${pie(id)}`,
};

export const TIPOS_SOPORTADOS = Object.keys(PLANTILLAS);

/** El HTML completo de UNA slide, listo para capturar. */
export function htmlDeSlide(slide, id, pieza) {
    const plantilla = PLANTILLAS[slide.type];
    if (!plantilla) {
        throw new Error(
            `Tipo de slide desconocido: "${slide.type}". ` +
            `Los que existen hoy: ${TIPOS_SOPORTADOS.join(', ')}.`
        );
    }

    const oscuro = pieza.theme !== 'light';
    const fondo = oscuro ? id.oscuro : id.colores.fondo;
    const texto = oscuro ? '#ffffff' : id.colores.texto;
    const esStory = id.formato?.nombre === '9:16';

    return `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${id.googleFonts}" rel="stylesheet">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    width:${id.formato.ancho}px; height:${id.formato.alto}px;
    background:${fondo}; color:${texto};
    font-family:${id.fuentes.texto};
    position:relative; overflow:hidden;
    -webkit-font-smoothing:antialiased;
  }

  /* Foto a sangre, con un velo para que el texto se lea siempre */
  .foto {
    position:absolute; inset:0;
    background-size:cover; background-position:center;
  }
  .velo {
    position:absolute; inset:0;
    background:linear-gradient(180deg,
      ${oscuro ? 'rgba(42,33,28,.45)' : 'rgba(250,248,245,.55)'} 0%,
      ${oscuro ? 'rgba(42,33,28,.92)' : 'rgba(250,248,245,.95)'} 68%);
  }

  .contenido {
    position:absolute; inset:0;
    padding:96px 88px 190px;
    display:flex; flex-direction:column; justify-content:flex-end;
  }

  /* Story (9:16): la placa es mucho más alta que el carrusel del feed, así que
     el texto apoyado abajo deja media pantalla vacía y queda por debajo de la
     zona donde la gente apoya el pulgar. Se centra y se agranda: una story se
     mira dos segundos, no se lee. */
  ${esStory ? `
  /* El velo del feed se oscurece hacia abajo porque ahí va el texto. En la
     story el texto está al medio, donde ese gradiente todavía es claro: se
     empareja para que el contraste no dependa de qué hay en la foto. */
  .velo { background:linear-gradient(180deg,
      ${oscuro ? 'rgba(42,33,28,.55)' : 'rgba(250,248,245,.62)'} 0%,
      ${oscuro ? 'rgba(42,33,28,.80)' : 'rgba(250,248,245,.88)'} 45%,
      ${oscuro ? 'rgba(42,33,28,.88)' : 'rgba(250,248,245,.94)'} 100%); }
  .contenido { justify-content:center !important; padding:120px 96px 260px; }
  h1 { font-size:104px; }
  h2 { font-size:78px; }
  .cuerpo { font-size:44px; margin-top:40px; }
  .bajada { font-size:42px; margin-top:40px; }
  .item { font-size:44px; }
  ` : ''}
  .contenido.cover { justify-content:flex-end; }
  /* La lista sin foto se centra; CON foto se apoya abajo, para no taparle la
     cara a la persona de la imagen ni dejar un hueco entre el texto y el pie.
     Se vio mirando la captura, que es como manda la guía. */
  .contenido.list  { justify-content:center; }
  .contenido.list.con-foto { justify-content:flex-end; }

  h1 { font-size:82px; line-height:1.04; font-weight:900; letter-spacing:-.025em; }
  h2 { font-size:64px; line-height:1.1;  font-weight:900; letter-spacing:-.02em; margin-bottom:44px; }
  .marca { color:${id.colores.marca}; }

  /* Producto: la foto ocupa la mitad de arriba, sobre fondo claro para que el
     armazón se vea bien recortado. El texto va abajo, sin taparla. */
  .producto {
    position:absolute; top:0; left:0; right:0; height:56%;
    background-size:contain; background-repeat:no-repeat; background-position:center;
    background-color:#ffffff;
  }
  .contenido.number { justify-content:flex-end; }
  .rotulo { font-size:38px; font-weight:700; letter-spacing:-.01em; opacity:.9; }
  .dato {
    font-size:104px; font-weight:900; letter-spacing:-.03em; line-height:1;
    margin-top:14px; color:${id.colores.marca};
  }

  .bajada { margin-top:32px; font-size:34px; line-height:1.4; font-weight:400; opacity:.86; }
  /* pre-line: los saltos de línea del texto se respetan. Sin esto, un cuerpo
     con dos horarios en dos líneas sale todo corrido en un párrafo y no se
     entiende dónde termina uno y empieza el otro. */
  .cuerpo { margin-top:28px; font-size:36px; line-height:1.38; font-weight:400; opacity:.9; white-space:pre-line; }

  ul { list-style:none; display:flex; flex-direction:column; gap:30px; }
  li {
    font-size:37px; line-height:1.34; font-weight:500;
    padding-left:44px; position:relative;
  }
  li::before {
    content:''; position:absolute; left:0; top:.55em;
    width:18px; height:18px; border-radius:50%;
    background:${id.colores.marca};
  }

  /* Logo y handle centrados entre sí, no pegados al fondo de la caja */
  .pie {
    position:absolute; left:88px; right:88px; bottom:74px;
    display:flex; align-items:center; gap:20px;
  }
  .logo { height:52px; width:auto; ${oscuro ? 'filter:brightness(0) invert(1);' : ''} opacity:.95; }
  .handle { font-size:26px; font-weight:500; letter-spacing:.06em; opacity:.7; }
</style></head>
<body>${plantilla(slide, id)}</body></html>`;
}
