import { prisma } from '@/lib/db';
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { getFileBuffer } from '@/lib/storage';
import { detectBillingAccount, getBillingAccountConfig } from '@/lib/afip';
import { format } from 'date-fns';

export class ReceiptAgentService {
    /**
     * Analiza asíncronamente un comprobante para buscar discrepancias (monto, CUIT, fecha, duplicación).
     */
    static async analyzeReceipt(
        paymentId: string,
        orderId: string,
        receiptUrl: string,
        expectedAmount: number,
        method: string
    ) {
        try {
            console.log(`[ReceiptAgent] Beginning analysis for Payment ${paymentId}`);

            // 1. Convert file from storage to base64
            const buffer = await getFileBuffer(receiptUrl);
            if (!buffer) {
                console.warn(`[ReceiptAgent] No se pudo leer el archivo ${receiptUrl}`);
                return;
            }

            // Determine image mime type based on extension
            let mimeType = 'image/jpeg';
            if (receiptUrl.toLowerCase().endsWith('.png')) mimeType = 'image/png';
            if (receiptUrl.toLowerCase().endsWith('.webp')) mimeType = 'image/webp';
            if (receiptUrl.toLowerCase().endsWith('.pdf')) mimeType = 'application/pdf'; // Gemini Vision also supports PDFs

            const base64Data = buffer.toString('base64');

            // 2. Determine Expected CUIT
            const account = detectBillingAccount([{ method }]);
            let expectedCuit: number | null = null;
            if (account) {
                expectedCuit = getBillingAccountConfig(account).cuit;
            }

            // 3. Prompt Gemini
            const model = new ChatGoogleGenerativeAI({
                model: "gemini-1.5-flash",
                maxOutputTokens: 2048,
                temperature: 0,
                apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY,
            });

            const systemPrompt = `Eres un experto auditor de pagos. Analiza el comprobante adjunto.
Extrae la siguiente información y preséntala ESTRICTAMENTE en formato JSON plano:
{
  "amount": número decimal obtenido del comprobante, sin símbolos ni puntos de miles, usando punto para decimales,
  "cuit": "el CUIT o CUIL del DESTINATARIO (el que cobra el dinero, no el que paga) si aparece, sin guiones. Si no aparece pon null",
  "date": "fecha del pago extraída del comprobante en formato YYYY-MM-DD. Si no aparece pon null",
  "transaction_id": "El número de transferencia, Nro de Operación, ID de transacción, o código de autorización único del comprobante. Si no encuentras, devuelve null"
}
Solo devuelve el JSON, sin texto antes ni después.`;

            const response = await model.invoke([
                 new SystemMessage(systemPrompt),
                 new HumanMessage({
                    content: [
                        { type: "text", text: "Por favor, analiza este comprobante según las instrucciones." },
                        { 
                            type: "image_url", 
                            image_url: `data:${mimeType};base64,${base64Data}`
                        }
                    ]
                 })
            ]);

            // 4. Parse the response
            let extracted: any = {};
            try {
                const text = response.content.toString();
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    extracted = JSON.parse(jsonMatch[0]);
                }
            } catch (e) {
                console.error('[ReceiptAgent] Failed to parse AI JSON:', e, response.content);
                throw new Error('Error al interpretar respuesta de IA');
            }

            console.log(`[ReceiptAgent] Extracted for payment ${paymentId}:`, extracted);

            // 5. Validation Rules
            const errors: string[] = [];

            // A) Check Amount
            const tolerance = 5; // 5 pesos de tolerancia por errores de redondeo o carga
            if (extracted.amount && Math.abs(extracted.amount - expectedAmount) > tolerance) {
                errors.push(`Monto difiere. Comprobante dice $${extracted.amount.toLocaleString()}, se cargó $${expectedAmount.toLocaleString()}.`);
            }

            // B) Check CUIT
            if (expectedCuit && extracted.cuit) {
                if (!extracted.cuit.includes(expectedCuit.toString())) {
                     errors.push(`CUIT de destino distinto. Se esperaba ${expectedCuit} y figura ${extracted.cuit}.`);
                }
            }

            // C) Check Duplicate Transaction
            let isDuplicate = false;
            // Append TX ID to the current payment notes right away so we can search it, or just update it
            if (extracted.transaction_id) {
                const txString = `[TX: ${extracted.transaction_id.trim()}]`;
                
                // Do a search to see if another payment has this same TX
                const duplicates = await prisma.payment.findMany({
                    where: {
                        notes: { contains: txString },
                        id: { not: paymentId } // Exclude the current current
                    }
                });

                if (duplicates.length > 0) {
                    isDuplicate = true;
                    errors.push(`¡Posible Duplicado! El comprobante tiene la Operación ${extracted.transaction_id}, igual a la/s en pago/s: ${duplicates.map(d => d.id).join(', ')}.`);
                }

                // Update the current payment notes to include this TX so it prevents future ones
                await prisma.payment.update({
                    where: { id: paymentId },
                    data: {
                        notes: {
                            // Concat to existing or set
                            // Using a raw query or fetching current
                            set: (await prisma.payment.findUnique({ where: { id: paymentId } }))?.notes 
                                ? `${(await prisma.payment.findUnique({ where: { id: paymentId } }))!.notes} \n${txString}`
                                : txString
                        }
                    }
                });
            }

            // D) Check Date (Must be very recent)
            if (extracted.date) {
                const docDate = new Date(extracted.date);
                const now = new Date();
                const diffTime = Math.abs(now.getTime() - docDate.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                if (diffDays > 5) {
                    errors.push(`Fecha antigua. El comprobante indica la fecha ${extracted.date}.`);
                }
            }

            // 6. Report if errors
            if (errors.length > 0) {
                const clientNameQuery = await prisma.order.findUnique({
                    where: { id: orderId },
                    select: { client: { select: { name: true } } }
                });
                const clientName = clientNameQuery?.client?.name || 'Desconocido';

                await prisma.notification.create({
                    data: {
                        type: 'RECEIPT_ERROR',
                        message: `ERROR IA en Comprobante (${clientName}): ${errors.join(' ')}`,
                        orderId: orderId,
                        requestedBy: 'IA (Auditor)',
                        status: 'PENDING'
                    }
                });
            } else {
                 console.log(`[ReceiptAgent] Payment ${paymentId} check passed successfully.`);
            }

        } catch (err: any) {
             console.error(`[ReceiptAgent] Agent failed for ${paymentId}:`, err.message);
        }
    }
}
