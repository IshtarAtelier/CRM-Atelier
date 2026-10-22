import { BUSINESS_INFO } from '@/lib/business-info';
import { NOTAS_MARCAS_CRISTALES } from '@/lib/constants/notas-marcas-cristales';
import { NOTAS_STELLEST } from '@/lib/constants/stellest-notas';

/**
 * /llms.txt — el índice del sitio para los asistentes de IA (ChatGPT,
 * Perplexity, Claude, Gemini), según la propuesta llmstxt.org. Les dice en
 * texto plano quiénes somos y cuáles son las páginas que responden mejor cada
 * pregunta, para que nos citen. Las notas salen de sus listas únicas: una nota
 * nueva aparece acá sola.
 */
export const revalidate = 86400;

const ORIGEN = 'https://atelieroptica.com.ar';

export function GET() {
  const linea = (titulo: string, ruta: string, desc: string) => `- [${titulo}](${ORIGEN}${ruta}): ${desc}`;
  const texto = [
    `# ${BUSINESS_INFO.name}`,
    '',
    `> Óptica en ${BUSINESS_INFO.address}. Anteojos recetados, multifocales, cristales de laboratorio, lentes de sol y de contacto, con tienda online y envíos a todo el país. Óptica certificada Stellest.`,
    '',
    `Horarios: ${BUSINESS_INFO.hours}. Teléfono y WhatsApp: ${BUSINESS_INFO.phone}.`,
    '',
    '## Marcas de cristales',
    ...NOTAS_MARCAS_CRISTALES.map((n) => linea(n.title, `/blog/${n.slug}`, n.resumen)),
    '',
    '## Cristales',
    linea('Cristales Hoya y Pentax', '/cristales-opticos/hoya', 'Progresivos, monofocales y la promo del segundo par.'),
    linea('Multifocales Varilux', '/cristales-opticos/varilux', 'Línea Varilux de Essilor.'),
    linea('Multifocales Kodak', '/cristales-opticos/kodak', 'Kodak Unique DRO y Precise.'),
    linea('Cristales con precio', '/cristales-opticos/tienda-online', 'Cristales que se compran online.'),
    linea('Multifocales', '/multifocales', 'Guía y presupuesto de multifocales.'),
    '',
    '## Control de miopía',
    ...NOTAS_STELLEST.map((n) => linea(n.title, `/blog/${n.slug}`, n.excerpt)),
    linea('MyoFix', '/blog/myofix', 'Cristal de Smart Lens para frenar la miopía infantil.'),
    '',
    '## La óptica',
    linea('Nuestro local', '/nuestro-local', 'Dónde estamos y cómo llegar.'),
    linea('Preguntas frecuentes', '/faq', 'Envíos, pagos, garantía y tiempos.'),
    linea('Tienda', '/tienda', 'Armazones y lentes de sol con precio.'),
    '',
  ].join('\n');
  return new Response(texto, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
