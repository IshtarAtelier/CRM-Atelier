import { prisma } from '../lib/db';
import { OptovisionParserService } from './optovision-parser.service';
import { PricingService } from './PricingService';
import nodemailer from 'nodemailer';

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
            
            if (!invoiceData.labOrderNumber) {
                console.log(`[Audit] Could not find labOrderNumber in ${fileName}`);
                return;
            }
            
            // Find the order in the database
            const orders = await prisma.order.findMany({
                where: { 
                    labOrderNumber: { contains: invoiceData.labOrderNumber },
                    isDeleted: false
                },
                include: {
                    items: {
                        include: { product: true }
                    },
                    client: true
                }
            });
            
            if (orders.length === 0) {
                console.log(`[Audit] No order found matching labOrderNumber: ${invoiceData.labOrderNumber}`);
                return;
            }
            
            // In case of multiple matching orders (unlikely but possible), audit them all
            for (const order of orders) {
                const estimatedCost = PricingService.calculateEstimatedCost(order);
                const billedCost = invoiceData.subtotal || invoiceData.total || 0;
                
                console.log(`[Audit] Order ${order.id} (${order.client?.name}) - Estimated: $${estimatedCost} | Billed: $${billedCost}`);
                
                if (billedCost > estimatedCost + this.TOLERANCE) {
                    await this.sendAlert(order, invoiceData, estimatedCost, billedCost, fileName);
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
            <p><a href="https://crm-atelier-production-ae72.up.railway.app/admin/contactos?clientId=${order.clientId}">Ver ficha del cliente en el CRM</a></p>
        `;

        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: {
                user: 'crm.atelier.optica@gmail.com',
                pass: 'mpjbysckqphdxevd' // we should move this to env var later
            }
        });

        await transporter.sendMail({
            from: '"Atelier CRM Alertas" <crm.atelier.optica@gmail.com>',
            to: 'pisano.ishtar@gmail.com',
            cc: 'atelier.optica.cerro@gmail.com',
            subject: `⚠️ Alerta Sobrecosto: Operación ${invoice.labOrderNumber} (${order.client?.name})`,
            html: htmlContent
        });
        
        console.log(`[Audit] Alert sent for labOrderNumber ${invoice.labOrderNumber}`);
    }
}
