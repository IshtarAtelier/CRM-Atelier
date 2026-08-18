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
import { fetchWa } from '@/lib/wa-config';
import { normalizeArgentinePhone } from '@/services/contact.service';
import { resolveStorageUrl } from '@/lib/utils/storage';
import { uploadFile } from '@/lib/storage';
import { STORE_ORIGIN } from '@/lib/constants';
import { frameRecapText, prescriptionRecapText, prescriptionRecapStructure } from '@/lib/sale-recap-text';
import { describeLabFrameDetails } from '@/lib/lab-frame-summary';
import { garantiaDeLosCristales, GARANTIA_ADAPTACION } from '@/lib/garantia';
import { logAudit } from '@/lib/audit';
import { DETALLE_MARK } from '@/lib/order-detail-summary';

/** Marca de la nota que registra el envío: sirve de candado de idempotencia. */
const MARCA_NOTA = '📧 Confirmación de compra enviada al cliente';

const money = (n: number) => `$${Math.round(n || 0).toLocaleString('es-AR')}`;

/**
 * El HTML del mail, vuelto texto legible para guardar en la ficha. No es una
 * segunda redacción del contenido (eso es justo lo que había que evitar): es
 * el mismo HTML que se mandó, con las etiquetas sacadas — la prueba real de
 * qué decía el mail, no una reconstrucción aparte que podría desalinearse.
 * HTML propio y controlado (no de terceros): un stripper simple alcanza.
 */
function stripHtmlToText(html: string): string {
    return html
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        // La foto de la receta deja constancia: sin esto, la copia no dice que
        // el mail la llevaba incrustada.
        .replace(/<img[^>]*>/gi, '\n[imagen adjunta]')
        .replace(/<(tr|p|div|h1|li|br)[^>]*>/gi, '\n')
        .replace(/<\/(p|div|h1|li)>/gi, '\n')
        .replace(/<td[^>]*>/gi, '\t')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        // `&amp;` va ÚLTIMO: si se decodifica primero, un texto que contenga
        // literalmente "&lt;" (escapado a "&amp;lt;") se decodificaría dos
        // veces y saldría como "<".
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&')
        .split('\n')
        // Se colapsan espacios pero se respeta el tabulador que separa
        // etiqueta de valor: sin él "Total $86.000" queda sin delimitador.
        .map(l => l.replace(/[ ]+/g, ' ').replace(/\t+/g, ': ').replace(/^:\s*/, '').trim())
        .filter(Boolean)
        .join('\n');
}

/**
 * Baja una imagen y la devuelve en base64, que es lo único que acepta el
 * `/api/send` del bot (no toma URLs). Devuelve null y sigue: que no se pueda
 * bajar una foto no puede voltear la confirmación de una venta.
 */
async function imagenABase64(url: string): Promise<{ base64: string; mimetype: string } | null> {
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
        if (!res.ok) return null;
        const buf = Buffer.from(await res.arrayBuffer());
        // Tope de 5 MB: WhatsApp rechaza más, y el bot se cuelga esperando.
        if (!buf.length || buf.length > 5 * 1024 * 1024) return null;
        return {
            base64: buf.toString('base64'),
            mimetype: res.headers.get('content-type') || 'image/jpeg',
        };
    } catch {
        return null;
    }
}

