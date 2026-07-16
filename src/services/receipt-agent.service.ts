import { prisma } from '@/lib/db';
import { ChatVertexAI } from "@langchain/google-vertexai-web";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { getFileBuffer } from '@/lib/storage';
import { detectBillingAccount, getBillingAccountConfig } from '@/lib/afip';
import { retryWithBackoff } from '@/lib/retry-utils';
import { notifyReceiptUploaded, notifyVendorsReceiptError, type DuplicatePaymentRef } from '@/lib/receipt-notify';

export class ReceiptAgentService {
    /**
     * Analiza asíncronamente un comprobante para buscar discrepancias (monto, CUIT, fecha, duplicación).
     */
    static async analyzeReceipt(
        paymentId: string,
        orderId: string,
        receiptUrl: string,
        expectedAmount: number,
        method: string,
        uploadedByName?: string | null
    ) {
        let adminEmailSent = false;
        try {
            console.log(`[ReceiptAgent] Beginning analysis for Payment ${paymentId}`);

            const orderInfo = await prisma.order.findUnique({
                where: { id: orderId },
                select: { client: { select: { id: true, name: true } } }
            });
            const clientName = orderInfo?.client?.name || 'Desconocido';
            const emailBase = {
                clientName,
                clientId: orderInfo?.client?.id,
                orderId,
                amount: expectedAmount,
                method,
                receiptUrl,
                uploadedByName: uploadedByName || null
            };

            // 1. Convert file from storage to base64
            const buffer = await getFileBuffer(receiptUrl);
            if (!buffer) {
                console.warn(`[ReceiptAgent] No se pudo leer el archivo ${receiptUrl}`);
                adminEmailSent = true;
                await notifyReceiptUploaded({ ...emailBase, auditErrors: null });
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
            // Mismas observaciones pero redactadas en tono coloquial: van en el mail
            // a los vendedores firmado por Ishtar, no pueden sonar a sistema.
            const vendorIssues: string[] = [];
            // Pagos anteriores con el mismo nº de operación → links a ambas fichas
            const duplicateRefs: DuplicatePaymentRef[] = [];

            // A) Check Amount
            const tolerance = 5; // 5 pesos de tolerancia por errores de redondeo o carga
            if (extracted.amount && Math.abs(extracted.amount - expectedAmount) > tolerance) {
                errors.push(`Monto difiere. Comprobante dice $${extracted.amount.toLocaleString()}, se cargó $${expectedAmount.toLocaleString()}.`);
                vendorIssues.push(`El comprobante está por $${extracted.amount.toLocaleString('es-AR')} pero el pago lo cargaron por $${expectedAmount.toLocaleString('es-AR')}.`);
            }

            // B) Check CUIT
            if (expectedCuit && extracted.cuit) {
                if (!extracted.cuit.includes(expectedCuit.toString())) {
                     errors.push(`CUIT de destino distinto. Se esperaba ${expectedCuit} y figura ${extracted.cuit}.`);
                     vendorIssues.push(`La transferencia fue a otro CUIT: en el comprobante figura ${extracted.cuit} y tendría que ser ${expectedCuit}.`);
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
                    vendorIssues.push(`Cargaron la referencia "${userReference}" pero en el comprobante figura "${extractedTx}" (ya la corregí yo, fíjense la próxima).`);
                    
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
                    duplicateRefs.push(...duplicates.map(d => ({
                        clientName: d.order?.client?.name || 'Cliente Desconocido',
                        clientId: d.order?.client?.id,
                        orderId: d.orderId
                    })));
                    const duplicateDetails = duplicates.map(d => {
                        const clientName = d.order?.client?.name || 'Cliente Desconocido';
                        return `ID: ...${d.id.slice(-4).toUpperCase()} de ${clientName}`;
                    }).join(', ');
                    errors.push(`¡Posible Duplicado! El comprobante tiene la Operación ${extractedTx}, igual a la/s en pago/s: ${duplicateDetails}.`);
                    vendorIssues.push(`El número de operación ${extractedTx} ya estaba cargado en otro pago (${duplicateDetails}) — parece el mismo comprobante dos veces.`);
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
                    vendorIssues.push(`El comprobante es del ${extracted.date}, quedó viejo — fíjense que sea el que corresponde a esta venta.`);
                }
            }

            // 6. Report if errors
            if (errors.length > 0) {
                const alertMsg = `ERROR IA en Comprobante (${clientName}${uploadedByName ? `, cargado por ${uploadedByName}` : ''}): ${errors.join(' ')}`;

                await prisma.notification.create({
                    data: {
                        type: 'RECEIPT_ERROR',
                        message: alertMsg,
                        orderId: orderId,
                        requestedBy: 'IA (Auditor)',
                        status: 'PENDING'
                    }
                });

                // Mail a los vendedores como si lo mandara Ishtar pidiendo corregir la carga
                await notifyVendorsReceiptError({
                    clientName,
                    clientId: orderInfo?.client?.id,
                    orderId,
                    amount: expectedAmount,
                    receiptUrl,
                    issues: vendorIssues.length > 0 ? vendorIssues : errors,
                    duplicateRefs
                });
            } else {
                 console.log(`[ReceiptAgent] Payment ${paymentId} check passed successfully.`);
            }

            // Email único al admin: comprobante adjunto + veredicto de la auditoría
            adminEmailSent = true;
            await notifyReceiptUploaded({
                ...emailBase,
                reference: extracted.transaction_id || null,
                auditErrors: errors,
                duplicateRefs
            });

        } catch (err: any) {
             const { handleAIError } = await import('@/lib/ai-error-handler');
             try {
                 await handleAIError(err, 'Agente Auditor de Comprobantes (OCR)');
             } catch (handledError: any) {
                 console.error(`[ReceiptAgent] Agent failed for ${paymentId}:`, handledError.message);
             }
             // Aunque la auditoría falle, el admin recibe el comprobante por email
             if (!adminEmailSent) {
                 try {
                     const orderInfo = await prisma.order.findUnique({
                         where: { id: orderId },
                         select: { client: { select: { id: true, name: true } } }
                     });
                     await notifyReceiptUploaded({
                         clientName: orderInfo?.client?.name || 'Desconocido',
                         clientId: orderInfo?.client?.id,
                         orderId,
                         amount: expectedAmount,
                         method,
                         receiptUrl,
                         uploadedByName: uploadedByName || null,
                         auditErrors: null
                     });
                 } catch (emailErr) {
                     console.error('[ReceiptAgent] No se pudo enviar el email de comprobante:', emailErr);
                 }
             }
        }
    }
}
