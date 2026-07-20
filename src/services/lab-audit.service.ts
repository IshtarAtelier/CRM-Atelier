import { prisma } from '../lib/db';
import { OptovisionParserService } from './optovision-parser.service';
import { PricingService } from './PricingService';
import { sendEmail } from '../lib/email';

export class LabAuditService {
    // 100 pesos of tolerance by default for rounding differences
    static TOLERANCE = 100; 
    
    /**
     * Process an Optovision invoice PDF buffer.
     * Extracts data, compares with CRM, and sends an alert if it exceeds tolerance.
     */
    static async auditInvoice(pdfBuffer: Buffer, fileName: string) {
        try {
            const invoiceData = await OptovisionParserService.parseInvoice(pdfBuffer);

            // Optovision suele facturar 2-3 pedidos juntos en una misma factura: hay
            // que auditar CADA pedido contra su propia orden, prorrateando el importe
            // facturado. Antes se comparaba el subtotal COMPLETO de la factura contra
            // el costo estimado de UNA sola orden → falsa "Alerta de Sobrecosto" y los
            // pedidos 2 y 3 quedaban sin auditar.
            const numbers = invoiceData.labOrderNumbers?.length
                ? invoiceData.labOrderNumbers
                : (invoiceData.labOrderNumber ? [invoiceData.labOrderNumber] : []);

            if (numbers.length === 0) {
                console.log(`[Audit] Could not find labOrderNumber in ${fileName}`);
                return;
            }

            const invoiceTotal = invoiceData.subtotal || invoiceData.total || 0;
            // Importe prorrateado por pedido (la factura agrupa N pedidos).
            const billedPerOrder = numbers.length > 0 ? invoiceTotal / numbers.length : invoiceTotal;

            for (const num of numbers) {
                const orders = await prisma.order.findMany({
                    where: {
                        labOrderNumber: { contains: num },
                        isDeleted: false
                    },
                    include: {
                        items: { include: { product: true } },
                        client: true
                    }
                });

                if (orders.length === 0) {
                    console.log(`[Audit] No order found matching labOrderNumber: ${num}`);
                    continue;
                }

                for (const order of orders) {
                    const estimatedCost = PricingService.calculateEstimatedCost(order);
                    console.log(`[Audit] Order ${order.id} (${order.client?.name}) pedido ${num} - Estimated: $${estimatedCost} | Billed (prorrateado): $${billedPerOrder}`);

                    if (billedPerOrder > estimatedCost + this.TOLERANCE) {
                        await this.sendAlert(order, { ...invoiceData, labOrderNumber: num }, estimatedCost, billedPerOrder, fileName);
                    }
                }
            }
            
        } catch (error) {
            console.error(`[Audit] Error auditing invoice ${fileName}:`, error);
        }
    }
    
    private static async sendAlert(order: any, invoice: any, estimatedCost: number, billedCost: number, fileName: string) {
        const diff = billedCost - estimatedCost;
        
        const htmlContent = `
            <h2>⚠️ Alerta de Sobrecosto en Laboratorio</h2>
            <p>Se detectó que el laboratorio Optovision ha facturado un monto mayor al costo estimado en el sistema para la siguiente orden:</p>
            <ul style="line-height: 1.6;">
                <li><strong>Cliente:</strong> ${order.client?.name}</li>
                <li><strong>Número de Operación:</strong> ${invoice.labOrderNumber}</li>
                <li><strong>Archivo Factura:</strong> ${fileName}</li>
            </ul>
            <hr/>
            <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd;"><strong>Costo Estimado (CRM)</strong></td>
                    <td style="padding: 8px; border: 1px solid #ddd; color: green;">$${estimatedCost.toLocaleString('es-AR')}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd;"><strong>Costo Facturado (PDF)</strong></td>
                    <td style="padding: 8px; border: 1px solid #ddd; color: red;">$${billedCost.toLocaleString('es-AR')}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd;"><strong>DIFERENCIA (Pérdida)</strong></td>
                    <td style="padding: 8px; border: 1px solid #ddd; color: red; font-weight: bold;">$${diff.toLocaleString('es-AR')}</td>
                </tr>
            </table>
            <br/>
            <p><a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://crm-atelier-production-ae72.up.railway.app'}/admin/contactos?clientId=${order.clientId}">Ver ficha del cliente en el CRM</a></p>
        `;

        // Usa el sistema central de emails (Resend/SMTP según configuración).
        // Antes había un transporter propio con la contraseña de Gmail hardcodeada.
        await sendEmail({
            to: 'pisano.ishtar@gmail.com, atelier.optica.cerro@gmail.com',
            subject: `⚠️ Alerta Sobrecosto: Operación ${invoice.labOrderNumber} (${order.client?.name})`,
            html: htmlContent
        });
        
        console.log(`[Audit] Alert sent for labOrderNumber ${invoice.labOrderNumber}`);
    }
}
