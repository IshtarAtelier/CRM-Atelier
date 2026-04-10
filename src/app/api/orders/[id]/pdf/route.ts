import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const order = await prisma.order.findUnique({
            where: { id },
            include: {
                client: true,
                items: {
                    include: {
                        product: true
                    }
                },
                prescription: true
            }
        });

        if (!order) {
            return new Response('Pedido no encontrado', { status: 404 });
        }

        const isSale = order.orderType === 'SALE';
        
        // Defensive date formatting
        let dateStr = '';
        try {
            dateStr = format(new Date(order.createdAt), "dd 'de' MMMM, yyyy", { locale: es });
        } catch (e) {
            dateStr = new Date().toLocaleDateString('es-AR');
        }

        const html = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>${isSale ? 'Venta' : 'Presupuesto'} #${order.id.slice(-6).toUpperCase()}</title>
    const logoUrl = `https://crm-atelier-production-ae72.up.railway.app/assets/logo-atelier-optica.png`;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>${isSale ? 'Venta' : 'Presupuesto'} #${order.id.slice(-6).toUpperCase()}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; font-family:'Inter','Segoe UI',sans-serif; }
  
  @page {
    margin: 0;
    size: auto;
  }

  body { padding: 40px 50px; color: #1c1917; font-size: 13px; line-height:1.5; background: white; }
  
  .letterhead { display:flex; justify-content:space-between; align-items:center; padding-bottom:20px; margin-bottom:8px; border-bottom:3px solid #1c1917; }
  .letterhead-left { display:flex; align-items:center; gap:16px; }
  .letterhead-logo { height:52px; }
  .letterhead-right { text-align:right; font-size:10px; color:#78716c; line-height:1.6; }
  .letterhead-right .address { font-weight:600; color:#57534e; }
  
  .tagline { text-align:center; font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:3px; color:#a0845e; padding:10px 0 20px; }
  
  .doc-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; }
  .doc-title { font-size:18px; font-weight:900; text-transform:uppercase; letter-spacing:3px; color:#c2410c; }
  .doc-number { font-size:11px; color:#78716c; margin-top:4px; }
  
  .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-bottom:24px; }
  .info-box { border:2px solid #e7e5e4; border-radius:12px; padding:16px; }
  .info-box h3 { font-size:10px; font-weight:900; text-transform:uppercase; letter-spacing:2px; color:#a8a29e; margin-bottom:8px; }
  .info-row { display:flex; justify-content:space-between; margin-bottom:4px; }
  .info-row .label { color:#78716c; font-size:12px; }
  .info-row .value { font-weight:700; font-size:12px; }
  
  table { width:100%; border-collapse:collapse; margin:20px 0; }
  th { background:#1c1917; color:white; padding:10px 14px; text-align:left; font-size:10px; text-transform:uppercase; letter-spacing:1px; }
  td { padding:14px; border-bottom:1px solid #e7e5e4; font-size:12px; vertical-align: top; }
  tr:nth-child(even) { background:#fafaf9; }
  
  .item-name { font-weight: 800; color: #1c1917; }
  .item-details { font-size: 10px; color: #78716c; margin-top: 2px; }

  .totals-wrapper { display: flex; justify-content: flex-end; margin-top: 20px; }
  .totals-box { width: 300px; }
  .total-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; font-weight: 600; }
  .total-row.grand { font-size: 22px; font-weight: 900; border-top: 3px solid #1c1917; padding-top: 10px; margin-top: 6px; }
  
  .payment-badge {
    background: #f0fdf4;
    border: 2px solid #10b981;
    color: #047857;
    padding: 10px 16px;
    border-radius: 12px;
    font-weight: 800;
    margin-bottom: 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .prescription-box {
    margin-top: 30px;
    background: #fafaf9;
    border: 2px solid #e7e5e4;
    border-radius: 12px;
    padding: 16px;
  }
  .prescription-box h3 { font-size:10px; font-weight:900; text-transform:uppercase; letter-spacing:2px; color:#a8a29e; margin-bottom:10px; }

  .footer { margin-top:40px; padding-top:16px; border-top:1px solid #e7e5e4; font-size:9px; color:#a8a29e; text-align:center; text-transform:uppercase; letter-spacing:2px; }
  
  .print-btn {
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 10px 20px;
    background: #c2410c;
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 900;
    cursor: pointer;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  }

  @media print {
    .print-btn { display: none; }
    body { padding: 20px; }
  }
</style></head><body>
<button class="print-btn" onclick="window.print()">IMPRIMIR DOCUMENTO</button>

<div class='letterhead'>
  <div class='letterhead-left'>
    <img src='${logoUrl}' class='letterhead-logo' alt='Atelier Óptica' />
  </div>
  <div class='letterhead-right'>
    <div class='address'>José Luis de Tejeda 4380</div>
    <div>Cerro de las Rosas, Córdoba</div>
  </div>
</div>
<div class='tagline'>La óptica mejor calificada en Google Business ⭐ 5/5</div>

<div class='doc-header'>
  <div>
    <div class='doc-title'>${isSale ? 'Comprobante de Venta' : 'Presupuesto Oficial'}</div>
    <div class='doc-number'>Operación #${order.id.slice(-6).toUpperCase()} · ${dateStr}</div>
  </div>
</div>

<div class='info-grid'>
  <div class='info-box'>
    <h3>👤 Datos del Cliente</h3>
    <div class='info-row'><span class='label'>Nombre</span><span class='value'>${order.client?.name || 'Cliente'}</span></div>
    <div class='info-row'><span class='label'>DNI</span><span class='value'>${order.client?.dni || '-'}</span></div>
    <div class='info-row'><span class='label'>WhatsApp</span><span class='value'>${order.client?.phone || '-'}</span></div>
    <div class='info-row'><span class='label'>Dirección</span><span class='value'>${order.client?.address || '-'}</span></div>
  </div>
  <div class='info-box'>
    <h3>📑 Términos y Validez</h3>
    <div class='info-row'><span class='label'>Fecha Emisión</span><span class='value'>${dateStr}</span></div>
    <div class='info-row'><span class='label'>Validez</span><span class='value'>15 días corridos</span></div>
    <div style="font-size: 10px; color: #a8a29e; margin-top: 8px; font-weight: 500;">
        Los precios están sujetos a modificación sin previo aviso.
    </div>
  </div>
</div>

${Number(order.paid) >= Number(order.total) ? `
    <div class='payment-badge'>
        <span>✅ PAGADO COMPLETAMENTE</span>
        <span>$${(Number(order.total) || 0).toLocaleString()}</span>
    </div>
` : ''}

<table>
  <thead>
    <tr>
      <th style="width: 55%">Descripción del Producto</th>
      <th style="text-align: center">Cant.</th>
      <th style="text-align: right">Unitario</th>
      <th style="text-align: right">Subtotal</th>
    </tr>
  </thead>
  <tbody>
    ${(order.items || []).map((it: any) => `
      <tr>
        <td>
            <div class="item-name">${it.product?.brand || ''} ${it.product?.model || it.product?.name || ''}</div>
            ${it.eye ? `<div class="item-details">Lado: ${it.eye}</div>` : ''}
        </td>
        <td style='text-align:center; font-weight: 700;'>${it.quantity}</td>
        <td style='text-align:right'>$${(Number(it.price) || 0).toLocaleString()}</td>
        <td style='text-align:right; font-weight: 800;'>$${(Number(it.price * it.quantity) || 0).toLocaleString()}</td>
      </tr>
    `).join('')}
  </tbody>
</table>

<div class='totals-wrapper'>
    <div class='totals-box'>
        <div class='total-row'>
            <span style="color: #78716c;">Subtotal</span>
            <span>$${(Number(order.total) + (Number(order.discount) || 0)).toLocaleString()}</span>
        </div>
        ${order.discount ? `
            <div class='total-row' style="color: #10b981;">
                <span>Bonificación Especial</span>
                <span>-$${(Number(order.discount) || 0).toLocaleString()}</span>
            </div>
        ` : ''}
        <div class='total-row grand'>
            <span>TOTAL</span>
            <span>$${(Number(order.total) || 0).toLocaleString()}</span>
        </div>
        
        ${Number(order.paid) > 0 && Number(order.paid) < Number(order.total) ? `
            <div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #e7e5e4;">
                <div class="total-row" style="color: #c2410c;">
                    <span>A cuenta / Seña</span>
                    <span>$${(Number(order.paid) || 0).toLocaleString()}</span>
                </div>
                <div class="total-row" style="font-size: 16px; font-weight: 900;">
                    <span>SALDO PENDIENTE</span>
                    <span>$${(Number(order.total) - Number(order.paid)).toLocaleString()}</span>
                </div>
            </div>
        ` : ''}
    </div>
</div>

${order.prescription ? `
    <div class='prescription-box'>
        <h3>🔬 Especificaciones de Laboratorio</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div style="background: white; padding: 10px; border-radius: 8px;">
                <strong style="color: #c2410c;">OD:</strong> ${order.prescription.sphereOD || '0'} / ${order.prescription.cylinderOD || '0'} x ${order.prescription.axisOD || '0'}°
            </div>
            <div style="background: white; padding: 10px; border-radius: 8px;">
                <strong style="color: #c2410c;">OI:</strong> ${order.prescription.sphereOI || '0'} / ${order.prescription.cylinderOI || '0'} x ${order.prescription.axisOI || '0'}°
            </div>
        </div>
    </div>
` : ''}

<div class='footer'>Atelier Óptica · José Luis de Tejeda 4380, Córdoba · Generado el ${format(new Date(), "d/MM/yyyy HH:mm", { locale: es })}</div>
</body></html>`;
</body>
</html>
        `;

        return new Response(html, {
            headers: { 'Content-Type': 'text/html' },
        });
    } catch (error: any) {
        console.error('Error generating budget view:', error);
        // During debugging, we return the error message to identify production issues
        return new Response(`Error interno del servidor: ${error.message || 'Unknown error'}. Trace: ${error.stack?.slice(0, 100)}`, { status: 500 });
    }
}
