import sanitizeHtml from 'sanitize-html';

/**
 * Sanitiza el HTML de los posts de blog (contenido de la DB / generado por IA)
 * antes de renderizarlo con dangerouslySetInnerHTML y antes de persistirlo.
 *
 * Fix de XSS almacenado: la config previa usaba `allowedAttributes: false`, que
 * NO filtra atributos, así que sobrevivían onerror/onclick/onmouseover y el
 * srcdoc de <iframe>. Acá la whitelist es EXPLÍCITA: se caen <script>, todos los
 * manejadores on*, srcdoc, y los esquemas peligrosos (javascript:, data: en href/src).
 */
export function sanitizeBlogHtml(html: string): string {
  if (!html) return '';
  return sanitizeHtml(html, {
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags,
      'img', 'figure', 'figcaption',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    ],
    allowedAttributes: {
      a: ['href', 'name', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height', 'loading', 'decoding', 'style'],
      iframe: ['src', 'width', 'height', 'allow', 'allowfullscreen', 'frameborder'],
      div: ['style'],
      span: ['style'],
      p: ['style'],
      figure: ['style'],
      table: ['style'],
      td: ['style', 'colspan', 'rowspan'],
      th: ['style', 'colspan', 'rowspan'],
      '*': ['class'],
    },
    allowedStyles: {
      '*': {
        width: [/^.*$/],
        height: [/^.*$/],
        'max-width': [/^.*$/],
        'text-align': [/^(left|right|center|justify)$/],
        margin: [/^.*$/],
        'margin-top': [/^.*$/],
        'margin-bottom': [/^.*$/],
        float: [/^(left|right|none)$/],
      },
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: { img: ['http', 'https'] },
    allowedIframeHostnames: [
      'www.youtube.com',
      'youtube.com',
      'www.youtube-nocookie.com',
      'player.vimeo.com',
    ],
    transformTags: {
      a: (_tagName, attribs) => ({
        tagName: 'a',
        attribs: { ...attribs, rel: 'noopener noreferrer nofollow' },
      }),
      img: (_tagName, attribs) => ({
        tagName: 'img',
        attribs: { ...attribs, loading: 'lazy', decoding: 'async' },
      }),
    },
  });
}
