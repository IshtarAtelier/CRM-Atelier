/**
 * Mail de la tienda con cupón de descuento, para retomar un presupuesto o un
 * carrito que quedó abierto. Pedido de Ishtar, 15/10/2026.
 *
 * Es UN solo diseño para los dos usos (presupuesto abierto y carrito
 * abandonado): cambia el título y el botón, no la pieza. Los colores son los
 * de la marca (globals.css: --primary #7d6249, --dorado #c8a55c, fondo crema)
 * escritos acá en hexa porque un mail no lee CSS variables.
 *
 * Reglas que respeta:
 * - Cuotas: "3 y 6 cuotas sin interés, y hasta 12 cuotas fijas", sin %.
 * - Descuento web: "por transferencia", nunca "efectivo o transferencia".
 * - El cupón NO se escribe a mano acá: llega del cupón real de la base (código,
 *   %/monto, vencimiento), así lo que promete el mail es canjeable.
 * - Nada se manda sin OK de Ishtar (texto final + audiencia + OK por envío).
 */
import { escHtml } from '@/lib/client-email';
import { LINEA_CUOTAS } from '@/lib/promo-cuotas';
import { LEYENDA_ENVIO_Y_RETIRO } from '@/lib/constants/envio';
import { WHATSAPP_PHONE } from '@/lib/constants';

export interface CuponParaMail {
    code: string;
    /** "10% OFF" o "$20.000 OFF", como lo arma recovery.ts. */
    label: string;
    /** Vencimiento ya formateado en dd/MM/yyyy. */
    venceEl: string;
    /** Compra mínima, ya formateada con $; vacío si no hay. */
    minimo?: string;
}

export interface CampaniaCuponParams {
    nombre: string;
    cupon: CuponParaMail;
    /** 'presupuesto' = le mandamos precio y no respondió · 'carrito' = dejó productos en el carrito */
    motivo: 'presupuesto' | 'carrito';
    /** Qué estaba mirando, si se sabe ("Calipso Oval Negro"). */
    producto?: string | null;
    /** Link principal: la ficha del producto o /tienda. */
    urlTienda: string;
    /** Link del carrito recuperado, si existe (/checkout?recuperar=…). */
    urlCarrito?: string | null;
}

const ORIGEN = 'https://atelieroptica.com.ar';
const COLOR_TEXTO = '#1c1917';
const COLOR_MARCA = '#7d6249';
const COLOR_DORADO = '#c8a55c';
const COLOR_FONDO = '#f7f3ee';

export function asuntoCampaniaCupon(p: CampaniaCuponParams): string {
    const nombre = p.nombre.split(' ')[0];
    return p.motivo === 'carrito'
        ? `${nombre}, tus anteojos siguen en el carrito · ${p.cupon.label} con el código ${p.cupon.code}`
        : `${nombre}, tu presupuesto sigue vigente · ${p.cupon.label} con el código ${p.cupon.code}`;
}

/** Cuerpo HTML completo (sin el pie: lo agrega sendClientEmail). */
export function htmlCampaniaCupon(p: CampaniaCuponParams): string {
    const nombre = escHtml(p.nombre.split(' ')[0]);
    const producto = p.producto ? escHtml(p.producto) : null;
    const wsp = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(`Hola! Soy ${p.nombre.split(' ')[0]}, recibí el código ${p.cupon.code}${producto ? ` por ${p.producto}` : ''} y quiero avanzar.`)}`;
    const urlPrincipal = p.urlCarrito || p.urlTienda;
    const titulo = p.motivo === 'carrito'
        ? 'Tus anteojos siguen acá'
        : 'Tu presupuesto sigue vigente';
    const bajada = p.motivo === 'carrito'
        ? `Dejaste ${producto ? `<strong>${producto}</strong>` : 'tus anteojos'} en el carrito. Te guardamos el precio y te sumamos un descuento para que los termines de elegir con tranquilidad.`
        : `Te pasamos el precio ${producto ? `de <strong>${producto}</strong> ` : ''}y no queremos que quede en la nada. Te sumamos un descuento para que te decidas con tranquilidad.`;
    const botonPrincipal = p.motivo === 'carrito' ? 'Terminar mi compra' : 'Ver en la tienda';

    return `
