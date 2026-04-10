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
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        
        @page {
            margin: 0;
            size: auto;
        }

        body { 
            font-family: 'Inter', -apple-system, sans-serif; 
            color: #1c1917; 
            line-height: 1.6; 
            margin: 0; 
            padding: 50px;
            background: white;
        }

        /* Branding Colors */
        .text-primary { color: #f97316; }
        .text-muted { color: #78716c; }
        .bg-stone { background: #fafaf9; }

        .header { 
            display: flex; 
            justify-content: space-between; 
            align-items: flex-start; 
            margin-bottom: 60px; 
            border-bottom: 4px solid #1c1917; 
            padding-bottom: 30px; 
        }

        .logo { 
            font-size: 32px; 
            font-weight: 900; 
            letter-spacing: -1.5px; 
            text-transform: uppercase; 
            line-height: 1;
        }
        .logo span { color: #f97316; }

        .doc-type {
            text-align: right;
        }
        .doc-type h1 { 
            margin: 0; 
            font-size: 24px; 
            font-weight: 900; 
            letter-spacing: -1px;
            text-transform: uppercase;
        }

        .info-grid { 
            display: grid; 
            grid-template-columns: 1.5fr 1fr; 
            gap: 60px; 
            margin-bottom: 50px; 
        }

        .section-title { 
            font-size: 11px; 
            font-weight: 800; 
            color: #a8a29e; 
            text-transform: uppercase; 
            letter-spacing: 2px; 
            margin-bottom: 12px; 
            border-bottom: 1px solid #f5f5f4;
            display: inline-block;
        }

        table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 50px; 
        }
        th { 
            text-align: left; 
            font-size: 11px; 
            font-weight: 800; 
            text-transform: uppercase; 
            letter-spacing: 1px; 
            color: #78716c; 
            border-bottom: 2px solid #1c1917; 
            padding: 15px 0; 
        }
        td { 
            padding: 20px 0; 
            border-bottom: 1px solid #f5f5f4; 
            font-size: 14px; 
            vertical-align: top;
        }

        .item-name { font-weight: 800; font-size: 15px; margin-bottom: 4px; }
        .item-details { font-size: 11px; color: #78716c; font-weight: 500; }

        .totals-container {
            display: flex;
            justify-content: flex-end;
            margin-top: 40px;
        }
        
        .totals-box {
            width: 320px;
            background: #fafaf9;
            padding: 30px;
            border-radius: 24px;
        }

        .total-row { 
            display: flex; 
            justify-content: space-between; 
            padding: 10px 0;
            font-size: 14px;
            font-weight: 600;
            color: #44403c;
        }
        
        .total-row.grand { 
            font-size: 28px; 
            font-weight: 900; 
            color: #1c1917;
            margin-top: 15px;
            padding-top: 20px;
            border-top: 2px solid #e7e5e4;
            letter-spacing: -1px;
        }

        .badge-sale {
            background: #1c1917;
            color: white;
            padding: 4px 12px;
            border-radius: 6px;
            font-size: 10px;
            font-weight: 900;
            display: inline-block;
            margin-bottom: 10px;
        }

        .footer { 
            margin-top: 80px; 
            padding-top: 30px;
            border-top: 1px solid #f5f5f4;
            font-size: 12px; 
            font-weight: 500;
            color: #a8a29e; 
            text-align: center; 
        }

        button.print-btn {
            position: fixed;
            top: 30px;
            right: 30px;
            padding: 12px 24px;
            background: #f97316;
            color: white;
            border: none;
            border-radius: 12px;
            font-weight: 900;
            font-size: 12px;
            letter-spacing: 1px;
            cursor: pointer;
            box-shadow: 0 10px 15px -3px rgba(249, 115, 22, 0.3);
            transition: all 0.2s;
            z-index: 100;
        }

        @media print {
            body { padding: 40px; }
            button.print-btn { display: none; }
        }
    </style>
</head>
<body>
    <button class="print-btn" onclick="window.print()">IMPRIMIR DOCUMENTO</button>

    <div class="header">
        <div class="logo">ATELIER<span>ÓPTICA</span></div>
        <div class="doc-type">
            <div class="badge-sale">${isSale ? 'SISTEMA DE VENTAS' : 'PRESUPUESTO OFICIAL'}</div>
            <h1>${isSale ? 'COMPROBANTE VENTA' : 'PRESUPUESTO'}</h1>
            <p style="margin: 4px 0 0 0; font-size: 14px; font-weight: 700; color: #a8a29e;">#${order.id.slice(-6).toUpperCase()}</p>
            <p style="margin: 2px 0 0 0; font-size: 13px; font-weight: 600; color: #a8a29e;">${dateStr}</p>
        </div>
    </div>

    <div class="info-grid">
        <div>
            <div class="section-title">Datos del Cliente</div>
            <div style="font-size: 18px; font-weight: 800; margin-bottom: 8px;">${order.client?.name || 'Cliente'}</div>
            <div style="font-size: 14px; font-weight: 500; color: #57534e; line-height: 1.4;">
                ${order.client?.dni ? `DNI: <span style="font-weight: 700;">${order.client.dni}</span><br>` : ''}
                ${order.client?.phone ? `WhatsApp: <span style="font-weight: 700;">${order.client.phone}</span><br>` : ''}
                ${order.client?.address || 'Dirección no especificada'}
            </div>
        </div>
        <div style="text-align: right">
            <div class="section-title">Validez y Términos</div>
            <div style="font-size: 13px; font-weight: 600; color: #57534e;">
                Válido por 15 días corridos.<br>
                Precios sujetos a cambio sin previo aviso.
            </div>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th style="width: 60%">Descripción del Producto</th>
                <th style="text-align: center">Cant.</th>
                <th style="text-align: right">Precio</th>
                <th style="text-align: right">Total</th>
            </tr>
        </thead>
        <tbody>
            ${(order.items || []).map((it: any) => `
                <tr>
                    <td>
                        <div class="item-name">${it.product?.brand || ''} ${it.product?.model || it.product?.name || ''}</div>
                        ${it.eye ? `<div class="item-details">Lado: <span style="color: #1c1917; font-weight: 700;">${it.eye}</span></div>` : ''}
                    </td>
                    <td style="text-align: center; font-weight: 700;">${it.quantity}</td>
                    <td style="text-align: right; color: #57534e;">$${(Number(it.price) || 0).toLocaleString()}</td>
                    <td style="text-align: right; font-weight: 800; font-size: 15px;">$${(Number(it.price * it.quantity) || 0).toLocaleString()}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    <div class="totals-container">
        <div class="totals-box">
            <div class="total-row">
                <span class="text-muted">Subtotal Base</span>
                <span>$${(Number(order.total) + (Number(order.discount) || 0)).toLocaleString()}</span>
            </div>
            ${order.discount ? `
                <div class="total-row" style="color: #10b981;">
                    <span>Bonificación Especial</span>
                    <span>-$${(Number(order.discount) || 0).toLocaleString()}</span>
                </div>
            ` : ''}
            <div class="total-row grand">
                <span>TOTAL</span>
                <span>$${(Number(order.total) || 0).toLocaleString()}</span>
            </div>
            
            ${Number(order.paid) > 0 ? `
                <div style="margin-top: 20px; padding-top: 20px; border-top: 1px dashed #e7e5e4;">
                    <div class="total-row" style="color: #f97316;">
                        <span>Pagado / Seña</span>
                        <span>$${(Number(order.paid) || 0).toLocaleString()}</span>
                    </div>
                    <div class="total-row" style="font-size: 18px; font-weight: 900; color: #1c1917;">
                        <span>Saldo Pendiente</span>
                        <span class="text-primary">$${(Number(order.total) - Number(order.paid)).toLocaleString()}</span>
                    </div>
                </div>
            ` : ''}
        </div>
    </div>

    ${order.prescription ? `
        <div style="margin-top: 60px; padding: 30px; background: #fafaf9; border-radius: 24px; border: 1px solid #f5f5f4;">
            <div class="section-title">Especificaciones de Laboratorio</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; font-size: 13px; font-weight: 600;">
                <div style="background: white; padding: 15px; border-radius: 12px;">
                    <span style="color: #f97316; font-weight: 900;">OD:</span> ${order.prescription.sphereOD || '0'} / ${order.prescription.cylinderOD || '0'} x ${order.prescription.axisOD || '0'}°
                </div>
                <div style="background: white; padding: 15px; border-radius: 12px;">
                    <span style="color: #f97316; font-weight: 900;">OI:</span> ${order.prescription.sphereOI || '0'} / ${order.prescription.cylinderOI || '0'} x ${order.prescription.axisOI || '0'}°
                </div>
            </div>
        </div>
    ` : ''}

    <div class="footer">
        Este documento es un comprobante oficial generado por la plataforma Atelier Óptica.<br>
        <strong>Gracias por elegir nuestra excelencia.</strong>
    </div>
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
