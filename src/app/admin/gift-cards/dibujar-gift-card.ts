/**
 * Dibuja la gift card digital (1080 × 1350, formato de WhatsApp e Instagram)
 * en un <canvas>. Es la pieza que diseñó Ishtar el 9/10/2026: negro con grano,
 * dorado, la Gioconda con anteojos y las reseñas de Google.
 *
 * Se dibuja en canvas (y no con el render de redes) porque se arma en el
 * navegador del local con los datos que se van tipeando, y se descarga o se
 * comparte desde ahí mismo, sin ida y vuelta al servidor.
 */

import { BUSINESS_INFO } from '@/lib/business-info';
import { formatDate } from '@/lib/format-date';
import { precioConSigno } from '@/lib/format-precio';

export const ANCHO_GIFT_CARD = 1080;
export const ALTO_GIFT_CARD = 1350;

export interface DatosGiftCardDibujo {
    para: string;
    de: string;
    monto: number;
    /** null mientras la tarjeta no está emitida. */
    code: string | null;
    /** "AAAA-MM-DD" o "". */
    validaHasta: string;
    /** Reseñas reales de Google; si no llegaron, la franja no muestra números. */
    rating: number;
    cantidadResenas: number;
}

export interface FuentesGiftCard {
    serif: string;
    sans: string;
}

const DORADO = '#C8A55C';
const MARFIL = '#F5F1E8';
const GRIS = '#8F877A';
const SUAVE = '#BDB5A6';
const LINEA = '#4A443C';
const RAYA = '#2A2622';

