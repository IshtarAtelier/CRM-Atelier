import { prisma } from '@/lib/db';
import { BillingAccount, getAfipInstance, formatAfipDate, getBillingAccountConfig } from '@/lib/afip';
import { PricingService } from '@/services/PricingService';
import fs from 'fs';
import path from 'path';

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

export interface CreateInvoiceItem {
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
}

export const BillingService = {

    /**
     * Emite una Factura C electrónica para una orden de tipo SALE.
     */
    async createInvoice(params: CreateInvoiceParams) {
        const { orderId, account = 'ISH', docTipo = 99, docNro = '0', puntoDeVenta, amount, items } = params;
 
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
 
        // 1.5 Validar doble facturación
        const totalInvoiced = order.invoices
            .filter((i) => i.status === 'COMPLETED')
            .reduce((acc, curr) => acc + curr.totalAmount, 0);
            
        const maximumInvoiceable = PricingService.calculateOrderFinancials(order as any).paidReal;

        if (totalInvoiced > 0 && (totalInvoiced + (amount || 0)) > maximumInvoiceable) {
            throw new Error(`Esta venta ya tiene un saldo facturado ($${totalInvoiced}). No podés facturar este nuevo monto porque superaría el saldo total pagado de $${maximumInvoiceable}.`);
        }

        // 2. Calcular importes e ítems
        const totalAmount = amount !== undefined ? amount : (order.total || 0);
        const UNIT_PRICE_LIMIT = 499000;
        
        const itemsToValidate = items || order.items.map(it => ({
            description: `${it.product?.brand || ''} ${it.product?.model || it.product?.name || 'Producto'}`.trim(),
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

        const voucherData: any = {
            'CantReg': 1,
            'PtoVta': ptoVta,
            'CbteTipo': VOUCHER_TYPE_FC,
            'Concepto': 1,
            'DocTipo': docTipo,
            'DocNro': docTipo === 99 ? 0 : parseInt(docNro || '0'),
            'CbteFch': formatAfipDate(),
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
            result = await afip.ElectronicBilling.createNextVoucher(voucherData);
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
                    docType: docTipo,
                    docNumber: docNro || '0',
                    billingAccount: account,
                    status: 'COMPLETED',
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
        const lastVoucher = await afip.ElectronicBilling.getLastVoucher(ptoVta, VOUCHER_TYPE_FC);
        return { lastVoucher, pointOfSale: ptoVta, voucherType: VOUCHER_TYPE_FC, account };
    },

    /**
     * Obtiene los puntos de venta disponibles en ARCA para una cuenta
     */
    async getSalesPoints(account: BillingAccount = 'ISH') {
        const afip = getAfipInstance(account);
        return await afip.ElectronicBilling.getSalesPoints();
    },

    /**
     * Verifica la conexión con ARCA para una cuenta
     */
    async checkConnection(account: BillingAccount = 'ISH') {
        try {
            const afip = getAfipInstance(account);
            const serverStatus = await afip.ElectronicBilling.getServerStatus();
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
                        items: { include: { product: true } }
                    }
                } 
            },
        });
        if (!invoice) throw new Error('Factura no encontrada');

        if (invoice.pdfUrl) return invoice.pdfUrl;

        try {
            const afip = getAfipInstance(invoice.billingAccount as BillingAccount);
            
            // Consultar la data REAL autorizada en ARCA para evitar discrepancias de fechas
            const voucherInfo = await afip.ElectronicBilling.getVoucherInfo(
                invoice.voucherNumber, 
                invoice.pointOfSale, 
                invoice.voucherType
            );

            if (!voucherInfo) {
                throw new Error("El comprobante no figura en los servidores de AFIP.");
            }

            // Preparar datos del PDF incluyendo logo
            const pdfData: any = {
                CbteTipo: invoice.voucherType,
                PtoVta: invoice.pointOfSale,
                CbteNro: invoice.voucherNumber,
                CbteFch: voucherInfo.CbteFch, // USAR FECHA REAL DE ARCA
                ImpTotal: invoice.totalAmount,
                CAE: invoice.cae,
                CAEFchVto: invoice.caeExpiration.replace(/-/g, ''),
                DocTipo: invoice.docType,
                DocNro: invoice.docNumber,
                condicion_venta: 'Otra',
                forma_de_pago: 'Otra',
                items: invoice.totalAmount === invoice.order.total
                    ? invoice.order.items.map((item: any) => ({
                        description: `${item.product?.brand || ''} ${item.product?.model || item.product?.name || ''}`.trim(),
                        quantity: item.quantity,
                        unit_price: item.price,
                        total: item.price * item.quantity,
                    }))
                    : [{
                        description: `Productos Ópticos / Venta (Pago Parcial Pedido #${invoice.order.id.slice(-4).toUpperCase()})`,
                        quantity: 1,
                        unit_price: invoice.totalAmount,
                        total: invoice.totalAmount,
                    }],
            };

            // Agregar logo si está disponible
            const logo = getLogoBase64();
            if (logo) {
                pdfData.logo = logo;
            }

            console.log('[PDF] Enviando datos a createPDF:', JSON.stringify({ ...pdfData, logo: pdfData.logo ? '(base64 omitido)' : 'sin logo' }));
            const pdfInfo = await afip.ElectronicBilling.createPDF(pdfData);

            // Log detallado para diagnosticar qué retorna el SDK
            console.log('[PDF] Respuesta del SDK createPDF:', JSON.stringify({
                keys: pdfInfo ? Object.keys(pdfInfo) : 'null',
                file_type: typeof pdfInfo?.file,
                file_preview: typeof pdfInfo?.file === 'string' ? pdfInfo.file.substring(0, 200) : 'N/A',
                file_name: pdfInfo?.file_name,
                url: pdfInfo?.url,
            }));

            // El SDK retorna { file, file_name }
            // 'file' puede ser una URL de descarga o contenido base64 del PDF
            let pdfUrl: string | null = null;

            if (pdfInfo?.file) {
                if (pdfInfo.file.startsWith('http')) {
                    // Es una URL directa
                    pdfUrl = pdfInfo.file;
                } else {
                    // Es contenido base64 — crear un data URI
                    pdfUrl = `data:application/pdf;base64,${pdfInfo.file}`;
                }
            } else if (pdfInfo?.url) {
                pdfUrl = pdfInfo.url;
            }

            if (pdfUrl && !pdfUrl.startsWith('data:')) {
                // Solo guardamos URLs externas, no data URIs (son muy grandes)
                await prisma.invoice.update({
                    where: { id: invoiceId },
                    data: { pdfUrl },
                });
            }

            return pdfUrl;
        } catch (error: any) {
            console.error('Error generando PDF de factura:', error);
            throw new Error(`Error generando PDF: ${error.message}`);
        }
    },
};