function urlAbsoluta(src?: string | null): string | null {
    if (!src) return null;
    const resuelta = resolveStorageUrl(src);
    if (!resuelta) return null;
    if (resuelta.startsWith('http') || resuelta.startsWith('data:')) return resuelta;
    return `${STORE_ORIGIN}${resuelta.startsWith('/') ? '' : '/'}${resuelta}`;
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
    /**
     * Fotos de los productos, absolutas, con su nombre. El mail las incrusta y
     * el WhatsApp las manda como adjuntos: las dos vías salen de esta lista, así
     * que no puede pasar que un canal muestre una foto que el otro no.
     */
    productImages: Array<{ url: string; nombre: string }>;
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

    const total = order.total || 0;
    const pagado = order.paid || 0;
    const saldo = Math.max(0, total - pagado);

    const items: any[] = order.items || [];
    const fotoReceta = urlAbsoluta(rx?.imageUrl);

    // ── Garantía, cristal por cristal ────────────────────────────────────────
    // El alcance sale de `garantia.ts`, que es la política publicada: si un día
    // cambia, cambia en un solo lugar y este mensaje lo sigue. Decir qué NO
    // tiene garantía es tan importante como decir qué sí — el silencio es lo
    // que después genera el reclamo.
    const garantia = garantiaDeLosCristales(items);
    const lineasGarantia: string[] = [];
    if (garantia.conGarantia.length) {
        lineasGarantia.push(
            `✅ CON garantía de adaptación: ${garantia.conGarantia.join(', ')}.`,
            `${GARANTIA_ADAPTACION.RESUMEN} ${GARANTIA_ADAPTACION.REQUISITO}`,
        );
    }
    if (garantia.sinGarantia.length) {
        lineasGarantia.push(
            `❌ SIN garantía de adaptación: ${garantia.sinGarantia.join(', ')}.`,
            `Estos cristales no se pueden cambiar si no te adaptás, así que asegurate de que ves bien con esta graduación antes de que salgan a fabricarse. Si tenés dudas, decinos y lo revisamos juntos ahora.`,
        );
    }

    // ── WhatsApp: texto plano, el mismo contenido ────────────────────────────
    const waText = [
        `*Confirmación de compra — Pedido #${nro}*`,
        esActualizacion ? `\n⚠️ *PEDIDO ACTUALIZADO* — este repaso reemplaza al anterior.` : '',
        ``,
        `Hola ${nombre}! Tu pedido ya salió a fabricación. Te pasamos el detalle *exacto* de cómo se va a fabricar para que lo revises.`,
        ``,
        `*Lo que encargaste*`,
        ...items.map(it => `• ${it.product?.name || it.productNameSnapshot || 'Producto'}${it.quantity > 1 ? ` x${it.quantity}` : ''}`),
        ``,
        `*Armazón y teñido*`,
        frameRecapText(order),
        ``,
        `*Tu receta (tal cual está cargada)*`,
        prescriptionRecapText(rx),
        ``,
        ...(lineasGarantia.length ? [`*Garantía de tus cristales*`, ...lineasGarantia, ``] : []),
        `*Pago*`,
        `Total: ${money(total)}`,
        `Abonado: ${money(pagado)}`,
        saldo > 0 ? `Saldo pendiente: ${money(saldo)}` : `Saldo: totalmente abonado ✅`,
        ``,
        `*Necesitamos tu OK* 🙏`,
        `Revisá que esté todo bien: así es como se va a fabricar.`,
        // Se le manda la foto de CADA armazón con su detalle (ver el envío de
        // fotos más abajo), así que no hace falta pedirle que mande una foto
        // suya para chequear el estilo: lo ve directamente.
        `• Mirá las fotos que te mandamos: son los armazones que van a fabricarse.`,
        `• Si son de sol: confirmanos el *color* y el *grado* del teñido.`,
        `• Si hay algún término que no entendés (esférico, cilindro, eje, adición, fotocromático), preguntanos ahora y te lo explicamos.`,
        ``,
        `Respondenos *OK* si está todo bien, o contanos qué corregir. Es el momento: una vez fabricado no se puede cambiar.`,
    ].filter(l => l !== '').join('\n');

    // ── Email ────────────────────────────────────────────────────────────────
    const fila = (label: string, valor: string) => `
        <tr>
          <td style="padding:6px 12px 6px 0;font-size:13px;color:#666;white-space:nowrap;vertical-align:top">${escHtml(label)}</td>
          <td style="padding:6px 0;font-size:14px;color:#111;font-weight:600">${escHtml(valor)}</td>
        </tr>`;

    // Convierte el MISMO texto que recibe el cliente por WhatsApp
    // (frameRecapText/prescriptionRecapText) en filas de HTML. No es una
    // segunda redacción del contenido: es el mismo texto, mostrado distinto.
    // Antes el mail rearmaba esto a mano y no mostraba el prisma ni el aviso
    // de teñido ambiguo — ver auditoría 18/8/2026.
    // Un renglón que NO abre etiqueta nueva es la continuación del anterior:
    // labNotes, labFrameDetails y rx.notes son texto libre y pueden traer
    // saltos de línea. Partiéndolos, "Retira: martes" se volvía una etiqueta
    // "Retira" que el vendedor nunca escribió — el mail inventaba un campo que
    // el WhatsApp mostraba bien. Se pegan al valor de su propia fila.
    const recapTextToHtmlRows = (texto: string) => {
        const filas: Array<{ label: string; valor: string } | { aviso: string }> = [];
        for (const linea of texto.split('\n')) {
            if (linea.startsWith('⚠️')) { filas.push({ aviso: linea }); continue; }
            const m = linea.match(/^([^:]+):[ ]?(.*)$/);
            const ultima = filas[filas.length - 1];
            if (m) {
                filas.push({ label: m[1], valor: m[2] });
            } else if (ultima && 'valor' in ultima) {
                ultima.valor += `\n${linea}`;
            } else {
                filas.push({ label: '', valor: linea });
            }
        }
        return filas.map(f => {
            if ('aviso' in f) {
                return `<tr><td colspan="2" style="padding:6px 0;font-size:13px;color:#7a4a00;font-weight:700">${escHtml(f.aviso)}</td></tr>`;
            }
            // El salto se conserva como <br>: mismo contenido que el WhatsApp.
            const valorHtml = escHtml(f.valor).replace(/\n/g, '<br>');
            if (!f.label) {
                return `<tr><td colspan="2" style="padding:6px 0;font-size:14px;color:#111">${valorHtml}</td></tr>`;
            }
            return `
        <tr>
          <td style="padding:6px 12px 6px 0;font-size:13px;color:#666;white-space:nowrap;vertical-align:top">${escHtml(f.label)}</td>
          <td style="padding:6px 0;font-size:14px;color:#111;font-weight:600">${valorHtml}</td>
        </tr>`;
        }).join('');
    };

    const bloque = (titulo: string, cuerpo: string) => `
        <div style="margin:24px 0;padding:18px;border:1px solid #e5e1da;border-radius:12px;background:#fbfaf8">
          <p style="margin:0 0 12px;font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#8a7f6d">${escHtml(titulo)}</p>
          ${cuerpo}
        </div>`;

    // Una sola lista de fotos para los dos canales: el mail las incrusta acá
    // abajo y el WhatsApp las manda como adjuntos desde `productImages`.
    const productImages: Array<{ url: string; nombre: string }> = [];

    const itemsHtml = items.map(it => {
        const foto = urlAbsoluta((it.product?.imagenesCatalogo || [])[0]);
        const nombreItem = it.product?.name || it.productNameSnapshot || 'Producto';
        const marca = it.product?.brand || '';
        return `
        <tr>
          <td width="72" style="padding:10px 14px 10px 0;border-bottom:1px solid #eee;vertical-align:middle">
            ${foto
                ? `<img src="${escHtml(foto)}" alt="" width="72" height="72" style="display:block;width:72px;height:72px;border-radius:10px;object-fit:cover;background:#f0ece5" />`
                : `<div style="width:72px;height:72px;border-radius:10px;background:#f0ece5"></div>`}
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #eee;vertical-align:middle">
            ${marca ? `<p style="margin:0;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#8a7f6d">${escHtml(marca)}</p>` : ''}
            <p style="margin:2px 0 0;font-size:15px;color:#111">${escHtml(nombreItem)}${it.quantity > 1 ? ` <span style="color:#666">x${it.quantity}</span>` : ''}</p>
          </td>
        </tr>`;
    }).join('');

    // ── Los armazones: cada uno con SU foto y SU detalle debajo ──────────────
    //
    // Antes el mail listaba las medidas en una tabla y las fotos aparecían
    // aparte, arriba, mezcladas con los cristales: el cliente no tenía cómo
    // saber qué medidas correspondían a qué armazón (y en un 2x1, cuál era
    // cuál). Ahora va foto + detalle juntos, uno abajo del otro.
    //
    // El emparejamiento foto↔par: los datos del par (forma, medidas) viven
    // sueltos en el pedido (labFrameShape, frameA…) y NO tienen vínculo con el
    // producto, así que no hay un campo que diga "esta foto es la del par 2".
    // Cuando la cantidad de armazones comprados coincide con la cantidad de
    // pares, se emparejan por orden, que es como se cargan. Si no coincide, se
    // muestran las fotos y los detalles sin afirmar una correspondencia que el
    // dato no respalda — antes que mostrarle al cliente la foto equivocada.
    const CATEGORIAS_SIN_FOTO_PROPIA = ['cristal', 'tratamiento'];
    const esArmazon = (it: any) => {
        const cat = `${it.product?.category || it.productCategorySnapshot || ''}`.toLowerCase();
        return cat !== '' && !CATEGORIAS_SIN_FOTO_PROPIA.some(c => cat.includes(c));
    };
    const armazonesComprados = items.filter(esArmazon).map(it => ({
        nombre: `${it.product?.brand || ''} ${it.product?.name || it.productNameSnapshot || 'Armazón'}`.trim(),
        foto: urlAbsoluta((it.product?.imagenesCatalogo || [])[0]),
    }));

    const resumenArmazon = describeLabFrameDetails(order);
    const emparejaPorOrden = armazonesComprados.length === resumenArmazon.pairs.length;

    /** Las líneas de detalle de un par, sin el prefijo de la etiqueta. */
    const detalleDelPar = (par: typeof resumenArmazon.pairs[number]) => par.isEmpty
        ? ['sin medidas cargadas']
        : [par.shape, par.measurements, par.details].filter(Boolean) as string[];

    const fichaArmazon = (titulo: string, foto: string | null, nombre: string | null, detalles: string[]) => `
          <div style="margin:0 0 16px;padding-bottom:14px;border-bottom:1px solid #eee">
            <p style="margin:0 0 8px;font-size:12px;font-weight:800;color:#4b3f2f">${escHtml(titulo)}</p>
            ${foto ? `<p style="margin:0 0 10px"><img src="${escHtml(foto)}" alt="${escHtml(nombre || titulo)}" style="display:block;width:100%;max-width:280px;border-radius:12px;border:1px solid #e5e1da;background:#f0ece5" /></p>` : ''}
            ${nombre ? `<p style="margin:0 0 6px;font-size:15px;color:#111;font-weight:600">${escHtml(nombre)}</p>` : ''}
            ${detalles.length ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%">${detalles.map(d => `<tr><td style="padding:3px 0;font-size:13px;color:#555">${escHtml(d)}</td></tr>`).join('')}</table>` : ''}
          </div>`;

    const armazonesHtml = `
        ${resumenArmazon.pairs.map((par, i) => {
        const comprado = emparejaPorOrden ? armazonesComprados[i] : null;
        if (comprado?.foto && !productImages.some(p => p.url === comprado.foto)) {
            // El pie de la foto en WhatsApp lleva el MISMO detalle que va
            // debajo de la foto en el mail: los dos canales, igual de completos.
            productImages.push({
                url: comprado.foto,
                nombre: [`*${par.label}*`, comprado.nombre, ...detalleDelPar(par)].join('\n'),
            });
        }
        return fichaArmazon(par.label, comprado?.foto || null, comprado?.nombre || null, detalleDelPar(par));
    }).join('')}
        ${!emparejaPorOrden ? armazonesComprados.filter(a => a.foto).map(a => {
        if (!productImages.some(p => p.url === a.foto)) productImages.push({ url: a.foto!, nombre: a.nombre });
        return fichaArmazon(a.nombre, a.foto, null, []);
    }).join('') : ''}
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%">${recapTextToHtmlRows(
        frameRecapText(order).split('\n').filter(l => !/^Armazón/.test(l) && !/^Par \d/.test(l) && !/^Armazón — Par/.test(l)).join('\n')
    )}</table>`;

    // Misma fuente que el WhatsApp (prescriptionRecapText): no puede decir
    // algo distinto de un canal al otro.
    // La receta con el MISMO cuadro de columnas que se ve en el sistema, pero
    // dibujado desde `prescriptionRecapStructure` — la misma estructura de la
    // que sale el texto del WhatsApp. Mismos datos, dos formas de mostrarlos.
    const rxEstructura = prescriptionRecapStructure(rx);
    const th = (t: string, primera = false) =>
        `<th style="padding:6px 8px;font-size:10px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:#8a7f6d;background:#f3efe8;border:1px solid #e5e1da;text-align:${primera ? 'left' : 'center'}">${escHtml(t)}</th>`;
    const td = (t: string, primera = false) =>
        `<td style="padding:7px 8px;font-size:13px;color:#111;border:1px solid #e5e1da;text-align:${primera ? 'left' : 'center'};${primera ? 'font-weight:700;background:#fbfaf8' : ''}">${escHtml(t)}</td>`;

    const tablaHtml = (t: typeof rxEstructura.tablas[number]) => `
          ${rxEstructura.tablas.length > 1 ? `<p style="margin:14px 0 6px;font-size:12px;font-weight:800;color:#4b3f2f">${escHtml(t.titulo)}</p>` : ''}
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-bottom:6px">
            <tr>${th('Ojo', true)}${t.columnas.map(c => th(c)).join('')}</tr>
            ${t.filas.map(f => `<tr>${td(f.ojo, true)}${f.valores.map(v => td(v)).join('')}</tr>`).join('')}
          </table>`;

    const recetaHtml = rxEstructura.vacia
        ? `<p style="margin:0;font-size:14px;color:#666">No hay una receta cargada en este pedido.</p>`
        : `${rxEstructura.tipo ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%">${fila('Tipo de lente', rxEstructura.tipo)}</table>` : ''}
        ${rxEstructura.tablas.map(tablaHtml).join('')}
        ${rxEstructura.extras.length ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-top:8px">${rxEstructura.extras.map(x => fila(x.label, x.valor)).join('')}</table>` : ''}
        ${fotoReceta ? `<p style="margin:14px 0 0"><img src="${escHtml(fotoReceta)}" alt="Foto de tu receta" style="max-width:100%;border-radius:10px;border:1px solid #e5e1da" /></p>` : ''}`;

    const emailHtml = `
      <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:620px;margin:0 auto;color:#111">
        <h1 style="font-size:22px;margin:0 0 6px">Confirmación de compra — Pedido #${escHtml(nro)}</h1>
        ${esActualizacion ? `<p style="margin:0 0 14px;padding:10px 14px;border-radius:10px;background:#fff4e5;color:#7a4a00;font-size:14px;font-weight:700">PEDIDO ACTUALIZADO — este repaso reemplaza al que te enviamos antes.</p>` : ''}
        <p style="font-size:15px;line-height:1.6;color:#333;margin:0 0 4px">Hola ${escHtml(nombre)}, tu pedido ya salió a fabricación.</p>
        <p style="font-size:15px;line-height:1.6;color:#333;margin:0">Abajo está el detalle <strong>exacto</strong> de cómo se va a fabricar. Te pedimos que lo revises con calma: es el momento para corregir cualquier cosa.</p>

        ${bloque('Lo que encargaste', `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%">${itemsHtml}</table>`)}

        ${bloque('Armazón y teñido', armazonesHtml)}

        ${bloque('Tu receta, tal cual está cargada', recetaHtml)}

        ${lineasGarantia.length ? bloque('Garantía de tus cristales', `
            ${garantia.conGarantia.length ? `
            <p style="margin:0 0 4px;font-size:14px;color:#1d6b45;font-weight:700">✅ CON garantía de adaptación</p>
            <p style="margin:0 0 6px;font-size:14px;color:#111">${escHtml(garantia.conGarantia.join(', '))}</p>
            <p style="margin:0 0 14px;font-size:13px;line-height:1.6;color:#555">${escHtml(`${GARANTIA_ADAPTACION.RESUMEN} ${GARANTIA_ADAPTACION.REQUISITO}`)}</p>` : ''}
            ${garantia.sinGarantia.length ? `
            <p style="margin:0 0 4px;font-size:14px;color:#993c1d;font-weight:700">❌ SIN garantía de adaptación</p>
            <p style="margin:0 0 6px;font-size:14px;color:#111">${escHtml(garantia.sinGarantia.join(', '))}</p>
            <p style="margin:0;font-size:13px;line-height:1.6;color:#555">Estos cristales no se pueden cambiar si no te adaptás, así que <strong>asegurate de que ves bien con esta graduación</strong> antes de que salgan a fabricarse. Si tenés dudas, decinos y lo revisamos juntos ahora.</p>` : ''}`) : ''}

        ${bloque('Pago', `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%">
              ${fila('Total', money(total))}
              ${fila('Abonado', money(pagado))}
              ${fila('Saldo pendiente', saldo > 0 ? money(saldo) : 'Totalmente abonado')}
            </table>`)}

        <div style="margin:24px 0;padding:18px;border:2px solid #d8cfc0;border-radius:12px;background:#fffdf8">
          <p style="margin:0 0 10px;font-size:16px;font-weight:800;color:#111">Necesitamos tu OK 🙏</p>
          <p style="margin:0 0 10px;font-size:14px;line-height:1.7;color:#333">Revisá que esté todo bien: <strong>así es como se va a fabricar</strong>.</p>
          <ul style="margin:0 0 10px;padding-left:20px;font-size:14px;line-height:1.8;color:#333">
            <li>Mirá las fotos de arriba: son los armazones que van a fabricarse, con sus medidas.</li>
            <li>Si son anteojos de sol, confirmanos el <strong>color</strong> y el <strong>grado</strong> del teñido.</li>
            <li>Si hay algún término que no entendés (esférico, cilindro, eje, adición, fotocromático), preguntanos y te lo explicamos con gusto.</li>
          </ul>
          <p style="margin:0;font-size:14px;line-height:1.7;color:#333">Respondé este mail o escribinos por WhatsApp con un <strong>OK</strong> si está todo bien, o contanos qué hay que corregir. Una vez fabricado ya no se puede cambiar.</p>
        </div>
      </div>`;

    return {
        subject: `${esActualizacion ? 'Pedido actualizado' : 'Confirmá tu pedido'} #${nro} — así se va a fabricar`,
        emailHtml,
        waText,
        prescriptionImageUrl: fotoReceta,
        productImages,
    };
}