export function dibujarGiftCard(ctx: CanvasRenderingContext2D, d: DatosGiftCardDibujo, f: FuentesGiftCard, imagen: HTMLImageElement | null) {
    const W = ANCHO_GIFT_CARD, H = ALTO_GIFT_CARD, P = 68;

    const fondo = ctx.createRadialGradient(540, 337, 0, 540, 337, 1100);
    fondo.addColorStop(0, '#1A1815'); fondo.addColorStop(0.6, '#0B0A09'); fondo.addColorStop(1, '#050505');
    ctx.fillStyle = fondo; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.016)';
    for (let y = 0; y < H; y += 6) ctx.fillRect(0, y, W, 2);
    ctx.textBaseline = 'alphabetic';

    const sans = (peso: number, px: number) => `${peso} ${px}px ${f.sans}`;
    const serif = (px: number, italica = false) => `${italica ? 'italic ' : ''}500 ${px}px ${f.serif}`;

    ctx.fillStyle = DORADO; ctx.font = sans(800, 22); espaciado(ctx, 'GIFT CARD', P, 92, 6);
    ctx.fillStyle = GRIS; ctx.font = sans(700, 22); espaciado(ctx, 'TARJETA DE REGALO', W - P, 92, 6, 'right');

    ctx.fillStyle = MARFIL; ctx.font = serif(136); ctx.fillText(BUSINESS_INFO.name, P - 4, 232);
    ctx.font = serif(50, true);
    const inicio = 'Te regalaron ';
    ctx.fillText(inicio, P, 306);
    ctx.fillStyle = DORADO; ctx.fillText('una nueva forma de ver.', P + ctx.measureText(inicio).width, 306);

    // Marco con la Gioconda
    const fx = P, fy = 350, fw = 400, fh = 740;
    ctx.strokeStyle = DORADO; ctx.lineWidth = 2; rectRedondeado(ctx, fx + 1, fy + 1, fw - 2, fh - 2, 8); ctx.stroke();
    if (imagen && imagen.naturalWidth) {
        const ix = fx + 11, iy = fy + 11, iw = fw - 22, ih = fh - 22;
        const s = Math.max(iw / imagen.naturalWidth, ih / imagen.naturalHeight);
        const sw = iw / s, sh = ih / s;
        ctx.drawImage(imagen, (imagen.naturalWidth - sw) * 0.5, (imagen.naturalHeight - sh) * 0.3, sw, sh, ix, iy, iw, ih);
    }

    // Datos
    const cx = 512, cw = W - P - cx;
    const etiqueta = (t: string, x: number, y: number) => { ctx.fillStyle = GRIS; ctx.font = sans(700, 20); espaciado(ctx, t, x, y, 4); };
    const raya = (x: number, y: number, w: number, color = LINEA) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, 2); };
    const valor = (t: string, x: number, y: number, w: number, peso = 500, px = 40) => {
        if (!t) return;
        ctx.fillStyle = MARFIL; ajustar(ctx, t, (n) => sans(peso, n), px, w, 20); ctx.fillText(t, x, y);
    };

    etiqueta('PARA', cx, 384); valor(d.para.trim(), cx, 446, cw); raya(cx, 462, cw);
    etiqueta('DE', cx, 532); valor(d.de.trim(), cx, 594, cw); raya(cx, 610, cw);
    etiqueta('MONTO', cx, 680);
    const monto = d.monto > 0 ? precioConSigno(d.monto).replace('$', '$ ') : '$';
    ctx.fillStyle = DORADO; ajustar(ctx, monto, (n) => serif(n), 76, cw, 40); ctx.fillText(monto, cx, 758);
    raya(cx, 772, cw, DORADO);

    const mitad = (cw - 32) / 2;
    etiqueta('CÓDIGO', cx, 842); etiqueta('VÁLIDA HASTA', cx + mitad + 32, 842);
    if (d.code) valor(d.code, cx, 900, mitad, 700, 32);
    else { ctx.fillStyle = GRIS; ctx.font = sans(500, 22); ctx.fillText('Se genera al emitir', cx, 898); }
    valor(d.validaHasta ? formatDate(d.validaHasta) : '', cx + mitad + 32, 900, mitad, 700, 32);
    raya(cx, 914, mitad); raya(cx + mitad + 32, 914, mitad);

    ctx.fillStyle = SUAVE; ctx.font = sans(400, 23);
    envolver(ctx, 'Presentala en el local o escribinos por WhatsApp para usarla.', cx, 1010, cw, 34);

    // Franja de reseñas y dirección
    raya(P, 1118, W - 2 * P, RAYA); raya(P, 1238, W - 2 * P, RAYA);
    const hayResenas = d.rating > 0 && d.cantidadResenas > 0;
    const ax = hayResenas ? 592 : P + 6;
    if (hayResenas) {
        ctx.fillStyle = DORADO; ctx.font = serif(92);
        ctx.fillText(d.rating.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }), P, 1208);
        ctx.font = sans(400, 28); espaciado(ctx, '★★★★★', P + 122, 1166, 4);
        ctx.fillStyle = MARFIL; ctx.font = sans(700, 25);
        ctx.fillText(`${d.cantidadResenas.toLocaleString('es-AR')} reseñas en Google`, P + 122, 1208);
    }
    ctx.strokeStyle = DORADO; ctx.lineWidth = 3.4;
    ctx.beginPath(); ctx.arc(ax, 1170, 11, Math.PI * 0.85, Math.PI * 2.15); ctx.lineTo(ax, 1196); ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.arc(ax, 1170, 4.5, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = MARFIL; ctx.font = sans(700, 26); ctx.fillText('José Luis de Tejeda 4380', ax + 30, 1172);
    ctx.fillStyle = SUAVE; ctx.font = sans(400, 20); ctx.fillText('Cerro de las Rosas · frente a Cremolatti', ax + 30, 1204);

    // Redes
    ctx.font = sans(500, 22);
    const telefono = BUSINESS_INFO.phone.replace('+54 9 ', '');
    const items: Array<['ig' | 'yt' | 'wa', string]> = [['ig', '@atelieroptica_'], ['yt', '@AtelierOptica'], ['wa', telefono]];
    const icono = (k: string) => (k === 'yt' ? 36 : 32);
    const sep = 40, aire = 12;
    let total = 0;
    for (const [k, t] of items) total += icono(k) + aire + ctx.measureText(t).width;
    total += sep * (items.length - 1);
    let x = (W - total) / 2; const y = 1290;
    for (const [k, t] of items) {
        if (k === 'ig') {
            const g = ctx.createLinearGradient(x, y + 14, x + 32, y - 18);
            g.addColorStop(0, '#FEDA75'); g.addColorStop(0.35, '#FA7E1E'); g.addColorStop(0.65, '#D62976'); g.addColorStop(1, '#4F5BD5');
            ctx.fillStyle = g; rectRedondeado(ctx, x, y - 18, 32, 32, 9); ctx.fill();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x + 16, y - 2, 7, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + 24.5, y - 10.5, 2, 0, Math.PI * 2); ctx.fill();
        } else if (k === 'yt') {
            ctx.fillStyle = '#FF0033'; rectRedondeado(ctx, x, y - 13, 36, 24, 7); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(x + 14, y - 6); ctx.lineTo(x + 24, y - 1); ctx.lineTo(x + 14, y + 4); ctx.closePath(); ctx.fill();
        } else {
            ctx.fillStyle = '#25D366'; ctx.beginPath(); ctx.arc(x + 16, y - 2, 16, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + 16, y - 2, 6, Math.PI * 0.2, Math.PI * 1.3); ctx.lineTo(x + 16, y - 2); ctx.closePath(); ctx.fill();
        }
        ctx.fillStyle = '#E8E1D2'; ctx.font = sans(500, 22);
        ctx.fillText(t, x + icono(k) + aire, y + 6);
        x += icono(k) + aire + ctx.measureText(t).width + sep;
    }
}

/** Texto con espaciado entre letras (las etiquetas en mayúscula del diseño). */
function espaciado(ctx: CanvasRenderingContext2D, t: string, x: number, y: number, sp: number, alineado: 'left' | 'right' = 'left') {
    let ancho = 0;
    for (const ch of t) ancho += ctx.measureText(ch).width + sp;
    let cx = alineado === 'right' ? x - ancho + sp : x;
    for (const ch of t) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + sp; }
}

/** Achica la fuente hasta que el texto entre en `max` (nombres largos). */
function ajustar(ctx: CanvasRenderingContext2D, t: string, fuente: (px: number) => string, px: number, max: number, min: number) {
    let n = px; ctx.font = fuente(n);
    while (ctx.measureText(t).width > max && n > min) { n -= 2; ctx.font = fuente(n); }
}

function envolver(ctx: CanvasRenderingContext2D, t: string, x: number, y: number, max: number, alto: number) {
    let linea = '';
    for (const palabra of t.split(' ')) {
        const prueba = linea ? `${linea} ${palabra}` : palabra;
        if (ctx.measureText(prueba).width > max && linea) { ctx.fillText(linea, x, y); linea = palabra; y += alto; }
        else linea = prueba;
    }
    if (linea) ctx.fillText(linea, x, y);
}

function rectRedondeado(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}
