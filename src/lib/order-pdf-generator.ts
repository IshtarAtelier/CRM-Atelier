import { WHATSAPP_PHONE, WHATSAPP_PHONE_DISPLAY, INSTAGRAM_URL, YOUTUBE_URL, GOOGLE_MAPS_URL, STORE_ORIGIN } from '@/lib/constants';
import { VIGENCIA_PRESUPUESTO_DIAS } from '@/lib/constants';

import { addDays, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { PricingService } from '@/services/PricingService';
// El PDF escribe plata por el MISMO helper que la tienda. Tenía 38
// `toLocaleString()` sin idioma: en la Mac se ven bien, pero el contenedor de
// producción (node:22-slim) resuelve en en-US, así que al cliente le llegaba
// "$ 70,500" — con coma, que acá se lee setenta con cinco. Es la regla que ya
// dejó escrita la auditoría del 2/9 en format-precio.ts y que este archivo se
// estaba salteando. De paso redondea: una cuota de 23833.333 salía con tres
// decimales.
import { formatearPrecio } from '@/lib/format-precio';
import { formatDate, formatDateLong } from '@/lib/format-date';
import { GARANTIA_UNA_LINEA, pedidoTieneGarantiaDeAdaptacion } from '@/lib/garantia';
import { describeLabFrameDetails } from '@/lib/lab-frame-summary';
import { colorLineaLabel } from '@/lib/crystal-color';
import { colorDeLenteEnPedido } from '@/lib/color-de-lente';
import { pick2x1FrameDiscount, etiquetaBonificacion2x1, modoBonificacionGuardada } from '@/lib/promo-utils';
import { cristalesPorArmazon } from '@/lib/order-frames';
import { armazonesPorPar, tipoDeItem } from '@/lib/armazon-por-par';
import fs from 'fs';
import path from 'path';

// A4 en píxeles CSS (96 dpi), que es como Chromium pagina al imprimir.
const A4_ANCHO_PX = 794;
const A4_ALTO_PX = 1123;
// Hasta acá se achica para que entre en una hoja; más chico ya no se lee.
const ESCALA_MINIMA_UNA_HOJA = 0.7;

/**
 * La observación del vendedor es texto libre que va a parar al HTML del PDF:
 * se escapa para que un "<" o un "&" no rompan el documento.
 */
function escapeHtml(value: string) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Quién firma el documento como vendedor:
 * - venta ya enviada a fábrica → labSentBy (regla: el dueño de la venta es
 *   quien la mandó a fábrica);
 * - si no, el usuario logueado que está generando/enviando el PDF.
 * Nombres de sistema no firman: un PDF "atendido por Sistema" queda peor que sin firma.
 */
function resolveVendorName(order: any, vendorName?: string): string | null {
    const name = (order?.labSentBy || vendorName || '').trim();
    if (!name || ['Sistema', 'Bot', 'CRM'].includes(name)) return null;
    return name;
}

/**
 * La foto del armazón, incrustada en base64 para que el PDF no dependa de la
 * red (igual que el logo). Solo armazones y anteojos de sol: los cristales no
 * tienen foto propia. Si el archivo no está en `public/`, se apunta a la tienda.
 */
function imagenDeArmazon(it: any): string {
    const categoria = `${it.product?.category || it.productCategorySnapshot || ''}`;
    if (!/Armazón|Sol/i.test(categoria)) return '';
    const src: string = it.product?.imagenesCatalogo?.[0] || it.product?.rawImageUrls?.[0] || '';
    if (!src) return '';
    if (/^https?:\/\//.test(src)) return src;
    try {
        const local = path.join(process.cwd(), 'public', src.replace(/^\//, ''));
        if (fs.existsSync(local)) {
            const ext = path.extname(local).slice(1).toLowerCase();
            const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext || 'png'}`;
            return `data:${mime};base64,${fs.readFileSync(local).toString('base64')}`;
        }
    } catch (e) {
        console.error('Error al leer la foto del armazón para el PDF:', e);
    }
    return `${STORE_ORIGIN}${src.startsWith('/') ? '' : '/'}${src}`;
}

function getOrderHtml(order: any, client: any, vendorName?: string): string {
    const isSale = order.orderType === 'SALE';
    // Un presupuesto es una cotización: no habla de pagos ni de saldos.
    const esPresupuesto = (order.orderType || 'QUOTE') === 'QUOTE';
    
    let dateStr = '';
    try {
        // Por el helper, no con el formato repetido acá: `formatDateLong`
        // existe para esto y ya resuelve el día-primero y el español.
        dateStr = formatDateLong(order.createdAt);
    } catch (e) {
        dateStr = formatDateLong(new Date());
    }
    // "Válido hasta" con fecha concreta: "15 días corridos" obligaba al
    // cliente a contar desde una fecha que estaba en otro renglón.
    let validoHasta = '';
    try {
        validoHasta = formatDate(addDays(new Date(order.createdAt || Date.now()), VIGENCIA_PRESUPUESTO_DIAS));
    } catch {
        validoHasta = '';
    }

    // Cargar logo local en base64 si existe
    let logoBase64 = '';
    try {
        const logoPath = path.join(process.cwd(), 'public', 'assets', 'logo-atelier-optica.png');
        if (fs.existsSync(logoPath)) {
            const logoBuffer = fs.readFileSync(logoPath);
            logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
        }
    } catch (e) {
        console.error('Error al leer logo local para el PDF:', e);
    }

    const logoUrl = logoBase64 || `${process.env.NEXT_PUBLIC_APP_URL || 'https://crm-atelier-production-ae72.up.railway.app'}/assets/logo-atelier-optica.png`;
    
    // Paleta: dos tintas de marca y neutros. Cada color extra (verde, violeta,
    // naranja) pedía atención por su cuenta y nada quedaba importante; el único
    // acento distinto es el verde apagado de "sin cargo".
    const brandBeige = '#D4C3B5';
    const brandSand = '#A68B7C';
    const tinta = '#1c1917';
    const gris = '#78716c';
    const linea = '#ece5dc';
    const crema = '#fbf8f4';
    const verdeSuave = '#4d7c5f';

    const financials = PricingService.calculateOrderFinancials(order);
    const markupFactor = 1 + ((order.markup || 0) / 100);
    // Con un descuento (armazón bonificado o especial) el total se muestra
    // como desglose; sin descuento, como una sola línea. Nunca los dos.
    const promoFrameInflated = Math.round((order.appliedPromoDiscount || 0) * markupFactor);
    const specialDiscount = order.specialDiscount || 0;
    const hayDesglose = promoFrameInflated > 0 || specialDiscount > 0;

    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>${isSale ? 'Venta' : 'Presupuesto'} - ${client?.name || 'Cliente'} - Atelier Óptica</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { margin:0; padding:0; box-sizing:border-box; font-family:'Inter','Segoe UI',sans-serif; }
        @page { margin: 0; size: auto; }
        body { padding: 30px 40px; color: ${tinta}; font-size: 12px; line-height:1.45; background: white; }

        .letterhead { display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:10px; border-bottom:1px solid ${brandBeige}; margin-bottom:12px; }
        .letterhead-logo { height: 34px; width: auto; max-width: 220px; object-fit: contain; }
        .letterhead-right { text-align:right; font-size:10px; color:${gris}; line-height:1.5; }
        .address-bold { font-weight:600; color:${brandSand}; }
        .tagline { display:inline-block; font-size:9px; font-weight:600; text-transform:uppercase; letter-spacing:.08em; color:${brandSand}; margin-top:4px; text-decoration:none; }
        .tagline .ver { display:inline-block; margin-left:4px; padding:1px 6px; border-radius:3px; background:${verdeSuave}; color:white; font-size:8px; font-weight:700; letter-spacing:.06em; vertical-align:middle; }

        .doc-header { display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:12px; }
        .doc-title { font-size:24px; font-weight:700; color:${tinta}; letter-spacing:-0.01em; }
        .doc-meta { font-size:11px; color:${gris}; margin-top:2px; }
        .doc-valid { text-align:right; font-size:11px; color:${gris}; }
        .doc-valid b { color:${tinta}; font-weight:600; }

        .info-grid { display:grid; grid-template-columns: 1fr 1fr; gap:14px; margin-bottom:14px; }
        .info-box { border:1px solid ${linea}; border-radius:6px; padding:10px 14px; background:${crema}; }
        .info-box h3 { font-size:9px; font-weight:600; text-transform:uppercase; letter-spacing:.06em; color:${brandSand}; margin-bottom:8px; }
        .info-row { display:flex; justify-content:space-between; margin-bottom:3px; font-size:12px; }
        .info-label { color:${gris}; }
        .info-value { font-weight:600; }

        table { width:100%; border-collapse:collapse; margin-bottom:6px; border-radius:6px; overflow:hidden; border:1px solid ${linea}; }
        th { background:${crema}; color:${brandSand}; padding:7px 14px; text-align:left; font-size:9px; text-transform:uppercase; letter-spacing:.08em; font-weight:600; border-bottom:1px solid ${linea}; }
        td { padding:7px 14px; border-bottom:1px solid ${linea}; font-size:12px; vertical-align:top; }
        td.num { text-align:right; font-variant-numeric: tabular-nums; }
        tr { break-inside: avoid; page-break-inside: avoid; }
        .par-sep td { background:${crema}; padding:7px 14px; font-size:10px; font-weight:700; color:${brandSand}; letter-spacing:.06em; }
        .par-sub { font-size:10px; color:${gris}; font-weight:400; letter-spacing:0; margin-top:1px; }
        .ojo { display:inline-block; border:1px solid ${brandBeige}; border-radius:4px; padding:1px 6px; font-size:8.5px; font-weight:600; letter-spacing:.06em; color:${brandSand}; margin-bottom:3px; }
        .item-name { font-weight:600; }
        .item-row { display:flex; gap:12px; align-items:flex-start; }
        .item-img { flex:none; width:84px; height:56px; object-fit:contain; border:1px solid ${linea}; border-radius:4px; background:white; }
        .item-sub { font-size:10px; color:${gris}; margin-top:1px; }
        .bonif { font-size:10px; color:${verdeSuave}; font-weight:600; margin-top:2px; }

        .total-row { display:flex; justify-content:space-between; align-items:baseline; margin-top:8px; padding:0 2px; }
        .total-label { font-size:10px; letter-spacing:.08em; text-transform:uppercase; color:${brandSand}; font-weight:600; }
        .total-amount { font-size:26px; font-weight:700; letter-spacing:-0.01em; }
        .total-hint { font-size:10px; color:${gris}; padding:0 2px; margin-top:2px; }

        /* Las tres tarjetas de pago van ENTERAS en una hoja: partidas por el
           corte de página, la fila de 12 cuotas caía sola en la hoja 2 dentro
           de una tarjeta cortada y el cliente no la veía. */
        .payment-methods { display:grid; grid-auto-flow:column; grid-auto-columns:minmax(0, 1fr); gap:8px; margin-top:12px; align-items:start; break-inside: avoid; page-break-inside: avoid; }
        .p-amount small { font-size:10px; font-weight:400; color:${gris}; }
        .payment-card { border-radius:6px; padding:12px 16px; border:1px solid ${linea}; }
        .p-title { font-size:9px; font-weight:600; text-transform:uppercase; letter-spacing:.06em; color:${gris}; margin-bottom:6px; display:block; }
        .p-amount { font-size:18px; font-weight:700; display:block; }
        .p-saldo { font-size:12px; font-weight:600; background:${crema}; display:inline-block; padding:4px 10px; border-radius:4px; margin-top:8px; }
        .p-saldo-label { color:${gris}; font-size:8px; display:block; margin-bottom:2px; text-transform:uppercase; }

        .installments { border-top:1px solid ${linea}; margin-top:10px; padding-top:8px; }
        .inst-row { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:4px; font-size:10.5px; }
        .inst-quota { font-size:13px; font-weight:700; }
        .inst-note { font-size:9px; color:${gris}; }


        .totals-summary { margin-top:18px; padding:16px 22px; border-radius:6px; background:${crema}; display:flex; justify-content:space-between; align-items:center; border:1px solid ${linea}; break-inside: avoid; page-break-inside: avoid; }
        .tot-col { text-align:center; padding:0 15px; border-right:1px solid ${brandBeige}; }
        .tot-col:last-of-type { border-right:none; }
        .tot-val { font-size:18px; font-weight:700; display:block; }
        .tot-label { font-size:8px; font-weight:600; text-transform:uppercase; letter-spacing:.06em; color:${gris}; display:block; margin-bottom:4px; }
        .tot-paid { text-align:right; border-left:1px solid ${brandBeige}; padding-left:25px; margin-left:10px; }
        .paid-value { font-size:22px; font-weight:700; }

        .cierre { break-inside: avoid; page-break-inside: avoid; }
        .firma { display:flex; justify-content:flex-end; margin-top:8px; }
        .footer { margin-top:10px; padding-top:8px; border-top:1px solid ${linea}; display:flex; justify-content:space-between; align-items:center; font-size:9px; color:${gris}; }
        .footer-links { display:flex; gap:14px; }
        .footer-links a { display:inline-flex; align-items:center; gap:4px; color:${brandSand}; text-decoration:none; font-weight:500; }
        .footer-links svg { width:11px; height:11px; }
        .footer-links a.ver-tienda { background:${verdeSuave}; color:white; padding:2px 8px; border-radius:3px; font-weight:700; }

        /* Modo compacto: lo prende el generador solo cuando el documento no
           entra en una hoja, antes de recurrir a achicar la escala. */
        body.compacto { padding: 22px 32px; font-size: 11.5px; }
        body.compacto .letterhead { margin-bottom: 10px; padding-bottom: 8px; }
        body.compacto .doc-header { margin-bottom: 8px; }
        body.compacto .info-grid { margin-bottom: 10px; }
        body.compacto .info-box { padding: 8px 12px; }
        body.compacto td { padding: 5px 12px; }
        body.compacto .par-sep td { padding: 5px 12px; }
        body.compacto .item-sub { display: inline; }
        body.compacto .item-sub + .item-sub::before { content: ' · '; }
        body.compacto .item-img { width: 64px; height: 42px; }
        body.compacto .payment-card { padding: 10px 12px; }
        body.compacto .installments { margin-top: 6px; padding-top: 6px; }
        body.compacto .firma { margin-top: 6px; }
        body.compacto .footer { margin-top: 8px; padding-top: 6px; }

        @media print { body { padding: 22px 30px; } body.compacto { padding: 18px 26px; } }
    </style>
</head>
<body>
    <div class='letterhead'>
        <img src='${logoUrl}' class='letterhead-logo' alt='Atelier Óptica' />
        <div class='letterhead-right'>
            <div class='address-bold'>José Luis de Tejeda 4380 · Cerro de las Rosas, Córdoba</div>
            <div>WhatsApp ${WHATSAPP_PHONE_DISPLAY}</div>
            <a class='tagline' href='${GOOGLE_MAPS_URL}'>La óptica mejor calificada en Córdoba · ★★★★★ <span class='ver'>Ver</span></a>
        </div>
    </div>

    <div class='doc-header'>
        <div>
            <div class='doc-title'>${isSale ? 'Orden de venta' : 'Presupuesto'}</div>
            <div class='doc-meta'>N.º ${order.id.slice(-6).toUpperCase()} · ${dateStr}</div>
        </div>
        ${esPresupuesto && validoHasta ? `<div class='doc-valid'>Válido hasta el <b>${validoHasta}</b></div>` : ''}
    </div>

    <div class='info-grid'>
        <div class='info-box'>
            <h3>Cliente</h3>
            <div class='info-row'><span class='info-label'>Nombre</span><span class='info-value'>${escapeHtml(client?.name || 'Cliente Final')}</span></div>
            <div class='info-row'><span class='info-label'>WhatsApp</span><span class='info-value'>${escapeHtml(client?.phone || '-')}</span></div>
        </div>
        <div class='info-box'>
            <h3>Atelier Óptica</h3>
            <div class='info-row'><span class='info-label'>Local</span><span class='info-value'>Tejeda 4380, Cerro de las Rosas</span></div>
            <div class='info-row'><span class='info-label'>Consultas</span><span class='info-value'>WhatsApp ${WHATSAPP_PHONE_DISPLAY}</span></div>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th style="width: 60%">Descripción</th>
                <th style="text-align: center">Cant.</th>
                <th style="text-align: right">Precio unitario</th>
                <th style="text-align: right">Subtotal</th>
            </tr>
        </thead>
        <tbody>
            ${(() => {
                // Qué renglón lleva el armazón bonificado del 2x1, para tacharlo
                // y mostrar el neto. El NÚMERO sale del descuento GUARDADO en la
                // venta; el localizador es el mismo módulo que calculó la plata.
                const promoGuardada = (order.appliedPromoDiscount || 0) > 0 ? pick2x1FrameDiscount(order.items || []) : null;
                const itemBonificado = promoGuardada?.item || null;
                const modoBonif = modoBonificacionGuardada(order.appliedPromoName);

                // AGRUPADO POR PAR, con separador. Antes esto mapeaba los items
                // en el orden de carga: un 2x1 mostraba cuatro Varilux idénticos
                // seguidos sin decir cuál iba en qué anteojo, y el armazón de
                // cada uno quedaba suelto más abajo. `cristalesPorArmazon` es el
                // MISMO helper que usan la ficha, la pantalla de venta y el
                // mail: los cuatro muestran la misma agrupación porque la
                // calcula un solo lugar.
                const porPar = cristalesPorArmazon(order);
                const conSeparador: any[] = [];
                const asignadosPdf = new Set<any>();
                if (porPar.size > 1) {
                    // El separador dice CUÁL armazón es cada par ("2º PAR —
                    // CLIPO ON METAL"), y el ítem del armazón vendido se ubica
                    // debajo de sus cristales — antes "Clip-on Classic" caía en
                    // la bolsa del final y nadie sabía de qué par era.
                    const resumenPdf = describeLabFrameDetails(order);
                    const esArmazonPdf = (it: any) =>
                        /Armazón|Sol/i.test(`${it.product?.category || it.productCategorySnapshot || ''}`);
    // ↑ `includes` y no igualdad: la categoría real del catálogo es
    // "Armazón de Receta" — el filtro exacto no matcheaba ningún producto.
                    const armazonDelParPdf = armazonesPorPar(
                        (order.items || []).filter(esArmazonPdf), resumenPdf.pairs);
                    for (const [par, lista] of [...porPar.entries()].sort((a, b) => a[0] - b[0])) {
                        if (!lista.length) continue; // un encabezado sin filas confunde más que nada
                        const info = resumenPdf.pairs.find(p => p.pair === par);
                        const cual = (info?.details || info?.shape || '').trim();
                        // Debajo del título van las medidas de ESE armazón:
                        // antes vivían en un cuadro aparte al final y el lector
                        // tenía que atar cabos entre secciones.
                        const medidasDe = [
                            info?.shape ? `Forma: ${info.shape}` : '',
                            info?.measurements || '',
                            info?.fitting || '',
                        ].filter(Boolean).join('  ·  ');
                        // "SIN CARGO" sin decir por qué confundía: si todos los
                        // cristales del par van a $0, el separador explica el 2x1.
                        const parSinCargo = lista.every((it: any) => Math.round((it.price || 0) * markupFactor) === 0);
                        conSeparador.push({
                            __separador: `${par}º PAR${cual ? ` — ${cual.toUpperCase()}` : ''}`,
                            __sub: [parSinCargo ? 'Promo 2x1: los cristales de este par van sin cargo' : '', medidasDe].filter(Boolean).join('  ·  '),
                        });
                        const orden = (it: any) => (it.eye === 'RIGHT' || it.eye === 'OD') ? 0 : 1;
                        [...lista].sort((a, b) => orden(a) - orden(b)).forEach(it => { conSeparador.push(it); asignadosPdf.add(it); });
                        const arm = armazonDelParPdf.get(par);
                        if (arm) { conSeparador.push(arm); asignadosPdf.add(arm); }
                    }
                    const sueltos = (order.items || []).filter((it: any) => !asignadosPdf.has(it));
                    if (sueltos.length) conSeparador.push({ __separador: 'APARTE DE TUS ANTEOJOS' }, ...sueltos);
                } else {
                    conSeparador.push(...(order.items || []));
                }

                return conSeparador.map((it: any) => {
                if (it.__separador) return `
                    <tr class="par-sep"><td colspan="4">
                      ${it.__separador}
                      ${it.__sub ? `<div class="par-sub">${escapeHtml(it.__sub)}</div>` : ''}
                    </td></tr>`;
                const itemPrice = Math.round(it.price * markupFactor);
                // El ojo va ARRIBA del nombre y en mayúsculas: OD y OI son dos
                // líneas con el mismo título, y como quinta línea gris el
                // cliente no distinguía cuál era cuál.
                let eyeLabel = '';
                if (it.eye === 'RIGHT' || it.eye === 'OD') eyeLabel = 'OJO DERECHO (OD)';
                else if (it.eye === 'LEFT' || it.eye === 'OI') eyeLabel = 'OJO IZQUIERDO (OI)';
                else if (it.eye) eyeLabel = String(it.eye).toUpperCase();

                let priceDisplay = `$${formatearPrecio(itemPrice)}`;
                let totalDisplay = `$${formatearPrecio((itemPrice * it.quantity))}`;
                
                if (itemPrice === 0) {
                    priceDisplay = '<span style="color:#4d7c5f; font-weight:600; font-size:10px;">SIN CARGO</span>';
                    totalDisplay = '<span style="color:#4d7c5f; font-weight:700;">$0</span>';
                }

                // El armazón bonificado: bruto tachado y el neto real al lado
                // (gratis entero o 50%, según lo guardado en la venta).
                let notaBonificacion = '';
                if (itemBonificado && it === itemBonificado) {
                    const descuentoInflado = Math.round((order.appliedPromoDiscount || 0) * markupFactor);
                    const brutoLinea = itemPrice * (it.quantity || 1);
                    const netoLinea = Math.max(0, brutoLinea - descuentoInflado);
                    totalDisplay = `<span style="text-decoration: line-through; color:#a8a29e; font-size:10px;">$${formatearPrecio(brutoLinea)}</span><br/><span style="color:#4d7c5f; font-weight:700;">${netoLinea === 0 ? 'SIN CARGO' : '$' + formatearPrecio(netoLinea)}</span>`;
                    notaBonificacion = `<div style="font-size:9px; color:#4d7c5f; margin-top:2px; font-weight:bold; ;">${etiquetaBonificacion2x1(modoBonif)} — descuento de $${formatearPrecio(descuentoInflado)}</div>`;
                }

                const refIndex = it.product?.lensIndex || it.productLensIndexSnapshot || '';
                // El COLOR del cristal en la línea que lo lleva, con la misma
                // redacción que la pantalla y el mensaje al cliente.
                const colorLinea = colorLineaLabel(it) || '';
                return `
                <tr>
                    <td>
                        <div class="item-row">
                        ${imagenDeArmazon(it) ? `<img class="item-img" src="${imagenDeArmazon(it)}" alt="" />` : ''}
                        <div>
                        ${eyeLabel ? `<div><span class="ojo">${eyeLabel}</span></div>` : ''}
                        <div class="item-name">${(() => {
                            // "Carolina emanuel Carolina Emanuel": la marca y el
                            // nombre del producto suelen decir lo mismo, y
                            // pegarlos sin mirar duplicaba el texto en la línea.
                            const marca = (it.product?.brand || it.productBrandSnapshot || '').trim();
                            const nombreP = (it.product?.name || it.productNameSnapshot || '').trim();
                            // `includes` y no igualdad: "Vulk" ya vive dentro de
                            // "Anteojo de sol - Vulk" y anteponerla repetía la marca.
                            return marca && !nombreP.toLowerCase().includes(marca.toLowerCase())
                                ? `${marca} ${nombreP}` : nombreP || marca;
                        })()}</div>
                        ${tipoDeItem(it) ? `<div class="item-sub">${tipoDeItem(it)}</div>` : ''}
                        ${colorDeLenteEnPedido(it, order.items || []) ? `<div class="item-sub">Color de la lente: ${colorDeLenteEnPedido(it, order.items || [])}</div>` : ''}
                        ${colorLinea ? `<div class="item-sub">Color: ${colorLinea}</div>` : ''}
                        ${refIndex ? `<div class="item-sub">Índice de refracción ${refIndex}</div>` : ''}
                        ${itemPrice === 0 ? `<div class="bonif">Bonificado por promoción</div>` : ''}
                        ${notaBonificacion}
                        </div>
                        </div>
                    </td>
                    <td class="num" style='text-align:center; font-weight:500;'>${it.quantity}</td>
                    <td class="num">${priceDisplay}</td>
                    <td class="num" style='font-weight:700;'>${totalDisplay}</td>
                </tr>
            `}).join('');
            })()}
        </tbody>
    </table>

    ${(() => {
        if (!hayDesglose) return '';
        const rawSubtotalInflated = (order.items || []).reduce((sum: number, it: any) => sum + (Math.round(it.price * markupFactor) * (it.quantity || 1)), 0);
        // El nombre de la promo guardada a veces trae la marca repetida
        // ("Atelier Atelier Premium"): se colapsa la palabra doble.
        const nombrePromo = String(order.appliedPromoName || 'Armazón bonificado').replace(/^(\S+)\s+\1\b/i, '$1');
        const fila = (label: string, valor: string, color = tinta) => `
                <div style="display:flex; justify-content:space-between; padding:3px 0; font-size:11px; color:${color};">
                    <span>${label}</span><span style="font-weight:600;">${valor}</span>
                </div>`;
        return `
        <div style="display:flex; justify-content:flex-end; margin-top:10px;">
            <div style="width:340px; background:${crema}; border:1px solid ${linea}; border-radius:6px; padding:12px 16px;">
                ${fila('Subtotal', `$${formatearPrecio(rawSubtotalInflated)}`, gris)}
                ${promoFrameInflated > 0 ? fila(`${escapeHtml(nombrePromo)} (2x1)`, `−$${formatearPrecio(promoFrameInflated)}`, verdeSuave) : ''}
                ${specialDiscount > 0 ? fila('Descuento especial para vos', `−$${formatearPrecio(specialDiscount)}`, verdeSuave) : ''}
                <div style="display:flex; justify-content:space-between; align-items:baseline; padding-top:8px; margin-top:6px; border-top:1px solid ${brandBeige};">
                    <span class="total-label">Precio total (lista)</span>
                    <span style="font-size:20px; font-weight:700;">$${formatearPrecio(financials.listPrice)}</span>
                </div>
            </div>
        </div>`;
    })()}

    ${!esPresupuesto && !financials.hasBalance ? `
    <div style="margin-top: 30px; padding: 28px 35px; border-radius: 6px; background: #f0fdf4; border: 2px solid #4d7c5f; color: #065f46;">
        <h2 style="font-size: 24px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 6px; text-align: center;">Orden pagada en su totalidad</h2>
        <p style="font-size: 14px; font-weight: 700; margin: 0 0 18px; text-align: center;">No queda saldo pendiente. Al retirar el pedido no tenés que abonar nada más.</p>
        ${(() => {
            // EL SALTO QUE NADIE EXPLICABA. Arriba dice "precio de lista final"
            // y acá "total abonado", con una diferencia de cientos de miles y
            // ninguna línea en el medio: es el descuento por forma de pago
            // (efectivo −20%, transferencia −15%), y se puede pagar MEZCLANDO.
            // Caso real: lista $1.796.600, abonado $1.443.162 — el cliente veía
            // los dos números sueltos y escribía preguntando cuál era el suyo.
            const ahorro = Math.round(financials.listPrice - financials.paidReal);
            const num = formatearPrecio;
            const filaTot = (label: string, valor: string, fuerte = false, color = '#065f46') => `
                <tr>
                  <td style="padding:5px 0;font-size:14px;color:${color};${fuerte ? 'font-weight:700;' : ''}">${label}</td>
                  <td style="padding:5px 0;font-size:${fuerte ? '18px' : '14px'};text-align:right;color:${color};font-weight:${fuerte ? '900' : '700'}">${valor}</td>
                </tr>`;
            return `
            <table style="width:100%;max-width:460px;margin:0 auto;border-collapse:collapse">
              ${filaTot('Precio de lista', `$${num(financials.listPrice)}`)}
              ${ahorro > 0 ? filaTot('Descuento por tu forma de pago', `− $${num(ahorro)}`) : ''}
              <tr><td colspan="2" style="border-top:2px solid #4d7c5f;padding:0"></td></tr>
              ${filaTot('Total que abonaste', `$${num(financials.paidReal)}`, true)}
            </table>`;
        })()}
    </div>
    ` : `
    ${esPresupuesto && !hayDesglose ? `
    <div class='total-row'>
        <span class='total-label'>Precio total (lista)</span>
        <span class='total-amount'>$${formatearPrecio(financials.listPrice)}</span>
    </div>` : ''}
    ${esPresupuesto ? `<div class='total-hint' style="margin-top:${hayDesglose ? '10px' : '2px'};">Elegí cómo pagarlo:</div>` : ''}
    <div class='payment-methods'>
        <div class='payment-card p-efective'>
            <span class='p-title'>Efectivo (−${financials.discountCash}%)</span>
            <span class='p-amount'>$${formatearPrecio(financials.totalCash)}</span>
            ${esPresupuesto ? '' : `<div class='p-saldo'>
                <span class='p-saldo-label'>Saldo Pendiente</span>
                <span>$${formatearPrecio(financials.remainingCash)}</span>
            </div>`}
        </div>
        <div class='payment-card p-transfer'>
            <span class='p-title'>Transferencia (−${financials.discountTransfer}%)</span>
            <span class='p-amount'>$${formatearPrecio(financials.totalTransfer)}</span>
            ${esPresupuesto ? '' : `<div class='p-saldo'>
                <span class='p-saldo-label'>Saldo Pendiente</span>
                <span>$${formatearPrecio(financials.remainingTransfer)}</span>
            </div>`}
        </div>
        <div class='payment-card p-card'>
            <span class='p-title'>Cuotas sin interés</span>
            <span class='p-amount'>$${formatearPrecio(financials.totalCard)}</span>
            ${esPresupuesto ? '' : `<div class='p-saldo'>
                <span class='p-saldo-label'>Saldo Listado</span>
                <span>$${formatearPrecio(financials.remainingCard)}</span>
            </div>`}
            <div class='installments'>
                <div class='inst-row'>
                    <span>3 cuotas de</span>
                    <span class='inst-quota'>$${formatearPrecio(financials.installment3)}</span>
                </div>
                <div class='inst-row'>
                    <span>6 cuotas de</span>
                    <span class='inst-quota'>$${formatearPrecio(financials.installment6)}</span>
                </div>
                <div class='inst-note'>Con tarjeta de crédito</div>
            </div>
        </div>
        ${esPresupuesto || financials.paidReal <= 0 ? `
        <div class='payment-card p-card12'>
            <span class='p-title'>12 cuotas fijas</span>
            <span class='p-amount'>$${formatearPrecio(financials.installment12)} <small>por mes</small></span>
            <div class='installments'>
                <div class='inst-row'>
                    <span>Total</span>
                    <span class='inst-quota'>$${formatearPrecio(financials.totalCardFinanced)}</span>
                </div>
                <div class='inst-note'>Con tarjeta de crédito · es un total propio, distinto del precio de lista</div>
            </div>
        </div>` : ''}
    </div>

    ${esPresupuesto ? '' : `<div class='totals-summary'>
        <div class='tot-col'>
            <span class='tot-label' style="color: #047857;">Efectivo</span>
            <span class='tot-val' style="color: #047857;">$${formatearPrecio(financials.totalCash)}</span>
        </div>
        <div class='tot-col'>
            <span class='tot-label' style="color: #78716c;">Transf</span>
            <span class='tot-val' style="color: #78716c;">$${formatearPrecio(financials.totalTransfer)}</span>
        </div>
        <div class='tot-col'>
            <span class='tot-label' style="color: #78716c;">Tarjeta</span>
            <span class='tot-val' style="color: #78716c;">$${formatearPrecio(financials.totalCard)}</span>
        </div>

        <div class='tot-paid'>
            <span class='tot-label' style="color: #78716c;">Abonado Real</span>
            <span class='paid-value' style="color: #1c1917;">$${formatearPrecio(financials.paidReal)}</span>
        </div>
    </div>`}
    `}

    ${order.prescription ? `
        <div style="margin-top: 25px; display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
            <div style="border: 1px solid ${brandBeige}; border-radius: 6px; padding: 12px;">
                <div style="font-size: 8px; font-weight: 700; color: ${brandSand}; margin-bottom: 5px;">OD</div>
                <div style="font-size: 14px; font-weight: 600;">${order.prescription.sphereOD || '0'} / ${order.prescription.cylinderOD || '0'} x ${order.prescription.axisOD || '0'}°</div>
            </div>
            <div style="border: 1px solid ${brandBeige}; border-radius: 6px; padding: 12px;">
                <div style="font-size: 8px; font-weight: 700; color: ${brandSand}; margin-bottom: 5px;">OI</div>
                <div style="font-size: 14px; font-weight: 600;">${order.prescription.sphereOI || '0'} / ${order.prescription.cylinderOI || '0'} x ${order.prescription.axisOI || '0'}°</div>
            </div>
        </div>
    ` : ''}

    ${(() => {
        const lab = describeLabFrameDetails(order);
        if (lab.isEmpty) return '';
        const filas: string[] = [];
        if (lab.origin) filas.push(`<div><div style="font-size: 8px; font-weight: 700; color: ${brandSand};">ARMAZÓN</div><div style="font-size: 12px; font-weight: 700; margin-top: 3px;">${escapeHtml(lab.origin)}</div></div>`);
        // Con VARIOS pares, las medidas de cada uno ya viven arriba, junto a
        // sus cristales ("2º PAR — CLIPO ON METAL · Forma: rectangular · …"):
        // repetirlas acá era volver a partir la información en dos lugares.
        // Con UN par se mantienen acá, que es donde siempre estuvieron.
        if (lab.pairs.length <= 1) {
            lab.pairs.forEach((pair) => {
                if (pair.isEmpty) return;
                const partes = [pair.shape ? `Forma: ${pair.shape}` : '', pair.measurements || '', pair.details || ''].filter(Boolean);
                if (partes.length === 0) return;
                filas.push(`<div><div style="font-size: 8px; font-weight: 700; color: ${brandSand};">MEDIDAS DEL ARMAZÓN</div><div style="font-size: 12px; font-weight: 700; margin-top: 3px;">${escapeHtml(partes.join('  ·  '))}</div></div>`);
            });
        }
        if (lab.tint) {
            filas.push(`<div><div style="font-size: 8px; font-weight: 700; color: ${brandSand};">TRATAMIENTO</div><div style="font-size: 12px; font-weight: 700; margin-top: 3px;">${escapeHtml(lab.tint.text)}</div></div>`);
        }
        return `
    <div style="margin-top: 14px; border: 1px solid ${brandBeige}; border-radius: 6px; padding: 12px 16px; page-break-inside: avoid; break-inside: avoid;">
        <div style="font-size: 8px; font-weight: 700; color: ${brandSand}; letter-spacing: .08em; margin-bottom: 10px;">DETALLES DE LABORATORIO</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">${filas.join('')}</div>
    </div>`;
    })()}

    ${order.clientNote && String(order.clientNote).trim() ? `
        <div style="margin-top: 22px; border: 1px solid ${brandBeige}; border-radius: 6px; padding: 14px 16px; background: #fffcf9; page-break-inside: avoid; break-inside: avoid;">
            <div style="font-size: 8px; font-weight: 700; color: ${brandSand}; letter-spacing: .08em; margin-bottom: 6px;">OBSERVACIONES</div>
            <div style="font-size: 12px; font-weight: 600; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(String(order.clientNote).trim())}</div>
        </div>
    ` : ''}

    <div class='cierre'>
    ${resolveVendorName(order, vendorName) ? `
        <div class='firma'>
            <div style="text-align: center; min-width: 200px;">
                <div style="font-size: 12px; font-weight: 600; padding: 0 18px 5px;">${escapeHtml(resolveVendorName(order, vendorName)!)}</div>
                <div style="border-top: 1px solid ${brandBeige}; padding-top: 5px; font-size: 8px; font-weight: 600; color: ${brandSand}; letter-spacing: .08em; text-transform: uppercase;">Te atendió · Atelier Óptica</div>
            </div>
        </div>
    ` : ''}

    <div class='footer'>
        <div>Atelier Óptica · Tejeda 4380, Cerro de las Rosas · Profesionalismo, ética y diseño · ${format(new Date(), "yyyy")}</div>
        <div class='footer-links'>
            <a class='ver-tienda' href="${STORE_ORIGIN}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>Ver tienda</a>
            <a href="${INSTAGRAM_URL}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>@${INSTAGRAM_URL.replace(/\/$/, '').split('/').pop()}</a>
            <a href="${YOUTUBE_URL}"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .6 12 31 31 0 0 0 1 16.8a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5A3 3 0 0 0 23 16.8 31 31 0 0 0 23.4 12 31 31 0 0 0 23 7.2zM9.8 15.1V8.9L15.7 12l-5.9 3.1z"/></svg>YouTube</a>
            <a href="https://wa.me/${WHATSAPP_PHONE}"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.6.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 12 12 0 0 0 4.6 4c1.7.7 2 .6 2.7.5a2.3 2.3 0 0 0 1.5-1.1 1.9 1.9 0 0 0 .1-1.1c0-.1-.2-.2-.5-.3z"/></svg>${WHATSAPP_PHONE_DISPLAY}</a>
        </div>
    </div>
    </div>
</body>
</html>`;
}

export async function generateOrderPDF(order: any, contact: any, vendorName?: string): Promise<{ base64: string, filename: string }> {
    const isSale = order.orderType === 'SALE';
    const safeName = (contact?.name || 'Cliente').replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-');
    const filename = `${isSale ? 'Venta' : 'Presupuesto'}_${order.id.slice(-4).toUpperCase()}_${safeName}.pdf`;

    const html = getOrderHtml(order, contact, vendorName);
    
    let browser;
    try {
        const path = await import('path');
        const browsersPath = path.join(process.cwd(), '.playwright-browsers');
        process.env.PLAYWRIGHT_BROWSERS_PATH = browsersPath;
        const { chromium } = await import('playwright');
        // timeout en el launch: si Chromium no arranca (binario faltante, recurso
        // trabado), fallamos rápido y caemos al fallback jsPDF en vez de colgarnos.
        browser = await chromium.launch({ headless: true, timeout: 15000 });
        const context = await browser.newContext();
        const page = await context.newPage();
        
        await page.setViewportSize({ width: A4_ANCHO_PX, height: A4_ALTO_PX });
        await page.emulateMedia({ media: 'print' });
        await page.setContent(html, { waitUntil: 'load', timeout: 8000 });
        // `load` no espera a las fuentes del @import: a veces el PDF salía en
        // Arial. Se espera a que estén listas, con tope para no colgarse si
        // Google Fonts no responde (en ese caso sale con la fuente de sistema).
        await page.evaluate(() => Promise.race([
            (async () => {
                for (let i = 0; i < 30 && document.fonts.size === 0; i++) await new Promise(r => setTimeout(r, 100));
                await document.fonts.ready;
            })(),
            new Promise(r => setTimeout(r, 5000)),
        ]));

        // Que entre en UNA hoja salvo que sea realmente largo (Ishtar, 29/9):
        // se mide el alto del documento y, si se pasa de la hoja por poco, se
        // achica la escala hasta que entre. Si se pasa por mucho, va en dos
        // hojas a tamaño normal antes que en una ilegible.
        // Chromium imprime con `scale` maquetando la hoja a (ancho ÷ scale) px, así
        // que el contenido se reacomoda más ancho y más corto: por eso se prueba
        // cada escala midiendo de verdad, en vez de dividir alturas.
        const altoDelDocumento = () => page.evaluate(() => document.documentElement.scrollHeight);
        let scale = 1;
        const altoInicial = await altoDelDocumento();
        const medidas: string[] = [`1:${altoInicial}`];
        let alto = altoInicial;
        if (alto > A4_ALTO_PX) {
            // Primero el modo compacto (misma letra, menos aire); si con eso
            // entra, no se achica nada.
            await page.evaluate(() => document.body.classList.add('compacto'));
            alto = await altoDelDocumento();
            medidas.push(`compacto:${alto}`);
        }
        if (alto > A4_ALTO_PX) {
            for (let s = 0.95; s >= ESCALA_MINIMA_UNA_HOJA - 1e-9; s = Math.round((s - 0.05) * 100) / 100) {
                await page.setViewportSize({ width: Math.round(A4_ANCHO_PX / s), height: Math.round(A4_ALTO_PX / s) });
                const alto = await altoDelDocumento();
                medidas.push(`${s}:${alto}/${Math.round(A4_ALTO_PX / s)}`);
                if (alto <= A4_ALTO_PX / s) { scale = s; break; }
            }
            if (scale === 1) {
                // Realmente largo: va en dos hojas, y a tamaño normal.
                await page.setViewportSize({ width: A4_ANCHO_PX, height: A4_ALTO_PX });
                await page.evaluate(() => document.body.classList.remove('compacto'));
            }
        }
        console.log(`[order-pdf] ${filename} alto=${altoInicial}px escala=${scale} (${medidas.join(' ')})`);

        const pdfBuffer = await page.pdf({
            format: 'A4',
            margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
            printBackground: true,
            scale,
        });
        
        const base64String = pdfBuffer.toString('base64');
        return { base64: base64String, filename };
    } catch (e: any) {
        console.error('Error generating PDF with Playwright:', e);
        console.warn('Falling back to jsPDF');
        return generateOrderPDFWithJsPDF(order, contact, filename, vendorName);
    } finally {
        if (browser) {
            // No dejar que un close() colgado bloquee la respuesta.
            await Promise.race([
                browser.close().catch(() => {}),
                new Promise(r => setTimeout(r, 5000))
            ]);
        }
    }
}

async function generateOrderPDFWithJsPDF(order: any, contact: any, filename: string, vendorName?: string): Promise<{ base64: string, filename: string }> {
    const { default: jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const isSale = order.orderType === 'SALE';
    // Un presupuesto es una cotización: no habla de pagos ni de saldos.
    const esPresupuesto = (order.orderType || 'QUOTE') === 'QUOTE';
    const financials = PricingService.calculateOrderFinancials(order);
    const markupFactor = 1 + ((order.markup || 0) / 100);
    
    const brandSand: [number, number, number] = [166, 139, 124];
    const brandBeige: [number, number, number] = [212, 195, 181];
    const emerald: [number, number, number] = [16, 185, 129];
    const darkText: [number, number, number] = [28, 25, 23];
    const grayText: [number, number, number] = [120, 113, 108];
    const violet: [number, number, number] = [124, 58, 237];
    const orange: [number, number, number] = [249, 115, 22];
    
    let dateStr = '';
    try {
        dateStr = format(new Date(order.createdAt), "dd/MM/yyyy", { locale: es });
    } catch { dateStr = new Date().toLocaleDateString('es-AR'); }
    
    const pw = 210;
    const m = 15;
    const cw = pw - m * 2;
    let y = m;

    // --- LOGO ---
    try {
        const logoPath = path.join(process.cwd(), 'public', 'assets', 'logo-atelier-optica.png');
        if (fs.existsSync(logoPath)) {
            const logoB64 = fs.readFileSync(logoPath).toString('base64');
            doc.addImage(`data:image/png;base64,${logoB64}`, 'PNG', m, y - 3, 45, 6.8);
        } else {
            doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.setTextColor(...brandSand);
            doc.text('ATELIER OPTICA', m, y + 5);
        }
    } catch {
        doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.setTextColor(...brandSand);
        doc.text('ATELIER OPTICA', m, y + 5);
    }
    
    doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(...brandSand);
    doc.text('JOSE LUIS DE TEJEDA 4380', pw - m, y, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...grayText);
    doc.text('Cerro de las Rosas, Cordoba', pw - m, y + 4, { align: 'right' });
    doc.text(`WhatsApp: ${WHATSAPP_PHONE_DISPLAY}`, pw - m, y + 8, { align: 'right' });
    
    y += 14;
    doc.setDrawColor(...brandBeige); doc.setLineWidth(0.5);
    doc.line(m, y, pw - m, y);
    y += 4;
    
    doc.setFontSize(6); doc.setFont('helvetica', 'bold'); doc.setTextColor(...brandSand);
    doc.text('ATELIER OPTICA  -  LA OPTICA MEJOR CALIFICADA EN CORDOBA', pw / 2, y, { align: 'center' });
    y += 7;
    
    // Doc title
    doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.setTextColor(...brandSand);
    doc.text(isSale ? 'ORDEN DE VENTA' : 'PRESUPUESTO', m, y);
    doc.setFontSize(8); doc.setTextColor(168, 162, 158);
    doc.text(`#${order.id.slice(-6).toUpperCase()}  |  ${dateStr}`, m, y + 5);
    y += 14;
    
    // --- CLIENT & LOCAL ---
    const bh = 22; const hw = (cw - 6) / 2;
    
    doc.setFillColor(255, 252, 249); doc.setDrawColor(...brandBeige); doc.setLineWidth(0.3);
    doc.roundedRect(m, y, hw, bh, 2, 2, 'FD');
    doc.setFontSize(6); doc.setFont('helvetica', 'bold'); doc.setTextColor(...brandSand);
    doc.text('CLIENTE', m + 4, y + 5);
    doc.setDrawColor(...brandBeige); doc.line(m + 4, y + 7, m + hw - 4, y + 7);
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...darkText);
    doc.text(contact?.name || 'Cliente Final', m + 4, y + 13);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...grayText);
    doc.text(`Tel: ${contact?.phone || '-'}`, m + 4, y + 18);
    
    const bx2 = m + hw + 6;
    doc.setFillColor(255, 252, 249);
    doc.roundedRect(bx2, y, hw, bh, 2, 2, 'FD');
    doc.setFontSize(6); doc.setFont('helvetica', 'bold'); doc.setTextColor(...brandSand);
    doc.text('ATELIER LOCAL', bx2 + 4, y + 5);
    doc.line(bx2 + 4, y + 7, bx2 + hw - 4, y + 7);
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...darkText);
    doc.text('Cerro de las Rosas', bx2 + 4, y + 13);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...grayText);
    doc.text('Vigencia: 15 dias corridos', bx2 + 4, y + 18);
    
    y += bh + 6;
    
    // --- ITEMS TABLE ---
    const rows = (order.items || []).map((it: any) => {
        const ip = Math.round(it.price * markupFactor);
        
        let eyeLabel = '';
        if (it.eye === 'RIGHT' || it.eye === 'OD') eyeLabel = 'OJO DERECHO (OD)';
        else if (it.eye === 'LEFT' || it.eye === 'OI') eyeLabel = 'OJO IZQUIERDO (OI)';
        else if (it.eye) eyeLabel = String(it.eye).toUpperCase();

        let itemName = `${it.product?.brand || it.productBrandSnapshot || ''} ${it.product?.name || it.productNameSnapshot || ''}`.trim();
        if (eyeLabel) itemName = `${eyeLabel}\n${itemName}`;
        const refIndex = it.product?.lensIndex || it.productLensIndexSnapshot || '';
        if (refIndex) itemName += `\n   Índice: ${refIndex}`;
        const colorLente = colorDeLenteEnPedido(it, order.items || []);
        if (colorLente) itemName += `\n   Color de la lente: ${colorLente}`;
        
        let priceLabel = `$${formatearPrecio(ip)}`;
        let totalLabel = `$${formatearPrecio((ip * it.quantity))}`;
        
        if (ip === 0) {
            itemName += `\n   * Bonificado por Promo`;
            priceLabel = 'SIN CARGO';
            totalLabel = '$0';
        }

        return [
            itemName,
            `${it.quantity}`,
            priceLabel,
            totalLabel
        ];
    });
    
    autoTable(doc, {
        startY: y,
        head: [['Descripción', 'Cant.', 'Precio Unit.', 'Subtotal']],
        body: rows,
        margin: { left: m, right: m },
        theme: 'plain',
        headStyles: { 
            fillColor: [255, 255, 255], 
            textColor: brandSand, 
            fontStyle: 'bold', 
            fontSize: 7, 
            halign: 'left',
            lineWidth: { bottom: 0.5 },
            lineColor: brandBeige
        },
        bodyStyles: { fontSize: 8, textColor: darkText, cellPadding: 8 },
        alternateRowStyles: { fillColor: [255, 255, 255] },
        columnStyles: {
            0: { cellWidth: 100, halign: 'left' },
            1: { cellWidth: 20, halign: 'center' },
            2: { cellWidth: 30, halign: 'right' },
            3: { cellWidth: 30, halign: 'right', fontStyle: 'bold' }
        },
        didParseCell: function(data: any) {
            if (data.section === 'head') {
                if (data.column.index > 0) data.cell.styles.halign = (data.column.index === 1) ? 'center' : 'right';
            }
        }
    });
    
    y = (doc as any).lastAutoTable.finalY + 8;

    // --- CÓMO SE COMPONE EL PRECIO ---
    //
    // Sin esto, los renglones de arriba suman una cosa y el total dice otra, sin
    // ninguna línea que lo explique. Caso real (Adriana, 24/8/26): los productos
    // sumaban $1.906.600 y el pedido decía $1.437.280 — $469.320 de descuento
    // invisibles. El cliente no tiene forma de reconstruirlo y escribe
    // preguntando. Es la misma información que el mail ya muestra; acá faltaba.
    {
        const sumaRenglones = (order.items || [])
            .filter((it: any) => (it.product?.category || it.productCategorySnapshot) !== 'Teñido')
            .reduce((n: number, it: any) => n + Math.round((it.price || 0) * markupFactor) * (it.quantity || 1), 0);
        const descuento = Math.round(sumaRenglones - financials.listPrice);
        if (descuento > 0) {
            const filaResumen = (label: string, valor: string, negrita = false, color: [number, number, number] = darkText) => {
                doc.setFontSize(8);
                doc.setFont('helvetica', negrita ? 'bold' : 'normal');
                doc.setTextColor(...color);
                doc.text(label, m + 4, y);
                doc.text(valor, m + cw - 4, y, { align: 'right' });
                y += 5;
            };
            filaResumen('Suma de los productos', `$${formatearPrecio(sumaRenglones)}`);
            filaResumen(
                order.appliedPromoName ? `Bonificacion - ${order.appliedPromoName}` : 'Descuento excepcional',
                `- $${formatearPrecio(descuento)}`, true, [26, 127, 75],
            );
            doc.setDrawColor(...brandBeige); doc.setLineWidth(0.3);
            doc.line(m + 4, y - 2, m + cw - 4, y - 2);
            y += 2;
            filaResumen('TOTAL DEL PEDIDO', `$${formatearPrecio(financials.listPrice)}`, true);
            y += 4;
        }
    }

    // --- PAYMENT CARDS ---
    if (esPresupuesto || financials.hasBalance) {
        if (esPresupuesto) {
            doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(...brandSand);
            doc.text('TOTAL · PRECIO DE LISTA', m, y + 4);
            doc.setFontSize(14); doc.setTextColor(...darkText);
            doc.text(`$${formatearPrecio(financials.listPrice)}`, pw - m, y + 5, { align: 'right' });
            y += 10;
        }
        const cardW = (cw - 8) / 3;
        const cy = y;
        const ch = 32;
        
        const drawCard = (x: number, topColor: [number,number,number], title: string, amount: number, saldo: number, extra?: string[]) => {
            doc.setDrawColor(...brandBeige); doc.setLineWidth(0.3);
            doc.roundedRect(x, cy, cardW, ch, 2, 2);
            doc.setFillColor(...topColor); doc.rect(x, cy, cardW, 1.5, 'F');
            doc.setFontSize(6); doc.setFont('helvetica', 'bold'); doc.setTextColor(...darkText);
            doc.text(title, x + 3, cy + 7);
            doc.setFontSize(13); doc.text(`$${formatearPrecio(amount)}`, x + 3, cy + 15);
            doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...grayText);
            if (!esPresupuesto) doc.text(`Saldo: $${formatearPrecio(saldo)}`, x + 3, cy + 21);
            if (extra) extra.forEach((l, i) => { doc.setFontSize(6); doc.text(l, x + 3, cy + 25 + i * 4); });
        };
        
        drawCard(m, emerald, `EFECTIVO (-${financials.discountCash}%)`, financials.totalCash, financials.remainingCash);
        drawCard(m + cardW + 4, violet, `TRANSFERENCIA (-${financials.discountTransfer}%)`, financials.totalTransfer, financials.remainingTransfer);
        drawCard(m + (cardW + 4) * 2, orange, 'CUOTAS SIN INTERÉS', financials.totalCard, financials.remainingCard, [
            `3 cuotas s/int: $${formatearPrecio(financials.installment3)}`,
            `6 cuotas s/int: $${formatearPrecio(financials.installment6)}`,
        ]);

        y = cy + ch + 8;

        // Las 12 cuotas aparte, con su propio total (en una venta con pagos ya
        // no se ofrece financiación larga, 27/8).
        if (esPresupuesto || financials.paidReal <= 0) {
            doc.setDrawColor(...brandBeige); doc.setLineWidth(0.3);
            doc.roundedRect(m, y, cw, 12, 2, 2);
            doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...darkText);
            doc.text(`12 cuotas fijas de $${formatearPrecio(financials.installment12)}`, m + 4, y + 7.5);
            doc.text(`Total en 12 cuotas: $${formatearPrecio(financials.totalCardFinanced)}`, pw - m - 4, y + 7.5, { align: 'right' });
            y += 18;
        }
        
        if (!esPresupuesto) {
        // Totals bar (Light background, beige border)
        doc.setFillColor(255, 252, 249);
        doc.setDrawColor(212, 195, 181); // brandBeige
        doc.setLineWidth(0.5);
        doc.roundedRect(m, y, cw, 20, 3, 3, 'FD'); // Fill and stroke
        
        const colW = cw / 4;
        const drawCol = (x: number, label: string, val: string, labelColor: [number,number,number], valColor: [number,number,number]) => {
            doc.setFontSize(5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...labelColor);
            doc.text(label, x, y + 7);
            doc.setFontSize(11); doc.setTextColor(...valColor);
            doc.text(val, x, y + 14);
        };
        
        const darkGreen: [number,number,number] = [4, 120, 87];
        const darkPurple: [number,number,number] = [109, 40, 217];
        const darkOrange: [number,number,number] = [194, 65, 12];
        const darkStone: [number,number,number] = [28, 25, 23];
        const darkGray: [number,number,number] = [120, 113, 108]; // #78716c
        
        drawCol(m + 4, 'EFECTIVO', `$${formatearPrecio(financials.totalCash)}`, darkGreen, darkGreen);
        drawCol(m + colW + 4, 'TRANSFERENCIA', `$${formatearPrecio(financials.totalTransfer)}`, darkPurple, darkPurple);
        drawCol(m + colW * 2 + 4, 'TARJETA', `$${formatearPrecio(financials.totalCard)}`, darkOrange, darkOrange);
        drawCol(m + colW * 3 + 4, 'ABONADO REAL', `$${formatearPrecio(financials.paidReal)}`, darkGray, darkStone);
        y += 26;
        }
    } else {
        doc.setFillColor(240, 253, 244); doc.setDrawColor(...emerald); doc.setLineWidth(0.5);
        doc.roundedRect(m, y, cw, 18, 3, 3, 'FD');
        doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(6, 95, 70);
        doc.text('ORDEN PAGADA EN SU TOTALIDAD', pw / 2, y + 8, { align: 'center' });
        doc.setFontSize(9);
        doc.text(`Total abonado: $${formatearPrecio(financials.paidReal)}`, pw / 2, y + 14, { align: 'center' });
        y += 24;
    }
    
    // --- PRESCRIPTION ---
    if (order.prescription) {
        const rxW = (cw - 6) / 2;
        doc.setDrawColor(...brandBeige); doc.setLineWidth(0.3);
        doc.roundedRect(m, y, rxW, 16, 2, 2);
        doc.setFontSize(6); doc.setFont('helvetica', 'bold'); doc.setTextColor(...brandSand);
        doc.text('OJO DERECHO (OD)', m + 4, y + 5);
        doc.setFontSize(10); doc.setTextColor(...darkText);
        doc.text(`${order.prescription.sphereOD || '0'} / ${order.prescription.cylinderOD || '0'} x ${order.prescription.axisOD || '0'}`, m + 4, y + 12);
        
        doc.roundedRect(m + rxW + 6, y, rxW, 16, 2, 2);
        doc.setFontSize(6); doc.setFont('helvetica', 'bold'); doc.setTextColor(...brandSand);
        doc.text('OJO IZQUIERDO (OI)', m + rxW + 10, y + 5);
        doc.setFontSize(10); doc.setTextColor(...darkText);
        doc.text(`${order.prescription.sphereOI || '0'} / ${order.prescription.cylinderOI || '0'} x ${order.prescription.axisOI || '0'}`, m + rxW + 10, y + 12);
        y += 22;
    }
    
    // --- DETALLES DE LABORATORIO (armazón, medidas, teñido) ---
    const labFrame = describeLabFrameDetails(order);
    if (!labFrame.isEmpty) {
        const lineasLab: string[] = [];
        if (labFrame.origin) lineasLab.push(`Armazón: ${labFrame.origin}`);
        labFrame.pairs.forEach((pair, i) => {
            if (pair.isEmpty) return;
            const partes = [pair.shape ? `Forma: ${pair.shape}` : '', pair.measurements || '', pair.details || ''].filter(Boolean);
            if (partes.length === 0) return;
            lineasLab.push(`${i === 1 ? 'Par 2 (bonificado)' : 'Medidas del armazón'}: ${partes.join('  ·  ')}`);
        });
        if (labFrame.tint) {
            // El aviso de "confirmar a qué par corresponde" es interno del vendedor:
            // vive en las pantallas del admin, nunca en el PDF que ve el cliente.
            lineasLab.push(`Tratamiento: ${labFrame.tint.text}`);
        }

        const lineas = lineasLab.flatMap(l => doc.splitTextToSize(l, cw - 8));
        const altura = 10 + lineas.length * 4;
        doc.setDrawColor(...brandBeige); doc.setLineWidth(0.5);
        doc.roundedRect(m, y, cw, altura, 2, 2);
        doc.setFontSize(6); doc.setFont('helvetica', 'bold'); doc.setTextColor(...brandSand);
        doc.text('DETALLES DE LABORATORIO', m + 4, y + 5);
        doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(...darkText);
        doc.text(lineas, m + 4, y + 11);
        y += altura + 6;
    }

    // --- OBSERVACIONES PARA EL CLIENTE ---
    const clientNote = order.clientNote ? String(order.clientNote).trim() : '';
    if (clientNote) {
        const lineas = doc.splitTextToSize(clientNote, cw - 8);
        const altura = 10 + lineas.length * 4;
        doc.setDrawColor(...brandBeige); doc.setLineWidth(0.5);
        doc.roundedRect(m, y, cw, altura, 2, 2);
        doc.setFontSize(6); doc.setFont('helvetica', 'bold'); doc.setTextColor(...brandSand);
        doc.text('OBSERVACIONES', m + 4, y + 5);
        doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(...darkText);
        doc.text(lineas, m + 4, y + 11);
        y += altura + 6;
    }

    // --- FIRMA DEL VENDEDOR (misma regla que el camino HTML) ---
    const firmaVendedor = resolveVendorName(order, vendorName);
    if (firmaVendedor) {
        y += 10;
        const firmaW = 70;
        const firmaX = pw - m - firmaW;
        doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(...darkText);
        doc.text(firmaVendedor, firmaX + firmaW / 2, y, { align: 'center' });
        y += 3;
        doc.setDrawColor(...brandBeige); doc.setLineWidth(0.5);
        doc.line(firmaX, y, firmaX + firmaW, y);
        y += 4;
        doc.setFontSize(6); doc.setFont('helvetica', 'bold'); doc.setTextColor(...brandSand);
        doc.text('TE ATENDIÓ · ATELIER ÓPTICA', firmaX + firmaW / 2, y, { align: 'center' });
        y += 8;
    }

    // --- GARANTÍA ---
    // El cliente se lleva el PDF: la condición tiene que viajar con él, no
    // quedar solo en el WhatsApp que se pierde en la conversación.
    // "Un solo cambio" es el límite que Ishtar pidió dejar escrito (8/9/2026).
    //
    // Pero SOLO en la orden de venta y solo si el pedido lleva cristales
    // cubiertos (multifocales o Super Blue): en un PRESUPUESTO todavía no se
    // compró nada, y en una venta de monofocales comunes no hay garantía de
    // adaptación que prometer (Ishtar, 16/9/2026).
    if (isSale && pedidoTieneGarantiaDeAdaptacion(order)) {
        doc.setFontSize(6.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(125, 98, 73);
        doc.text(GARANTIA_UNA_LINEA.toUpperCase(), pw / 2, y, { align: 'center' });
        y += 5;
    }

    // --- FOOTER ---
    doc.setDrawColor(...brandBeige); doc.setLineWidth(0.5);
    doc.line(m, y, pw - m, y);
    y += 5;
    doc.setFontSize(6); doc.setFont('helvetica', 'bold'); doc.setTextColor(168, 162, 158);
    doc.text(`ATELIER OPTICA  |  TEJEDA 4380  |  PROFESIONALISMO ETICA Y DISENO  |  ${format(new Date(), 'yyyy')}`, pw / 2, y, { align: 'center' });
    
    const base64 = doc.output('datauristring').split(',')[1];
    console.log('[generateOrderPDF] Generated with jsPDF fallback successfully');
    return { base64, filename };
}
