import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';
import { prisma } from '../lib/db';
import { OptovisionParserService } from './optovision-parser.service';
import { sendEmail } from '../lib/email';

export class OptovisionAuditService {
    /**
     * Connects to IMAP, searches for Optovision invoices containing the order number,
     * and alerts the administrator if it has already been billed.
     */
    static async checkOptovisionBillingAndAlert(orderId: string, labOrderNumber: string) {
        if (!labOrderNumber) return;

        // Extraer TODOS los pedidos (5+ dígitos) de la venta: puede facturar varios
        // juntos ("580841-580844"). Antes match(/\d+/) tomaba solo el primero y los
        // otros nunca se verificaban.
        const orderNumbers = labOrderNumber.match(/\d{5,}/g) || (labOrderNumber.match(/\d+/) || []);
        if (orderNumbers.length === 0) return;
        // Para la búsqueda IMAP alcanza el primero; el match fino se hace por número.
        const cleanNumber = orderNumbers[0];

        // Misma resolución de credenciales que openImap del servicio de
        // conciliación: usuario+clave apareados (IMAP_* primero, EMAIL_* como
        // fallback). Antes mezclaba EMAIL_USER con IMAP_PASSWORD → login fallido
        // en cuanto las claves de las dos casillas no coincidían.
        const imapConfig = {
            imap: {
                user: process.env.IMAP_USER || process.env.EMAIL_USER || 'crm.atelier.optica@gmail.com',
                password: process.env.IMAP_PASSWORD || process.env.EMAIL_PASS || '',
                host: 'imap.gmail.com',
                port: 993,
                tls: true,
                tlsOptions: { rejectUnauthorized: false },
                authTimeout: 10000
            }
        };

        if (!imapConfig.imap.password) {
            console.warn("[Optovision Audit] No IMAP password found in environment. Skipping check.");
            return;
        }

        try {
            console.log(`[Optovision Audit] Searching IMAP for order: ${cleanNumber}`);
            const connection = await imaps.connect(imapConfig);
            await connection.openBox('INBOX');

            // Search for emails from procesos@optovisionsa.com.ar containing the order number
            const searchCriteria = [
                ['FROM', 'procesos@optovisionsa.com.ar'],
                ['TEXT', cleanNumber]
            ];

            const fetchOptions = {
                bodies: [''],
                markSeen: false
            };

            const messages = await connection.search(searchCriteria, fetchOptions);
            console.log(`[Optovision Audit] Found ${messages.length} email candidates containing "${cleanNumber}"`);

            let billedInvoiceFile: string | null = null;
            let billedTotal = 0;

            for (const msg of messages) {
                const allPart = msg.parts.find((p: any) => p.which === '');
                if (!allPart) continue;

                const parsed = await simpleParser(allPart.body);
                if (parsed.attachments && parsed.attachments.length > 0) {
                    for (const attachment of parsed.attachments) {
                        if (attachment.contentType === 'application/pdf') {
                            const invoice = await OptovisionParserService.parseInvoice(attachment.content);

                            // Match PRECISO: alguno de los pedidos de la venta tiene que
                            // aparecer como pedido facturado (labOrderNumbers, parseados de
                            // la línea "Ped:") o entre paréntesis en el texto crudo, con la
                            // forma "(NNNNN)". Antes rawText.includes(número) matcheaba los
                            // mismos dígitos dentro de un importe, un CUIT u otro pedido →
                            // falsos "ya facturado".
                            const billedNums = invoice.labOrderNumbers || [];
                            const isMatch = orderNumbers.some((n: string) =>
                                billedNums.includes(n) || new RegExp(`\\(${n}\\)`).test(invoice.rawText)
                            );
                            if (isMatch) {
                                billedInvoiceFile = attachment.filename || 'factura.pdf';
                                billedTotal = invoice.total || invoice.subtotal || 0;
                                break;
                            }
                        }
                    }
                }
                if (billedInvoiceFile) break;
            }

            connection.end();

            if (billedInvoiceFile) {
                console.log(`[Optovision Audit] ALERT: Order ${cleanNumber} has already been billed!`);
                const adminEmail = process.env.ADMIN_EMAIL || 'Pisano.ishtar@gmail.com';
                const subject = `🚨 ALERTA: Pedido Optovision ya Facturado - Venta #${orderId.slice(-6).toUpperCase()}`;
                
                const orderData = await prisma.order.findUnique({
                    where: { id: orderId },
                    select: { client: { select: { name: true } } }
                });

                const html = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 2px solid #dc2626; border-radius: 12px; padding: 24px; background-color: #ffffff; color: #1f2937;">
                        <h2 style="color: #dc2626; margin-top: 0; border-bottom: 2px solid #f87171; padding-bottom: 8px;">🚨 Alerta: Pedido de Optovision ya Facturado</h2>
                        <p style="font-size: 14px; line-height: 1.5;">Se ha registrado un caso de post-venta para un pedido que <strong>ya fue facturado</strong> por el laboratorio:</p>
                        <table style="width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 14px;">
                            <tr style="border-bottom: 1px solid #f3f4f6;">
                                <td style="padding: 10px 0; font-weight: bold; color: #4b5563; width: 150px;">Cliente:</td>
                                <td style="padding: 10px 0; color: #1f2937; font-weight: bold;">${orderData?.client?.name || 'Cliente'}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #f3f4f6;">
                                <td style="padding: 10px 0; font-weight: bold; color: #4b5563;">N° OP Lab:</td>
                                <td style="padding: 10px 0; color: #2563eb; font-family: monospace; font-weight: bold;">${labOrderNumber}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #f3f4f6;">
                                <td style="padding: 10px 0; font-weight: bold; color: #4b5563;">Factura Lab:</td>
                                <td style="padding: 10px 0; color: #dc2626; font-weight: bold;">${billedInvoiceFile}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #f3f4f6;">
                                <td style="padding: 10px 0; font-weight: bold; color: #4b5563;">Monto Facturado:</td>
                                <td style="padding: 10px 0; color: #dc2626; font-weight: bold;">$${billedTotal.toLocaleString('es-AR')}</td>
                            </tr>
                        </table>
                        <div style="margin-top: 24px; padding: 16px; background-color: #fef2f2; border-left: 4px solid #dc2626; border-radius: 8px;">
                            <p style="margin: 0; color: #991b1b; font-size: 13px; line-height: 1.5; font-weight: bold;">
                                ⚠️ Atención: El pedido ya fue cobrado por el laboratorio. Iniciar un reproceso podría generar costos adicionales duplicados si no se gestiona como nota de crédito/garantía.
                            </p>
                        </div>
                        <p style="margin-top: 32px; font-size: 11px; color: #9ca3af; text-align: center; border-top: 1px solid #f3f4f6; padding-top: 16px;">Atelier Óptica - Módulo de Auditoría de Laboratorio</p>
                    </div>
                `;

                await sendEmail({
                    to: adminEmail,
                    subject,
                    html
                });
            } else {
                console.log(`[Optovision Audit] Order ${cleanNumber} is not billed yet.`);
            }
        } catch (error) {
            console.error("[Optovision Audit] Error performing IMAP search:", error);
        }
    }
}
