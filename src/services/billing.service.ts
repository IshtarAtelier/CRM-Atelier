import { prisma } from '@/lib/db';
import { getAfipInstance, formatAfipDate } from '@/lib/afip';

// Tipos de comprobante — Monotributista siempre emite Factura C
const VOUCHER_TYPE_FC = 11;    // Factura C
const VOUCHER_TYPE_NCC = 13;   // Nota de Crédito C

export interface CreateInvoiceParams {
    orderId: string;
    docTipo?: number;     // 80=CUIT, 96=DNI, 99=Sin identificar (default)
    docNro?: string;      // Número de documento del receptor
    puntoDeVenta?: number; // Punto de venta (default: env AFIP_PUNTO_VENTA)
}

export const BillingService = {

    /**
     * Emite una Factura C electrónica para una orden de tipo SALE.
     */
    async createInvoice(params: CreateInvoiceParams) {
        const { orderId, docTipo = 99, docNro = '0', puntoDeVenta } = params;

        // 1. Validar orden
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
                client: true,
                items: { include: { product: true } },
                invoices: true,
            },
        });

        if (!order) throw new Error('Orden no encontrada');
        if (order.orderType !== 'SALE') throw new Error('Solo se pueden facturar ventas confirmadas (SALE)');
        if (order.isDeleted) throw new Error('No se puede facturar una orden eliminada');

        // Verificar si ya tiene factura vigente
        const existingInvoice = order.invoices?.find((inv: any) => inv.status === 'COMPLETED');
        if (existingInvoice) {
            throw new Error(`Esta venta ya tiene una factura emitida: FC ${existingInvoice.pointOfSale.toString().padStart(4, '0')}-${existingInvoice.voucherNumber.toString().padStart(8, '0')} (CAE: ${existingInvoice.cae})`);
        }

        // 2. Calcular importes
        // Monotributista: todo va como ImpTotal, no discrimina IVA
        const totalAmount = order.total || 0;

        // 3. Preparar datos para ARCA
        const ptoVta = puntoDeVenta || parseInt(process.env.AFIP_PUNTO_VENTA || '1');
        const afip = getAfipInstance();

        const voucherData: any = {
            'CantReg': 1,
            'PtoVta': ptoVta,
            'CbteTipo': VOUCHER_TYPE_FC,
            'Concepto': 1,  // Productos
            'DocTipo': docTipo,
            'DocNro': docTipo === 99 ? 0 : parseInt(docNro || '0'),
            'CbteFch': formatAfipDate(),
            'ImpTotal': totalAmount,
            'ImpTotConc': 0,       // No gravado
            'ImpNeto': totalAmount, // En Factura C, todo es neto
            'ImpOpEx': 0,          // Exento
            'ImpIVA': 0,           // Monotributista no discrimina IVA
            'ImpTrib': 0,          // Sin tributos
            'MonId': 'PES',
            'MonCotiz': 1,
        };

        // 4. Crear comprobante en ARCA (auto-numera)
        const result = await afip.ElectronicBilling.createNextVoucher(voucherData);

        // result = { CAE, CAEFchVto, voucher_number }
        if (!result || !result.CAE) {
            throw new Error('ARCA no devolvió un CAE válido. Verificar la configuración.');
        }

        // 5. Guardar en la DB
        const invoice = await prisma.invoice.create({
            data: {
                orderId,
                cae: result.CAE,
                caeExpiration: result.CAEFchVto,
                voucherNumber: result.voucher_number,
                voucherType: VOUCHER_TYPE_FC,
                pointOfSale: ptoVta,
                concept: 1,
                totalAmount,
                docType: docTipo,
                docNumber: docNro || '0',
                status: 'COMPLETED',
            },
        });

        // 6. Registrar en historial del contacto
        const voucherLabel = `FC ${ptoVta.toString().padStart(4, '0')}-${result.voucher_number.toString().padStart(8, '0')}`;
        await prisma.interaction.create({
            data: {
                clientId: order.clientId,
                type: 'INVOICE',
                content: `🧾 Factura ${voucherLabel} emitida por $${totalAmount.toLocaleString('es-AR')} — CAE: ${result.CAE}`,
            },
        });

        return {
            ...invoice,
            voucherLabel,
        };
    },

    /**
     * Obtiene una factura por ID
     */
    async getInvoice(invoiceId: string) {
        return await prisma.invoice.findUnique({
            where: { id: invoiceId },
            include: { order: { include: { client: true, items: { include: { product: true } } } } },
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
    async getLastVoucherNumber(puntoDeVenta?: number) {
        const ptoVta = puntoDeVenta || parseInt(process.env.AFIP_PUNTO_VENTA || '1');
        const afip = getAfipInstance();
        const lastVoucher = await afip.ElectronicBilling.getLastVoucher(ptoVta, VOUCHER_TYPE_FC);
        return { lastVoucher, pointOfSale: ptoVta, voucherType: VOUCHER_TYPE_FC };
    },

    /**
     * Obtiene los puntos de venta disponibles en ARCA
     */
    async getSalesPoints() {
        const afip = getAfipInstance();
        return await afip.ElectronicBilling.getSalesPoints();
    },

    /**
     * Verifica la conexión con ARCA
     */
    async checkConnection() {
        try {
            const afip = getAfipInstance();
            const serverStatus = await afip.ElectronicBilling.getServerStatus();
            return {
                connected: true,
                status: serverStatus,
                cuit: process.env.AFIP_CUIT || '20409378472',
                hasCert: !!(process.env.AFIP_CERT && process.env.AFIP_KEY),
                hasAccessToken: !!process.env.AFIP_ACCESS_TOKEN,
            };
        } catch (error: any) {
            return {
                connected: false,
                error: error.message,
                cuit: process.env.AFIP_CUIT || '20409378472',
                hasCert: !!(process.env.AFIP_CERT && process.env.AFIP_KEY),
                hasAccessToken: !!process.env.AFIP_ACCESS_TOKEN,
            };
        }
    },

    /**
     * Genera la URL de descarga del PDF de una factura usando Afip SDK templates
     */
    async getInvoicePdfUrl(invoiceId: string) {
        const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId },
            include: { order: { include: { client: true, items: { include: { product: true } } } } },
        });
        if (!invoice) throw new Error('Factura no encontrada');

        // Si ya tenemos la URL guardada, retornarla
        if (invoice.pdfUrl) return invoice.pdfUrl;

        // Generar PDF via Afip SDK
        try {
            const afip = getAfipInstance();
            const pdfInfo = await afip.ElectronicBilling.createPDF({
                // Datos del comprobante
                CbteTipo: invoice.voucherType,
                PtoVta: invoice.pointOfSale,
                CbteNro: invoice.voucherNumber,
                CbteFch: invoice.createdAt.toISOString().split('T')[0].replace(/-/g, ''),
                ImpTotal: invoice.totalAmount,
                CAE: invoice.cae,
                CAEFchVto: invoice.caeExpiration.replace(/-/g, ''),
                // Receptor
                DocTipo: invoice.docType,
                DocNro: invoice.docNumber,
                // Items  
                items: invoice.order.items.map((item: any) => ({
                    description: `${item.product?.brand || ''} ${item.product?.model || item.product?.name || ''}`.trim(),
                    quantity: item.quantity,
                    unitPrice: item.price,
                    total: item.price * item.quantity,
                })),
            });

            // Guardar la URL para futuros accesos
            if (pdfInfo?.url) {
                await prisma.invoice.update({
                    where: { id: invoiceId },
                    data: { pdfUrl: pdfInfo.url },
                });
            }

            return pdfInfo?.url || null;
        } catch (error: any) {
            console.error('Error generando PDF de factura:', error);
            return null;
        }
    },
};
