import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export const dynamic = 'force-dynamic';

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

        const logoUrl = `https://crm-atelier-production-ae72.up.railway.app/assets/logo-atelier-optica.png`;
        
        // Final calculations
        const total = Number(order.total) || 0;
        const paid = Number(order.paid) || 0;
        const remaining = total - paid;
        
        // Financing calculations based on system constants (3: 10%, 6: 20%)
        // We use subtotalWithMarkup - paid if available, as that is the official List Price balance
        const baseForInstallments = (Number(order.subtotalWithMarkup) || total) - paid;
        
        const total3 = Math.round(baseForInstallments * 1.10);
        const quota3 = Math.round(total3 / 3);
        
        const total6 = Math.round(baseForInstallments * 1.20);
        const quota6 = Math.round(total6 / 6);

        const html = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>${isSale ? 'Venta' : 'Presupuesto'} #${order.id.slice(-6).toUpperCase()}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
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
        
        .tagline { text-align:center; font-size:10px; font-weight:900; text-transform:uppercase; letter-spacing:2px; color:#10b981; padding:10px 0 20px; }
        
        .doc-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; }
        .doc-title { font-size:20px; font-weight:900; text-transform:uppercase; letter-spacing:3px; color:#10b981; }
        .doc-number { font-size:11px; color:#a8a29e; margin-top:4px; font-weight: 700; }
        
        .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-bottom:24px; }
        .info-box { border:2px solid #f5f5f4; border-radius:16px; padding:16px; background: #fafaf9; }
        .info-box h3 { font-size:10px; font-weight:900; text-transform:uppercase; letter-spacing:2px; color:#a8a29e; margin-bottom:10px; }
        .info-row { display:flex; justify-content:space-between; margin-bottom:5px; }
        .info-row .label { color:#78716c; font-size:12px; font-weight: 500; }
        .info-row .value { font-weight:800; font-size:12px; color: #1c1917; }
        
        table { width:100%; border-collapse:collapse; margin:20px 0; border-radius: 12px; overflow: hidden; }
        th { background:#1c1917; color:white; padding:12px 16px; text-align:left; font-size:10px; text-transform:uppercase; letter-spacing:1px; }
        td { padding:14px 16px; border-bottom:1px solid #f5f5f4; font-size:12px; vertical-align: top; }
        tr:nth-child(even) { background:#fafaf9; }
        .item-name { font-weight: 800; color: #1c1917; font-size: 13px; }
        .item-details { font-size: 10px; color: #78716c; margin-top: 3px; font-weight: 600; }

        .totals-section { display: flex; gap: 30px; margin-top: 30px; }
        .financing-box { flex: 1; border: 2px dashed #10b981; border-radius: 20px; padding: 20px; background: #f0fdf4; }
        .financing-box h3 { font-size: 11px; font-weight: 900; color: #047857; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 12px; border-bottom: 1px solid #10b98140; padding-bottom: 8px; }
        .financing-row { display: flex; justify-content: space-between; margin-bottom: 8px; align-items: center; }
        .financing-row .label { font-size: 12px; font-weight: 700; color: #065f46; }
        .financing-row .value { font-size: 15px; font-weight: 900; color: #1c1917; }
        .financing-row .quota { font-size: 11px; color: #047857; font-weight: 800; }

        .totals-box { width: 320px; }
        .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 13px; font-weight: 600; }
        .total-row.grand { font-size: 26px; font-weight: 900; color: #1c1917; border-top: 4px solid #1c1917; padding-top: 12px; margin-top: 8px; }
        .total-row.saldo { color: #ef4444; font-size: 20px; font-weight: 900; border-top: 1px dashed #e7e5e4; padding-top: 10px; margin-top: 5px; }
        
        .prescription-box {
            margin-top: 30px;
            background: #1c1917;
            color: white;
            border-radius: 20px;
            padding: 24px;
        }
        .prescription-box h3 { font-size:11px; font-weight:900; text-transform:uppercase; letter-spacing:2px; color:#a8a29e; margin-bottom:15px; border-bottom: 1px solid #ffffff20; padding-bottom: 10px; }
        .eye-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        .eye-card { background: #292524; padding: 15px; border-radius: 12px; border: 1px solid #44403c; }
        .eye-label { color: #10b981; font-weight: 900; font-size: 14px; margin-bottom: 5px; display: block; }
        .eye-value { font-size: 15px; font-weight: 600; letter-spacing: 1px; }

        .footer { margin-top:50px; padding-top:20px; border-top:1px solid #f5f5f4; font-size:10px; color:#a8a29e; text-align:center; text-transform:uppercase; letter-spacing:2px; font-weight: 700; }
        
        .print-btn {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 24px;
            background: #10b981;
            color: white;
            border: none;
            border-radius: 12px;
            font-weight: 900;
            cursor: pointer;
            box-shadow: 0 10px 15px -3px rgba(16,185,129,0.3);
            text-transform: uppercase;
            letter-spacing: 1px;
            z-index: 100;
        }

        @media print {
            .print-btn { display: none; }
            body { padding: 20px; }
        }
    </style>
</head>
<body>
    <button class="print-btn" onclick="window.print()">Imprimir Documento</button>

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
        <div class='doc-title'>${isSale ? 'Orden de Venta' : 'Presupuesto Oficial'}</div>
        <div class='doc-number'>Op. #${order.id.slice(-6).toUpperCase()} · ${dateStr}</div>
      </div>
    </div>

    <div class='info-grid'>
      <div class='info-box'>
        <h3>👤 Datos del Cliente</h3>
        <div class='info-row'><span class='label'>Nombre</span><span class='value'>${order.client?.name || 'Cliente Final'}</span></div>
        <div class='info-row'><span class='label'>WhatsApp</span><span class='value'>${order.client?.phone || '-'}</span></div>
      </div>
      <div class='info-box'>
        <h3>📑 Condiciones</h3>
        <div class='info-row'><span class='label'>Vigencia</span><span class='value'>15 días corridos</span></div>
        <div class='info-row'><span class='label'>Emitido en</span><span class='value'>Atelier Local Cerro</span></div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 55%">Ítem / Descripción</th>
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
            <td style='text-align:center; font-weight: 800;'>${it.quantity}</td>
            <td style='text-align:right'>$${(Number(it.price) || 0).toLocaleString()}</td>
            <td style='text-align:right; font-weight: 900;'>$${(Number(it.price * it.quantity) || 0).toLocaleString()}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class='totals-section'>
        <div class='financing-box'>
            <h3>💳 Opciones con Tarjeta (Saldo)</h3>
            <div class='financing-row'>
                <div class='label'>3 Cuotas de</div>
                <div style="text-align: right">
                    <div class='value'>$${quota3.toLocaleString()}</div>
                    <div class='quota'>Total financiado: $${total3.toLocaleString()}</div>
                </div>
            </div>
            <div class='financing-row' style="margin-top: 15px;">
                <div class='label'>6 Cuotas de</div>
                <div style="text-align: right">
                    <div class='value'>$${quota6.toLocaleString()}</div>
                    <div class='quota'>Total financiado: $${total6.toLocaleString()}</div>
                </div>
            </div>
            <div style="font-size: 8px; color: #047857; margin-top: 15px; font-weight: 700; text-transform: uppercase;">
                * Financiación válida para tarjetas participantes. Consultar planes vigentes.
            </div>
        </div>

        <div class='totals-box'>
            <div class='total-row'>
                <span style="color: #a8a29e;">Subtotal Efectivo</span>
                <span>$${total.toLocaleString()}</span>
            </div>
            <div class='total-row grand'>
                <span>TOTAL</span>
                <span>$${total.toLocaleString()}</span>
            </div>
            ${paid > 0 ? `
                <div class='total-row' style="color: #10b981; font-weight: 800; margin-top: 10px;">
                    <span>Abonado a cuenta</span>
                    <span>-$${paid.toLocaleString()}</span>
                </div>
                <div class='total-row saldo'>
                    <span>SALDO</span>
                    <span>$${remaining.toLocaleString()}</span>
                </div>
            ` : ''}
        </div>
    </div>

    ${order.prescription ? `
        <div class='prescription-box'>
            <h3>🔬 Especificaciones de Laboratorio</h3>
            <div class='eye-grid'>
                <div class='eye-card'>
                    <span class='eye-label'>OJO DERECHO (OD)</span>
                    <div class='eye-value'>${order.prescription.sphereOD || '0'} / ${order.prescription.cylinderOD || '0'} x ${order.prescription.axisOD || '0'}°</div>
                </div>
                <div class='eye-card'>
                    <span class='eye-label'>OJO IZQUIERDO (OI)</span>
                    <div class='eye-value'>${order.prescription.sphereOI || '0'} / ${order.prescription.cylinderOI || '0'} x ${order.prescription.axisOI || '0'}°</div>
                </div>
            </div>
        </div>
    ` : ''}

    <div class='footer'>Atelier Óptica · José Luis de Tejeda 4380, Córdoba · excelencia visual · ${format(new Date(), "d/MM/yyyy HH:mm", { locale: es })}</div>
</body>
</html>`;

        return new Response(html, {
            headers: { 'Content-Type': 'text/html' },
        });
    } catch (error: any) {
        console.error('Error generating budget view:', error);
        return new Response(`Error interno del servidor: ${error.message}`, { status: 500 });
    }
}
