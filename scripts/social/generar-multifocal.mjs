/**
 * Arma la pieza de PRECIO DE MULTIFOCAL leyendo la base — la primera de la
 * historia de la cuenta.
 *
 *   node scripts/social/generar-multifocal.mjs              → contra la base LOCAL
 *   node scripts/social/generar-multifocal.mjs --produccion  → contra producción (solo lee)
 *
 * POR QUÉ EXISTE
 * El multifocal es el producto que factura (ticket ~$830.000) y hasta hoy no
 * había NINGUNA pieza social con su precio: mientras tanto la competencia ancla
 * la categoría en $120.000 a quince minutos de acá. Publicar un número es la
 * única forma de discutir ese ancla. Pero un precio publicado sale de la base o
 * no sale (regla R6): por eso esto es un generador y no un JSON escrito a mano.
 * La pieza sale marcada `fuente: "base"` — lo único que hace que el validador
 * acepte precios — y con `generadoEl`, que el cron del feed usa para negarse a
 * publicar precios de más de 10 días (`src/lib/social/frescura.ts`).
 *
 * DE DÓNDE SALE CADA NÚMERO
 *  · El precio de cada gama: el de la opción de multifocal del configurador,
 *    con el producto vinculado en /admin/web → Cristales. Se lee con el MISMO
 *    service que usan la tienda, el checkout y la landing `/multifocales`
 *    (`src/services/cristales-web.service.ts`), no con una copia: antes esto
 *    repetía el matcher por palabras clave y el 10/8/2026 dos copias
 *    distintas publicaban y cobraban precios distintos.
 *  · Las cuotas y el descuento de contado: de `SystemSetting`, que es de donde
 *    los lee la tienda (`PaymentOptions.tsx`), con el mismo redondeo.
 *  · El armazón de entrada: el más barato publicado, activo y CON STOCK.
 *
 * PLACA, ANUNCIO Y LANDING NO PUEDEN DECIR NÚMEROS DISTINTOS. Por eso el titular
 * de la placa es exactamente el ancla de la landing (el cristal multifocal más
 * barato) y no una suma armada acá: la landing dice "cristales multifocales
 * desde $X · el armazón lo elegís vos" y la pieza dice lo mismo, con las mismas
 * palabras. Si algún día hiciera falta publicar el "anteojo completo", el número
 * tiene que nacer en un solo lugar y leerse desde ahí, no calcularse dos veces.
 *
 * QUÉ ESCRIBE
 *  · `social/contenido/multifocal-desde.json` — el carrusel 4:5 del feed.
 *  · `social/contenido/ad-l1-multifocal-desde{,-cuadrado,-story,-apaisado}.json`
 *    — las cuatro medidas que pide Meta Ads (es el creativo `[metaDesde]` de M1).
 *
 * NO renderiza ni publica: para eso están `render.mjs` y `publicar.mjs`, y
 * publicar exige `--facebook`/`--instagram` explícitos.
 */
import 'dotenv/config';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { RAIZ } from './identidad.mjs';
import { register } from 'node:module';
import { cuotasLargas, leerPromoCuotas } from './condiciones-pago.mjs';

const SALIDA = path.join(RAIZ, 'social', 'contenido');
const BANCO = path.join(RAIZ, 'public', 'images');

/** El id de la pieza del feed, tal como lo nombra el calendario del plan. */
const ID_CARRUSEL = 'multifocal-desde';
/** Prefijo de los creativos de anuncio: lote 1 (multifocales) de Meta. */
const ID_ANUNCIO = 'ad-l1-multifocal-desde';

/**
 * Una línea de detalle por gama, para la escalera de la placa. El NOMBRE de la
 * gama no va acá: es la etiqueta de la opción en la base (la misma card que ve
 * el cliente en el configurador), así el aviso y la tienda no pueden llamarla
 * distinto.
 */
const DETALLE_DE_GAMA = {
    SMART_FREE: 'campo visual amplio',
    FOTOCROMATICO: 'se oscurece al sol',
    VARILUX: 'la gama alta de Essilor',
};

