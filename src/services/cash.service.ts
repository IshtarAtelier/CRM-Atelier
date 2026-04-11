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
        // 1. Calcular el total de pagos en efectivo directamente en la DB (O(1) Memory)
        const paymentsAgg = await prisma.payment.aggregate({
            _sum: { amount: true },
            where: { 
                method: { in: ['EFECTIVO', 'CASH'] },
                order: { isDeleted: false }
            }
        });
        const paymentsTotal = paymentsAgg._sum.amount || 0;

        // 2. Calcular los totales de movimientos manuales de caja (IN / OUT)
        const manualInAgg = await (prisma as any).cashMovement.aggregate({
            _sum: { amount: true },
            where: { type: 'IN' }
        });
        const manualIn = manualInAgg._sum.amount || 0;

        const manualOutAgg = await (prisma as any).cashMovement.aggregate({
            _sum: { amount: true },
            where: { type: 'OUT' }
        });
        const manualOut = manualOutAgg._sum.amount || 0;

        const manualBalance = manualIn - manualOut;
        const totalCash = paymentsTotal + manualBalance;

        // 3. Cargar SÓLO los 50 movimientos más recientes para la Línea de Tiempo del Frontend
        const recentPayments = await prisma.payment.findMany({
            where: { 
                method: { in: ['EFECTIVO', 'CASH'] },
                order: { isDeleted: false }
            },
            include: { order: { include: { client: true, user: true } } },
            orderBy: { date: 'desc' },
            take: 50
        });

        const recentMovements = await (prisma as any).cashMovement.findMany({
            include: { user: true },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        // Convertir pagos a formato de movimiento
        const formattedPayments = recentPayments.map((p: any) => ({
            id: p.id,
            type: 'IN',
            amount: p.amount || 0,
            reason: `Cobro Venta - ${p.order?.client?.name || 'Cliente'}`,
            category: 'VENTA',
            createdAt: p.date, 
            user: { name: p.order?.user?.name || 'Vendedor' },
            receiptUrl: p.receiptUrl
        }));

        // Combinar top 50 de ambas fuentes, ordenar final y devolver
        const allMovements = [...recentMovements, ...formattedPayments].sort((a: any, b: any) => {
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
