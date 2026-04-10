import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const order = await prisma.order.findUnique({
            where: { id: params.id },
            include: {
                contact: true,
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
        const dateStr = format(new Date(order.createdAt), "dd 'de' MMMM, yyyy", { locale: es });

        const html = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>${isSale ? 'Venta' : 'Presupuesto'} #${order.id.slice(-6).toUpperCase()}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
        body { font-family: 'Inter', sans-serif; color: #1c1917; line-height: 1.5; margin: 0; padding: 40px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 2px solid #f5f5f4; pb-20px; }
        .logo { font-size: 24px; font-weight: 900; letter-spacing: -1px; text-transform: uppercase; }
        .logo span { color: #f97316; }
        .info-grid { display: grid; grid-cols: 2; gap: 40px; margin-bottom: 40px; }
        .section-title { font-size: 10px; font-weight: 900; color: #a8a29e; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
        th { text-align: left; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: #a8a29e; border-bottom: 1px solid #f5f5f4; padding: 12px 0; }
        td { padding: 16px 0; border-bottom: 1px solid #fafaf9; font-size: 14px; }
        .item-name { font-weight: 700; }
        .item-details { font-size: 11px; color: #78716c; }
        .totals { margin-left: auto; width: 300px; }
        .total-row { display: flex; justify-content: space-between; padding: 8px 0; }
        .total-row.grand { font-size: 24px; font-weight: 900; border-top: 2px solid #1c1917; margin-top: 12px; padding-top: 12px; }
        .footer { margin-top: 60px; font-size: 11px; color: #a8a29e; text-align: center; }
        @media print {
            body { padding: 0; }
            button { display: none; }
        }
    </style>
</head>
<body>
    <div style="text-align: right; margin-bottom: 20px;">
        <button onclick="window.print()" style="padding: 10px 20px; background: #1c1917; color: white; border: none; border-radius: 8px; font-weight: 900; cursor: pointer;">🖨️ IMPRIMIR</button>
    </div>

    <div class="header">
        <div class="logo">ATELIER<span>ÓPTICA</span></div>
        <div style="text-align: right">
            <h1 style="margin: 0; font-size: 20px; font-weight: 900;">${isSale ? 'COMPROBANTE DE VENTA' : 'PRESUPUESTO'}</h1>
            <p style="margin: 0; font-size: 12px; color: #78716c;">#${order.id.slice(-6).toUpperCase()}</p>
            <p style="margin: 0; font-size: 12px; color: #78716c;">${dateStr}</p>
        </div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px;">
        <div>
            <div class="section-title">Cliente</div>
            <div style="font-weight: 700;">${order.contact.name}</div>
            <div style="font-size: 13px; color: #78716c;">
                ${order.contact.dni ? `DNI: ${order.contact.dni}<br>` : ''}
                ${order.contact.phone ? `Tel: ${order.contact.phone}<br>` : ''}
                ${order.contact.address || ''}
            </div>
        </div>
        <div style="text-align: right">
            <div class="section-title">Validez</div>
            <div style="font-size: 13px;">Presupuesto válido por 15 días corridos.</div>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th>Descripción</th>
                <th style="text-align: center">Cant.</th>
                <th style="text-align: right">Precio</th>
                <th style="text-align: right">Total</th>
            </tr>
        </thead>
        <tbody>
            ${order.items.map((it: any) => `
                <tr>
                    <td>
                        <div class="item-name">${it.product?.brand || ''} ${it.product?.model || it.product?.name || ''}</div>
                        ${it.eye ? `<div class="item-details">Ojo: ${it.eye}</div>` : ''}
                    </td>
                    <td style="text-align: center">${it.quantity}</td>
                    <td style="text-align: right">$${it.price.toLocaleString()}</td>
                    <td style="text-align: right font-weight: 700">$${(it.price * it.quantity).toLocaleString()}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    <div class="totals">
        <div class="total-row" style="color: #78716c;">
            <span>Subtotal</span>
            <span>$${(order.total + (order.discount || 0)).toLocaleString()}</span>
        </div>
        ${order.discount ? `
            <div class="total-row" style="color: #10b981; font-weight: 700;">
                <span>Bonificaciones</span>
                <span>-$${order.discount.toLocaleString()}</span>
            </div>
        ` : ''}
        <div class="total-row grand">
            <span>TOTAL</span>
            <span>$${order.total.toLocaleString()}</span>
        </div>
        ${order.paid > 0 ? `
            <div class="total-row" style="color: #f97316; font-weight: 700; padding-top: 10px;">
                <span>PAGADO</span>
                <span>$${order.paid.toLocaleString()}</span>
            </div>
            <div class="total-row" style="font-size: 18px; font-weight: 900; margin-top: 5px;">
                <span>SALDO</span>
                <span>$${(order.total - order.paid).toLocaleString()}</span>
            </div>
        ` : ''}
    </div>

    ${order.prescription ? `
        <div style="margin-top: 40px; padding: 20px; border: 1px solid #f5f5f4; border-radius: 12px;">
            <div class="section-title">Datos Clínicos (Referencia)</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; font-size: 12px;">
                <div>OD: ${order.prescription.sphereOD || '0'} / ${order.prescription.cylinderOD || '0'} x ${order.prescription.axisOD || '0'}°</div>
                <div>OI: ${order.prescription.sphereOI || '0'} / ${order.prescription.cylinderOI || '0'} x ${order.prescription.axisOI || '0'}°</div>
            </div>
        </div>
    ` : ''}

    <div class="footer">
        Este documento es un comprobante de presupuesto/venta generado por Atelier Óptica.<br>
        Gracias por confiar en nosotros.
    </div>
</body>
</html>
        `;

        return new Response(html, {
            headers: { 'Content-Type': 'text/html' },
        });
    } catch (error) {
        console.error('Error generating budget view:', error);
        return new Response('Error interno del servidor', { status: 500 });
    }
}
