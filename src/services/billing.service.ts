import { prisma } from '@/lib/db';
import { BillingAccount, getAfipInstance, formatAfipDate, getBillingAccountConfig } from '@/lib/afip';
import { PricingService } from '@/services/PricingService';
import { uploadFile, getSignedUrl } from '@/lib/storage';
import fs from 'fs';
import path from 'path';
import { retryWithBackoff, isTransientNetworkError } from '@/lib/retry-utils';

// Logo en base64 para incluir en los PDFs de factura
let logoBase64Cache: string | null = null;
function getLogoBase64(): string | null {
    if (logoBase64Cache) return logoBase64Cache;
    try {
        const logoPath = path.join(process.cwd(), 'public', 'assets', 'logo-atelier-optica.png');
        const logoBuffer = fs.readFileSync(logoPath);
        logoBase64Cache = logoBuffer.toString('base64');
        return logoBase64Cache;
    } catch (err) {
        console.error('[LOGO] No se pudo leer el logo:', err);
        return null;
    }
}

// Tipos de comprobante — Monotributista siempre emite Factura C
const VOUCHER_TYPE_FC = 11;    // Factura C
const VOUCHER_TYPE_NCC = 13;   // Nota de Crédito C

// Custom predicate to determine retryability for AFIP operations
function shouldRetryAfip(error: any): boolean {
    const errMsg = String(error.message || '').toLowerCase();
    const isConfigOrAuthError = 
        errMsg.includes('could not authenticate') ||
        errMsg.includes('punto de venta') ||
        errMsg.includes('cuit') ||
        errMsg.includes('invalid');
    
    return !isConfigOrAuthError && isTransientNetworkError(error);
}

interface CreateInvoiceItem {
    description: string;
    quantity: number;
    price: number;
}

export interface CreateInvoiceParams {
    orderId: string;
    account: BillingAccount;
    docTipo?: number;     // 80=CUIT, 96=DNI, 99=Sin identificar (default)
    docNro?: string;      // Número de documento del receptor
    puntoDeVenta?: number; // Punto de venta (default: config de la cuenta)
    amount?: number;       // Nuevo: monto exacto enviado desde el frontend
    items?: CreateInvoiceItem[]; // Nuevo: ítems ya validados (ej: divididos por el tope de 500k)
    issueDate?: string;    // Nuevo: Fecha de emisión de la factura (YYYY-MM-DD)
    observations?: string; // Nuevo: Observaciones opcionales
}

