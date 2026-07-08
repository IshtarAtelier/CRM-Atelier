import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { resolveStorageUrl } from '@/lib/utils/storage';
import { ADMIN_ALERT_EMAILS } from '@/lib/constants';

// Base absoluta para links e imágenes del email. Hasta el cutover del dominio
// apunta al sitio vivo en Railway; después toma NEXT_PUBLIC_APP_URL.
const STORE_BASE = (process.env.NEXT_PUBLIC_APP_URL || 'https://crm-atelier-production-ae72.up.railway.app').replace(/\/$/, '');

// Un armazón (sol/receta/clip-on) es cualquier producto con stock físico que NO
// sea cristal ni tratamiento (a medida, sin stock) ni lente de contacto (consumible).
const NON_FRAME_CATEGORIES = ['Cristal', 'Tratamiento', 'TRATAMIENTO', 'Tratamientos y Accesorios', 'Lentes de Contacto'];

function isFrame(category?: string | null): boolean {
  if (!category) return false;
  return !NON_FRAME_CATEGORIES.includes(category);
}

// resolveStorageUrl puede devolver una ruta relativa (/api/storage/view?...);
// para el email necesitamos una URL absoluta que el cliente de correo pueda cargar.
function toAbsoluteUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('http') || url.startsWith('data:')) return url;
  return `${STORE_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
}

/**
 * Avisa por email cuando un armazón cruza a stock <= 1 (última unidad o agotado).
 *
 * Se llama DESPUÉS de confirmar la venta (no en el momento del decremento), para
 * no avisar si el pago falla y el stock se restaura. Solo dispara en el CRUCE de
 * >1 a <=1, así no repite el aviso en cada venta posterior mientras siga bajo.
 * Es fire-and-forget: nunca lanza para no romper el flujo de venta.
 */
export async function notifyLowStockCrossing(
  items: Array<{ productId?: string | null; id?: string | null; prevStock: number; quantity: number }>
): Promise<void> {
  try {
    for (const it of items) {
      const productId = it.productId ?? it.id;
      if (!productId) continue;
      const newStock = it.prevStock - it.quantity;
      // Cruce hacia abajo: venía con más de 1 y quedó en 1 (o 0 si vendió de a varios).
      if (!(it.prevStock > 1 && newStock <= 1)) continue;
      await sendOneAlert(productId, newStock);
    }
  } catch (err) {
    console.error('[low-stock] no se pudo procesar la alerta de stock bajo:', err);
  }
}

async function sendOneAlert(productId: string, newStock: number): Promise<void> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      brand: true,
      model: true,
      name: true,
      category: true,
      imagenesCatalogo: true,
      webProducts: { select: { slug: true, images: true, name: true }, take: 1 },
    },
  });
  if (!product || !isFrame(product.category)) return;

  const wp = product.webProducts?.[0];
  const code = product.model || product.name || '—';
  const displayName = wp?.name || product.name || product.model || 'Armazón';
  const brand = product.brand || 'Atelier';
  const link = wp?.slug ? `${STORE_BASE}/producto/${wp.slug}` : `${STORE_BASE}/tienda`;
  const rawImg = wp?.images?.[0] || product.imagenesCatalogo?.[0] || '';
  const imgUrl = toAbsoluteUrl(resolveStorageUrl(rawImg));

  const agotado = newStock <= 0;
  const badge = agotado ? 'SIN STOCK' : 'ÚLTIMA UNIDAD';
  const badgeColor = agotado ? '#b91c1c' : '#8a6d3b';
  const quedan = agotado ? 'Se agotó (0 unidades)' : 'Queda 1 unidad';
  const subject = agotado
    ? `⚠️ Sin stock: ${displayName} (${code})`
    : `⚠️ Última unidad: ${displayName} (${code})`;

  const html = `
  <div style="background:#0a0a0a;padding:32px 16px;font-family:'Helvetica Neue',Arial,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#111;border:1px solid #2a2a2a;border-radius:16px;overflow:hidden;">
      <div style="padding:24px 28px 8px;">
        <span style="display:inline-block;font-size:11px;font-weight:800;letter-spacing:2px;color:${badgeColor};text-transform:uppercase;">${badge}</span>
        <p style="margin:6px 0 0;font-size:12px;color:#a3a3a3;letter-spacing:1px;">Alerta de stock · Atelier Óptica</p>
      </div>
      ${imgUrl ? `<div style="padding:16px 28px;text-align:center;"><img src="${imgUrl}" alt="${displayName}" style="max-width:220px;max-height:160px;object-fit:contain;border-radius:8px;background:#f5f5f5;padding:8px;" /></div>` : ''}
      <div style="padding:8px 28px 24px;">
        <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:2px;color:#c8a55c;text-transform:uppercase;">${brand}</p>
        <h1 style="margin:4px 0 2px;font-size:22px;color:#fff;font-weight:600;">${displayName}</h1>
        <p style="margin:0 0 16px;font-size:13px;color:#a3a3a3;">Código: <strong style="color:#e5e5e5;">${code}</strong></p>
        <p style="margin:0 0 20px;font-size:15px;color:${badgeColor};font-weight:700;">${quedan}</p>
        <a href="${link}" style="display:inline-block;background:#c8a55c;color:#0a0a0a;text-decoration:none;font-weight:700;font-size:13px;letter-spacing:1px;padding:12px 24px;border-radius:999px;text-transform:uppercase;">Ver producto →</a>
        <p style="margin:16px 0 0;font-size:11px;color:#666;">Repone este modelo o desactivalo de la tienda para que no se venda sin stock.</p>
      </div>
    </div>
  </div>`;

  const text = `${badge}: ${displayName} (${code}) — ${quedan}. ${link}`;

  await sendEmail({ to: ADMIN_ALERT_EMAILS, subject, html, text });
  console.log(`[low-stock] alerta enviada: ${displayName} (${code}) stock=${newStock}`);
}
