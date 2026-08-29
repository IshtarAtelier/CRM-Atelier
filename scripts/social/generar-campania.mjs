/**
 * Arma las placas de una promoción en TODOS los tamaños que pide Meta Ads.
 *
 *   node scripts/social/generar-campania.mjs              → todas las promos
 *   node scripts/social/generar-campania.mjs 2x1          → una sola
 *
 * POR QUÉ CUATRO TAMAÑOS Y NO UNO
 * Meta recorta la creatividad para cada ubicación. Subir solo un 4:5 significa
 * que en la columna derecha y en Audience Network se ve un recorte automático
 * con el texto cortado por la mitad. Cada ubicación tiene su placa:
 *
 *   4:5     1080x1350  feed de Instagram y Facebook
 *   1:1     1080x1080  varias ubicaciones; la que menos se recorta
 *   9:16    1080x1920  stories y reels
 *   1.91:1  1200x628   columna derecha, Marketplace, Audience Network
 *
 * El apaisado NO lleva el mismo texto que los otros: 628 px de alto no dan para
 * un párrafo. Por eso cada promo declara `corto`, que es lo que se usa ahí.
 *
 * DE DÓNDE SALEN LOS DATOS DE LA PROMO
 * De `src/lib/business-info.ts` — las cuotas y los descuentos ya viven ahí
 * porque los usan el bot y los mensajes automáticos. Copiarlos acá sería tener
 * el mismo dato en dos lados, que es exactamente cómo se termina publicando
 * "3 cuotas" en un aviso mientras el bot dice 6.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { RAIZ } from './identidad.mjs';

const BUSINESS_INFO_TS = path.join(RAIZ, 'src', 'lib', 'business-info.ts');
const SALIDA = path.join(RAIZ, 'social', 'contenido');

/** Los cuatro tamaños de anuncio, con el sufijo que lleva cada archivo. */
const TAMANOS = [
    { formato: '4:5', sufijo: 'feed', donde: 'Feed de Instagram y Facebook' },
    { formato: '1:1', sufijo: 'cuadrado', donde: 'Varias ubicaciones (la que menos se recorta)' },
    { formato: '9:16', sufijo: 'story', donde: 'Stories y Reels' },
    { formato: '1.91:1', sufijo: 'apaisado', donde: 'Columna derecha, Marketplace, Audience Network' },
];

function leerCampo(ts, campo) {
    const m = ts.match(new RegExp(`\\b${campo}:\\s*"((?:[^"\\\\]|\\\\.)*)"`));
    if (m) return m[1];
    const n = ts.match(new RegExp(`\\b${campo}:\\s*(\\d+)`));
    if (n) return n[1];
    throw new Error(`No se pudo leer "${campo}" de business-info.ts.`);
}

/**
 * Las promos. El texto largo va en el feed, el corto en el apaisado.
 *
 * `imagen` sale del banco que ya existe; R5 corta si no está.
 */
function promos(info) {
    return {
        '6cuotas': {
            id: 'campania-6-cuotas',
            temas: ['armazones', 'local'],
            // Armazones reales del estante del local — se tiene que entender
            // de un vistazo que hablamos de anteojos.
            imagen: 'blog/anteojos-rosa-pastel.jpg',
            titulo: 'Hasta *6 cuotas sin interés*',
            bajada: 'En anteojos recetados, multifocales y lentes de sol. Con tarjeta, en el local. Y ahora también hasta 12 cuotas con Mercado Pago.',
            corto: 'En anteojos recetados y multifocales.',
            dato: '6 cuotas',
            rotulo: 'Sin interés, con tarjeta',
            caption: `Hasta 6 cuotas sin interés con tarjeta, en anteojos recetados, multifocales y lentes de sol. Y ahora también hasta 12 cuotas con Mercado Pago.\n\nTambién ${info.descuentoEfectivo}% de descuento pagando en efectivo o ${info.descuentoTransferencia}% por transferencia.\n\n${info.address}. Sin turno previo.`,
        },
        // 27/8/2026: acuerdo con Mercado Pago. Regla de comunicación de Ishtar:
        // "hasta 12 cuotas" — NUNCA "sin interés" (eso son solo 3 y 6) ni el
        // costo financiero en el cartel.
        '12pagos': {
            id: 'campania-12-pagos',
            temas: ['armazones', 'local'],
            // Clienta probándose armazones EN el local: el momento exacto en el
            // que importa cómo pagarlo. (El mostrador de mármol mostraba el
            // frasco de caramelos — "eso no es un anteojo", Ishtar 27/8.)
            imagen: 'blog/blog3_eligiendo.png',
            titulo: 'Ahora *hasta 12 cuotas*',
            bajada: 'Tus anteojos en 12 cuotas con Mercado Pago. Recetados, multifocales y lentes de sol. Y las 6 cuotas sin interés de siempre.',
            corto: 'Con Mercado Pago, en todo el local.',
            dato: '12 cuotas',
            rotulo: 'Con Mercado Pago',
            caption: `Ahora podés llevarte tus anteojos en hasta 12 cuotas con Mercado Pago 💳\n\nY siguen las de siempre: 6 cuotas sin interés con tarjeta, ${info.descuentoEfectivo}% de descuento en efectivo o ${info.descuentoTransferencia}% por transferencia.\n\n${info.address}. Sin turno previo.`,
        },
        // 29/8/2026: pieza combinada pedida por Ishtar — multifocales
        // específicamente en 12 cuotas, no el genérico de armazones de '12pagos'.
        '12pagos-multifocales': {
            id: 'campania-12-pagos-multifocales',
            temas: ['multifocales'],
            imagen: 'blog/pareja-multifocales-exterior.png',
            titulo: 'Tus *multifocales* en 12 cuotas',
            bajada: 'Tus multifocales en hasta 12 cuotas con Mercado Pago. Medidos acá, con garantía de adaptación. Y las 6 cuotas sin interés de siempre.',
            corto: 'Con Mercado Pago, medidos acá.',
            dato: '12 cuotas',
            rotulo: 'En lentes multifocales',
            caption: `Tus multifocales en hasta 12 cuotas con Mercado Pago 💳\n\nMedidos acá, con garantía de adaptación de 30 días. Y siguen las de siempre: 6 cuotas sin interés con tarjeta, ${info.descuentoEfectivo}% de descuento en efectivo o ${info.descuentoTransferencia}% por transferencia.\n\n${info.address}. Sin turno previo, o escribinos por WhatsApp.`,
        },
        '2x1': {
            id: 'campania-2x1-multifocales',
            temas: ['multifocales'],
            imagen: 'blog/pareja-multifocales-exterior.png',
            titulo: '*2x1* en multifocales',
            bajada: 'Llevás dos pares de multifocales al precio de uno. Medidos acá, con garantía de adaptación.',
            corto: 'Dos pares al precio de uno.',
            dato: '2x1',
            rotulo: 'En lentes multifocales',
            caption: `2x1 en multifocales: llevás dos pares al precio de uno.\n\nLos dos medidos acá, con el armazón ya elegido y garantía de adaptación de 30 días. Si no te adaptás, hacemos el cristal de nuevo.\n\n${info.address}. Sin turno previo, o escribinos por WhatsApp.`,
        },
    };
}

