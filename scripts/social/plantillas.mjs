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
    ${slide.imagenResuelta ? `<div class="producto ${slide.encuadre === 'cover' ? 'llena' : ''}" style="background-image:url('${comoUrl(slide.imagenResuelta)}')"></div>` : ''}
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
    const esApaisado = id.formato?.nombre === '1.91:1';
    const esCuadrado = id.formato?.nombre === '1:1';

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
    padding:96px 88px 380px;
    display:flex; flex-direction:column; justify-content:flex-end;
  }

  .contenido.cover { justify-content:flex-end; }
  /* La lista sin foto se centra; CON foto se apoya abajo, para no taparle la
     cara a la persona de la imagen ni dejar un hueco entre el texto y el pie.
     Se vio mirando la captura, que es como manda la guía. */
  .contenido.list  { justify-content:center; }
  .contenido.list.con-foto { justify-content:flex-end; }

  h1 { font-size:82px; line-height:1.04; font-weight:900; letter-spacing:-.025em; }
  h2 { font-size:64px; line-height:1.1;  font-weight:900; letter-spacing:-.02em; margin-bottom:44px; }
  /* Bronce CLARO (el del tema oscuro de globals.css): el bronce normal sobre
     este fondo mide 3,6-4:1 y justo resalta las frases que venden ("rehacemos
     el cristal", "30 dias de garantia"). El claro pasa de 9:1. El numero
     grande (.dato) sigue con el bronce normal: como texto grande su umbral es
     3:1 y lo cumple. */
  .marca { color:${id.colores.marcaClara}; }

  /* Producto: la foto ocupa la mitad de arriba, sobre fondo claro para que el
     armazón se vea bien recortado. El texto va abajo, sin taparla. */
  .producto {
    position:absolute; top:0; left:0; right:0; height:56%;
    background-size:contain; background-repeat:no-repeat; background-position:center;
    background-color:#ffffff;
  }
  /*
   * El contain con fondo blanco de arriba es para un ARMAZON RECORTADO: la foto
   * tiene que entrar entera, sin cortar una varilla, y el blanco es el fondo
   * del propio recorte, asi que no se nota.
   *
   * Con una foto editorial (personas, el local) eso deja franjas blancas a los
   * costados y la placa parece mal armada. Paso con las de campania.
   *
   * La clase llena es para esas: la foto cubre la franja y se recorta lo que
   * sobra, que en una foto de ambiente no molesta.
   */
  .producto.llena { background-size:cover; background-color:transparent; }

  /*
   * La franja de la foto termina en un corte recto contra el fondo oscuro y se
   * ve como dos placas pegadas. Este degrade funde el blanco del recorte con el
   * fondo, que es lo que hace que la pieza se lea como una sola cosa.
   * Va sobre la foto, no debajo: tiene que tapar el borde.
   */
  .producto::after {
    content:''; position:absolute; left:0; right:0; bottom:0; height:26%;
    background:linear-gradient(180deg, rgba(255,255,255,0) 0%, ${fondo} 92%);
  }
  /* En la variante llena la foto es editorial y ya trae su propio velo, asi
     que el degrade se suaviza para no ensuciarla. */
  .producto.llena::after { height:34%;
    background:linear-gradient(180deg, transparent 0%, ${fondo} 96%); }
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
    /* ZONA SEGURA DE UN DEDO en TODOS los formatos: ~20% del alto libre abajo.
       Es donde el pulgar apoya y donde Meta superpone el botón de CTA en las
       ubicaciones que lo llevan. Proporcional por formato: 4:5 → 267px,
       1:1 → 214px, 9:16 → 380px, 1.91:1 → 124px. */
    position:absolute; left:88px; right:88px; bottom:267px;
    display:flex; align-items:center; gap:20px;
  }
  .logo { height:52px; width:auto; ${oscuro ? 'filter:brightness(0) invert(1);' : ''} opacity:.95; }
  .handle { font-size:26px; font-weight:500; letter-spacing:.06em; opacity:.7; }

  /* ── Ajustes por formato ──────────────────────────────────────────────────
     VAN AL FINAL A PROPÓSITO. Estaban arriba y no se aplicaban: las reglas
     base de .producto y .pie venían después y ganaban por orden. La placa
     apaisada salió con la foto encima del texto y el pie superpuesto. */

  ${esStory ? `
  /* Story (9:16): mucho más alta que el feed. El texto apoyado abajo deja media
     pantalla vacía y cae por debajo de donde la gente apoya el pulgar. Se
     centra y se agranda: una story se mira dos segundos, no se lee. */
  /* ZONA SEGURA DE ANUNCIO: en una story promocionada, el botón "Enviar
     mensaje" se superpone sobre la imagen y tapa la franja inferior. El pie
     sube a 460px y el texto reserva ese espacio. 380px (un dedo) alcanzaba
     para Stories, pero en FACEBOOK REELS la pila de UI (cuenta + caption +
     botón) sube más y pisaba el logo — verificado en la vista previa real
     de Meta. Sin esto, el logo queda tapado SIEMPRE en esa ubicación. */
  .contenido { justify-content:center; padding:120px 96px 580px; }
  .pie { bottom:460px; }
  h1 { font-size:104px; }
  h2 { font-size:78px; }
  .cuerpo { font-size:44px; margin-top:40px; }
  .bajada { font-size:42px; margin-top:40px; }
  .item { font-size:44px; }
  /* El velo del feed se oscurece hacia abajo porque ahí va el texto; acá el
     texto está al medio, donde ese gradiente todavía es claro. */
  .velo { background:linear-gradient(180deg,
      ${oscuro ? 'rgba(42,33,28,.55)' : 'rgba(250,248,245,.62)'} 0%,
      ${oscuro ? 'rgba(42,33,28,.80)' : 'rgba(250,248,245,.88)'} 45%,
      ${oscuro ? 'rgba(42,33,28,.88)' : 'rgba(250,248,245,.94)'} 100%); }
  /* Producto es la excepción: la foto va arriba sobre fondo blanco, así que el
     texto tiene que quedar ABAJO, sobre el oscuro. Centrado cae sobre el blanco
     y, siendo texto blanco, desaparece. Pasó: salió el precio sin nombre. */
  .contenido.number { justify-content:flex-end; }
  /* Más alta que en el feed y la foto un poco arriba del centro: en 9:16, con
     el armazón centrado en su franja queda un hueco muerto entre la foto y el
     texto. */
  .producto { height:58%; background-position:center 42%; }
  ` : ''}

  ${esCuadrado ? `
  /* Cuadrado (1:1): el layout del feed funciona, solo se ajusta el aire. */
  .contenido { padding:80px 76px 320px; }
  .pie { bottom:214px; }
  h1 { font-size:74px; }
  h2 { font-size:58px; margin-bottom:34px; }
  .producto { height:52%; }
  ` : ''}

  ${esApaisado ? `
  /* Apaisado (1.91:1): 1200x628, la ubicación más chica y más ancha. No entra
     un párrafo, entra un titular y un dato. La foto va al COSTADO: partir 628px
     en dos franjas horizontales no deja lugar para nada. */
  .producto { top:0; bottom:0; left:auto; right:0; width:44%; height:100%;
              background-size:cover; }
  /* El padding-bottom reserva la franja del pie. Sin él, el texto centrado baja
     hasta el logo y se superponen: la bajada quedaba escrita encima del
     isotipo. */
  .contenido { inset:0; padding:32px 52px 180px 60px; padding-right:50%;
               justify-content:center; }
  h1 { font-size:56px; line-height:1.03; }
  h2 { font-size:44px; margin-bottom:18px; }
  .rotulo { font-size:25px; }
  .dato { font-size:82px; margin-top:6px; }
  .cuerpo { font-size:25px; margin-top:14px; line-height:1.3; }
  .bajada { font-size:25px; margin-top:14px; line-height:1.3; }
  .item { font-size:25px; }
  /* El pie se achica y se ancla a la izquierda: con 628px de alto, el de 74px
     de separación se comía el texto. */
  .pie { left:60px; right:auto; bottom:124px; gap:12px; }
  .logo { height:34px; }
  .handle { font-size:19px; }
  ` : ''}
</style></head>
<body>${plantilla(slide, id)}</body></html>`;
}
