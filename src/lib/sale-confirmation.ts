// ────────────────────────────────────────────────────────────────────────────
// Confirmación de compra: el repaso completo que el cliente recibe por mail y
// por WhatsApp en el mismo momento en que su presupuesto se convierte en venta
// y se manda a fábrica.
//
// El porqué: a partir de acá el pedido es inmutable, y un dato mal cargado se
// paga en un par de cristales rehecho. El mensaje existe para que el error se
// detecte AHORA, en la ventana previa a que la fábrica empiece — por eso pide
// un OK explícito, dice el teñido incluso cuando no lleva, aclara qué es un
// fotocromático, y le pide al cliente que corrobore el estilo del armazón.
//
// Módulo de COMPOSICIÓN: los datos salen de `describeLabFrameDetails()` y del
// `prescriptionSnapshot` (las mismas fuentes que ve la venta en pantalla), y el
// envío reusa `sendClientEmail` / `fetchWa` / `generateOrderPDF`. Nada de esto
// se reimplementa acá.
// ────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/db';
import { escHtml, sendClientEmail } from '@/lib/client-email';
import { sendWhatsApp, explainSendFailure } from '@/lib/whatsapp/send';
import { templateSpec } from '@/lib/whatsapp/templates';
import { normalizeArgentinePhone } from '@/services/contact.service';
import { resolveStorageUrl } from '@/lib/utils/storage';
import { uploadFile, getFileBuffer } from '@/lib/storage';
import { STORE_ORIGIN } from '@/lib/constants';
import { PricingService } from '@/services/PricingService';
import { describeLabFrameDetails } from '@/lib/lab-frame-summary';
import { frameRecapText, prescriptionRecapText, tienePhotocromatico } from '@/lib/sale-recap-text';
import { logAudit } from '@/lib/audit';
import { SELECT_REPASO_CON_CLIENTE } from '@/lib/order-recap-select';
import { BUSINESS_INFO } from '@/lib/business-info';
import { cristalesPorArmazon } from '@/lib/order-frames';
import { isTeñidoAddon, esLineaDeTenido } from '@/lib/promo-utils';
import { armazonesPorPar, tituloDePar, tipoDeItem } from '@/lib/armazon-por-par';
import { DETALLE_MARK } from '@/lib/order-detail-summary';

/** Marca de la nota que registra el envío: sirve de candado de idempotencia. */
const MARCA_NOTA = '📧 Confirmación de compra enviada al cliente';

const money = (n: number) => `$${Math.round(n || 0).toLocaleString('es-AR')}`;

function urlAbsoluta(src?: string | null): string | null {
    if (!src) return null;
    const resuelta = resolveStorageUrl(src);
    if (!resuelta) return null;
    if (resuelta.startsWith('http') || resuelta.startsWith('data:')) return resuelta;
    return `${STORE_ORIGIN}${resuelta.startsWith('/') ? '' : '/'}${resuelta}`;
}

/**
 * Los bytes de una imagen guardada, para poder adjuntarla por WhatsApp.
 *
 * Prueba primero el almacenamiento (nube o disco) y, si el valor guardado es
 * una ruta pública del sitio, la baja por HTTP. Devuelve null si no se pudo:
 * una foto que no se puede adjuntar no puede voltear la confirmación entera.
 */
async function bytesDeImagen(valor: string): Promise<{ base64: string; mimetype: string; filename: string } | null> {
    const extension = (valor.split('?')[0].split('.').pop() || 'jpg').toLowerCase();
    const mimetype = extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg';
    const filename = `armazon.${extension === 'png' ? 'png' : extension === 'webp' ? 'webp' : 'jpg'}`;
    try {
        const buf = await getFileBuffer(valor);
        if (buf) return { base64: buf.toString('base64'), mimetype, filename };
    } catch { /* sigue por HTTP */ }
    try {
        const url = urlAbsoluta(valor);
        if (!url) return null;
        const res = await fetch(url);
        if (!res.ok) return null;
        const ab = await res.arrayBuffer();
        return { base64: Buffer.from(ab).toString('base64'), mimetype, filename };
    } catch (e: any) {
        console.error('[Confirmación de compra] No se pudieron leer los bytes de la foto:', e?.message);
        return null;
    }
}

/** La receta que vale: la congelada al enviar a fábrica; si no hay, la viva. */
export function recetaDeLaVenta(order: any): any {
    try {
        const snap = order?.prescriptionSnapshot ? JSON.parse(order.prescriptionSnapshot) : null;
        if (snap?.rx) return snap.rx;
    } catch { /* snapshot ilegible: se cae a la receta viva */ }
    return order?.prescription || null;
}

export interface SaleConfirmation {
    subject: string;
    emailHtml: string;
    waText: string;
    /** Foto de la receta, absoluta, para adjuntar/mostrar. null si no hay. */
    prescriptionImageUrl: string | null;
    /** Fotos del armazón: el valor guardado, la URL y el pie de cada una. */
    fotosArmazon: { valor: string; url: string; titulo: string }[];
}

/**
 * Arma el mail y el WhatsApp de la confirmación. Función pura: no manda nada,
 * así se puede testear el contenido sin tocar la red.
 *
 * @param esActualizacion true cuando la venta se reabrió y volvió a confirmarse:
 *   el cliente tiene que saber que este repaso PISA al anterior.
 */