/** Una pieza por tamaño: el mismo mensaje, el layout que corresponde. */
function piezasDePromo(promo, tam) {
    const apaisado = tam.formato === '1.91:1';
    return {
        id: `${promo.id}-${tam.sufijo}`,
        format: tam.formato,
        theme: 'dark',
        pilar: 'campania',
        fuente: 'business-info',
        ubicacion: tam.donde,
        temas: promo.temas,
        caption: promo.caption,
        slides: [
            {
                // `number` deja el dato grande, que en un anuncio es lo único
                // que se lee de reojo: "2x1", "6 cuotas".
                type: 'number',
                role: 'portada',
                image: promo.imagen,
                // Foto editorial, no un armazón recortado: tiene que llenar la
                // franja. Sin esto queda con franjas blancas a los costados,
                // porque el default de esta plantilla es `contain` sobre blanco
                // (pensado para el recorte de un armazón).
                encuadre: 'cover',
                title: promo.rotulo,
                dato: promo.dato,
                body: apaisado ? promo.corto : promo.bajada,
            },
        ],
    };
}

export async function generarCampanias(cuales) {
    const ts = await readFile(BUSINESS_INFO_TS, 'utf-8');
    const info = {
        address: leerCampo(ts, 'address'),
        descuentoEfectivo: leerCampo(ts, 'discountCashPercent'),
        descuentoTransferencia: leerCampo(ts, 'discountTransferPercent'),
    };

    console.log('\nDatos leídos de business-info.ts (fuente única):');
    console.log(`  dirección  : ${info.address}`);
    console.log(`  descuentos : ${info.descuentoEfectivo}% efectivo · ${info.descuentoTransferencia}% transferencia`);

    const todas = promos(info);
    const pedidas = cuales?.length ? cuales : Object.keys(todas);

    const generadas = [];
    for (const clave of pedidas) {
        const promo = todas[clave];
        if (!promo) {
            console.error(`\n❌ No conozco la promo "${clave}". Las que hay: ${Object.keys(todas).join(', ')}`);
            continue;
        }
        console.log(`\n${promo.dato} — ${promo.rotulo}`);
        for (const tam of TAMANOS) {
            const pieza = piezasDePromo(promo, tam);
            const destino = path.join(SALIDA, `${pieza.id}.json`);
            await writeFile(destino, JSON.stringify(pieza, null, 2) + '\n', 'utf-8');
            console.log(`  ✅ ${String(tam.formato).padEnd(8)} ${pieza.id}`);
            generadas.push(pieza.id);
        }
    }
    return generadas;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    try {
        const g = await generarCampanias(process.argv.slice(2).filter(a => !a.startsWith('--')));
        console.log(`\n${g.length} placa(s). Renderizar:\n  for f in social/contenido/campania-*.json; do node scripts/social/render.mjs "$f"; done`);
    } catch (e) {
        console.error(`\n❌ ${e.message}`);
        process.exit(1);
    }
}
