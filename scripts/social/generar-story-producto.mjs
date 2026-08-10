/**
 * Arma stories 9:16 de productos, leyendo el catálogo.
 *
 *   node scripts/social/generar-story-producto.mjs --produccion --marca "Cápsula Escarlata" --cantidad 20
 *
 * Opciones de la llamada a la acción: `--cta "otro texto"` la cambia,
 * `--sin-cta` la saca. Sin nada, sale la de CTA_POR_DEFECTO.
 *
 * POR QUÉ SE GENERAN Y NO SE ESCRIBEN (regla R6):
 * una pieza con un precio escrito a mano no renderiza. El precio y la foto
 * salen de la base, así que publicar un valor viejo deja de ser posible en vez
 * de ser "algo a tener cuidado". Si mañana cambia el precio o la foto, la story
 * del día siguiente sale con lo nuevo sin que nadie se acuerde.
 *
 * QUÉ PRODUCTOS ENTRAN
 * Solo los que están publicados en la tienda (WebProduct activo), con stock y
 * con foto. Una story de algo agotado hace venir gente a comprar lo que no hay,
 * que es peor que no publicar.
 *
 * SOBRE EL LINK: la API de Meta no permite el sticker de link en una story
 * publicada por programa — se agrega a mano desde la app. Por eso la placa
 * lleva el nombre del modelo bien visible y el pie remite a la tienda: alguien
 * que ve la story puede buscarlo por nombre y encontrarlo.
 */
import 'dotenv/config';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { RAIZ } from './identidad.mjs';

const SALIDA = path.join(RAIZ, 'social', 'contenido');

/**
 * La llamada a la acción de toda story de producto.
 *
 * Salían ~120 stories de producto por mes mostrando el precio y nada más: se
 * veía cuánto sale y no se decía qué hacer con eso. El que la miraba tenía que
 * inventar el próximo paso, y el que no lo inventa se va. El paso que pedimos
 * es el presupuesto por WhatsApp porque es la puerta que ya está atendida (el
 * bot contesta 24/7) y la que después se puede medir.
 *
 * NUNCA lleva un número adentro — ver `sinPrecio()` abajo.
 */
const CTA_POR_DEFECTO = 'Pedí tu presupuesto 👉 WhatsApp';

/**
 * El CTA no puede traer un importe.
 *
 * La pieza sale marcada `fuente: "base"`, y con esa marca el validador deja
 * pasar los precios sin revisarlos (R6 confía en que los puso la base). Un
 * importe tipeado en `--cta` entraría por esa puerta y quedaría congelado en la
 * placa aunque el precio de la base cambie mañana. Se corta acá, que es donde
 * el texto se escribe a mano.
 */
function sinPrecio(cta) {
    if (cta && /\$\s?\d|\b\d{4,}\s*(pesos|ars)\b/i.test(cta)) {
        throw new Error(
            `El CTA no puede llevar un precio adentro: "${cta}". El precio de la placa ` +
            `sale de la base (regla R6); escrito a mano queda viejo y nadie se entera.`);
    }
    return cta;
}

function arg(nombre, porDefecto = null) {
    const i = process.argv.indexOf(`--${nombre}`);
    return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
        ? process.argv[i + 1] : porDefecto;
}