export function buildSaleConfirmation(order: any, esActualizacion = false): SaleConfirmation {
    const nro = String(order.id).slice(-4).toUpperCase();
    const nombre = (order.client?.name || '').split(' ')[0] || '';
    const rx = recetaDeLaVenta(order);
    const resumen = describeLabFrameDetails(order);

    // La plata sale de PricingService y NO se recalcula acá: es la regla de
    // CLAUDE.md, y cada copia de este cálculo divergió alguna vez y costó plata.
    const fin = PricingService.calculateOrderFinancials(order);
    const markupFactor = 1 + ((order.markup || 0) / 100);
    const precioDe = (it: any) => Math.round((it.price || 0) * markupFactor) * (it.quantity || 1);

    // TODOS los renglones, teñido incluido: si el teñido queda afuera de la
    // suma pero adentro del precio de lista, aparecen pesos "de la nada" entre
    // una fila y la otra y el desglose deja de cerrar — que es el reclamo que
    // esto viene a resolver.
    const sumaRenglones = (order.items || []).reduce((n: number, it: any) => n + precioDe(it), 0);

    // Los descuentos se muestran con sus MONTOS GUARDADOS, cada uno en su fila:
    // la promo (si la hubo) y el descuento especial del vendedor. Antes era una
    // resta ciega (suma − lista) con una sola etiqueta, que rotulaba el
    // descuento manual como si fuera la promo y absorbía errores de redondeo.
    const promoInflado = Math.round((order.appliedPromoDiscount || 0) * markupFactor);
    const especial = fin.specialDiscount || 0;

    // Y ANTES DE IMPRIMIR, SE VERIFICA: si la cadena no cierra (± $100 por
    // redondeos), el desglose no se muestra — solo el precio de lista. Un
    // desglose que no suma es peor que ninguno: es el mail original.
    const cadenaCierra = Math.abs(sumaRenglones - promoInflado - especial - fin.listPrice) <= 100;

    // El salto entre la lista y lo pagado: el descuento por forma de pago
    // (efectivo −20%, transferencia −15%, se puede mezclar).
    const descuentoFormaDePago = Math.max(0, fin.listPrice - fin.paidReal);

    // EL SALDO NO SE RESTA (CLAUDE.md): sale de PricingService, que convierte
    // cada pago a su equivalente de lista.
    const saldo = fin.hasBalance ? fin.remainingList : 0;
    // La tolerancia de $1.000 de hasBalance no puede volverse promesa: con $900
    // reales de saldo, el cartel verde "no tenés que pagar nada más" mentiría.
    const saldoChico = !fin.hasBalance && fin.remainingList > 0;

    const items: any[] = order.items || [];
    const cristalesDe = cristalesPorArmazon(order);
    const asignados = new Set<any>();
    cristalesDe.forEach(lista => lista.forEach((it: any) => asignados.add(it)));
    // Los ARMAZONES del pedido, asignados a su par: si hay tantos ítems de
    // armazón como pares, el 1º va con el 1º par y así — mismo criterio de
    // orden que usa el reparto de cristales. Si no coinciden las cantidades,
    // quedan en "También llevás" (mejor una bolsa honesta que una asignación
    // inventada).
    const esArmazonItem = (it: any) =>
        /Armazón|Sol/i.test(`${it.product?.category || it.productCategorySnapshot || ''}`);
    // ↑ `includes` y no igualdad: la categoría real del catálogo es
    // "Armazón de Receta" — el filtro exacto no matcheaba ningún producto.
    const armazonesItems = items.filter(esArmazonItem);
    // Por PARECIDO DE NOMBRE contra el detalle del laboratorio ("clipo on
    // metal" ↔ "Clip-on Classic"), no por cantidad: la venta de Adriana tenía
    // 3 armazones y 2 pares y el conteo no asignaba ninguno. Los anteojos
    // terminados (de sol) quedan afuera a propósito.
    const armazonDelPar = armazonesPorPar(armazonesItems, resumen.pairs);

    // Los TEÑIDOS con su par: por framePosition si lo tiene, o al único par.
    // `esLineaDeTenido` y no `isTeñidoAddon(it.product)`: con el producto
    // borrado del catálogo, la segunda devuelve false y el teñido de un pedido
    // viejo se duplicaba en "También llevás".
    const teñidosItems = items.filter(it => esLineaDeTenido(it));
    const teñidoDelPar = new Map<number, any[]>();
    for (const t of teñidosItems) {
        const par = t.framePosition || (resumen.pairs.length === 1 ? resumen.pairs[0]?.pair : null);
        if (par != null) {
            if (!teñidoDelPar.has(par)) teñidoDelPar.set(par, []);
            teñidoDelPar.get(par)!.push(t);
        }
    }
    const teñidosAsignados = new Set([...teñidoDelPar.values()].flat());

    // Lo que no pertenece a ningún anteojo (accesorios, armazones sin par claro,
    // un teñido que no se pudo ubicar).
    const otrosItems = items.filter(it =>
        !asignados.has(it)
        && !(armazonDelPar.size > 0 && esArmazonItem(it))
        && !teñidosAsignados.has(it));

    // Una línea por producto, y si es un teñido, CON su color y su grado. Decir
    // "Teñido Degradé" a secas y más abajo listar el color por separado obliga
    // al cliente a atar cabos; junto se lee de una.
    const lineasDeItems = (lista: any[]): string[] => {
        const vistos = new Set<string>();
        const salida: string[] = [];
        for (const it of lista) {
            // El teñido tiene su propia línea en "Tu anteojo", con color y grado.
            // Repetirlo acá hacía que el cliente lo leyera dos veces y dudara de
            // si eran dos cosas distintas.
            if (isTeñidoAddon(it.product)) continue;
            const nombre = it.product?.name || it.productNameSnapshot || 'Producto';
            const detalle = [it.crystalColor, it.crystalColorNote ? `grado ${it.crystalColorNote}` : null]
                .filter(Boolean).join(', ');
            const linea = `• ${nombre}${detalle ? ` — ${detalle}` : ''}`;
            // Los cristales vienen por ojo (OD y OI): al cliente le importa el
            // par, no la línea contable de cada ojo.
            if (vistos.has(linea)) continue;
            vistos.add(linea);
            salida.push(linea);
        }
        return salida;
    };
    const fotoReceta = urlAbsoluta(rx?.imageUrl);

    // Fotos del armazón sacadas por el vendedor. Se le MUESTRAN al cliente: no
    // se le piden. Él tiene que reconocer su armazón, no fotografiarlo.
    // Cada foto lleva el valor GUARDADO (para poder leer sus bytes y adjuntarla
    // por WhatsApp) y la URL absoluta (para mostrarla en el mail).
    //
    // El pie de cada foto dice el cristal de ESE armazón. Es donde el dato
    // sirve: el cliente está mirando el anteojo, no una lista más abajo — y con
    // dos anteojos, leer "teñido sepia" lejos de la foto obliga a adivinar cuál
    // era. Pedido del 24/8: cuando el cristal es BLANCO también se dice, ahí
    // mismo — el silencio junto a una foto y "teñido" junto a la otra hacía que
    // el cliente pregunte igual.
    const fotosArmazon = resumen.pairs
        .filter(p => p.imageUrl)
        .map(p => {
            const cual = resumen.pairs.length > 1 ? `tu ${p.pair}º armazón` : 'tu armazón';
            const pair = p.pair; // para poder ubicar la foto en la tarjeta de SU anteojo
            const extras = [
                // Con teñido, el anteojo deja de ser blanco: es DE SOL, del
                // color elegido — y así se le dice al cliente (Ishtar, 24/8/26).
                p.tint ? `Cristal de sol — teñido ${p.tint}` : null,
                p.photochromic
                    ? `Cristal fotocromático${p.photochromicColor ? ` ${p.photochromicColor}` : ''} (se oscurece solo con el sol)`
                    : null,
            ].filter(Boolean);
            // Sin teñido ni fotocromático → decirlo igual, junto a la foto.
            if (!extras.length) extras.push('Cristales blancos (sin teñido)');
            return {
                pair,
                valor: p.imageUrl as string,
                url: urlAbsoluta(p.imageUrl) as string,
                titulo: `Foto de ${cual} — ¿es el que elegiste?${extras.length ? `\n${extras.join('\n')}` : ''}`,
            };
        })
        .filter(f => !!f.url);

    // ── WhatsApp ─────────────────────────────────────────────────────────────
    //
    // Las líneas vacías son las que separan las secciones: sin ellas el mensaje
    // es un bloque de texto que nadie lee hasta el final, que es justo lo que
    // acá hace falta. Por eso lo condicional se marca con `null` y se filtra
    // eso — no las cadenas vacías, que son los espacios a propósito.
    const L = (...lineas: (string | null)[]) => lineas.filter(l => l !== null) as string[];

    const waText = L(
        `*Confirmación de compra — Pedido #${nro}*`,
        esActualizacion ? `⚠️ *PEDIDO ACTUALIZADO* — este repaso reemplaza al anterior.` : null,
        ``,
        `Hola ${nombre}! Tu pedido ya salió a fabricación. Te pasamos el detalle *exacto* de cómo se va a fabricar para que lo revises.`,
        ``,
        `*LO QUE ENCARGASTE*`,
        ...(resumen.pairs.length > 1
            // Con dos anteojos, listar los cristales en una sola bolsa no dice
            // cuál lleva qué: se agrupan por anteojo.
            ? resumen.pairs.flatMap(p => {
                const suyos = cristalesDe.get(p.pair) || [];
                const lineas = lineasDeItems(suyos);
                return lineas.length ? [`${p.label}:`, ...lineas.map(l => `  ${l}`)] : [];
            })
            : lineasDeItems(items)),
        ...(otrosItems.length ? lineasDeItems(otrosItems) : []),
        ``,
        `*TU ANTEOJO*`,
        frameRecapText(order, true),
        ``,
        ...(prescriptionRecapText(rx, true)
            ? [`*TU RECETA* (tal cual está cargada)`, prescriptionRecapText(rx, true), ``]
            : []),
        `*PAGO*`,
        ...(cadenaCierra && (promoInflado > 0 || especial > 0) ? [`Suma de los productos: ${money(sumaRenglones)}`] : []),
        ...(cadenaCierra && promoInflado > 0 ? [`Bonificación — ${order.appliedPromoName || 'promoción'}: −${money(promoInflado)}`] : []),
        ...(cadenaCierra && especial > 0 ? [`⭐ Descuento excepcional para vos: −${money(especial)}`] : []),
        `Precio de lista: ${money(fin.listPrice)}`,
        ...(!fin.hasBalance && descuentoFormaDePago > 0
            ? [`Descuento por tu forma de pago: −${money(descuentoFormaDePago)}`,
               `*Lo que pagaste: ${money(fin.paidReal)}*`]
            : [`Abonado: ${money(fin.paidReal)}${fin.hasBalance && fin.listEquivalentPaid > fin.paidReal ? ` (equivalen a ${money(fin.listEquivalentPaid)} de lista)` : ''}`]),
        ...(saldo > 0
            ? [`Te queda al retirar: efectivo ${money(fin.remainingCash)} · transferencia ${money(fin.remainingTransfer)} · tarjeta ${money(fin.remainingCard)}`]
            : saldoChico
                ? [`Queda una diferencia mínima de ${money(fin.remainingList)} que se ajusta al retirar.`]
                : [`Saldo: totalmente abonado ✅`]),
        ``,
        `*NECESITAMOS TU OK* 🙏`,
        `Revisá que esté todo bien: así es como se va a fabricar.`,
        ``,
        fotosArmazon.length
            ? `• Mirá la foto que te adjuntamos: ¿es el armazón que elegiste?`
            : `• ¿El armazón es el que elegiste?`,
        // Con varios anteojos hay que decir CUÁL va teñido, o el cliente
        // confirma un color creyendo que es para el otro.
        ...(resumen.pairs.filter(p => p.tint).length > 0
            ? resumen.pairs.filter(p => p.tint).map(p =>
                resumen.pairs.length > 1
                    ? `• El *${p.label.replace('Armazón — ', '')} armazón* va teñido *${p.tint}*: confirmanos que es el que pediste.`
                    : `• El teñido va *${p.tint}*: confirmanos que es el que pediste.`)
            : [`• Este pedido va *SIN teñido*. Si lo querés con color, decinos ahora.`]),
        `• Si hay algún término que no entendés (esférico, cilindro, eje, adición, fotocromático), preguntanos y te lo explicamos.`,
        ``,
        `Respondenos *OK* si está todo bien, o contanos qué corregir. Es el momento: una vez fabricado no se puede cambiar.`,
    ).join('\n');

    // ── Email ────────────────────────────────────────────────────────────────
    const fila = (label: string, valor: string) => `
        <tr>
          <td style="padding:6px 12px 6px 0;font-size:13px;color:#666;white-space:nowrap;vertical-align:top">${escHtml(label)}</td>
          <td style="padding:6px 0;font-size:14px;color:#111;font-weight:600">${escHtml(valor)}</td>
        </tr>`;

    const bloque = (titulo: string, cuerpo: string) => `
        <div style="margin:24px 0;padding:18px;border:1px solid #e5e1da;border-radius:12px;background:#fbfaf8">
          <p style="margin:0 0 12px;font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#8a7f6d">${escHtml(titulo)}</p>
          ${cuerpo}
        </div>`;

    // Mismo criterio que el WhatsApp: el teñido va en su bloque, no repetido acá.
    //
    // AGRUPADO POR ANTEOJO Y SIN REPETIR, igual que el texto. Antes esto mapeaba
    // `items` crudo: como los cristales se cargan POR OJO, un 2x1 de dos pares
    // salía como CUATRO renglones idénticos —"Varilux Comfort Max" cuatro veces
    // seguidas— sin decir cuál iba en qué armazón. Un cliente lo reportó tal
    // cual: «la OC describe muy poco y confuso esto».
    //
    // El texto de WhatsApp ya lo resolvía (`lineasDeItems` deduplica y
    // `cristalesDe` agrupa) y el mail se había quedado atrás. Es la regla de
    // CLAUDE.md: un dato que se muestra en más de un lugar se arma UNA vez.
    /**
     * UNA TARJETA POR ANTEOJO: sus cristales (con el ojo), su armazón, sus
     * medidas y su foto, todo junto.
     *
     * Antes esto estaba partido en dos bloques lejanos —"Lo que encargaste" con
     * los cristales sueltos y "Armazón y teñido" con las medidas— y el cliente
     * tenía que atar cabos entre secciones para saber qué cristal iba en qué
     * anteojo. Con un 2x1 (dos pares × dos ojos) eso eran cuatro renglones
     * iguales arriba y dos bloques de medidas abajo. Un cliente lo dijo tal
     * cual: «la OC describe muy poco y confuso esto».
     */
    const ojoLabel = (eye: string | null | undefined): string =>
        eye === 'RIGHT' || eye === 'OD' ? 'Ojo derecho (OD)'
            : eye === 'LEFT' || eye === 'OI' ? 'Ojo izquierdo (OI)'
                : '';

    const cristalHtml = (it: any) => {
        const nombre = it.product?.name || it.productNameSnapshot || 'Cristal';
        const marca = it.product?.brand || it.productBrandSnapshot || '';
        const ojo = ojoLabel(it.eye);
        const detalle = [tipoDeItem(it), it.crystalColor, it.crystalColorNote ? `grado ${it.crystalColorNote}` : null]
            .filter(Boolean).join(' · ');
        const precio = precioDe(it);
        return `
          <tr>
            <td style="padding:7px 0;border-bottom:1px solid #efeae1;vertical-align:top">
              ${ojo ? `<p style="margin:0;font-size:12px;font-weight:bold;color:#6b6257">${escHtml(ojo)}</p>` : ''}
              <p style="margin:1px 0 0;font-size:14px;color:#111">${marca && !nombre.toLowerCase().includes(marca.toLowerCase()) ? escHtml(marca) + ' ' : ''}${escHtml(nombre)}</p>
              ${detalle ? `<p style="margin:1px 0 0;font-size:12px;color:#6b6257">${escHtml(detalle)}</p>` : ''}
            </td>
            <td style="padding:7px 0 7px 12px;border-bottom:1px solid #efeae1;text-align:right;white-space:nowrap;vertical-align:top">
              ${precio > 0
                ? `<span style="font-size:14px;color:#111">${money(precio)}</span>`
                : `<span style="font-size:11px;font-weight:bold;color:#1a7f4b">SIN CARGO</span>`}
            </td>
          </tr>`;
    };

    const tarjetaDeAnteojo = (par: any, indice: number) => {
        const cristales = (cristalesDe.get(par.pair) || []).filter((it: any) => !esLineaDeTenido(it));
        // Los cristales se cargan por ojo: se ordenan OD y después OI, siempre
        // igual, para que los dos anteojos se lean con la misma estructura.
        const orden = (it: any) => (it.eye === 'RIGHT' || it.eye === 'OD') ? 0 : (it.eye === 'LEFT' || it.eye === 'OI') ? 1 : 2;
        cristales.sort((a: any, b: any) => orden(a) - orden(b));

        const foto = fotosArmazon.find(f => f.pair === par.pair);
        const titulo = tituloDePar(par, resumen.pairs.length, indice);
        const armazonItem = armazonDelPar.get(par.pair) || null;
        const teñidosDePar = teñidoDelPar.get(par.pair) || [];
        // Sin cristales, sin medidas, sin teñido y sin foto no hay tarjeta: una
        // venta de lentes de sol sin receta dibujaba una caja "TU ANTEOJO"
        // completamente vacía y el producto real quedaba abajo en otra caja.
        if (cristales.length === 0 && teñidosDePar.length === 0 && !armazonItem
            && !par.shape && !par.measurements && !par.fitting && !par.details
            && !par.tint && !fotosArmazon.find(f => f.pair === par.pair)) {
            return '';
        }
        // Los datos del armazón, DESPUÉS de la foto y en CUADRANTES: fichitas
        // de a dos por fila, cada una con su etiqueta y su valor. Pedido de la
        // dueña: "las medidas ponelas después de la foto, bien ordenadas en una
        // ficha con cuadrantes — es interno, no hace falta que lo vea el
        // cliente, pero no queda mal que salga todo junto".
        //
        // Y el teñido/fotocromático VAN ACÁ, en la ficha de su anteojo — no en
        // un bloque aparte al final: "todo eso va asociado al anteojo, tiene
        // que ir juntito al armazón uno, no en otra ficha".
        // `par.tint` es un STRING (lab-frame-summary lo declara así): nada de
        // `.text`, que ya apagó esta fila una vez en silencio.
        const tintDelPar: string | null = par.tint || null;

        const cuadrantes = [
            par.shape ? ['Forma / aro', par.shape] : null,
            par.measurements ? ['Medidas', par.measurements] : null,
            par.fitting ? ['Altura', par.fitting] : null,
            par.details ? ['Detalles', par.details] : null,
            ['Teñido', tintDelPar || 'No lleva'],
            par.photochromic
                ? ['Fotocromático', `Sí${par.photochromicColor ? ` — ${par.photochromicColor}` : ''} (se oscurece solo con el sol)`]
                : null,
        ].filter(Boolean) as [string, string][];

        const cuadrante = ([k, v]: [string, string]) => `
            <td width="50%" style="padding:4px">
              <div style="border:1px solid #e5e1da;border-radius:10px;padding:8px 10px;background:#fbfaf7">
                <p style="margin:0;font-size:10px;letter-spacing:1.2px;text-transform:uppercase;color:#6b6257;font-weight:bold">${escHtml(k)}</p>
                <p style="margin:2px 0 0;font-size:13px;font-weight:bold;color:#111">${escHtml(v)}</p>
              </div>
            </td>`;
        const filasCuadrantes: string[] = [];
        for (let i = 0; i < cuadrantes.length; i += 2) {
            filasCuadrantes.push(`<tr>${cuadrante(cuadrantes[i])}${cuadrantes[i + 1] ? cuadrante(cuadrantes[i + 1]) : '<td width="50%" style="padding:4px"></td>'}</tr>`);
        }

        return `
        <div style="margin:0 0 16px;border:1px solid #e5e1da;border-radius:14px;overflow:hidden;background:#fff">
          <div style="padding:10px 16px;background:#f7f4ee;border-bottom:1px solid #e5e1da">
            <p style="margin:0;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#4b3f2f;font-weight:800">${escHtml(titulo)}</p>
          </div>
          <div style="padding:12px 16px">
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%">${[...cristales, ...teñidosDePar, ...(armazonItem ? [armazonItem] : [])].map(cristalHtml).join('')}</table>
            ${foto ? `
            <div style="margin-top:12px">
              <img src="${foto.url}" alt="Foto de tu armazón" width="240" style="max-width:240px;width:100%;border-radius:12px;border:1px solid #e5e1da" />
            </div>` : ''}
            ${filasCuadrantes.length ? `
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-top:10px">${filasCuadrantes.join('')}</table>` : ''}
          </div>
        </div>`;
    };

    const anteojosHtml = resumen.pairs.map(tarjetaDeAnteojo).join('')
        // Lo que no pertenece a ningún anteojo (accesorios, un armazón suelto).
        + (otrosItems.length ? `
        <div style="margin:0 0 16px;border:1px solid #e5e1da;border-radius:14px;overflow:hidden;background:#fff">
          <div style="padding:10px 16px;background:#f7f4ee;border-bottom:1px solid #e5e1da">
            <p style="margin:0;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#4b3f2f;font-weight:800">Aparte de tus anteojos</p>
          </div>
          <div style="padding:12px 16px">
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%">${otrosItems.map(cristalHtml).join('')}</table>
          </div>
        </div>` : '');

    const recetaHtml = rx
        ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%">
             ${rx.prescriptionType ? fila('Tipo de lente', String(rx.prescriptionType)) : ''}
             ${fila('Ojo derecho (OD)', `Esf ${rx.sphereOD ?? '—'} · Cil ${rx.cylinderOD ?? '—'} · Eje ${rx.axisOD ?? '—'} · Add ${rx.additionOD ?? rx.addition ?? '—'} · Altura ${rx.heightOD ?? '—'}`)}
             ${fila('Ojo izquierdo (OI)', `Esf ${rx.sphereOI ?? '—'} · Cil ${rx.cylinderOI ?? '—'} · Eje ${rx.axisOI ?? '—'} · Add ${rx.additionOI ?? rx.addition ?? '—'} · Altura ${rx.heightOI ?? '—'}`)}
             ${fila('Distancia interpupilar', String(rx.pd ?? '—'))}
             ${rx.notes ? fila('Observaciones', String(rx.notes)) : ''}
           </table>
           ${fotoReceta ? `<p style="margin:14px 0 0"><img src="${fotoReceta}" alt="Foto de tu receta" style="max-width:100%;border-radius:10px;border:1px solid #e5e1da" /></p>` : ''}`
        : `<p style="margin:0;font-size:14px;color:#666">No hay una receta cargada en este pedido.</p>`;

    // El botón de WhatsApp aparece 3 veces (arriba, en el bloque del OK y al
    // pie) y el mail dice EXPLÍCITO que no se responda por mail. Pedido del
    // 24/8: la casilla de respuestas no se mira — un cliente que contesta el
    // mail cree que avisó y nadie lo vio. El único canal de vuelta es WhatsApp.
    const waLink = `https://wa.me/${BUSINESS_INFO.phoneE164.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola! Es por mi pedido #${nro}:`)}`;
    const botonWhatsApp = (texto: string) => `
        <div style="text-align:center;margin:14px 0 0">
          <a href="${waLink}" style="display:inline-block;background:#25D366;color:#fff;font-size:17px;font-weight:800;line-height:1;padding:16px 28px;border-radius:14px;text-decoration:none">
            ${escHtml(texto)} &nbsp;📲
          </a>
        </div>`;

    const emailHtml = `
      <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:620px;margin:0 auto;color:#111">
        <h1 style="font-size:22px;margin:0 0 6px">Confirmación de compra — Pedido #${escHtml(nro)}</h1>
        ${esActualizacion ? `<p style="margin:0 0 14px;padding:10px 14px;border-radius:10px;background:#fff4e5;color:#7a4a00;font-size:14px;font-weight:700">PEDIDO ACTUALIZADO — este repaso reemplaza al que te enviamos antes.</p>` : ''}
        <p style="font-size:15px;line-height:1.6;color:#333;margin:0 0 4px">Hola ${escHtml(nombre)}, tu pedido ya salió a fabricación.</p>
        <p style="font-size:15px;line-height:1.6;color:#333;margin:0">Abajo está el detalle <strong>exacto</strong> de cómo se va a fabricar. Te pedimos que lo revises con calma: es el momento para corregir cualquier cosa.</p>
        ${botonWhatsApp('Responder por WhatsApp')}
        <p style="margin:8px 0 0;font-size:14px;font-weight:800;line-height:1.6;color:#b3261e;text-align:center">Este mail no recibe respuestas — escribinos por WhatsApp.</p>

        ${bloque('Lo que encargaste', anteojosHtml)}

        ${bloque('Datos del armazón', `
            ${resumen.origin ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%">${fila('Armazón', resumen.origin)}</table>` : ''}
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-top:10px">
              ${fila('Teñido', resumen.tint ? resumen.tint.text : 'NO lleva teñido')}
              ${tienePhotocromatico(order) ? fila('Fotocromático', 'Sí — los cristales se oscurecen solos con el sol y se aclaran en interiores.') : ''}
              ${resumen.notes ? fila('Notas de laboratorio', resumen.notes) : ''}
            </table>
`)}

        ${bloque('Tu receta, tal cual está cargada', recetaHtml)}

        ${bloque('Cómo se compone el precio', `
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;color:#333">
              ${cadenaCierra && (promoInflado > 0 || especial > 0) ? `
              <tr>
                <td style="padding:6px 0">Suma de los productos</td>
                <td style="padding:6px 0;text-align:right">${money(sumaRenglones)}</td>
              </tr>
              ${promoInflado > 0 ? `
              <tr>
                <td style="padding:6px 0;color:#1a7f4b">Bonificación — ${escHtml(order.appliedPromoName || 'promoción')}</td>
                <td style="padding:6px 0;text-align:right;color:#1a7f4b;font-weight:bold">− ${money(promoInflado)}</td>
              </tr>` : ''}
              ${especial > 0 ? `
              <tr>
                <td colspan="2" style="padding:4px 0">
                  <!-- DESTACADO a propósito: no es una promo de lista ni el
                       descuento por forma de pago — es un gesto EXCEPCIONAL que
                       se le hizo a este cliente, y tiene que notarse.
                       (Ishtar, 25/8: "quiero que se destaque porque es
                       realmente especial"). -->
                  <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#eaf7f0;border:1px solid #7cc79b;border-radius:10px">
                    <tr>
                      <td style="padding:8px 12px;color:#12653a;font-weight:800;font-size:14px">⭐ Descuento excepcional para vos</td>
                      <td style="padding:8px 12px;text-align:right;color:#12653a;font-weight:800;font-size:15px;white-space:nowrap">− ${money(especial)}</td>
                    </tr>
                  </table>
                </td>
              </tr>` : ''}
              <tr>
                <td style="padding:8px 0 6px;border-top:1px solid #e5e1da;font-weight:bold;color:#111">Precio de lista</td>
                <td style="padding:8px 0 6px;border-top:1px solid #e5e1da;text-align:right;font-weight:bold;color:#111">${money(fin.listPrice)}</td>
              </tr>` : `
              <tr>
                <td style="padding:6px 0;font-weight:bold;color:#111">Precio de lista</td>
                <td style="padding:6px 0;text-align:right;font-weight:bold;color:#111">${money(fin.listPrice)}</td>
              </tr>`}
              ${!fin.hasBalance && descuentoFormaDePago > 0 ? `
              <tr>
                <td style="padding:6px 0;color:#1a7f4b">Descuento por tu forma de pago</td>
                <td style="padding:6px 0;text-align:right;color:#1a7f4b;font-weight:bold">− ${money(descuentoFormaDePago)}</td>
              </tr>
              <tr>
                <td style="padding:10px 0 6px;border-top:2px solid #d8cfc0;font-size:16px;font-weight:800;color:#111">Lo que pagaste</td>
                <td style="padding:10px 0 6px;border-top:2px solid #d8cfc0;text-align:right;font-size:16px;font-weight:800;color:#111">${money(fin.paidReal)}</td>
              </tr>` : `
              <tr>
                <td style="padding:6px 0">Ya abonaste${fin.hasBalance && fin.listEquivalentPaid > fin.paidReal
                    ? ` <span style="font-size:12px;color:#666">(equivalen a ${money(fin.listEquivalentPaid)} de lista por tu forma de pago)</span>` : ''}</td>
                <td style="padding:6px 0;text-align:right">${money(fin.paidReal)}</td>
              </tr>`}
            </table>
            ${saldo > 0 ? `
              <div style="margin-top:14px;padding:14px;border-radius:12px;background:#fff6e5;border:1px solid #f0d9a8">
                <p style="margin:0 0 8px;font-size:15px;font-weight:800;color:#7a5a12">Te queda por abonar al retirar</p>
                <p style="margin:0 0 10px;font-size:13px;line-height:1.6;color:#7a5a12">Cuánto depende de cómo lo pagues:</p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;color:#7a5a12">
                  <tr><td style="padding:3px 0">💵 En efectivo <span style="font-size:12px">(−${fin.discountCash}%)</span></td>
                      <td style="padding:3px 0;text-align:right;font-weight:bold">${money(fin.remainingCash)}</td></tr>
                  <tr><td style="padding:3px 0">🏦 Por transferencia <span style="font-size:12px">(−${fin.discountTransfer}%)</span></td>
                      <td style="padding:3px 0;text-align:right;font-weight:bold">${money(fin.remainingTransfer)}</td></tr>
                  <tr><td style="padding:3px 0">💳 Con tarjeta o en cuotas</td>
                      <td style="padding:3px 0;text-align:right;font-weight:bold">${money(fin.remainingCard)}</td></tr>
                </table>
                <p style="margin:10px 0 0;font-size:13px;line-height:1.6;color:#7a5a12">Te avisamos por WhatsApp cuando esté listo.</p>
              </div>`
            : saldoChico ? `
              <div style="margin-top:14px;padding:14px;border-radius:12px;background:#fffdf4;border:1px solid #e5d9a8">
                <p style="margin:0;font-size:14px;font-weight:bold;color:#6b5d1e">Queda una diferencia mínima de ${money(fin.remainingList)} que se ajusta al retirar.</p>
              </div>` : `
              <div style="margin-top:14px;padding:16px;border-radius:12px;background:#eaf7f0;border:2px solid #7cc79b;text-align:center">
                <p style="margin:0;font-size:18px;font-weight:800;color:#12653a">✅ NO TENÉS SALDO PENDIENTE</p>
                <p style="margin:6px 0 0;font-size:14px;line-height:1.6;color:#12653a">Tu pedido está <strong>totalmente abonado</strong>. Cuando lo retires no tenés que pagar nada más.</p>
              </div>`}
            <p style="margin:14px 0 0;font-size:13px;line-height:1.7;color:#666">
              📎 <strong>Adjunto a este mail</strong> va el detalle completo del pedido en PDF. Guardalo: es tu respaldo.
            </p>`)}

        <div style="margin:24px 0;padding:18px;border:2px solid #d8cfc0;border-radius:12px;background:#fffdf8">
          <p style="margin:0 0 10px;font-size:16px;font-weight:800;color:#111">Necesitamos tu OK 🙏</p>
          <p style="margin:0 0 10px;font-size:14px;line-height:1.7;color:#333">Revisá que esté todo bien: <strong>así es como se va a fabricar</strong>.</p>
          <ul style="margin:0 0 10px;padding-left:20px;font-size:14px;line-height:1.8;color:#333">
            <li>${fotosArmazon.length ? 'Mirá la foto del armazón acá arriba: ¿es el que elegiste?' : '¿El armazón es el que elegiste?'}</li>
            ${resumen.pairs.filter(p => p.tint).length > 0
                ? resumen.pairs.filter(p => p.tint).map(p =>
                    `<li>El teñido ${resumen.pairs.length > 1 ? `del <strong>${p.pair}º par</strong> ` : ''}va <strong>${escHtml(p.tint!)}</strong>: confirmanos que es el que pediste.</li>`).join('')
                : resumen.tint
                    ? `<li>El teñido va <strong>${escHtml(resumen.tint.text)}</strong>: confirmanos que es el que pediste.</li>${resumen.tint.ambiguousPair ? '<li><strong>No quedó registrado en cuál de los dos armazones va el teñido: confirmanos cuál.</strong></li>' : ''}`
                    : '<li>Si querés que lleven teñido, decinos ahora — este pedido va sin teñido.</li>'}
            <li>Si hay algún término que no entendés (esférico, cilindro, eje, adición, fotocromático), preguntanos y te lo explicamos con gusto.</li>
          </ul>
          ${botonWhatsApp('Mandanos tu OK por WhatsApp')}
          <p style="margin:12px 0 0;font-size:15px;font-weight:800;line-height:1.6;color:#b3261e;text-align:center">⚠️ NO respondas este mail: no lo vemos.<br>Escribinos SOLO por WhatsApp 👆</p>
          <p style="margin:10px 0 0;padding:10px 12px;border-radius:10px;background:#fdecea;font-size:14px;font-weight:bold;line-height:1.6;color:#b3261e;text-align:center">Si querés cambiar algo del pedido, pedilo <u>únicamente por WhatsApp</u>.<br><span style="font-weight:normal">Un cambio pedido por otra vía no queda registrado y no lo vamos a ver.</span></p>
          <p style="margin:8px 0 0;font-size:13px;line-height:1.6;color:#666;text-align:center">Una vez fabricado ya no se puede cambiar.</p>
        </div>

        ${botonWhatsApp('Tengo una duda — hablar por WhatsApp')}
        <p style="margin:8px 0 24px;font-size:13px;line-height:1.6;color:#666;text-align:center">Cualquier consulta va por WhatsApp — las respuestas a este mail no se leen.</p>
      </div>`;

    return {
        subject: `${esActualizacion ? 'Pedido actualizado' : 'Confirmá tu pedido'} #${nro} — así se va a fabricar`,
        emailHtml,
        waText,
        prescriptionImageUrl: fotoReceta,
        fotosArmazon,
    };
}

/** Todo lo que la confirmación necesita leer de la orden, en un solo lugar. */
const SELECT_CONFIRMACION = SELECT_REPASO_CON_CLIENTE;

export interface EnvioConfirmacionResultado {
    email: boolean;
    whatsapp: boolean;
    /** No se envió porque ya se había enviado antes para esta versión del pedido. */
    yaEnviada?: boolean;
    /** No se envió porque la corrida pidió no enviar nada (ATELIER_SIN_ENVIOS=1). */
    omitida?: boolean;
    pdfUrl?: string | null;
}

/**
 * Manda la confirmación por mail y por WhatsApp, guarda el PDF y deja la nota
 * en la ficha con el resultado REAL de cada canal.
 *
 * Nunca lanza: la venta ya está hecha y confirmada: que falle un aviso no puede
 * voltearla. Lo que falla queda escrito en la ficha para que una persona lo vea.
 */
export async function sendSaleConfirmation(
    orderId: string,
    opts: { esActualizacion?: boolean; version?: number } = {}
): Promise<EnvioConfirmacionResultado> {
    const { esActualizacion = false, version } = opts;
    const resultado: EnvioConfirmacionResultado = { email: false, whatsapp: false };

    // Los checks convierten ventas sintéticas para probar el candado, y cada
    // conversión disparaba una confirmación REAL: mails y WhatsApp de pedidos
    // que no existen, a buzones de verdad. Un script de prueba no puede
    // escribirle a nadie.
    //
    // La guarda es explícita y de una sola dirección: hay que PEDIR que no se
    // envíe. Así producción nunca queda muda por una variable mal puesta.
    if (process.env.ATELIER_SIN_ENVIOS === '1') {
        console.log('[Confirmación de compra] ATELIER_SIN_ENVIOS=1 — no se envía nada (corrida de prueba).');
        return { ...resultado, omitida: true };
    }

    try {
        const order: any = await prisma.order.findUnique({ where: { id: orderId }, select: SELECT_CONFIRMACION });
        if (!order || !order.client) return resultado;

        // Idempotencia: una confirmación por versión del pedido. Sin esto, dos
        // guardados seguidos le mandan el mismo repaso dos veces al cliente.
        const sello = `${MARCA_NOTA} · #${String(order.id).slice(-4).toUpperCase()}${version ? ` (v${version})` : ''}`;
        const yaHay = await prisma.interaction.findFirst({
            where: { clientId: order.client.id, content: { startsWith: sello } },
            select: { id: true },
        });
        if (yaHay) return { ...resultado, yaEnviada: true };

        const conf = buildSaleConfirmation(order, esActualizacion);

        // PDF del pedido: se adjunta al mail, se manda por WhatsApp y queda
        // guardado para la ficha del cliente.
        let pdf: { base64: string; filename: string } | null = null;
        let pdfUrl: string | null = null;
        try {
            const { generateOrderPDF } = await import('@/lib/order-pdf-generator');
            pdf = await generateOrderPDF(order, order.client, order.labSentBy || undefined);
            pdfUrl = await uploadFile(
                Buffer.from(pdf.base64, 'base64'),
                `confirmaciones/${order.id}-${version || 1}.pdf`,
                'application/pdf',
            );
        } catch (err) {
            console.error('[Confirmación de compra] No se pudo generar/guardar el PDF:', err);
        }

        // ── Email ────────────────────────────────────────────────────────────
        resultado.email = await sendClientEmail({
            to: order.client.email,
            subject: conf.subject,
            bodyHtml: conf.emailHtml,
            label: 'confirmación de compra',
            ...(pdf ? { attachments: [{ filename: pdf.filename, content: Buffer.from(pdf.base64, 'base64'), contentType: 'application/pdf' }] } : {}),
        });

        // ── WhatsApp ─────────────────────────────────────────────────────────
        const tel = (order.client.phone || '').replace(/\D/g, '');
        if (tel.length >= 10) {
            try {
                // Texto libre + PDF dentro de la ventana de 24 h; si está
                // cerrada, plantilla "venta_confirmada" (A2) con el PDF de encabezado.
                const nro = `#${String(order.id).slice(-4).toUpperCase()}`;
                const res = await sendWhatsApp({
                    chatId: `${normalizeArgentinePhone(tel)}@c.us`,
                    message: conf.waText,
                    senderName: 'Sistema Atelier',
                    isProactive: true,
                    media: pdf ? { base64: pdf.base64, mimetype: 'application/pdf', filename: pdf.filename } : null,
                    // Sin PDF la plantilla con documento no se puede armar: se
                    // deja sin plantilla y, si la ventana está cerrada, queda
                    // registrado como no enviado (el email igual salió).
                    // Lo pagado si está saldado; el precio de lista si no.
                    // `order.total` era un CUARTO número (el teórico
                    // todo-en-efectivo) que no figuraba en ningún otro lado del
                    // mail nuevo. Mismo cálculo que el cuerpo (PricingService).
                    template: pdf ? (() => {
                        const finTpl = PricingService.calculateOrderFinancials(order);
                        const monto = finTpl.hasBalance ? finTpl.listPrice : finTpl.paidReal;
                        return templateSpec('venta_confirmada', [order.client.name.split(' ')[0], nro,
                            `$ ${Number(monto).toLocaleString('es-AR')}`]);
                    })() : null,
                });
                resultado.whatsapp = res.ok;
                if (!res.ok) console.warn('[Confirmación de compra] WhatsApp no salió:', explainSendFailure(res));

                // Y las FOTOS del armazón, una por mensaje.
                //
                // El texto le dice al cliente "mirá la foto que te adjuntamos",
                // pero por WhatsApp solo viajaba el PDF: la foto quedaba dentro
                // del adjunto, que muchos ni abren. Y es justo lo que tiene que
                // mirar para reconocer su armazón — el único control que puede
                // hacer de verdad. El endpoint del bot manda un archivo por
                // mensaje, así que van de a una.
                // Con la API oficial las fotos sueltas solo pueden ir con la ventana
                // abierta (una plantilla lleva un solo encabezado): si el
                // principal salió como plantilla, las fotos ya están en el PDF.
                if (res.ok && res.via !== 'template') {
                    for (const foto of conf.fotosArmazon) {
                        const img = await bytesDeImagen(foto.valor);
                        if (!img) continue;
                        await sendWhatsApp({
                            chatId: `${normalizeArgentinePhone(tel)}@c.us`,
                            message: foto.titulo,
                            senderName: 'Sistema Atelier',
                            isProactive: true,
                            media: { base64: img.base64, mimetype: img.mimetype, filename: img.filename },
                        }).catch(err => console.error('[Confirmación de compra] No se pudo enviar la foto del armazón:', err));
                    }
                }
            } catch (err) {
                console.error('[Confirmación de compra] WhatsApp falló:', err);
            }
        }

        resultado.pdfUrl = pdfUrl;

        // ── Registro en la ficha, con el resultado real de cada canal ────────
        // Resumen arriba, y detrás del separador la COPIA EXACTA que recibió el
        // cliente (la ficha la muestra colapsada). Es lo que se le contesta a un
        // "a mí me dijeron otra cosa".
        const detalle = [
            sello,
            `Email: ${resultado.email ? `✅ enviado a ${order.client.email}` : (order.client.email ? '❌ NO se pudo enviar' : '— sin email cargado')}`,
            `WhatsApp: ${resultado.whatsapp ? `✅ enviado al ${order.client.phone}` : (tel.length >= 10 ? '❌ NO se pudo enviar' : '— sin teléfono válido')}`,
            pdfUrl ? `PDF del pedido: ${resolveStorageUrl(pdfUrl)}` : `PDF del pedido: ❌ no se pudo generar`,
        ].join('\n') + DETALLE_MARK + conf.waText;

        await prisma.interaction.create({
            data: {
                clientId: order.client.id,
                type: 'NOTE',
                content: detalle,
                userId: null,
                userName: 'Sistema',
            },
        }).catch(err => console.error('[Confirmación de compra] No se pudo registrar la nota:', err));

        // Si NINGÚN canal salió, alguien tiene que enterarse y mandarla a mano.
        if (!resultado.email && !resultado.whatsapp) {
            await prisma.clientTask.create({
                data: {
                    clientId: order.client.id,
                    description: `⚠️ La confirmación de compra del pedido #${String(order.id).slice(-4).toUpperCase()} NO llegó ni por mail ni por WhatsApp. Enviarla a mano y pedirle el OK.`,
                    status: 'PENDING',
                    type: 'TASK',
                },
            }).catch(err => console.error('[Confirmación de compra] No se pudo crear la tarea de aviso:', err));
        }

        logAudit({
            userId: null,
            userName: 'Sistema',
            action: 'NOTIFY',
            entityType: 'ORDER',
            entityId: order.id,
            details: { tipo: 'confirmacion_compra', email: resultado.email, whatsapp: resultado.whatsapp, version: version || 1 },
        }).catch(err => console.error('[Confirmación de compra] audit:', err));

        return resultado;
    } catch (err) {
        console.error('[Confirmación de compra] Error inesperado:', err);
        return resultado;
    }
}
