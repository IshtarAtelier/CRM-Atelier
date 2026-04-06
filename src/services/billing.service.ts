import { prisma } from '@/lib/db';
import { BillingAccount, getAfipInstance, formatAfipDate, getBillingAccountConfig } from '@/lib/afip';

// Tipos de comprobante — Monotributista siempre emite Factura C
const VOUCHER_TYPE_FC = 11;    // Factura C
const VOUCHER_TYPE_NCC = 13;   // Nota de Crédito C

export interface CreateInvoiceParams {
    orderId: string;
    account: BillingAccount;
    docTipo?: number;     // 80=CUIT, 96=DNI, 99=Sin identificar (default)
    docNro?: string;      // Número de documento del receptor
    puntoDeVenta?: number; // Punto de venta (default: config de la cuenta)
}

export const BillingService = {

    /**
     * Emite una Factura C electrónica para una orden de tipo SALE.
     */
    async createInvoice(params: CreateInvoiceParams) {
        const { orderId, account = 'ISH', docTipo = 99, docNro = '0', puntoDeVenta } = params;

        // 1. Validar orden
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            select: {
                id: true,
                total: true,
                orderType: true,
                isDeleted: true,
                clientId: true,
                subtotalWithMarkup: true,
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

        // 2. Calcular importes e ítems para validación
        const totalAmount = order.total || 0;
        
        // El límite de Monotributo para bienes muebles es de $499.000 por ítem 
        // para evitar la exclusión al Régimen General.
        const UNIT_PRICE_LIMIT = 499000;
        const expensiveItem = order.items.find(item => item.price > UNIT_PRICE_LIMIT);
        
        if (expensiveItem) {
            const itemName = `${expensiveItem.product?.brand || ''} ${expensiveItem.product?.model || expensiveItem.product?.name || 'Producto'}`.trim();
            throw new Error(`No se puede facturar: El ítem "${itemName}" tiene un precio de $${expensiveItem.price.toLocaleString('es-AR')}, lo cual supera el límite de Monotributo ($${UNIT_PRICE_LIMIT.toLocaleString('es-AR')}).`);
        }

        // 3. Preparar datos para ARCA
        const accountConfig = getBillingAccountConfig(account);
        const ptoVta = puntoDeVenta || accountConfig.puntoDeVenta;
        const afip = getAfipInstance(account);

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
                billingAccount: account,
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
                    select: {
                        id: true,
                        items: { include: { product: true } }
                    }
                } 
            },
        });
        if (!invoice) throw new Error('Factura no encontrada');

        // Si ya tenemos la URL guardada, retornarla
        if (invoice.pdfUrl) return invoice.pdfUrl;

        // Generar PDF via Afip SDK
        try {
            const afip = getAfipInstance(invoice.billingAccount as BillingAccount);
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
                    description: `${item.product?.brand || ''} ${item.product?.model || item.product?.name || ''} ${item.eye ? '(' + item.eye + ')' : ''}`.trim(),
                    quantity: item.quantity,
                    unit_price: item.price,
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
