/**
 * Aplica a la tabla BlogPost las correcciones de la auditoría de contenido
 * del 19/8/2026 (claims sin fuente, productos inexistentes, links 404, typos).
 *
 * Las notas viejas del blog viven en la DB y la página [slug] sirve la DB
 * ANTES que el mapa estático del código: corregir el .tsx no alcanza.
 * Este script aplica los mismos reemplazos, string exacto por string exacto.
 *
 *   node scripts/maintenance/blog-correcciones-auditoria-contenido.mjs           → LOCAL (DATABASE_URL), sin escribir
 *   node scripts/maintenance/blog-correcciones-auditoria-contenido.mjs --write   → LOCAL, escribe
 *   node scripts/maintenance/blog-correcciones-auditoria-contenido.mjs --prod --write → PRODUCCIÓN (PROD_DATABASE_URL)
 *
 * Contra prod: updates con select explícito (el schema local está adelantado).
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const PROD = process.argv.includes('--prod');
const WRITE = process.argv.includes('--write');
const url = PROD ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
if (!url) throw new Error(PROD ? 'Falta PROD_DATABASE_URL' : 'Falta DATABASE_URL');
const prisma = new PrismaClient({ datasources: { db: { url } } });

// [slug, buscar, reemplazar] — el buscar debe estar EXACTO en el content de la DB.
const FIXES = [
  // ALTA: 9 links de producto 404 → /tienda
  ...['aurora-c1','atelier-hera-dwcn','atelier-leda-1yn2','atelier-iris-8u55','julieta-c1','atelier-pandora-my5d','atelier-diana-k0k7','atelier-athena-906p','atelier-ceres-rpg5']
    .map((s) => ['elegir-anteojos-recetados', `href="/producto/${s}"`, 'href="/tienda"']),
  // ALTA: variantes Eyezen inventadas
  ['lentes-eyezen-descanso-pantallas-essilor',
    'cuál de las 4 variaciones de potencia de Eyezen (Start, Plus, Pro o Max) es la ideal',
    'cuál de las variantes de Eyezen (Start, o Boost con sus 4 niveles de refuerzo: 0,4 / 0,6 / 0,85 / 1,1) es la ideal'],
  // ALTA: 98% inventado
  ['mejor-optica-multifocales-cordoba',
    'nos especializamos en lentes progresivos con una tasa de adaptación que supera el 98%. No es casualidad',
    'nos especializamos en lentes progresivos con garantía de adaptación de 30 días. No es casualidad'],
  // MEDIA: Ray-Ban Meta
  ['ray-ban-meta-smart-glasses-cordoba',
    'se encuentran cámaras de altísima definición. Podés sacar fotos y grabar videos de hasta 60 segundos en 1080p',
    'se encuentra una cámara de 12 MP de altísima definición. Podés sacar fotos y grabar videos de hasta 3 minutos en 1080p'],
  // MEDIA: Transitions Gen 8 → GEN S
  ['cristales-fotocromaticos-transitions',
    '<strong>Transitions Gen 8</strong>',
    '<strong>Transitions GEN S</strong>, la generación más reciente,'],
  // MEDIA: Comfort Max
  ['varilux-comfort-max-dolor-de-cuello',
    '227 posturas diferentes evaluadas durante su diseño garantizan que veas bien sin forzar el cuello.',
    'su diseño Flex Optim contempla cientos de posturas más que la generación anterior, para que veas bien sin forzar el cuello.'],
  ['varilux-comfort-max-dolor-de-cuello',
    'esta es la línea más amigable y de más rápida adaptación en el mercado de gama media-alta.',
    'esta es una de las líneas más amigables para adaptarse dentro de la gama media-alta.'],
  // MEDIA: Varilux XR
  ['varilux-xr-series-inteligencia-artificial',
    'recopilaron datos de más de un millón de pacientes en todo el mundo. Utilizando IA, lograron crear un cristal que literalmente <strong>predice cómo vas a mover los ojos</strong> antes de que lo hagas.',
    'recopilaron más de un millón de mediciones de comportamiento visual en todo el mundo. Utilizando IA, lograron crear un cristal que <strong>anticipa el comportamiento visual más probable según tu receta</strong>.'],
  ['varilux-xr-series-inteligencia-artificial',
    '9 de cada 10 pacientes se adaptan el mismo día que se los ponen, sin el clásico período de acostumbramiento.',
    'nitidez instantánea incluso en movimiento, con un período de acostumbramiento mucho más corto que los progresivos tradicionales.'],
  // MEDIA: Crizal superlativo
  ['tratamiento-antirreflex-crizal-sapphire',
    'Es el antirreflex más transparente del mercado mundial.',
    'Es uno de los antirreflex más transparentes de su categoría.'],
  // MEDIA: Stellest 67% condicionado a 12 h/día
  ['lentes-stellest-control-miopia-infantil',
    'ralentizan la progresión de la miopía en un <strong>67%</strong> comparado con los lentes tradicionales.',
    'ralentizan la progresión de la miopía en un <strong>67%</strong> comparado con los lentes tradicionales, usándolos al menos 12 horas por día.'],
  ['control-miopia',
    'ralentizan la progresión de la miopía en un 67% en promedio, comparado con lentes monofocales estándar.',
    'ralentizan la progresión de la miopía en un 67% en promedio, comparado con lentes monofocales estándar, cuando se usan al menos 12 horas por día.'],
  // MEDIA: filtro-azul claims
  ['filtro-azul-pantallas',
    'la sobreexposición constante a muy corta distancia genera un estrés enorme para nuestra retina.',
    'la exposición prolongada a corta distancia se asocia con fatiga y molestias visuales al final del día.'],
  ['filtro-azul-pantallas',
    '<li><strong>Mejoran el sueño:</strong> La luz azul bloquea la producción de melatonina (la hormona del sueño). Usar este filtro a la noche ayuda a dormir mejor.</li>',
    '<li><strong>Uso nocturno más amigable:</strong> la luz azul interviene en la regulación de la melatonina; filtrar parte de esa luz a la noche puede hacer más llevadero el uso de pantallas antes de dormir.</li>'],
  // MEDIA: Novar
  ['optica-exclusiva-cerro-rosas-cordoba',
    '<strong>Novar:</strong> Tecnología de tallado digital argentina-alemana con la mejor relación calidad-precio del mercado.',
    '<strong>Novar:</strong> Laboratorio argentino con tallado digital de excelente relación calidad-precio.'],
  ['multifocales-marcas-precios-varilux-novar',
    'Esto acerca el diseño visual al ojo, ampliando el campo de visión hasta un 30% respecto a los genéricos.',
    'Esto acerca el diseño visual al ojo, ampliando notablemente el campo de visión respecto a los genéricos.'],
  // BAJA: voseo/typos
  ['guia-multifocales-cordoba', '¡Visitános y volvé', '¡Visitanos y volvé'],
  ['guia-multifocales-cordoba', 'acostúmbrate a apuntar con la nariz', 'acostumbrate a apuntar con la nariz'],
  ['multifocales-primera-vez-guia-cordoba', 'Usálos desde temprano', 'Usalos desde temprano'],
  ['lentes-wicue-oscurecen-con-boton',
    'cambian de alineación casi a la velocidad de la luz (0.1 segundos)',
    'cambian de alineación en apenas 0,1 segundos'],
];

const bySlug = new Map();
for (const [slug, from, to] of FIXES) {
  if (!bySlug.has(slug)) bySlug.set(slug, []);
  bySlug.get(slug).push([from, to]);
}

console.log(`\n═══ ${PROD ? 'PRODUCCIÓN' : 'LOCAL'} — ${WRITE ? 'ESCRIBIENDO' : 'PRUEBA (no escribe)'} ═══\n`);
let applied = 0, missed = 0, updatedPosts = 0;
for (const [slug, pairs] of bySlug) {
  const post = await prisma.blogPost.findUnique({ where: { slug }, select: { content: true, excerpt: true } });
  if (!post) { console.log(`— ${slug}: NO está en esta DB (se sirve del código, ok)`); continue; }
  let c = post.content; const done = [], miss = [];
  for (const [from, to] of pairs) {
    if (c.includes(from)) { c = c.split(from).join(to); done.push(from.slice(0, 55)); applied++; }
    else { miss.push(from.slice(0, 70)); missed++; }
  }
  if (done.length && WRITE) {
    await prisma.blogPost.update({ where: { slug }, data: { content: c }, select: { slug: true } });
    updatedPosts++;
  }
  console.log(`${done.length ? '✅' : '·'} ${slug}: ${done.length} aplicadas${miss.length ? `, ${miss.length} SIN MATCH` : ''}`);
  for (const m of miss) console.log(`   MISS: ${m}`);
}
console.log(`\nTotal: ${applied} reemplazos${WRITE ? ` en ${updatedPosts} notas` : ' (simulado)'}, ${missed} sin match.`);
await prisma.$disconnect();
