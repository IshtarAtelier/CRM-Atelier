import { prisma } from '@/lib/db';
import nodemailer from 'nodemailer';

const ADMIN_EMAIL = 'pisano.ishtar@gmail.com';
const CASH_ALERT_THRESHOLD = 300000;

export const CashService = {
    /**
     * Calcula el saldo total en efectivo.
     * Saldo = (Pagos en Efectivo) + (Entradas manuales) - (Salidas manuales)
     */
    async getCashBalance() {
        // 1. Obtener todos los pagos válidos en EFECTIVO (ventas y señas de presupuestos no borrados)
        const cashPayments = await prisma.payment.findMany({
            where: { 
                method: { in: ['EFECTIVO', 'CASH'] },
                order: {
                    isDeleted: false
                }
            },
            include: {
                order: {
                    include: { client: true, user: true }
                }
            }
        });

        const paymentsTotal = cashPayments.reduce((acc, p) => acc + (p.amount || 0), 0);

        // 2. Obtener movimientos manuales de caja con el usuario
        const movementsList = await (prisma as any).cashMovement.findMany({
            include: { user: true }
        });
        
        let manualIn = 0;
        let manualOut = 0;
        movementsList.forEach((mov: any) => {
            if (mov.type === 'IN') manualIn += mov.amount;
            if (mov.type === 'OUT') manualOut += mov.amount;
        });
        const manualBalance = manualIn - manualOut;

        const totalCash = paymentsTotal + manualBalance;

        // 3. Convertir pagos a formato de movimiento para el historial
        const formattedPayments = cashPayments.map((p) => ({
            id: p.id,
            type: 'IN',
            amount: p.amount || 0,
            reason: `Cobro Venta - ${p.order?.client?.name || 'Cliente'}`,
            category: 'VENTA',
            createdAt: p.date, 
            user: { name: p.order?.user?.name || 'Vendedor' },
            receiptUrl: p.receiptUrl
        }));

        // 4. Combinar, ordenar por fecha descendente y limitar a los últimos 50
        const allMovements = [...movementsList, ...formattedPayments].sort((a: any, b: any) => {
            return new Date(b.createdAt || new Date()).getTime() - new Date(a.createdAt || new Date()).getTime();
        }).slice(0, 50);

        return {
            total: totalCash,
            paymentsTotal: paymentsTotal,
            manualBalance: manualBalance,
            manualIn: manualIn,
            manualOut: manualOut,
            movements: allMovements,
        };
    },

    /**
     * Registra un nuevo movimiento de caja (entrada o salida).
     */
    async registerMovement(params: { type: 'IN' | 'OUT', amount: number, reason: string, userId: string, receiptUrl?: string, category?: string, laboratory?: string }) {
        const { type, amount, reason, userId, receiptUrl, category, laboratory } = params;

        const movement = await (prisma as any).cashMovement.create({
            data: { type, amount, reason, userId, receiptUrl, category: category || 'OTRO', laboratory },
            include: { user: true }
        });

        // Notificar por email si es una salida
        if (type === 'OUT') {
            const labLine = laboratory ? `\nLaboratorio: ${laboratory}` : '';
            const catLabel = category === 'PAGO_LABORATORIO' ? 'Pago Laboratorio' : category === 'GASTO_GENERAL' ? 'Gasto General' : 'Otro';
            await this.sendEmail(
                '🚨 Salida de Efectivo Registrada',
                `Se ha registrado una salida de efectivo:\n\n` +
                `Monto: $${amount.toLocaleString('es-AR')}\n` +
                `Categoría: ${catLabel}\n` +
                `Motivo: ${reason}${labLine}\n` +
                `Registrado por: ${movement.user.name}\n` +
                `Fecha: ${movement.createdAt.toLocaleString('es-AR')}`
            );

            // También registrar en notificaciones de la DB
            await prisma.notification.create({
                data: {
                    type: 'CASH_OUTFLOW',
                    message: `Salida de efectivo: $${amount.toLocaleString('es-AR')} - ${reason}${laboratory ? ` (${laboratory})` : ''}`,
                    requestedBy: movement.user.name,
                    status: 'COMPLETED'
                }
            });
        }

        // Verificar umbral de 300.000 para alerta
        await this.checkBalanceAndAlert();

        return movement;
    },

    /**
     * Verifica el saldo actual y envía una alerta si supera el umbral.
     */
    async checkBalanceAndAlert() {
        const balance = await this.getCashBalance();
        if (balance.total > CASH_ALERT_THRESHOLD) {
            await this.sendEmail(
                '⚠️ Alerta: Saldo de Caja Elevado',
                `El saldo de efectivo en caja ha superado los $${CASH_ALERT_THRESHOLD.toLocaleString('es-AR')}.\n\n` +
                `Saldo actual: $${balance.total.toLocaleString('es-AR')}\n\n` +
                `Se recomienda realizar un retiro parcial.`
            );

            // También registrar en notificaciones de la DB
            await prisma.notification.create({
                data: {
                    type: 'HIGH_CASH_BALANCE',
                    message: `Alerta: Saldo de caja elevado ($${balance.total.toLocaleString('es-AR')})`,
                    requestedBy: 'SYSTEM',
                    status: 'PENDING'
                }
            });
        }
    },

    /**
     * Envía un email usando nodemailer.
     */
    async sendEmail(subject: string, text: string) {
        try {
            // Configuración de transporte (usar variables de entorno)
            const transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST || 'smtp.gmail.com',
                port: parseInt(process.env.SMTP_PORT || '587'),
                secure: process.env.SMTP_SECURE === 'true',
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                },
            });

            await transporter.sendMail({
                from: `"Atelier Óptica" <${process.env.SMTP_USER || 'no-reply@atelieroptica.com'}>`,
                to: ADMIN_EMAIL,
                subject: subject,
                text: text,
            });

            console.log(`Email enviado con éxito: ${subject}`);
        } catch (error) {
            console.error('Error enviando email:', error);
            // No lanzamos error para no bloquear el flujo principal si falla el email
        }
    }
};