export const BillingService = {

    /**
     * Emite una Factura C electrónica para una orden de tipo SALE.
     */
    async createInvoice(params: CreateInvoiceParams) {
        const { orderId, account = 'ISH', docTipo = 99, docNro = '0', puntoDeVenta, amount, items, issueDate, observations } = params;
 
        // 1. Validar orden
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { 
                items: { include: { product: true } },
                invoices: true,
                client: true
            },
        });
 
        if (!order) throw new Error('No se encontró la orden especificada.');
        if (order.orderType !== 'SALE') throw new Error('Solo se pueden facturar ventas confirmadas.');
        if (order.isDeleted) throw new Error('La orden ha sido eliminada y no puede facturarse.');
 
        // Clean DNI/CUIT non-digits before determining document type or parsing
        const cleanDocNro = (docNro || '0').replace(/\D/g, '') || '0';
        let finalDocTipo = docTipo;
        if (cleanDocNro === '0') {
            finalDocTipo = 99;
        } else if (docTipo === 99) {
            if (cleanDocNro.length === 11) {
                finalDocTipo = 80;
            } else {
                finalDocTipo = 96;
            }
        }

        // 1.5 Validar doble facturación
        const totalInvoiced = order.invoices
            .filter((i) => i.status === 'COMPLETED')
            .reduce((acc, curr) => acc + curr.totalAmount, 0);
            
        const maximumInvoiceable = PricingService.calculateOrderFinancials(order as any).paidReal;

        // 2. Calcular importes e ítems
        const totalAmount = amount !== undefined ? amount : (order.total || 0);

        // 1.5 Validar doble facturación (ahora con totalAmount real y redondeado a 2 decimales)
        const roundedTotalToInvoice = Math.round((totalInvoiced + totalAmount) * 100) / 100;
        const roundedMaximum = Math.round(maximumInvoiceable * 100) / 100;
        if (roundedTotalToInvoice > roundedMaximum) {
            throw new Error(`No podés facturar este monto ($${totalAmount}) porque el total facturado ($${totalInvoiced + totalAmount}) superaría el saldo total pagado de $${maximumInvoiceable}.`);
        }
        const UNIT_PRICE_LIMIT = 499000;
        
        const itemsToValidate = items || order.items.map(it => ({
            description: `${it.product?.brand || it.productBrandSnapshot || ''} ${it.product?.name || it.productNameSnapshot || 'Producto'}`.trim(),
            price: it.price
        }));

        const expensiveItem = itemsToValidate.find(item => item.price > UNIT_PRICE_LIMIT);
        if (expensiveItem) {
            throw new Error(`Ítem "${expensiveItem.description}" excede el límite de Monotributo ($${UNIT_PRICE_LIMIT.toLocaleString('es-AR')}).`);
        }

        // 3. Preparar datos para ARCA
        const accountConfig = getBillingAccountConfig(account);
        const ptoVta = puntoDeVenta || accountConfig.puntoDeVenta;
        const afip = getAfipInstance(account);

        let cbteFch = formatAfipDate();
        if (issueDate) {
            cbteFch = parseInt(issueDate.replace(/-/g, ''));
        }

        const voucherData: any = {
            'CantReg': 1,
            'PtoVta': ptoVta,
            'CbteTipo': VOUCHER_TYPE_FC,
            'Concepto': 1,
            'DocTipo': finalDocTipo,
            'DocNro': finalDocTipo === 99 ? 0 : parseInt(cleanDocNro || '0'),
            'CbteFch': cbteFch,
            'ImpTotal': totalAmount,
            'ImpTotConc': 0,
            'ImpNeto': totalAmount,
            'ImpOpEx': 0,
            'ImpIVA': 0,
            'ImpTrib': 0,
            'MonId': 'PES',
            'MonCotiz': 1,
        };

        // 4. Crear comprobante en ARCA
        let result;
        try {
            // Get the last voucher number from AFIP
            const lastVoucherNumber = await retryWithBackoff<number>(
                () => afip.ElectronicBilling.getLastVoucher(ptoVta, VOUCHER_TYPE_FC),
                { label: 'AFIP getLastVoucher', shouldRetry: shouldRetryAfip }
            );
            
            // Check if we already have this voucher in our DB
            const existingInvoiceInDb = await prisma.invoice.findFirst({
                where: {
                    pointOfSale: ptoVta,
                    voucherType: VOUCHER_TYPE_FC,
                    voucherNumber: lastVoucherNumber,
                    billingAccount: account,
                    status: 'COMPLETED'
                }
            });

            let recoveredFromAfip = false;

            const isAnonymous = finalDocTipo === 99 || cleanDocNro === '0' || !cleanDocNro;
            if (!existingInvoiceInDb && lastVoucherNumber > 0 && !isAnonymous) {
                // If it is NOT in our DB, query AFIP to see if it matches our request details
                try {
                    const voucherInfo = await retryWithBackoff<any>(
                        () => afip.ElectronicBilling.getVoucherInfo(lastVoucherNumber, ptoVta, VOUCHER_TYPE_FC),
                        { label: 'AFIP getVoucherInfo', shouldRetry: shouldRetryAfip }
                    );
                    if (
                        voucherInfo &&
                        voucherInfo.ImpTotal === totalAmount &&
                        Number(voucherInfo.DocNro) === (voucherData.DocNro || 0) &&
                        Number(voucherInfo.DocTipo) === (voucherData.DocTipo || 0)
                    ) {
                        console.log(`[AFIP RECOVERY] Found previously authorized voucher ${lastVoucherNumber} matching this request. Recovering...`);
                        result = {
                            CAE: voucherInfo.CodAutorizacion,
                            CAEFchVto: voucherInfo.FchVto,
                            voucherNumber: lastVoucherNumber
                        };
                        recoveredFromAfip = true;
                    }
                } catch (infoErr) {
                    console.warn(`[AFIP RECOVERY] Failed to query voucher info for ${lastVoucherNumber}:`, infoErr);
                }
            }

            if (!recoveredFromAfip) {
                // Emit normally if not recovered
                result = await retryWithBackoff<any>(
                    () => afip.ElectronicBilling.createNextVoucher(voucherData),
                    { label: 'AFIP createNextVoucher', shouldRetry: shouldRetryAfip }
                );
            }
        } catch (error: any) {
            console.error('[ARCA ERROR]', error);
            const errorPayload = error.data || error.response?.data || error;
            const msg = (errorPayload.message || errorPayload.error || (typeof errorPayload === 'string' ? errorPayload : JSON.stringify(errorPayload))) || error.message || '';
            if (msg.includes('Could not authenticate')) throw new Error('Error de Autenticación con ARCA (verificá Certificado y Key).');
            if (msg.includes('Punto de Venta')) throw new Error(`El Punto de Venta (${ptoVta}) no está habilitado o no existe para esta cuenta en ARCA.`);
            throw new Error(`Detalle de ARCA: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
        }

        if (!result || !result.CAE) {
            throw new Error('ARCA no devolvió un código CAE. Verificá la configuración de la cuenta.');
        }

        // 5. Guardar en la DB (Transacción Atómica)
        return await prisma.$transaction(async (tx) => {
            const invoice = await tx.invoice.create({
                data: {
                    orderId,
                    cae: result.CAE,
                    caeExpiration: result.CAEFchVto,
                    voucherNumber: result.voucherNumber,
                    voucherType: VOUCHER_TYPE_FC,
                    pointOfSale: ptoVta,
                    concept: 1,
                    totalAmount,
                    docType: finalDocTipo,
                    docNumber: cleanDocNro,
                    billingAccount: account,
                    status: 'COMPLETED',
                    observations: observations || null,
                },
            });

            const voucherLabel = `FC ${ptoVta.toString().padStart(4, '0')}-${result.voucherNumber.toString().padStart(8, '0')}`;
            await tx.interaction.create({
                data: {
                    clientId: order.clientId,
                    type: 'INVOICE',
                    content: `🧾 Factura ${voucherLabel} emitida por $${totalAmount.toLocaleString('es-AR')} — CAE: ${result.CAE}`,
                },
            });

            return { ...invoice, voucherLabel };
        });
    },

    /**
     * Obtiene una factura por ID
     */
    async getInvoice(invoiceId: string) {
        return await prisma.invoice.findUnique({
            where: { id: invoiceId },
            include: { 
                order: { 
                    select: {
                        id: true,
                        total: true, // Needed for PDF and info
                        client: true,
                        items: { include: { product: true } }
                    }
                } 
            },
        });
    },

    /**
     * Obtiene las facturas de una orden
     */
    async getInvoicesByOrder(orderId: string) {
        return await prisma.invoice.findMany({
            where: { orderId },
            orderBy: { createdAt: 'desc' },
        });
    },

    /**
     * Obtiene el último número de comprobante para un punto de venta
     */
    async getLastVoucherNumber(account: BillingAccount = 'ISH', puntoDeVenta?: number) {
        const accountConfig = getBillingAccountConfig(account);
        const ptoVta = puntoDeVenta || accountConfig.puntoDeVenta;
        const afip = getAfipInstance(account);
        const lastVoucher = await retryWithBackoff<number>(
            () => afip.ElectronicBilling.getLastVoucher(ptoVta, VOUCHER_TYPE_FC),
            { label: 'AFIP getLastVoucher', shouldRetry: shouldRetryAfip }
        );
        return { lastVoucher, pointOfSale: ptoVta, voucherType: VOUCHER_TYPE_FC, account };
    },

    /**
     * Obtiene los puntos de venta disponibles en ARCA para una cuenta
     */
    async getSalesPoints(account: BillingAccount = 'ISH') {
        const afip = getAfipInstance(account);
        return await retryWithBackoff<any>(
            () => afip.ElectronicBilling.getSalesPoints(),
            { label: 'AFIP getSalesPoints', shouldRetry: shouldRetryAfip }
        );
    },

    /**
     * Verifica la conexión con ARCA para una cuenta
     */
    async checkConnection(account: BillingAccount = 'ISH') {
        try {
            const afip = getAfipInstance(account);
            const serverStatus = await retryWithBackoff<any>(
                () => afip.ElectronicBilling.getServerStatus(),
                { label: 'AFIP getServerStatus', shouldRetry: shouldRetryAfip }
            );
            const accountConfig = getBillingAccountConfig(account);
            return {
                connected: true,
                status: serverStatus,
                account,
                cuit: accountConfig.cuit,
                label: accountConfig.label,
                hasCert: true, // Si llegamos aquí tiene lo necesario
            };
        } catch (error: any) {
            return {
                connected: false,
                error: error.message,
                account,
            };
        }
    },

    /**
     * Genera la URL de descarga del PDF de una factura usando Afip SDK templates
     */
    async getInvoicePdfUrl(invoiceId: string) {
        const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId },
            include: { 
                order: { 
                    include: {
                        items: { include: { product: true } },
                        client: true
                    }
                } 
            },
        });
        if (!invoice) throw new Error('Factura no encontrada');

        if (invoice.pdfUrl) {
            return await getSignedUrl(invoice.pdfUrl);
        }

        try {
            const afip = getAfipInstance(invoice.billingAccount as BillingAccount);
            const accountConfig = getBillingAccountConfig(invoice.billingAccount as BillingAccount);
            
            // Consultar la data REAL autorizada en ARCA para evitar discrepancias de fechas
            const voucherInfo = await retryWithBackoff<any>(
                () => afip.ElectronicBilling.getVoucherInfo(
                    invoice.voucherNumber, 
                    invoice.pointOfSale, 
                    invoice.voucherType
                ),
                { label: 'AFIP getVoucherInfo', shouldRetry: shouldRetryAfip }
            );

            if (!voucherInfo) {
                throw new Error("El comprobante no figura en los servidores de AFIP.");
            }

            // Formatear fecha de ARCA (yyyymmdd) a dd/mm/yyyy
            const cbteFch = String(voucherInfo.CbteFch);
            const formattedIssueDate = `${cbteFch.slice(6,8)}/${cbteFch.slice(4,6)}/${cbteFch.slice(0,4)}`;
            
            const caeVto = invoice.caeExpiration.replace(/-/g, '');
            const formattedCaeDate = `${caeVto.slice(6,8)}/${caeVto.slice(4,6)}/${caeVto.slice(0,4)}`;

            // Preparar ítems para el PDF
            const pdfItems = invoice.totalAmount === invoice.order.total
                ? invoice.order.items.map((item: any) => ({
                    description: `${item.product?.brand || item.productBrandSnapshot || ''} ${item.product?.name || item.productNameSnapshot || ''}`.trim(),
                    quantity: item.quantity,
                    unit_price: item.price,
                    subtotal: item.price * item.quantity,
                }))
                : [{
                    description: `Productos \u00d3pticos — Venta #${invoice.order.id.slice(-4).toUpperCase()}`,
                    quantity: 1,
                    unit_price: invoice.totalAmount,
                    subtotal: invoice.totalAmount,
                }];

            // Logo en base64
            const logo = getLogoBase64();

            // Formato correcto del SDK (docs: afipsdk.com/docs/pdfs/invoice-c/nodejs)
            const pdfData: any = {
                file_name: `FC-${invoice.pointOfSale.toString().padStart(4,'0')}-${invoice.voucherNumber.toString().padStart(8,'0')}.pdf`,
                template: {
                    name: 'invoice-c',
                    params: {
                        // Datos del comprobante
                        voucher_number: invoice.voucherNumber,
                        sales_point: invoice.pointOfSale,
                        issue_date: formattedIssueDate,
                        cae: invoice.cae,
                        cae_due_date: formattedCaeDate,
                        concept: 1,
                        // Datos del emisor
                        issuer_cuit: accountConfig.cuit,
                        issuer_business_name: accountConfig.label,
                        issuer_address: accountConfig.address,
                        issuer_iva_condition: 'Monotributista',
                        issuer_activity_start_date: accountConfig.activityStart,
                        // Datos del receptor
                        receiver_name: invoice.order.client?.name || 'Consumidor Final',
                        receiver_address: '-',
                        receiver_document_type: invoice.docType,
                        receiver_document_number: invoice.docNumber === '0' ? 0 : Number(invoice.docNumber) || 0,
                        receiver_iva_condition: 'Consumidor Final',
                        // Condiciones
                        sale_condition: 'Otro',
                        currency_id: 'ARS',
                        currency_rate: 1,
                        // \u00cdtems y total
                        items: pdfItems,
                        // Montos (Monotributista Factura C: IVA no discriminado)
                        vat_amount: 0,
                        tributes_amount: 0,
                        total_amount: invoice.totalAmount,
                        net_amount_taxed: 0,
                        net_amount_untaxed: 0,
                        exempt_amount: invoice.totalAmount,
                        // Observaciones para el PDF oficial de AFIP
                        invoice_footer_note: invoice.observations || '',
                    }
                }
            };

            console.log('[PDF] Enviando datos a createPDF (template format):', JSON.stringify({
                file_name: pdfData.file_name,
                template_name: pdfData.template.name,
                params_keys: Object.keys(pdfData.template.params),
                has_logo: !!logo,
                items_count: pdfItems.length,
                total: invoice.totalAmount,
            }));

            const pdfInfo = await afip.ElectronicBilling.createPDF(pdfData);

            console.log('[PDF] Respuesta del SDK:', JSON.stringify({
                keys: pdfInfo ? Object.keys(pdfInfo) : 'null',
                file_type: typeof pdfInfo?.file,
                file_preview: typeof pdfInfo?.file === 'string' ? pdfInfo.file.substring(0, 200) : 'N/A',
                file_name: pdfInfo?.file_name,
            }));

            let key: string | null = null;
            if (pdfInfo?.file) {
                if (pdfInfo.file.startsWith('http')) {
                    key = pdfInfo.file; // already uploaded?
                } else {
                    const pdfBuffer = Buffer.from(pdfInfo.file, 'base64');
                    const filename = `invoices/FC-${invoice.pointOfSale.toString().padStart(4,'0')}-${invoice.voucherNumber.toString().padStart(8,'0')}.pdf`;
                    key = await uploadFile(pdfBuffer, filename, 'application/pdf');
                }
            }

            if (key) {
                await prisma.invoice.update({
                    where: { id: invoiceId },
                    data: { pdfUrl: key },
                });
                return await getSignedUrl(key);
            }

            return null;
        } catch (error: any) {
            console.error('Error generando PDF de factura:', error);
            
            let extraInfo = '';
            if (error.response?.data) {
                console.error('[PDF] API Error de Validación:', JSON.stringify(error.response.data, null, 2));
                extraInfo = ` - Detalle: ${JSON.stringify(error.response.data)}`;
            } else if (error.cause) {
                extraInfo = ` - Causa: ${error.cause}`;
            }

            throw new Error(`Error generando PDF: ${error.message}${extraInfo}`);
        }
    },
    /**
     * Obtiene el total facturado exacto del mes actual agrupado por cuenta.
     * Esto asegura precisión literal sin depender de límites de paginación del frontend.
     */
    async getMonthlyStats() {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        
        const stats = await prisma.invoice.groupBy({
            by: ['billingAccount'],
            where: {
                status: 'COMPLETED',
                createdAt: { gte: startOfMonth }
            },
            _sum: {
                totalAmount: true
            },
            _count: {
                id: true
            }
        });

        const result = {
            ISH: { count: 0, total: 0 },
            YANI: { count: 0, total: 0 }
        };

        stats.forEach(s => {
            const account = s.billingAccount as 'ISH' | 'YANI';
            if (result[account]) {
                result[account].count = s._count.id;
                result[account].total = s._sum.totalAmount || 0;
            }
        });

        return result;
    }
};