<div style="background:${COLOR_FONDO};padding:24px 12px;font-family:Helvetica,Arial,sans-serif;color:${COLOR_TEXTO}">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e7e0d8">
    <div style="padding:22px 28px;border-bottom:1px solid #eee7de;text-align:center">
      <div style="font-size:11px;letter-spacing:0.35em;text-transform:uppercase;color:${COLOR_MARCA}">Atelier Óptica</div>
      <div style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#8c8279;margin-top:4px">Cerro de las Rosas · Córdoba</div>
    </div>

    <div style="padding:28px 28px 8px">
      <p style="margin:0 0 6px;font-size:13px;color:#6b6259">Hola ${nombre},</p>
      <h1 style="margin:0 0 12px;font-size:26px;line-height:1.2;font-weight:600;font-family:Georgia,'Times New Roman',serif;color:${COLOR_TEXTO}">${titulo}</h1>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#3f3833">${bajada}</p>
    </div>

    <div style="margin:0 28px 20px;padding:18px 20px;border:2px dashed ${COLOR_DORADO};background:#fffaf0;text-align:center">
      <div style="font-size:11px;letter-spacing:0.25em;text-transform:uppercase;color:#8a6d3b">Tu código</div>
      <div style="font-size:30px;font-weight:800;letter-spacing:0.12em;color:${COLOR_TEXTO};margin:6px 0">${escHtml(p.cupon.code)}</div>
      <div style="font-size:15px;color:#3f3833"><strong>${escHtml(p.cupon.label)}</strong> en la tienda online · vence el <strong>${escHtml(p.cupon.venceEl)}</strong></div>
      ${p.cupon.minimo ? `<div style="font-size:12px;color:#8c8279;margin-top:4px">Compra mínima ${escHtml(p.cupon.minimo)}</div>` : ''}
    </div>

    <div style="padding:0 28px 8px;text-align:center">
      <a href="${escHtml(urlPrincipal)}" style="display:inline-block;background:${COLOR_TEXTO};color:#ffffff;text-decoration:none;padding:15px 28px;font-size:13px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase">${botonPrincipal}</a>
      <div style="height:10px"></div>
      <a href="${wsp}" style="display:inline-block;border:1px solid ${COLOR_TEXTO};color:${COLOR_TEXTO};text-decoration:none;padding:13px 28px;font-size:13px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase">Consultar por WhatsApp</a>
    </div>

    <div style="padding:22px 28px 6px">
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:13px;color:#3f3833">
        <tr><td style="padding:6px 0;border-top:1px solid #eee7de">✓ ${escHtml(LINEA_CUOTAS)}</td></tr>
        <tr><td style="padding:6px 0;border-top:1px solid #eee7de">✓ 15% de descuento pagando por transferencia</td></tr>
        <tr><td style="padding:6px 0;border-top:1px solid #eee7de">✓ ${escHtml(LEYENDA_ENVIO_Y_RETIRO)}</td></tr>
        <tr><td style="padding:6px 0;border-top:1px solid #eee7de;border-bottom:1px solid #eee7de">✓ Garantía de adaptación de 30 días en cristales</td></tr>
      </table>
    </div>

    <div style="padding:18px 28px 26px;font-size:12px;line-height:1.5;color:#8c8279">
      El código se carga en el checkout, en "¿Tenés un código de descuento?". Si preferís elegir en el local, mostralo al retirar: vale igual.
      <br><a href="${ORIGEN}/tienda" style="color:${COLOR_MARCA}">atelieroptica.com.ar/tienda</a>
    </div>
  </div>
</div>`;
}

/**
 * El mismo mensaje, para WhatsApp (los presupuestos abiertos de la tienda
 * llegaron casi todos por WhatsApp y no dejaron mail). Lo manda una persona
 * desde su teléfono, o una plantilla aprobada por Meta: nunca el bot a mano.
 */
export function textoWhatsAppCampaniaCupon(p: CampaniaCuponParams): string {
    const nombre = p.nombre.split(' ')[0];
    const que = p.producto ? ` por ${p.producto}` : '';
    return [
        `Hola ${nombre}! Soy de Atelier Óptica. Te pasamos el precio${que} hace unos días y no queremos que quede en la nada.`,
        `Te guardamos un ${p.cupon.label} extra con el código *${p.cupon.code}* (vale hasta el ${p.cupon.venceEl}, en la tienda online o en el local).`,
        `Si querés, te lo reservo para que vengas a probártelo. ¿Qué día te queda cómodo?`,
        `${LINEA_CUOTAS}. ${LEYENDA_ENVIO_Y_RETIRO}.`,
    ].join('\n\n');
}
