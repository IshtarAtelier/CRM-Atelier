import { prisma } from '@/lib/db';
import { ChatVertexAI } from "@langchain/google-vertexai-web";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { getFileBuffer } from '@/lib/storage';
import { detectBillingAccount, getBillingAccountConfig } from '@/lib/afip';
import { retryWithBackoff } from '@/lib/retry-utils';

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

            // 3. Prompt Gemini (Vertex AI)
            const model = new ChatVertexAI({
                model: "gemini-2.5-flash",
                location: "global",
                maxOutputTokens: 2048,
                temperature: 0,
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

            // Use unified retry logic for transient OAuth/network errors
            const response = await retryWithBackoff(
                () => model.invoke([
                     new SystemMessage(systemPrompt),
                     new HumanMessage({
                        content: [
                            { type: "text", text: "Por favor, analiza este comprobante según las instrucciones." },
                            { 
                                type: "image_url", 
                                image_url: { url: `data:${mimeType};base64,${base64Data}` }
                            }
                        ]
                     })
                ]),
                { label: 'ReceiptAgent' }
            );

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

            // C) Auto-correct Transaction ID + Check Duplicates
            let isDuplicate = false;
            if (extracted.transaction_id) {
                const extractedTx = extracted.transaction_id.trim();
                const txString = `[TX: ${extractedTx}]`;

                // Fetch current payment to compare the user-typed notes vs. AI-extracted TX
                const currentPayment = await prisma.payment.findUnique({ where: { id: paymentId } });
                const userTypedNotes = (currentPayment?.notes || '').trim();

                // Strip any previous [TX: ...] tag from notes for clean comparison
                const userReference = userTypedNotes.replace(/\s*\[TX:.*?\]\s*/g, '').trim();

                // AUTO-CORRECT: If the user typed a different reference than what the image shows, overwrite it
                const referenceMatchesExtracted = userReference === extractedTx 
                    || userReference.includes(extractedTx) 
                    || extractedTx.includes(userReference);

                if (userReference && !referenceMatchesExtracted) {
                    // The user typed something wrong — correct it with the AI-extracted value
                    errors.push(`Referencia corregida: El usuario cargó "${userReference}" pero el comprobante dice "${extractedTx}". Se actualizó automáticamente.`);
                    
                    await prisma.payment.update({
                        where: { id: paymentId },
                        data: { notes: `${extractedTx} ${txString}` }
                    });
                } else {
                    // Notes match or were empty — just append the [TX: ...] tag for dedup tracking
                    const newNotes = userReference
                        ? `${userReference} ${txString}`
                        : txString;

                    await prisma.payment.update({
                        where: { id: paymentId },
                        data: { notes: newNotes }
                    });
                }

                // Check for duplicate transactions across other payments
                const duplicates = await prisma.payment.findMany({
                    where: {
                        notes: { contains: txString },
                        id: { not: paymentId }
                    },
                    include: {
                        order: {
                            include: { client: true }
                        }
                    }
                });

                if (duplicates.length > 0) {
                    isDuplicate = true;
                    const duplicateDetails = duplicates.map(d => {
                        const clientName = d.order?.client?.name || 'Cliente Desconocido';
                        return `ID: ...${d.id.slice(-4).toUpperCase()} de ${clientName}`;
                    }).join(', ');
                    errors.push(`¡Posible Duplicado! El comprobante tiene la Operación ${extractedTx}, igual a la/s en pago/s: ${duplicateDetails}.`);
                }
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

                const alertMsg = `ERROR IA en Comprobante (${clientName}): ${errors.join(' ')}`;

                await prisma.notification.create({
                    data: {
                        type: 'RECEIPT_ERROR',
                        message: alertMsg,
                        orderId: orderId,
                        requestedBy: 'IA (Auditor)',
                        status: 'PENDING'
                    }
                });

                // Send immediate email alert to admin
                import('@/lib/email').then(({ sendEmail }) => {
                    sendEmail({
                        to: process.env.ADMIN_EMAIL || 'pisano.ishtar@gmail.com',
                        subject: '⚠️ Alerta de Auditoría de Comprobante',
                        text: `El auditor automático de comprobantes ha detectado observaciones en el pago de la orden #${orderId.slice(-4).toUpperCase()} del cliente "${clientName}".\n\nDetalles:\n${errors.map(e => `- ${e}`).join('\n')}\n\nPuedes revisar esto en el panel de administración.`
                    });
                }).catch(err => console.error('[ReceiptAgent Email Alert Error]', err));
            } else {
                 console.log(`[ReceiptAgent] Payment ${paymentId} check passed successfully.`);
            }

        } catch (err: any) {
             const { handleAIError } = await import('@/lib/ai-error-handler');
             try {
                 await handleAIError(err, 'Agente Auditor de Comprobantes (OCR)');
             } catch (handledError: any) {
                 console.error(`[ReceiptAgent] Agent failed for ${paymentId}:`, handledError.message);
             }
        }
    }
}