/** Un slug seguro para el id de la pieza y el nombre de carpeta. */
function aSlug(t) {
    return String(t).normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** $89.900 — sin decimales, que en una placa no aportan y ocupan. */
function precioAr(n) {
    return `$${Math.round(n).toLocaleString('es-AR')}`;
}

/**
 * "Nashira C3" → "Nashira".
 *
 * El sufijo de color (C1, C2, C4...) distingue variantes en el catálogo, donde
 * hace falta. En una placa ensucia: nadie busca "Dionisio C1", busca
 * "Dionisio". El color se ve en la foto, que para eso está.
 *
 * Solo se saca si va al final y tiene la forma C + número: un modelo que se
 * llame "C3PO" no se toca.
 */
function limpiarNombre(nombre) {
    return String(nombre).replace(/\s+C\d+\s*$/i, '').trim();
}

/**
 * Las condiciones de pago, leídas de DONDE LAS LEE LA TIENDA.
 *
 * `PaymentOptions.tsx` las saca de `SystemSetting` (`web_promo_installments` y
 * `web_promo_cash_discount`), no de business-info.ts. Si acá se usara otra
 * fuente, la story diría un precio y la ficha del producto otro — el cliente
 * llega a la tienda desde la story y ve otro número. Es el mismo criterio con
 * el que la tienda calcula: `Math.round(price / cuotas)` y
 * `Math.round(price * (1 - descuento/100))`.
 */
async function condicionesDeVenta(prisma) {
    const filas = await prisma.systemSetting.findMany({
        where: { key: { in: ['web_promo_installments', 'web_promo_cash_discount'] } },
        select: { key: true, value: true },
    });
    const get = (k) => filas.find(f => f.key === k)?.value;

    const texto = get('web_promo_installments') || '6 cuotas sin interés';
    const cuotas = Number(texto.match(/\d+/)?.[0] || 6);

    const crudo = Number(get('web_promo_cash_discount'));
    // El mismo default que PaymentOptions.tsx cuando el setting no está.
    const descuento = Number.isFinite(crudo) && crudo > 0 ? crudo : 15;

    return { cuotas, textoCuotas: texto, descuento };
}

export async function generarStoriesDeProducto({ marca, cantidad, produccion, tienda, categoria, nombre, cta = CTA_POR_DEFECTO }) {
    const url = produccion ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
    if (!url) throw new Error(`Falta ${produccion ? 'PROD_DATABASE_URL' : 'DATABASE_URL'} en el .env`);

    // Antes de abrir la base: si el CTA está mal, que falle en el primer segundo
    // y no después de escribir veinte archivos que hay que volver a generar.
    const llamado = sinPrecio(cta);

    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient({ datasources: { db: { url } } });

    try {
        // `select` explícito: el schema local está adelantado respecto de
        // producción y traer la fila entera revienta contra prod.
        const webs = await prisma.webProduct.findMany({
            where: {
                isActive: true,
                ...(categoria ? { category: { equals: categoria, mode: 'insensitive' } } : {}),
                ...(nombre ? { name: { startsWith: nombre, mode: 'insensitive' } } : {}),
                product: { brand: { equals: marca, mode: 'insensitive' }, stock: { gt: 0 } },
            },
            select: {
                name: true, slug: true, images: true, imageUrl: true, imageAlts: true, category: true,
                product: { select: { model: true, brand: true, price: true, salePrice: true, stock: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        const filtros = [
            `marca "${marca}"`,
            categoria ? `categoría "${categoria}"` : null,
            nombre ? `nombre que empieza con "${nombre}"` : null,
        ].filter(Boolean).join(' · ');
        console.log(`\n${webs.length} producto(s) publicados con stock — ${filtros}`);

        const usables = webs.filter(w => (w.images?.length || w.imageUrl) && (w.product?.price ?? 0) > 0);
        const sinFoto = webs.length - usables.length;
        if (sinFoto > 0) {
            // Se dice en voz alta: un filtro silencioso hace creer que se
            // cubrió todo el catálogo cuando se dejó afuera un tercio.
            console.log(`  · ${sinFoto} quedaron afuera por no tener foto o precio.`);
        }

        const cond = await condicionesDeVenta(prisma);
        console.log(`  · condiciones (de la tienda): ${cond.textoCuotas} · ${cond.descuento}% al contado`);
        console.log(`  · llamada a la acción: ${llamado || '(ninguna — placa sin CTA)'}`);

        const elegidos = usables.slice(0, cantidad);
        const generadas = [];

        for (const w of elegidos) {
            const p = w.product;
            const enOferta = (p.salePrice ?? 0) > 0 && p.salePrice < p.price;
            const precio = enOferta ? p.salePrice : p.price;
            const foto = (w.images?.[0] || w.imageUrl || '').replace(/^\//, '');
            const nombre = limpiarNombre(w.name);
            // El id sale del SLUG, que es único, y no del nombre limpio: al
            // sacar el sufijo de color, "Dionisio C1" y "Dionisio C2" pasan a
            // llamarse igual y la segunda pieza pisaba a la primera en silencio.
            const id = `story-producto-${aSlug(w.slug)}`;

            // Se calcula igual que PaymentOptions.tsx, con Math.round, para que
            // el número de la story sea EXACTAMENTE el de la ficha. Un peso de
            // diferencia entre lo que promete el aviso y lo que muestra la
            // tienda es una discusión en el mostrador.
            const cuota = Math.round(precio / cond.cuotas);
            const alContado = Math.round(precio * (1 - cond.descuento / 100));

            const pieza = {
                id,
                format: '9:16',
                theme: 'dark',
                pilar: 'producto',
                // Marca de origen: el validador exige que toda pieza con precio
                // venga de la base (R6). Escrita a mano, no renderiza.
                fuente: 'base',
                // Cuándo se leyeron esos precios. Sin esta fecha no hay forma de
                // probar que el número sigue vigente, y el cron de stories no la
                // publica (src/lib/social/frescura.ts). Las 13 stories que ya
                // existían no la traían: podían salir con un precio de meses.
                generadoEl: new Date().toISOString().slice(0, 10),
                // CONTRA QUÉ base se leyeron. La fecha sola no alcanza: el
                // catálogo de docker está desincronizado, así que una pieza
                // generada hoy contra local puede traer un precio de hace
                // semanas y `generadoEl` la daría fresca igual. Con esto, la
                // guarda de frescura la rechaza y pide regenerar --produccion.
                generadoDesde: produccion ? 'produccion' : 'local',
                temas: ['armazones'],
                producto: { nombre, slug: w.slug, marca: p.brand, categoria: w.category },
                caption: `${nombre} · ${p.brand}\n\n${cond.textoCuotas} de ${precioAr(cuota)}\n${precioAr(alContado)} en efectivo o transferencia (ahorrás ${cond.descuento}%)\n\nEn la tienda: ${tienda}/producto/${w.slug}\nO vení a probártelo, Cerro de las Rosas.`,
                slides: [
                    {
                        type: 'number',
                        role: 'portada',
                        image: foto,
                        // Primer impacto: el valor de la CUOTA. El precio de
                        // lista solo no dice nada y no vende; lo que decide una
                        // compra es cuánto sale por mes.
                        title: `${nombre} · ${p.brand}`,
                        dato: precioAr(cuota),
                        body: `${cond.textoCuotas}\n${precioAr(alContado)} en efectivo o transferencia`,
                        // El renglón que dice QUÉ HACER. Va como campo aparte y
                        // no pegado al `body` para que la plantilla pueda darle
                        // su propio peso y color: mezclado en el cuerpo se lee
                        // como una condición de pago más y se pierde.
                        // Opcional: sin `cta` la placa sale como salía antes.
                        ...(llamado ? { cta: llamado } : {}),
                    },
                ],
            };

            const destino = path.join(SALIDA, `${id}.json`);
            await writeFile(destino, JSON.stringify(pieza, null, 2) + '\n', 'utf-8');
            generadas.push({ id, nombre, cuota: precioAr(cuota), contado: precioAr(alContado), categoria: w.category });
        }

        console.log(`\n✅ ${generadas.length} story(s) generada(s):\n`);
        console.log(`   ${'producto'.padEnd(24)} ${'cuota'.padEnd(12)} contado`);
        generadas.forEach(g => console.log(`   ${g.nombre.padEnd(24)} ${g.cuota.padEnd(12)} ${g.contado}   [${g.categoria || '—'}]`));
        return generadas;
    } finally {
        await prisma.$disconnect();
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    try {
        const generadas = await generarStoriesDeProducto({
            marca: arg('marca', 'Cápsula Escarlata'),
            cantidad: Number(arg('cantidad', 20)),
            categoria: arg('categoria'),
            nombre: arg('nombre'),
            // `--sin-cta` existe para el caso puntual (una story que ya lleva el
            // sticker de link puesto a mano, donde el rótulo repite la acción).
            // El default es CON llamada: que aparezca no puede depender de que
            // alguien se acuerde de pedirla.
            cta: process.argv.includes('--sin-cta') ? null : arg('cta', CTA_POR_DEFECTO),
            produccion: process.argv.includes('--produccion'),
            tienda: process.env.NEXT_PUBLIC_APP_URL || 'https://atelieroptica.com.ar',
        });
        console.log(`\nRenderizar todas:\n  for f in social/contenido/story-producto-*.json; do node scripts/social/render.mjs "$f"; done`);
        if (!generadas.length) process.exitCode = 1;
    } catch (e) {
        console.error(`\n❌ ${e.message}`);
        process.exit(1);
    }
}