/** Los cuatro tamaños de anuncio, con el sufijo de archivo de la familia ad-l1-*. */
const TAMANOS = [
    { formato: '4:5', sufijo: '', donde: 'Feed de Instagram y Facebook' },
    { formato: '1:1', sufijo: '-cuadrado', donde: 'Varias ubicaciones (la que menos se recorta)' },
    { formato: '9:16', sufijo: '-story', donde: 'Stories y Reels' },
    { formato: '1.91:1', sufijo: '-apaisado', donde: 'Columna derecha, Marketplace, Audience Network' },
];

/** $269.000 — sin decimales, que en una placa no aportan y ocupan. */
const plata = (n) => `$${Math.round(n).toLocaleString('es-AR')}`;

function tieneFlag(nombre) {
    return process.argv.includes(`--${nombre}`);
}

/**
 * El resolutor de opciones de cristal de la app, importado tal cual (TypeScript
 * directo: Node 22 lo lee sin compilar). El loader de alias es el mismo que usan
 * los checks para importar services reales con `@/`.
 */
async function importarResolutor() {
    register('../checks/_alias-loader.mjs', import.meta.url);
    return import('../../src/services/cristales-web.service.ts');
}

/**
 * Las condiciones de pago, leídas de DONDE LAS LEE LA TIENDA (`SystemSetting`),
 * con el mismo redondeo que `PaymentOptions.tsx`. Si la fuente fuera otra, el
 * aviso diría un número y la ficha otro, y el cliente llega a la tienda desde el
 * aviso.
 */
async function condicionesDeVenta(prisma) {
    const filas = await prisma.systemSetting.findMany({
        where: { key: { in: ['web_promo_installments', 'web_promo_cash_discount'] } },
        select: { key: true, value: true },
    });
    const get = (k) => filas.find(f => f.key === k)?.value;

    // `web_promo_installments` es texto libre cargado desde /admin/web:
    // `leerPromoCuotas` solo acepta un número que de verdad se venda sin interés
    // (3 o 6). Con "12 cuotas" ahí, esto habría dividido el precio de lista por
    // 12 y lo habría rotulado "sin interés" — la frase prohibida y, encima, el
    // precio equivocado (las 12 llevan el costo financiero).
    const promo = leerPromoCuotas(get('web_promo_installments'));
    const crudo = Number(get('web_promo_cash_discount'));
    return {
        cuotas: promo.cantidad,
        textoCuotas: promo.texto,
        // El mismo default que PaymentOptions.tsx cuando el setting no está.
        descuento: Number.isFinite(crudo) && crudo > 0 ? crudo : 15,
    };
}

/**
 * El armazón más barato que se puede comprar HOY: publicado, activo y con stock.
 * Sin stock no entra — mandar gente a comprar lo que no hay es peor que no
 * publicar. Es de categoría "Receta": el armazón que acompaña a un multifocal es
 * un recetado, no uno de sol.
 */
async function armazonDeEntrada(prisma, categoria) {
    const webs = await prisma.webProduct.findMany({
        where: {
            isActive: true,
            category: { equals: categoria, mode: 'insensitive' },
            product: { stock: { gt: 0 }, price: { gt: 0 } },
        },
        select: { name: true, slug: true, product: { select: { price: true, brand: true } } },
    });
    if (!webs.length) return null;
    const barato = webs.reduce((a, b) => (b.product.price < a.product.price ? b : a));
    return { nombre: String(barato.name).replace(/\s+C\d+\s*$/i, '').trim(), precio: barato.product.price };
}

/**
 * Chequea que toda imagen citada exista en el banco. Es la regla R5 del
 * validador, adelantada al momento de generar: si falta una foto conviene
 * enterarse acá y no cuando alguien va a renderizar la placa del sábado.
 */
function verificarImagenes(piezas) {
    for (const pieza of piezas) {
        for (const s of pieza.slides) {
            if (s.image && !existsSync(path.join(BANCO, s.image))) {
                throw new Error(`R5: la imagen "${s.image}" no existe en public/images/ (pieza ${pieza.id}).`);
            }
        }
    }
}