/** Todo lo que la confirmación necesita leer de la orden, en un solo lugar. */
const SELECT_CONFIRMACION = {
    id: true, total: true, paid: true, orderType: true, isLocked: true,
    clientId: true, labSentBy: true, labSentAt: true,
    appliedPromoName: true, prescriptionSnapshot: true,
    frameSource: true, userFrameBrand: true, userFrameModel: true,
    labFrameShape: true, labFrameDetails: true,
    frameA: true, frameB: true, frameDbl: true, frameEdc: true,
    labFrameShape2: true, labFrameDetails2: true,
    frameA2: true, frameB2: true, frameDbl2: true, frameEdc2: true,
    labColor: true, labTreatment: true, labNotes: true,
    client: { select: { id: true, name: true, email: true, phone: true } },
    prescription: true,
    items: {
        select: {
            id: true, quantity: true, price: true, eye: true,
            productNameSnapshot: true, productBrandSnapshot: true, productCategorySnapshot: true, productTypeSnapshot: true,
            product: { select: { name: true, brand: true, category: true, type: true, imagenesCatalogo: true } },
        },
    },
} as const;

export interface EnvioConfirmacionResultado {
    email: boolean;
    whatsapp: boolean;
    /** No se envió porque ya se había enviado antes para esta versión del pedido. */
    yaEnviada?: boolean;
    pdfUrl?: string | null;
    /** Fotos que salieron por WhatsApp, y cuántas se intentaron. */
    fotosEnviadas?: number;
    fotosTotales?: number;
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
                const res = await fetchWa('/api/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chatId: `${normalizeArgentinePhone(tel)}@c.us`,
                        message: conf.waText,
                        senderName: 'Sistema Atelier',
                        ...(pdf ? { media: { base64: pdf.base64, mimetype: 'application/pdf', filename: pdf.filename } } : {}),
                    }),
                });
                resultado.whatsapp = res.ok;
            } catch (err) {
                console.error('[Confirmación de compra] WhatsApp falló:', err);
            }

            // ── Las fotos, por WhatsApp ──────────────────────────────────────
            // El mail las incrusta; acá van como adjuntos, para que los dos
            // canales muestren lo mismo. Salen de la MISMA lista que el mail
            // (`conf.prescriptionImageUrl` y `conf.productImages`), así que no
            // puede pasar que una foto viaje por un canal y no por el otro.
            //
            // Solo si el mensaje principal salió: mandar fotos sueltas sin el
            // repaso que las explica es peor que no mandarlas.
            if (resultado.whatsapp) {
                const fotos: Array<{ url: string; caption: string; nombre: string }> = [];
                if (conf.prescriptionImageUrl) {
                    fotos.push({ url: conf.prescriptionImageUrl, caption: 'La receta que usamos para fabricar tus lentes.', nombre: 'receta.jpg' });
                }
                for (const p of conf.productImages) {
                    fotos.push({ url: p.url, caption: p.nombre, nombre: 'producto.jpg' });
                }

                for (const [i, foto] of fotos.entries()) {
                    // Espaciado entre adjuntos: una ráfaga de imágenes seguidas
                    // es justo el patrón que castiga WhatsApp (el canal es el
                    // cliente no oficial). 4 s alcanza y no molesta a nadie.
                    if (i > 0) await new Promise(r => setTimeout(r, 4000));
                    const img = await imagenABase64(foto.url);
                    if (!img) {
                        console.error(`[Confirmación de compra] No se pudo bajar la foto ${foto.url}`);
                        continue;
                    }
                    try {
                        await fetchWa('/api/send', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                chatId: `${normalizeArgentinePhone(tel)}@c.us`,
                                message: foto.caption,
                                senderName: 'Sistema Atelier',
                                media: { base64: img.base64, mimetype: img.mimetype, filename: foto.nombre },
                            }),
                        });
                        resultado.fotosEnviadas = (resultado.fotosEnviadas || 0) + 1;
                    } catch (err) {
                        console.error('[Confirmación de compra] Falló una foto por WhatsApp:', err);
                    }
                }
                resultado.fotosTotales = fotos.length;
            }
        }

        resultado.pdfUrl = pdfUrl;

        // ── Registro en la ficha, con el resultado real de cada canal ────────
        // Resumen arriba, y detrás del separador las COPIAS EXACTAS de los DOS
        // canales (la ficha las muestra colapsadas). No un resumen aparte: el
        // texto de WhatsApp es el mismo string que se mandó, y el del mail sale
        // de sacarle las etiquetas al HTML real que se mandó — así, ante un
        // "a mí me dijeron otra cosa", queda qué dijo CADA canal, tal cual.
        const copiaEmail = stripHtmlToText(conf.emailHtml);
        const detalle = [
            sello,
            `Email: ${resultado.email ? `✅ enviado a ${order.client.email}` : (order.client.email ? '❌ NO se pudo enviar' : '— sin email cargado')}`,
            `WhatsApp: ${resultado.whatsapp ? `✅ enviado al ${order.client.phone}` : (tel.length >= 10 ? '❌ NO se pudo enviar' : '— sin teléfono válido')}`,
            resultado.fotosTotales
                ? `Fotos por WhatsApp: ${resultado.fotosEnviadas || 0} de ${resultado.fotosTotales}${(resultado.fotosEnviadas || 0) < resultado.fotosTotales ? ' ⚠️' : ' ✅'} (receta y productos)`
                : `Fotos por WhatsApp: — no había ninguna para enviar`,
            pdfUrl ? `PDF del pedido: ${resolveStorageUrl(pdfUrl)}` : `PDF del pedido: ❌ no se pudo generar`,
        ].join('\n') + DETALLE_MARK
            + `── Copia exacta enviada por WhatsApp ──\n${conf.waText}`
            + `\n\n── Copia exacta enviada por email ──\n${copiaEmail}`;

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