export async function generarPiezaMultifocal({ produccion = false, categoriaArmazon = 'Receta' } = {}) {
    const url = produccion ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
    if (!url) throw new Error(`Falta ${produccion ? 'PROD_DATABASE_URL' : 'DATABASE_URL'} en el .env`);

    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient({ datasources: { db: { url } } });

    try {
        console.log(`\nBase: ${produccion ? 'PRODUCCIÓN (solo lectura)' : 'LOCAL'}`);

        // Las gamas son las opciones de multifocal que vende la tienda, con el
        // precio del producto vinculado. El service usa `select` explícito
        // (el schema local está adelantado respecto de producción).
        const { resolverOpcionesDeCristal } = await importarResolutor();
        const opciones = await resolverOpcionesDeCristal(prisma);
        const gamas = [];
        for (const o of opciones.filter(x => x.grupo === 'MULTIFOCAL')) {
            if (!o.disponible) {
                // Una gama sin producto vinculado no se inventa: queda fuera.
                console.log(`  ⚠️  ${o.etiqueta}: no disponible en la tienda (${o.motivo}), queda fuera de la pieza.`);
                continue;
            }
            gamas.push({
                clave: o.codigo,
                rotulo: o.etiqueta,
                detalle: DETALLE_DE_GAMA[o.codigo] ?? o.descripcion ?? '',
                precio: o.precio,
                producto: o.nombreProducto,
                es2x1: o.is2x1,
            });
            console.log(`  · ${o.etiqueta.padEnd(22)} ${plata(o.precio).padStart(12)}   ← ${o.nombreProducto}`);
        }
        if (!gamas.length) {
            throw new Error('Ninguna opción de multifocal está disponible en la tienda (/admin/web → Cristales). Sin precio no hay pieza.');
        }

        // El ancla es la gama más barata: el mismo número que calcula
        // `precioMultifocalDesde()` para la landing, con la misma regla.
        // De menor a mayor: la escalera se lee de una sola pasada.
        gamas.sort((a, b) => a.precio - b.precio);
        const ancla = gamas[0];

        const cond = await condicionesDeVenta(prisma);
        console.log(`  · condiciones (de la tienda): ${cond.textoCuotas} · ${cond.descuento}% al contado`);

        const armazon = await armazonDeEntrada(prisma, categoriaArmazon);
        if (armazon) console.log(`  · armazón de entrada: ${armazon.nombre} ${plata(armazon.precio)}`);
        else console.log('  · sin armazón publicado con stock: la pieza sale sin esa línea.');

        // Mismo cálculo que la tienda: Math.round sobre el precio de lista. Un
        // peso de diferencia entre el aviso y la ficha es una discusión en el
        // mostrador.
        const cuota = Math.round(ancla.precio / cond.cuotas);
        const alContado = Math.round(ancla.precio * (1 - cond.descuento / 100));
        // 12 cuotas MP (27/8/26): misma fórmula que la tienda
        // (lista × factor ÷ 12), con el factor leído de
        // RECARGO_MP_CUOTAS_LARGAS en vez de un 1,10 tipeado acá.
        //
        // REGLA DE COMUNICACIÓN (Ishtar, 31/8/2026 a la noche): las 12 se
        // dicen "cuotas fijas", sin la leyenda del % — el recargo va ADENTRO
        // del importe. Y nunca "sin interés" (eso son solo 3 y 6).
        const texto12 = (await cuotasLargas(ancla.precio)).texto;
        const hoy = new Date().toISOString().slice(0, 10);

        // El mismo texto que muestra la landing (`LandingClient.tsx`): dice
        // "cristales", no "anteojos", porque el armazón va aparte. La placa no
        // puede prometer más que la página a la que manda.
        const TITULAR = 'Cristales multifocales';

        // La escalera de gamas solo tiene sentido con dos o más: con una sola
        // sería una lista de un renglón.
        const hayEscalera = gamas.length > 1;

        // Un precio de 2x1 cubre DOS pares. Si no se aclara, esa gama parece
        // carísima al lado de la de entrada y se pierde la ventaja.
        const nota2x1 = (g) => (g.es2x1 ? ' · los dos pares (2x1)' : '');
        const notaAncla = ancla.es2x1 ? ' Ese precio cubre los dos pares (2x1).' : '';

        const caption = [
            `Cuánto sale un multifocal en Atelier, sin "consultar precio".`,
            ``,
            `${TITULAR} desde ${plata(ancla.precio)} — ${texto12}, ${cond.textoCuotas} de ${plata(cuota)}, o transferencia ${cond.descuento}% OFF: ${plata(alContado)}.`,
            `Es el cristal: el armazón lo elegís vos${armazon ? `, y arrancan en ${plata(armazon.precio)}` : ''}.${notaAncla}`,
            ...(hayEscalera ? [
                ``,
                `Las gamas y desde cuánto arranca cada una:`,
                ...gamas.map(g => `· ${g.rotulo} — desde ${plata(g.precio)}${g.es2x1 ? ' (los dos pares, 2x1)' : ''}`),
            ] : []),
            ``,
            `Los medimos con tu armazón puesto y quedás con 30 días de garantía de adaptación: si no te adaptás, rehacemos el cristal.`,
            ``,
            `Mandanos la receta por WhatsApp y te pasamos el total exacto. Cerro de las Rosas, sin turno previo.`,
        ].join('\n');

        const carrusel = {
            id: ID_CARRUSEL,
            format: '4:5',
            theme: 'dark',
            pilar: 'accion',
            // La marca que habilita los precios en el validador (R6).
            fuente: 'base',
            // Cuándo se leyeron esos precios. Sin esta fecha el cron no publica
            // la pieza: no se puede probar que el número sea el de hoy.
            generadoEl: hoy,
            // De qué base salieron. La local está semanas atrás de producción:
            // sin esta marca, una placa generada para mirar el diseño se ve
            // idéntica a una lista para publicar, y la guarda de frescura no
            // ayuda (la fecha es de hoy igual). Quien publique tiene que ver
            // "produccion" acá.
            generadoDesde: produccion ? 'produccion' : 'local',
            temas: ['multifocales'],
            caption,
            slides: [
                {
                    // La portada LLEVA el número, al revés que los carruseles de
                    // catálogo (donde el gancho no es el precio). Acá el precio
                    // ES el gancho: la pieza existe para discutir el ancla de
                    // $120.000 que instaló la competencia, y eso no se discute
                    // recién en la tercera slide.
                    type: 'cover',
                    role: 'portada',
                    image: 'blog/multifocal-mujer-lectura.png',
                    title: `${TITULAR} *desde ${plata(ancla.precio)}*`,
                    subtitle: `Sin "consultar precio". El armazón lo elegís vos.${notaAncla}`,
                },
                {
                    type: 'number',
                    // Con escalera son 5 slides y el validador (R2) pide declarar
                    // la bisagra: es acá, donde el carrusel gira de "cuánto sale"
                    // a "cómo se paga", que es la objeción real de un ticket de
                    // este tamaño.
                    //
                    // Sin escalera son 4 slides y esta va SIN foto: tres fotos
                    // sobre cuatro slides es 75% y R4 corta en 60%. La regla
                    // existe porque si todo es foto, ninguna foto jerarquiza — y
                    // la de la portada es la que tiene que jerarquizar.
                    ...(hayEscalera ? {
                        role: 'bisagra',
                        image: 'blog/lentes-progresivos-zonas.png',
                        // Foto editorial: sin `cover` la plantilla la deja con
                        // franjas blancas a los costados (el default es el
                        // recorte de un armazón sobre blanco).
                        encuadre: 'cover',
                    } : {}),
                    title: cond.textoCuotas,
                    dato: plata(cuota),
                    body: `Transferencia ${cond.descuento}% OFF: ${plata(alContado)}`,
                },
                ...(hayEscalera ? [{
                    type: 'list',
                    // El título no dice "tres": las gamas que salen dependen de
                    // lo que la base pueda respaldar, y una placa que promete
                    // tres y muestra dos se lee como un error.
                    title: 'Las gamas, y *desde cuánto* arranca cada una',
                    items: gamas.map(g => `${g.rotulo} — desde ${plata(g.precio)} (${g.detalle})${nota2x1(g)}`),
                }] : []),
                {
                    type: 'list',
                    title: 'Lo que *incluye*',
                    items: [
                        'Medición con tu armazón puesto, no con una plantilla',
                        '*30 días de garantía de adaptación*: si no te adaptás, rehacemos el cristal',
                        'Laboratorio propio: si algo hay que corregir, se corrige acá',
                        ...(armazon ? [`Armazones recetados desde ${plata(armazon.precio)}, también en cuotas`] : []),
                    ],
                },
                {
                    type: 'cta',
                    role: 'cierre',
                    image: 'blog/mostrador-marmol.jpg',
                    title: 'Mandanos tu receta',
                    body: 'Te pasamos el total exacto con el armazón que elijas. Cerro de las Rosas, sin turno previo.',
                },
            ],
        };

        // Los cuatro tamaños del creativo de anuncio. Meta recorta la
        // creatividad por ubicación: subir solo el 4:5 significa que en la
        // columna derecha se ve un recorte con el texto cortado al medio.
        // El apaisado (628px de alto) no lleva el mismo cuerpo: no entra.
        const anuncios = TAMANOS.map(tam => ({
            id: `${ID_ANUNCIO}${tam.sufijo}`,
            format: tam.formato,
            theme: 'dark',
            pilar: 'campania',
            fuente: 'base',
            generadoEl: hoy,
            generadoDesde: produccion ? 'produccion' : 'local',
            ubicacion: tam.donde,
            temas: ['multifocales'],
            caption,
            slides: [
                {
                    // `number` deja el dato grande, que en un anuncio es lo
                    // único que se lee de reojo.
                    type: 'number',
                    role: 'portada',
                    image: 'blog/pareja-multifocales-exterior.png',
                    encuadre: 'cover',
                    title: `${TITULAR} desde`,
                    dato: plata(ancla.precio),
                    body: tam.formato === '1.91:1'
                        ? `${texto12}.\n${cond.textoCuotas} de ${plata(cuota)}.`
                        : `${texto12}.\n${cond.textoCuotas} de ${plata(cuota)}.\nEl armazón lo elegís vos.${notaAncla}`,
                },
            ],
        }));

        const piezas = [carrusel, ...anuncios];
        verificarImagenes(piezas);

        await mkdir(SALIDA, { recursive: true });
        for (const pieza of piezas) {
            await writeFile(path.join(SALIDA, `${pieza.id}.json`), JSON.stringify(pieza, null, 2) + '\n', 'utf-8');
            console.log(`  ✅ ${String(pieza.format).padEnd(8)} ${pieza.id}`);
        }

        // El ancla de la landing NO se escribe en ningún archivo: `/multifocales`
        // la calcula en vivo con `precioMultifocalDesde()`, sobre las mismas
        // opciones que leyó este script. Guardarla acá crearía una segunda copia del
        // número, que es justo lo que hay que evitar. Se imprime para poder
        // verificar de un vistazo que la placa, el anuncio y la landing dicen lo
        // mismo.
        console.log(`\nAncla de la landing /multifocales (calculada en vivo, misma fuente): ${plata(ancla.precio)}`);
        console.log(`Precios leídos de la base HOY (${hoy}). Vencen a los 10 días (guarda de frescura).`);
        if (!produccion) {
            console.log(
                '\n⚠️  Son precios de la base LOCAL, que está semanas atrás de producción.\n' +
                '    Sirven para ver el diseño; para publicar, volvé a correr con --produccion.',
            );
        }

        return { carrusel, anuncios, ancla: ancla.precio, cond };
    } finally {
        await prisma.$disconnect();
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    try {
        await generarPiezaMultifocal({ produccion: tieneFlag('produccion') });
        console.log('\nRenderizar (no publica nada):');
        console.log(`  node scripts/social/render.mjs social/contenido/${ID_CARRUSEL}.json`);
        console.log(`  for f in social/contenido/${ID_ANUNCIO}*.json; do node scripts/social/render.mjs "$f"; done`);
    } catch (e) {
        console.error(`\n❌ ${e.message}`);
        process.exit(1);
    }
}
